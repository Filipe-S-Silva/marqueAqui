import { BarChart3, CalendarCheck, CalendarDays, Home, Scissors, Users } from 'lucide-react';
import { motion, useMotionTemplate, useReducedMotion, useSpring } from 'motion/react';
import type { PointerEvent } from 'react';
import { BrandMark } from '@/components/common/Logo';
import { cn } from '@/lib/utils';

/* Prévia ilustrativa do produto: a mesma linguagem visual das telas reais, com dados de exemplo. */

const TEAL = 'bg-[var(--ev-teal)] text-[var(--ev-teal-fg)]';
const BLUE = 'bg-[var(--ev-blue)] text-[var(--ev-blue-fg)]';
const YELLOW = 'bg-[var(--ev-yellow)] text-[var(--ev-yellow-fg)]';

const ROW = 26; // px por 30 minutos
const START = 9 * 60;
const COLS = [
  { name: 'Rafa', initials: 'RA', blocks: [{ s: '09:00', e: '10:00', who: 'Caio', what: 'Corte', tone: TEAL }, { s: '11:00', e: '12:00', who: 'Léo', what: 'Corte + barba', tone: BLUE }] },
  { name: 'Bia', initials: 'BI', blocks: [{ s: '09:30', e: '10:30', who: 'Marina', what: 'Escova', tone: YELLOW }, { s: '11:00', e: '11:30', who: 'Ana', what: 'Barba', tone: TEAL }] },
  { name: 'Téo', initials: 'TE', blocks: [{ s: '10:00', e: '11:00', who: 'Dudu', what: 'Coloração', tone: BLUE }] },
];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const y = (t: string) => ((toMin(t) - START) / 30) * ROW;

