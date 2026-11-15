// Seed de desenvolvimento (spec 14). Uso: npm run db:seed
// - drizzle-seed cria as 3 empresas e os 5 clientes; o resto é inserido de forma determinística.
// - Todos os agendamentos passam pela mesma regra de disponibilidade usada pela API (checkSlot/listFreeSlots).
// - Não cria administradores: use `npm run admin:create`.
// - Credenciais exclusivas de desenvolvimento.
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { seed } from 'drizzle-seed';
import { createDatabase, type DbOrTx } from './client.ts';
import {
  addDays,
  nowInBusinessTz,
  weekdayOf,
} from './domain/datetime.ts';
import { addDuration, listFreeSlots, type TimeInterval } from './domain/availability.ts';
import { configurePasswordPepper, hashPassword } from './password.ts';
import * as schema from './schema.ts';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== '1') {
  console.error('Seed bloqueado em produção. Defina ALLOW_SEED=1 somente se tiver certeza.');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida. Copie packages/database/.env.example para .env.');
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? 'easyService';
const CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? 'Cliente@2026';

/* ----------------------------------------------------------- dados base */

const today = nowInBusinessTz();

const SHOPS = [
  {
    name: 'Barbearia Alfa',
    description: 'Cortes clássicos e barba com toalha quente, no centro da cidade.',
    address: 'Rua das Palmeiras, 120, Centro',
    phone: '(71) 3000-0001',
  },
  {
    name: 'Salão Beleza & Cia',
    description: 'Cabelo, coloração e unhas com equipe especializada.',
    address: 'Av. Principal, 450, Pituba',
    phone: '(71) 3000-0002',
  },
  {
    name: 'Studio Navalha de Ouro',
    description: 'Barbearia moderna com pigmentação e tratamentos capilares.',
    address: 'Rua do Comércio, 77, Barra',
    phone: '(71) 3000-0003',
  },
] as const;

const CLIENTS = [
  { name: 'Lucas Almeida', email: 'lucas.cliente@marqueaqui.dev', phone: '(71) 98888-0001' },
  { name: 'Mariana Souza', email: 'mariana.cliente@marqueaqui.dev', phone: '(71) 98888-0002' },
  { name: 'Pedro Henrique', email: 'pedro.cliente@marqueaqui.dev', phone: '(71) 98888-0003' },
  { name: 'Juliana Costa', email: 'juliana.cliente@marqueaqui.dev', phone: '(71) 98888-0004' },
  { name: 'Rafael Mendes', email: 'rafael.cliente@marqueaqui.dev', phone: '(71) 98888-0005' },
] as const;

const MANAGERS = [
  { key: 'ana', name: 'Ana Gestora', email: 'ana.gestora@marqueaqui.dev', phone: '(71) 97777-0001', shops: [0, 1] },
  { key: 'bruno', name: 'Bruno Gestor', email: 'bruno.gestor@marqueaqui.dev', phone: '(71) 97777-0002', shops: [2] },
] as const;

const PROFESSIONALS = [
  { key: 'carlos', name: 'Carlos Navalha', email: 'carlos.pro@marqueaqui.dev', phone: '(71) 96666-0001' },
  { key: 'diana', name: 'Diana Tesoura', email: 'diana.pro@marqueaqui.dev', phone: '(71) 96666-0002' },
  { key: 'eduardo', name: 'Eduardo Cortes', email: 'eduardo.pro@marqueaqui.dev', phone: '(71) 96666-0003' },
  { key: 'fernanda', name: 'Fernanda Estilo', email: 'fernanda.pro@marqueaqui.dev', phone: '(71) 96666-0004' },
  { key: 'gabriel', name: 'Gabriel Barba', email: 'gabriel.pro@marqueaqui.dev', phone: '(71) 96666-0005' },
] as const;

interface ServiceDef {
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
}

const SERVICES_BY_SHOP: ServiceDef[][] = [
  [
    { name: 'Corte', description: 'Corte masculino na tesoura ou máquina.', durationMinutes: 30, priceCents: 4500 },
    { name: 'Barba', description: 'Barba modelada com toalha quente.', durationMinutes: 30, priceCents: 3500 },
    { name: 'Corte e barba', description: 'Combo completo.', durationMinutes: 60, priceCents: 7500 },
    { name: 'Sobrancelha', description: 'Design de sobrancelha.', durationMinutes: 30, priceCents: 2000 },
  ],
  [
    { name: 'Corte feminino', description: 'Corte com finalização.', durationMinutes: 60, priceCents: 9000 },
    { name: 'Escova', description: 'Escova modelada.', durationMinutes: 30, priceCents: 5000 },
    { name: 'Coloração', description: 'Coloração completa.', durationMinutes: 120, priceCents: 18000 },
    { name: 'Manicure', description: 'Mãos com esmaltação.', durationMinutes: 60, priceCents: 4500 },
  ],
  [
    { name: 'Corte', description: 'Corte masculino.', durationMinutes: 30, priceCents: 4000 },
    { name: 'Barba', description: 'Barba desenhada.', durationMinutes: 30, priceCents: 3000 },
    { name: 'Pigmentação', description: 'Pigmentação de barba ou cabelo.', durationMinutes: 60, priceCents: 6000 },
    { name: 'Hidratação', description: 'Tratamento capilar.', durationMinutes: 60, priceCents: 5500 },
  ],
];

// Um registro de profissional por empresa. Carlos atua em duas empresas.
const BARBER_LINKS = [
  { pro: 'carlos', shop: 0, services: [0, 1, 2, 3], hours: 'split' },
  { pro: 'diana', shop: 0, services: [0, 1, 2], hours: 'split' },
  { pro: 'carlos', shop: 1, services: [0, 1, 3], hours: 'tueSat' },
  { pro: 'fernanda', shop: 1, services: [0, 1, 2, 3], hours: 'tueSat' },
  { pro: 'eduardo', shop: 2, services: [0, 1, 2, 3], hours: 'full' },
  { pro: 'gabriel', shop: 2, services: [0, 1, 2], hours: 'full' },
] as const;

const WALK_INS = [
  { name: 'Cliente Balcão', phone: '(71) 95555-0001' },
  { name: 'Visitante Ricardo', phone: '(71) 95555-0002' },
  { name: 'Visitante Paula', phone: '(71) 95555-0003' },
];

/* -------------------------------------------------------------- helpers */

function lcg(initial: number): () => number {
  let s = initial >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const SERIAL_TABLES = [
  'shops',
  'users',
  'barbers',
  'services',
  'working_hours',
  'breaks',
  'appointments',
  'notifications',
  'password_reset_tokens',
] as const; // admins e audit_logs ficam de fora de propósito

async function alignSequences(db: DbOrTx): Promise<void> {
  for (const table of SERIAL_TABLES) {
    await db.execute(
      sql.raw(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), (SELECT COUNT(*) > 0 FROM ${table}))`,
      ),
    );
  }
}

function workingFor(kind: (typeof BARBER_LINKS)[number]['hours']): Array<{ weekday: number } & TimeInterval> {
  const rows: Array<{ weekday: number } & TimeInterval> = [];
  if (kind === 'full') {
    for (let d = 1; d <= 5; d++) rows.push({ weekday: d, startTime: '09:00', endTime: '18:00' });
  } else if (kind === 'split') {
    for (let d = 1; d <= 5; d++) {
      rows.push({ weekday: d, startTime: '09:00', endTime: '12:00' });
      rows.push({ weekday: d, startTime: '13:00', endTime: '18:00' });
    }
  } else {
    for (let d = 2; d <= 6; d++) {
      rows.push({ weekday: d, startTime: '10:00', endTime: '12:00' });
      rows.push({ weekday: d, startTime: '14:00', endTime: '19:00' });
    }
  }
  return rows;
}

/* ----------------------------------------------------------------- main */

const { db, close } = createDatabase(url, { max: 2 });

try {
  console.log('Limpando tabelas de dados (administradores e auditoria são preservados)...');
  await db.execute(
    sql.raw(
      'TRUNCATE TABLE sessions, password_reset_tokens, notifications, appointments, breaks, working_hours, barber_services, barbers, services, shop_managers, users, shops RESTART IDENTITY CASCADE',
    ),
  );

  console.log('Criando empresas e clientes com drizzle-seed...');
  await seed(
    db,
    { shops: schema.shops, users: schema.users },
    { seed: 20260101 },
  ).refine((f) => ({
    shops: {
      count: SHOPS.length,
      columns: {
        name: f.valuesFromArray({ values: SHOPS.map((s) => s.name), isUnique: true }),
      },
    },
    users: {
      count: CLIENTS.length,
      columns: {
        name: f.valuesFromArray({ values: CLIENTS.map((c) => c.name), isUnique: true }),
        email: f.valuesFromArray({ values: CLIENTS.map((c) => c.email), isUnique: true }),
        passwordHash: f.default({ defaultValue: 'placeholder' }),
        role: f.default({ defaultValue: 'CLIENT' }),
      },
    },
  }));

  await alignSequences(db);

  // Normaliza o que o drizzle-seed gerou de forma aleatória, para o resultado ser determinístico.
  const seededShops = await db.select({ id: schema.shops.id }).from(schema.shops).orderBy(schema.shops.id);
  const shopIds: number[] = [];
  for (const [i, row] of seededShops.entries()) {
    const def = SHOPS[i]!;
    shopIds.push(row.id);
    await db
      .update(schema.shops)
      .set({
        name: def.name,
        description: def.description,
        address: def.address,
        phone: def.phone,
        logoUrl: null,
        active: true,
        deactivatedAt: null,
      })
      .where(eq(schema.shops.id, row.id));
  }

  configurePasswordPepper(process.env.PASSWORD_PEPPER); // mesmo valor do .env dos backends, senão os logins do seed falham
  const clientHash = await hashPassword(CLIENT_PASSWORD);
  const seededClients = await db.select({ id: schema.users.id }).from(schema.users).orderBy(schema.users.id);

  // O drizzle-seed sorteia a ordem dos e-mails. Atribuir CLIENTS[i] por posição colide com
  // users_email_unique (o e-mail desejado ainda pertence a outra linha). Primeiro liberamos todos.
  for (const row of seededClients) {
    await db
      .update(schema.users)
      .set({ email: `tmp-${row.id}@seed.invalid` })
      .where(eq(schema.users.id, row.id));
  }

  const clientIds: number[] = [];
  for (const [i, row] of seededClients.entries()) {
    const def = CLIENTS[i]!;
    clientIds.push(row.id);
    await db
      .update(schema.users)
      .set({
        name: def.name,
        email: def.email,
        phone: def.phone,
        passwordHash: clientHash,
        role: 'CLIENT',
        active: true,
        mustChangePassword: false,
        photoUrl: null,
        description: null,
        lastLoginAt: new Date(),
        deactivatedAt: null,
        deactivationReason: null,
      })
      .where(eq(schema.users.id, row.id));
  }

  console.log('Criando gestores e profissionais...');
  const defaultHash = await hashPassword(DEFAULT_PASSWORD);
  const managerRows = await db
    .insert(schema.users)
    .values(
      MANAGERS.map((m) => ({
        name: m.name,
        email: m.email,
        phone: m.phone,
        passwordHash: defaultHash,
        role: 'MANAGER' as const,
        mustChangePassword: true,
        lastLoginAt: new Date(),
      })),
    )
    .returning({ id: schema.users.id, email: schema.users.email });
  const managerId = new Map(MANAGERS.map((m, i) => [m.key, managerRows[i]!.id]));

  const proRows = await db
    .insert(schema.users)
    .values(
      PROFESSIONALS.map((p) => ({
        name: p.name,
        email: p.email,
        phone: p.phone,
        passwordHash: defaultHash,
        role: 'PROFESSIONAL' as const,
        mustChangePassword: true,
        description: `${p.name}, profissional com anos de experiência.`,
        lastLoginAt: new Date(),
      })),
    )
    .returning({ id: schema.users.id });
  const proId = new Map(PROFESSIONALS.map((p, i) => [p.key, proRows[i]!.id]));

  for (const m of MANAGERS) {
    await db.insert(schema.shopManagers).values(
      m.shops.map((si) => ({ shopId: shopIds[si]!, userId: managerId.get(m.key)! })),
    );
  }

  console.log('Criando serviços, vínculos, expedientes e pausas...');
  const serviceIds: number[][] = [];
  for (const [si, list] of SERVICES_BY_SHOP.entries()) {
    const rows = await db
      .insert(schema.services)
      .values(list.map((s) => ({ ...s, shopId: shopIds[si]! })))
      .returning({ id: schema.services.id });
    serviceIds.push(rows.map((r) => r.id));
  }

  interface BarberCtx {
    id: number;
    shopIndex: number;
    serviceIdx: readonly number[];
    working: Array<{ weekday: number } & TimeInterval>;
    label: string;
  }
  const barbers: BarberCtx[] = [];
  for (const link of BARBER_LINKS) {
    const [row] = await db
      .insert(schema.barbers)
      .values({ userId: proId.get(link.pro)!, shopId: shopIds[link.shop]! })
      .returning({ id: schema.barbers.id });
    const barberId = row!.id;
    await db.insert(schema.barberServices).values(
      link.services.map((idx) => ({ barberId, serviceId: serviceIds[link.shop]![idx]! })),
    );
    const working = workingFor(link.hours);
    await db.insert(schema.workingHours).values(working.map((w) => ({ barberId, ...w })));
    barbers.push({
      id: barberId,
      shopIndex: link.shop,
      serviceIdx: link.services,
      working,
      label: `${link.pro}@${SHOPS[link.shop]!.name}`,
    });
  }

  // Pausas: duas por profissional, em dias úteis futuros dentro do expediente.
  const breakRows: Array<typeof schema.breaks.$inferInsert> = [];
  const breaksByBarberDate = new Map<string, TimeInterval[]>();
  for (const b of barbers) {
    let placed = 0;
    for (let offset = 1; offset <= 10 && placed < 2; offset++) {
      const date = addDays(today.date, offset);
      const wd = weekdayOf(date);
      const covers = b.working.some((w) => w.weekday === wd && w.startTime <= '15:00' && w.endTime >= '16:00');
      if (!covers) continue;
      breakRows.push({ barberId: b.id, date, startTime: '15:00', endTime: '16:00', reason: 'Pausa para reunião' });
      breaksByBarberDate.set(`${b.id}|${date}`, [{ startTime: '15:00', endTime: '16:00' }]);
      placed++;
      offset += 2;
    }
  }
  if (breakRows.length) await db.insert(schema.breaks).values(breakRows);

  console.log('Gerando agendamentos válidos pela regra de disponibilidade...');
  const rand = lcg(20260101);
  const busy = new Map<string, TimeInterval[]>(); // agendamentos não cancelados por barber|data
  const apptRows: Array<typeof schema.appointments.$inferInsert> = [];

  const serviceMeta = SERVICES_BY_SHOP.map((list, si) =>
    list.map((s, idx) => ({ id: serviceIds[si]![idx]!, ...s })),
  );

  for (let offset = -10; offset <= 14; offset++) {
    const date = addDays(today.date, offset);
    const wd = weekdayOf(date);
    const isPast = date < today.date;
    for (const b of barbers) {
      const working = b.working.filter((w) => w.weekday === wd);
      if (!working.length) continue;
      const target = Math.floor(rand() * 4); // 0 a 3 por dia
      for (let n = 0; n < target; n++) {
        const idx = b.serviceIdx[Math.floor(rand() * b.serviceIdx.length)]!;
        const svc = serviceMeta[b.shopIndex]![idx]!;
        const key = `${b.id}|${date}`;
        const slots = listFreeSlots({
          date,
          durationMinutes: svc.durationMinutes,
          working,
          breaks: breaksByBarberDate.get(key) ?? [],
          appointments: busy.get(key) ?? [],
          now: today,
          allowPast: isPast,
        });
        if (!slots.length) continue;
        const startTime = slots[Math.floor(rand() * slots.length)]!;
        const endTime = addDuration(startTime, svc.durationMinutes);

        let status: (typeof schema.appointments.$inferInsert)['status'];
        const r = rand();
        if (isPast) status = r < 0.7 ? 'COMPLETED' : r < 0.85 ? 'NO_SHOW' : 'CANCELLED';
        else status = r < 0.92 ? 'CONFIRMED' : 'CANCELLED';

        const registered = rand() < 0.75;
        const clientIdx = Math.floor(rand() * CLIENTS.length);
        const walk = WALK_INS[Math.floor(rand() * WALK_INS.length)]!;
        const client = registered ? CLIENTS[clientIdx]! : walk;

        apptRows.push({
          shopId: shopIds[b.shopIndex]!,
          barberId: b.id,
          serviceId: svc.id,
          clientId: registered ? clientIds[clientIdx]! : null,
          clientName: client.name,
          clientPhone: client.phone,
          date,
          startTime,
          endTime,
          durationMinutes: svc.durationMinutes,
          priceCents: svc.priceCents,
          status,
          cancelReason: status === 'CANCELLED' ? 'CLIENT' : null,
          cancelledAt: status === 'CANCELLED' ? new Date() : null,
          cancelledByUserId: status === 'CANCELLED' && registered ? clientIds[clientIdx]! : null,
        });
        if (status !== 'CANCELLED') {
          const list = busy.get(key) ?? [];
          list.push({ startTime, endTime });
          busy.set(key, list);
        }
      }
    }
  }
  if (apptRows.length) await db.insert(schema.appointments).values(apptRows);

  console.log('Criando notificações de exemplo...');
  await db.insert(schema.notifications).values([
    {
      userId: clientIds[0]!,
      type: 'INFO',
      title: 'Bem-vindo ao MarqueAqui',
      message: 'Sua conta de teste está pronta. Faça seu primeiro agendamento pelo assistente.',
      requiresAck: true,
      sourceKey: 'seed:welcome',
    },
    {
      userId: managerId.get('ana')!,
      type: 'INFO',
      title: 'Bem-vinda ao painel do parceiro',
      message: 'Revise a equipe e os serviços da sua empresa em Equipe e Serviços.',
      requiresAck: true,
      sourceKey: 'seed:manager-welcome',
    },
    {
      userId: clientIds[1]!,
      type: 'INFO',
      title: 'Lembrete',
      message: 'Confira seus próximos horários em Meus agendamentos.',
      requiresAck: false,
      readAt: new Date(),
      sourceKey: 'seed:reminder',
    },
  ]);

  await alignSequences(db);

  const [counts] = await db.execute<{
    shops: number;
    users: number;
    barbers: number;
    services: number;
    appointments: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM shops) AS shops,
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM barbers) AS barbers,
      (SELECT COUNT(*)::int FROM services) AS services,
      (SELECT COUNT(*)::int FROM appointments) AS appointments
  `);
  console.log('\nSeed concluído:', counts);

  console.log('\n=== LOGINS DE TESTE (somente desenvolvimento) ===');
  console.log(`Clientes (senha: ${CLIENT_PASSWORD}):`);
  for (const c of CLIENTS) console.log(`  CLIENT        ${c.email}`);
  console.log(`Gestores e profissionais (senha padrão: ${DEFAULT_PASSWORD}; troca obrigatória no primeiro acesso):`);
  for (const m of MANAGERS) {
    console.log(`  MANAGER       ${m.email}  -> ${m.shops.map((i) => SHOPS[i]!.name).join(' + ')}`);
  }
  for (const link of BARBER_LINKS) {
    const p = PROFESSIONALS.find((x) => x.key === link.pro)!;
    console.log(`  PROFESSIONAL  ${p.email}  -> ${SHOPS[link.shop]!.name}`);
  }
  console.log('Administrador: rode `npm run admin:create` (não é criado pelo seed).');
} catch (error) {
  console.error('Falha no seed:', error);
  process.exitCode = 1;
} finally {
  await close();
}