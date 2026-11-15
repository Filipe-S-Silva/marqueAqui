// Schema Drizzle compartilhado pelas APIs APP e ADM (fonte única, spec 4 e 9).
// Horários são guardados como texto HH:MM e datas como YYYY-MM-DD, em horário local do negócio (spec 7.4).
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** bytea ↔ Buffer (fotos de perfil). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/* ------------------------------------------------------------------ enums */

export const userRoleEnum = pgEnum('user_role', ['CLIENT', 'PROFESSIONAL', 'MANAGER']);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);

export const cancelReasonEnum = pgEnum('cancel_reason', [
  'CLIENT',
  'STAFF',
  'PROFESSIONAL_DEACTIVATED',
  'SHOP_DEACTIVATED',
  'USER_DEACTIVATED',
  'INACTIVITY',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'APPOINTMENT_CANCELLED',
  'PROFESSIONAL_DEACTIVATED',
  'SHOP_DEACTIVATED',
  'SHOP_REACTIVATED',
  'ACCOUNT_DEACTIVATED',
  'ADMIN_CHANGE',
  'INFO',
]);

export const USER_ROLES = userRoleEnum.enumValues;
export const APPOINTMENT_STATUSES = appointmentStatusEnum.enumValues;
export type UserRole = (typeof USER_ROLES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type CancelReason = (typeof cancelReasonEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

/* ---------------------------------------------------------------- helpers */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

const HHMM = `'^([01][0-9]|2[0-3]):[0-5][0-9]$'`;

/* ------------------------------------------------------------------ shops */

export const shops = pgTable(
  'shops',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    address: varchar('address', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    logoUrl: text('logo_url'),
    active: boolean('active').notNull().default(true),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shops_active_name_idx').on(t.active, t.name),
  ],
);

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    // sempre normalizado em minúsculas pela aplicação; a constraint impede desvio
    email: varchar('email', { length: 254 }).notNull().unique(),
    phone: varchar('phone', { length: 30 }),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull(),
    active: boolean('active').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    photoUrl: text('photo_url'),
    description: text('description'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    deactivationReason: varchar('deactivation_reason', { length: 60 }),
    // Bloqueio por senhas erradas (contador atômico em lockout.ts)
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    index('users_role_active_idx').on(t.role, t.active),
    index('users_inactivity_idx').on(t.active, t.lastLoginAt),
    index('users_name_idx').on(t.name),
    index('users_created_idx').on(t.createdAt),
  ],
);

/* ---------------------------------------------------------- shop managers */

export const shopManagers = pgTable(
  'shop_managers',
  {
    shopId: integer('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.userId] }),
    index('shop_managers_user_idx').on(t.userId, t.active),
  ],
);

/* ---------------------------------------------------------------- barbers */
// Profissional por empresa: um usuário pode ter uma linha por empresa.

export const barbers = pgTable(
  'barbers',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    shopId: integer('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    active: boolean('active').notNull().default(true),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('barbers_user_shop_uq').on(t.userId, t.shopId),
    index('barbers_shop_active_idx').on(t.shopId, t.active),
  ],
);

/* --------------------------------------------------------------- services */

export const services = pgTable(
  'services',
  {
    id: serial('id').primaryKey(),
    shopId: integer('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    durationMinutes: smallint('duration_minutes').notNull(),
    priceCents: integer('price_cents').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'services_duration_grid',
      sql`${t.durationMinutes} BETWEEN 30 AND 480 AND ${t.durationMinutes} % 30 = 0`,
    ),
    check('services_price_nonneg', sql`${t.priceCents} >= 0`),
    index('services_shop_active_idx').on(t.shopId, t.active),
  ],
);

export const barberServices = pgTable(
  'barber_services',
  {
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id, { onDelete: 'cascade' }),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.barberId, t.serviceId] }),
    index('barber_services_service_idx').on(t.serviceId),
  ],
);

/* ---------------------------------------------------------- working hours */

export const workingHours = pgTable(
  'working_hours',
  {
    id: serial('id').primaryKey(),
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(), // 0 = domingo ... 6 = sábado
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
  },
  (t) => [
    check('working_hours_weekday', sql`${t.weekday} BETWEEN 0 AND 6`),
    check(
      'working_hours_times',
      sql.raw(
        `start_time ~ ${HHMM} AND end_time ~ ${HHMM} AND start_time < end_time`,
      ),
    ),
    index('working_hours_barber_weekday_idx').on(t.barberId, t.weekday),
  ],
);

/* ----------------------------------------------------------------- breaks */

export const breaks = pgTable(
  'breaks',
  {
    id: serial('id').primaryKey(),
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    reason: varchar('reason', { length: 120 }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'breaks_times',
      sql.raw(
        `start_time ~ ${HHMM} AND end_time ~ ${HHMM} AND start_time < end_time`,
      ),
    ),
    index('breaks_barber_date_idx').on(t.barberId, t.date),
  ],
);

/* ----------------------------------------------------------- appointments */
// O cancelamento é lógico: o registro nunca é apagado (spec 7.5).
// Campos de cliente e valores são "fotografias" do momento da reserva.