function DesktopMockup() {
  return (
    <div className="overflow-hidden rounded-md bg-card">
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ef4444]/70" /><span className="size-2.5 rounded-full bg-highlight/80" /><span className="size-2.5 rounded-full bg-success/70" />
        </span>
        <span className="mx-auto truncate rounded-md bg-card px-3 py-0.5 text-xs text-muted-foreground">marqueaqui.app/gestor/agendas</span>
      </div>
      <div className="flex">
        <aside className="hidden w-36 shrink-0 flex-col gap-1 border-r p-3 sm:flex">
          <BrandMark className="mb-2 text-sm" />
          {[
            { icon: Home, label: 'Visão geral' },
            { icon: CalendarDays, label: 'Agendas', active: true },
            { icon: Users, label: 'Equipe' },
            { icon: Scissors, label: 'Serviços' },
            { icon: BarChart3, label: 'Relatório' },
          ].map(({ icon: Icon, label, active }) => (
            <span key={label} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <Icon className="size-3.5" /> {label}
            </span>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-sm font-extrabold">Agendas da equipe</p>
            <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">Agendar</span>
          </div>
          <div className="grid grid-cols-[2.25rem_repeat(3,minmax(0,1fr))] overflow-hidden rounded-md border">
            <span className="border-b" />
            {COLS.map((c) => (
              <div key={c.name} className="flex flex-col items-center gap-1 border-b border-l py-2">
                <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground">{c.initials}</span>
                <span className="text-xs font-bold">{c.name}</span>
              </div>
            ))}
            <div className="relative" style={{ height: ROW * 6 }}>
              {['09:00', '10:00', '11:00'].map((h) => <span key={h} className="tnum absolute right-1 text-xs text-muted-foreground" style={{ top: y(h) + 2 }}>{h.slice(0, 2)}h</span>)}
            </div>
            {COLS.map((c) => (
              <div key={c.name} className="relative border-l" style={{ height: ROW * 6, backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${ROW}px)` }}>
                {c.blocks.map((b) => (
                  <div key={b.s} className={cn('absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-xs leading-tight shadow-card', b.tone)} style={{ top: y(b.s) + 2, height: y(b.e) - y(b.s) - 4 }}>
                    <p className="truncate font-bold">{b.who}</p>
                    <p className="truncate">{b.what}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative w-36 rounded-[1.6rem] border-[5px] border-[#071039] bg-background p-2.5 shadow-float sm:w-44 lg:w-52 dark:border-[#2e5de6]">
      <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-[#071039]/80 dark:bg-[#2e5de6]" />
      <p className="font-display text-sm font-extrabold">Olá, Lucas!</p>
      <p className="text-xs text-muted-foreground">Seu próximo horário</p>
      <div className={cn('mt-2 rounded-lg p-2.5 text-xs shadow-card', TEAL)}>
        <p className="flex items-center gap-1 font-bold"><CalendarCheck className="size-3.5" /> Corte + barba</p>
        <p className="tnum mt-0.5">Sexta, 14 · 10:00</p>
        <p>com Rafa</p>
      </div>
      <p className="mt-3 text-xs font-semibold">Horários livres hoje</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {['13:00', '14:30', '16:00'].map((t, i) => (
          <span key={t} className={cn('tnum rounded-md border py-1 text-center text-xs', i === 1 ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>{t}</span>
        ))}
      </div>
      <span className="mt-3 block rounded-md bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground">Confirmar</span>
    </div>
  );
}

/** Notebook: tela com moldura e a base deitada em perspectiva. */
function Laptop() {
  return (
    <div className="[transform-style:preserve-3d]">
      <div className="rounded-t-2xl rounded-b-md border-[6px] border-b-[12px] border-[#071039] bg-[#071039] shadow-float dark:border-[#1a3bb0] dark:bg-[#1a3bb0]">
        <DesktopMockup />
      </div>
      <div className="-mx-[7%] h-5 origin-top rounded-b-2xl bg-gradient-to-b from-[#afc5f8] to-[#6e92f2] shadow-float [transform:rotateX(70deg)] dark:from-[#1a3bb0] dark:to-[#0f2270]" />
    </div>
  );
}

/** Celular com espessura: a traseira fica alguns pixels atrás e aparece como a lateral do aparelho. */
function Phone() {
  return (
    <div className="relative [transform-style:preserve-3d]">
      <div className="absolute inset-0 rounded-[1.6rem] bg-[#071039] [transform:translateZ(-14px)] dark:bg-[#0f2270]" />
      <PhoneMockup />
    </div>
  );
}

const SPRING = { stiffness: 120, damping: 18 };

export function ProductMockups() {
  const reduce = useReducedMotion();
  const rx = useSpring(0, SPRING);
  const ry = useSpring(0, SPRING);
  const transform = useMotionTemplate`rotateX(${rx}deg) rotateY(${ry}deg)`;

  // Inclina a cena seguindo o mouse; no toque e com redução de movimento fica parada
  function move(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  }

  return (
    <div role="img" aria-label="Prévia do MarqueAqui: a agenda da equipe no computador e o agendamento do cliente no celular"
      className="relative mx-auto max-w-[22rem] pb-10 [perspective:1600px] max-sm:[zoom:0.75] sm:max-w-none sm:pb-16" onPointerMove={move} onPointerLeave={() => { rx.set(0); ry.set(0); }}>
      {/* Sem preserve-3d no grupo: notebook e celular são camadas separadas (cada uma com sua perspectiva),
          então o plano do notebook nunca atravessa e corta o celular quando a cena inclina */}
      <motion.div className="relative" style={{ transform }}>
        {/* margem à direita: o celular sobrepõe só a borda do notebook, sem esconder a última coluna */}
        <div aria-hidden className="mr-12 [transform-style:preserve-3d] [transform:perspective(1600px)_rotateY(-14deg)_rotateX(6deg)] sm:mr-28"><Laptop /></div>
        <div aria-hidden className="absolute bottom-0 right-0 z-10 [transform-style:preserve-3d] [transform:perspective(1200px)_rotateY(-22deg)_rotateX(4deg)]">
          <div className="float-y [transform-style:preserve-3d]"><Phone /></div>
        </div>
      </motion.div>
    </div>
  );
}