export const appointments = pgTable(
  'appointments',
  {
    id: serial('id').primaryKey(),
    shopId: integer('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    barberId: integer('barber_id')
      .notNull()
      .references(() => barbers.id, { onDelete: 'restrict' }),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    clientId: integer('client_id').references(() => users.id, { onDelete: 'restrict' }),
    clientName: varchar('client_name', { length: 120 }).notNull(),
    clientPhone: varchar('client_phone', { length: 30 }),
    date: date('date', { mode: 'string' }).notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(),
    endTime: varchar('end_time', { length: 5 }).notNull(),
    durationMinutes: smallint('duration_minutes').notNull(),
    priceCents: integer('price_cents').notNull(),
    status: appointmentStatusEnum('status').notNull().default('CONFIRMED'),
    cancelReason: cancelReasonEnum('cancel_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: integer('cancelled_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'appointments_times',
      sql.raw(
        `start_time ~ ${HHMM} AND end_time ~ ${HHMM} AND start_time < end_time`,
      ),
    ),
    // Defesa em profundidade: duas reservas ativas no mesmo início são impossíveis no banco.
    // A sobreposição parcial é impedida pela transação com pg_advisory_xact_lock (spec 7.3).
    uniqueIndex('appointments_active_slot_uq')
      .on(t.barberId, t.date, t.startTime)
      .where(sql`${t.status} <> 'CANCELLED'`),
    index('appointments_barber_date_idx').on(t.barberId, t.date, t.status),
    index('appointments_shop_date_idx').on(t.shopId, t.date, t.status),
    index('appointments_client_idx').on(t.clientId, t.date, t.startTime),
    index('appointments_report_idx').on(t.shopId, t.status, t.date),
  ],
);

/* ---------------------------------------------------------- notifications */

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    message: text('message').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    // Avisos que aparecem na janela pós-login até o usuário clicar em "Entendi"
    requiresAck: boolean('requires_ack').notNull().default(false),
    ackedAt: timestamp('acked_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    // Chave de idempotência: o mesmo evento nunca gera duas notificações para o mesmo usuário
    sourceKey: varchar('source_key', { length: 200 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('notifications_user_source_uq').on(t.userId, t.sourceKey),
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_pending_idx').on(t.userId, t.requiresAck, t.ackedAt),
  ],
);

/* ----------------------------------------------------------------- admins */
// Tabela independente dos usuários comuns. O e-mail nunca é guardado: só o HMAC-SHA256 (spec 8.1).

export const admins = pgTable(
  'admins',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    emailHmac: varchar('email_hmac', { length: 64 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    // Senha provisória (criação por outro admin ou redefinição): só /auth/change-password funciona até trocar
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    // 2FA (TOTP). O segredo fica CIFRADO (AES-256-GCM); com enabledAt nulo ele é só um cadastro pendente.
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    // Último intervalo de 30 s aceito: impede reutilizar o mesmo código (replay)
    totpLastStep: integer('totp_last_step'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('admins_active_idx').on(t.active)],
);

/* ------------------------------------------------- 2FA: recuperação e login */
// Só o HMAC dos códigos de recuperação é guardado; cada código vale uma vez.
export const adminRecoveryCodes = pgTable(
  'admin_recovery_codes',
  {
    id: serial('id').primaryKey(),
    adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('admin_recovery_codes_uq').on(t.adminId, t.codeHash)],
);

// Desafio da 2ª etapa do login: token opaco (só o SHA-256 fica aqui), 5 min, no máximo 5 tentativas.
export const adminChallenges = pgTable(
  'admin_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: varchar('ip', { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index('admin_challenges_admin_idx').on(t.adminId)],
);

/* ------------------------------------------------------------ admin_audit */
// Registro das ações do painel e dos eventos de segurança do ADM. Nunca grava senhas, tokens nem textos de mensagens.
export const ADMIN_AUDIT_TYPES = ['AUTH', 'SECURITY', 'USER', 'SHOP', 'ANNOUNCEMENT', 'SUPPORT', 'ADMIN'] as const;
export type AdminAuditType = (typeof ADMIN_AUDIT_TYPES)[number];

export const adminAudit = pgTable(
  'admin_audit',
  {
    id: serial('id').primaryKey(),
    // Nulo em eventos sem administrador identificado (ex.: tentativa de login com credenciais inválidas)
    adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 16 }).$type<AdminAuditType>().notNull(),
    action: varchar('action', { length: 80 }).notNull(),
    targetType: varchar('target_type', { length: 40 }),
    targetId: varchar('target_id', { length: 40 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('admin_audit_created_idx').on(t.createdAt),
    index('admin_audit_type_idx').on(t.type, t.createdAt),
    index('admin_audit_admin_idx').on(t.adminId, t.createdAt),
  ],
);

/* --------------------------------------------------------- admin_sessions */
// Sessões do painel: token aleatório de 32 bytes; só o SHA-256 fica aqui. Tabela separada de `sessions`,
// então um token do APP nunca vale no ADM e vice-versa. Logout e revogação APAGAM a linha.
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: integer('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: createdAt(),
  },
  (t) => [index('admin_sessions_admin_idx').on(t.adminId), index('admin_sessions_expires_idx').on(t.expiresAt)],
);

/* --------------------------------------------------------------- sessions */
// Sessões do APP: access token curto + refresh token rotativo guardado só como hash.

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    activeShopId: integer('active_shop_id').references(() => shops.id, { onDelete: 'set null' }),
    // Por onde a pessoa entrou: 'client' (login de cliente) ou 'partner' (login de gestor/profissional)
    portal: varchar('portal', { length: 10, enum: ['client', 'partner'] }).notNull().default('client'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId, t.revokedAt),
    index('sessions_family_idx').on(t.familyId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('password_reset_user_idx').on(t.userId)],
);

/* ------------------------------------------------------------- audit logs */
// Nunca grava senhas, tokens ou outros segredos (spec 10.6).

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorType: varchar('actor_type', { length: 12 }).notNull(), // ADMIN | USER | SYSTEM
    actorId: integer('actor_id'),
    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 40 }),
    entityId: varchar('entity_id', { length: 40 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: varchar('ip', { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorType, t.actorId),
  ],
);


/* ------------------------------------------------- feedbacks e chamados */

export const FEEDBACK_CATEGORIES = ['SUGGESTION', 'PRAISE', 'COMPLAINT', 'BUG'] as const;
export const FEEDBACK_STATUSES = ['NEW', 'READ', 'ARCHIVED'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

// Feedback de qualquer usuário para a equipe de administração da plataforma.
export const platformFeedbacks = pgTable(
  'platform_feedbacks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 12, enum: FEEDBACK_CATEGORIES }).notNull(),
    rating: smallint('rating'),
    message: text('message').notNull(),
    status: varchar('status', { length: 10, enum: FEEDBACK_STATUSES }).notNull().default('NEW'),
    handledByAdminId: integer('handled_by_admin_id').references(() => admins.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check('platform_feedbacks_rating', sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
    index('platform_feedbacks_status_idx').on(t.status, t.createdAt),
    index('platform_feedbacks_user_idx').on(t.userId),
  ],
);

// Avaliação do cliente sobre um atendimento concluído, visível para a empresa. Uma por atendimento.
export const shopReviews = pgTable(
  'shop_reviews',
  {
    id: serial('id').primaryKey(),
    shopId: integer('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    // O atendimento é apagado após o período de retenção; a avaliação permanece com um resumo (serviço e data).
    appointmentId: integer('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
    serviceName: varchar('service_name', { length: 120 }).notNull(),
    appointmentDate: date('appointment_date').notNull(),
    clientId: integer('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    barberId: integer('barber_id').references(() => barbers.id, { onDelete: 'set null' }),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    reply: text('reply'),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    repliedByUserId: integer('replied_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('shop_reviews_rating', sql`${t.rating} BETWEEN 1 AND 5`),
    uniqueIndex('shop_reviews_appointment_uq').on(t.appointmentId),
    index('shop_reviews_shop_idx').on(t.shopId, t.createdAt),
  ],
);

export const TICKET_CATEGORIES = ['ACCOUNT', 'BOOKING', 'SHOP', 'BUG', 'OTHER'] as const;
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Chamado de suporte aberto por um usuário e respondido pela administração.
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shopId: integer('shop_id').references(() => shops.id, { onDelete: 'set null' }),
    subject: varchar('subject', { length: 150 }).notNull(),
    category: varchar('category', { length: 10, enum: TICKET_CATEGORIES }).notNull(),
    status: varchar('status', { length: 12, enum: TICKET_STATUSES }).notNull().default('OPEN'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    // Quem escreveu por último: o ADM só precisa agir quando foi o usuário
    lastMessageBy: varchar('last_message_by', { length: 5, enum: ['USER', 'ADMIN'] }).notNull().default('USER'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('support_tickets_user_idx').on(t.userId, t.lastMessageAt),
    index('support_tickets_status_idx').on(t.status, t.lastMessageAt),
  ],
);

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    authorType: varchar('author_type', { length: 5, enum: ['USER', 'ADMIN'] }).notNull(),
    authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    authorAdminId: integer('author_admin_id').references(() => admins.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ticket_messages_ticket_idx').on(t.ticketId, t.createdAt)],
);

/* ------------------------------------------------------------------ tipos */

export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Barber = typeof barbers.$inferSelect;
export type Service = typeof services.$inferSelect;
export type WorkingHour = typeof workingHours.$inferSelect;
export type Break = typeof breaks.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type ShopReview = typeof shopReviews.$inferSelect;


/* ------------------------------------------------------------ fotos de perfil */

/** Foto do profissional/gestor (até 5 MB, validada por assinatura do arquivo). Servida por GET /photos/:id. */
export const userPhotos = pgTable('user_photos', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  contentType: varchar('content_type', { length: 20 }).notNull(),
  data: bytea('data').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  updatedAt: updatedAt(),
});
