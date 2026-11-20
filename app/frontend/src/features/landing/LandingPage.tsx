import * as D from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarCheck, Check, Clock, Menu, ShieldCheck, Smartphone, Store, TrendingUp, Users, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BrandMark, ShopAvatar } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogoBurst } from './LogoBurst';
import { ProductMockups } from './ProductMockups';

/* ───────────── Agenda de exemplo: uma agenda de verdade se preenchendo ───────────── */

const PROS = ['Rafa', 'Bia'] as const;
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00'] as const;
/** Células ocupadas de exemplo (coluna-linha). As demais ficam livres e recebem o cursor. */
const BOOKED: Record<string, { who: string; what: string }> = {
  '0-0': { who: 'Caio', what: 'Corte' },
  '1-0': { who: 'Marina', what: 'Escova' },
  '1-1': { who: 'Dudu', what: 'Barba' },
  '0-2': { who: 'Léo', what: 'Corte + barba' },
  '1-3': { who: 'Ana', what: 'Coloração' },
  '0-4': { who: 'Téo', what: 'Corte' },
};
const FREE = ['0-1', '1-2', '0-3', '1-4'] as const;

function HeroAgenda() {
  const reduce = useReducedMotion();
  const [cursor, setCursor] = useState<string | null>(reduce ? FREE[0] : null);
  const [done, setDone] = useState(!!reduce);

  useEffect(() => {
    if (reduce) { setCursor(FREE[0]); setDone(true); return; }
    let alive = true;
    let i = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (!alive) return;
      if (document.hidden) { t = setTimeout(run, 600); return; } // pausa com a aba oculta
      setDone(false);
      setCursor(FREE[i % FREE.length]!);
      t = setTimeout(() => {
        setDone(true);
        t = setTimeout(() => { i += 1; run(); }, 2600);
      }, 1400);
    };
    t = setTimeout(run, 1400);
    return () => { alive = false; if (t) clearTimeout(t); };
  }, [reduce]);

  const [col, row] = cursor ? cursor.split('-').map(Number) as [number, number] : [0, 0];

  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="rise relative rounded-lg border bg-card p-4 shadow-float" style={{ '--i': 1 } as CSSProperties}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShopAvatar name="Barbearia Navalha" className="size-9 text-xs" />
            <div className="leading-tight">
              <p className="text-sm font-bold">Barbearia Navalha</p>
              <p className="text-xs text-muted-foreground">Sexta, 14</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <span className="size-1.5 rounded-full bg-success" /> Agenda ao vivo
          </span>
        </div>

        <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-2 gap-y-2">
          <span />
          {PROS.map((p) => <span key={p} className="text-center text-xs font-semibold text-muted-foreground">{p}</span>)}
          {HOURS.map((h, r) => (
            <div key={h} className="contents">
              <span className="tnum pt-4 text-xs text-muted-foreground">{h}</span>
              {PROS.map((_, c) => {
                const id = `${c}-${r}`;
                const booked = BOOKED[id];
                const mine = done && cursor === id;
                return (
                  <div key={id} className="rise relative h-14" style={{ '--i': 2 + r + c } as CSSProperties}>
                    {booked ? (
                      <div className="h-full rounded-md bg-secondary px-2.5 py-1.5 text-secondary-foreground">
                        <p className="truncate text-xs font-bold">{booked.who}</p>
                        <p className="truncate text-xs">{booked.what}</p>
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center rounded-md border border-dashed text-xs text-muted-foreground">
                        {!mine && 'Livre'}
                      </div>
                    )}
                    <AnimatePresence>
                      {mine && (
                        <motion.div key="mine" className="absolute inset-0 flex flex-col justify-center rounded-md bg-primary px-2.5 text-primary-foreground shadow-card"
                          initial={{ opacity: 0, transform: 'scale(0.94)' }} animate={{ opacity: 1, transform: 'scale(1)' }}
                          exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
                          <p className="flex items-center gap-1 text-xs font-bold"><Check className="size-3.5" /> Você</p>
                          <p className="truncate text-xs">Corte + barba</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {cursor === id && (
                      <motion.span layoutId="hero-cursor" className="absolute -inset-0.5 rounded-md ring-2 ring-ring"
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {done && cursor && !reduce && (
          <motion.p key="chip" className="absolute -bottom-5 left-6 flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-semibold shadow-float"
            initial={{ opacity: 0, transform: 'translateY(10px) scale(0.97)' }} animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
            <CalendarCheck className="size-4 text-success" /> Confirmado: <span className="tnum">{HOURS[row]}</span> com {PROS[col]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fundo líquido azul do hero (referência: motion background azul). Parado com redução de movimento. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[var(--hero-base)]">
      <span className="wave wave-a -left-[15%] top-[-20%] h-[70%] w-[75%] bg-[var(--wave-1)]" />
      <span className="wave wave-b -right-[20%] top-[10%] h-[55%] w-[80%] rotate-[-18deg] bg-[var(--wave-2)]" />
      <span className="wave wave-c bottom-[-25%] left-[10%] h-[60%] w-[70%] rotate-[12deg] bg-[var(--wave-3)]" />
      <span className="wave wave-a right-[5%] top-[35%] h-[35%] w-[45%] bg-[var(--wave-4)]" />
    </div>
  );
}

/* ───────────── Hero: o logo surge letra a letra e explode; depois entra o produto ───────────── */

const EASE = [0.23, 1, 0.32, 1] as const;

function Hero() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'intro' | 'product'>(reduce ? 'product' : 'intro');
  useEffect(() => { if (reduce) setPhase('product'); }, [reduce]);

  return (
    <section className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl items-center overflow-x-clip px-4 py-12">
      {/* overflow-x-clip: a perspectiva 3D dos mockups não pode criar rolagem lateral no celular */}
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'intro' ? (
          <motion.div key="intro" className="flex w-full justify-center" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <LogoBurst onDone={() => setPhase('product')} />
          </motion.div>
        ) : (
          <motion.div key="product" className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
            initial={reduce ? false : { opacity: 0, transform: 'scale(0.94)' }} animate={{ opacity: 1, transform: 'scale(1)' }} transition={{ duration: 0.5, ease: EASE }}>
            <motion.div className="flex flex-col items-center text-center lg:items-start lg:text-left"
              initial={reduce ? false : { opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.6, ease: EASE }}>
              <h1 aria-label="MarqueAqui: controle da agenda e do fluxo de caixa"><BrandMark className="text-4xl sm:text-5xl" /></h1>
              <p className="mt-6 max-w-md text-lg text-muted-foreground">
                Agenda da equipe, horários livres em tempo real e o faturamento do mês num só lugar. Seus clientes marcam em segundos, sem ligação.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button asChild size="lg"><Link to="/register">Criar conta grátis</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/login">Já tenho conta</Link></Button>
              </div>
            </motion.div>
            {/* no celular os mockups vêm primeiro; no desktop ficam à direita do texto */}
            <motion.div className="order-first lg:order-none" initial={reduce ? false : { opacity: 0, transform: 'translateY(24px) scale(0.97)' }} animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}>
              <ProductMockups />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const STEPS = [
  { icon: Store, title: 'Escolha a empresa', text: 'Pesquise o salão ou a barbearia pelo nome.' },
  { icon: Users, title: 'Escolha serviço e profissional', text: 'Veja duração, preço e quem realiza o serviço.' },
  { icon: CalendarCheck, title: 'Reserve o horário', text: 'Os horários livres vêm direto da agenda real.' },
];

const CLIENT_BENEFITS = [
  { icon: Clock, title: 'Sem espera', text: 'Reserve em segundos, a qualquer hora.' },
  { icon: Smartphone, title: 'No celular', text: 'Acompanhe e cancele seus agendamentos de onde estiver.' },
  { icon: ShieldCheck, title: 'Seus dados protegidos', text: 'Só você vê os seus agendamentos.' },
];

const SHOP_BENEFITS = [
  { icon: TrendingUp, title: 'Agenda organizada', text: 'Menos conflitos e menos horários vazios.' },
  { icon: Users, title: 'Gestão da equipe', text: 'Expediente, pausas e serviços por profissional.' },
  { icon: Store, title: 'Relatório mensal', text: 'Acompanhe atendimentos e faturamento.' },
];

function Benefits({ title, items }: { title: string; items: typeof CLIENT_BENEFITS }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
      <h2 className="text-3xl font-extrabold">{title}</h2>
      <ul className="divide-y rounded-lg border bg-card shadow-card">
        {items.map(({ icon: Icon, title: t, text }) => (
          <li key={t} className="flex items-start gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
            <div><h3 className="font-bold">{t}</h3><p className="mt-0.5 text-sm text-muted-foreground">{text}</p></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartnerForm() {
  const [company, setCompany] = useState('');
  const [owner, setOwner] = useState('');
  const number = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, '') ?? '';

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = `Olá! Tenho interesse em ser parceiro do MarqueAqui.\nEmpresa: ${company.trim()}\nResponsável: ${owner.trim()}`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  if (!number) {
    return <p className="text-sm text-muted-foreground">O contato por WhatsApp ainda não foi configurado (VITE_WHATSAPP_NUMBER).</p>;
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Nome da empresa"><Input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} required /></Field>
      <Field label="Nome do responsável"><Input value={owner} onChange={(e) => setOwner(e.target.value)} maxLength={120} required /></Field>
      <Button type="submit" size="lg">Falar no WhatsApp</Button>
    </form>
  );
}

/** Menu lateral do celular: as ações do cabeçalho que não cabem em telas pequenas. */
function MobileMenu() {
  return (
    <D.Root>
      <D.Trigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Abrir menu"><Menu className="size-5" /></Button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="dlg-overlay fixed inset-0 z-50 bg-[#071039]/60 backdrop-blur-sm dark:bg-black/70" />
        <D.Content className="sheet fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 border-l bg-card p-5 shadow-float">
          <div className="flex items-center justify-between">
            <D.Title asChild><span className="text-base"><BrandMark /></span></D.Title>
            <D.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar menu"><X className="size-5" /></Button></D.Close>
          </div>
          <D.Description className="sr-only">Acesso à conta e seções da página</D.Description>
          <nav aria-label="Conta" className="grid gap-2">
            <D.Close asChild><Button asChild size="lg"><Link to="/register">Criar conta</Link></Button></D.Close>
            <D.Close asChild><Button asChild size="lg" variant="outline"><Link to="/login">Entrar</Link></Button></D.Close>
            <D.Close asChild><Button asChild size="lg" variant="ghost"><Link to="/parceiro/login">Sou parceiro</Link></Button></D.Close>
          </nav>
          <nav aria-label="Seções" className="grid gap-1 border-t pt-4 text-sm font-medium">
            {[['#como-funciona', 'Como funciona'], ['#beneficios', 'Benefícios'], ['#seja-parceiro', 'Seja parceiro']].map(([href, label]) => (
              <D.Close key={href} asChild><a href={href} className="rounded-md px-3 py-2 transition-colors hover:bg-accent">{label}</a></D.Close>
            ))}
          </nav>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function LandingPage() {
  return (
    <div>
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-lg"><BrandMark /></Link>
          <nav aria-label="Seções" className="hidden gap-6 text-sm font-medium md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-primary">Como funciona</a>
            <a href="#beneficios" className="transition-colors hover:text-primary">Benefícios</a>
            <a href="#seja-parceiro" className="transition-colors hover:text-primary">Seja parceiro</a>
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/parceiro/login">Sou parceiro</Link></Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Entrar</Link></Button>
            <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/register">Criar conta</Link></Button>
            <MobileMenu />
          </div>
        </div>
      </header>

      <div className="relative isolate overflow-hidden">
        <HeroBackdrop />
        <Hero />
      </div>

      <section id="agenda" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold">Agenda em tempo real</h2>
          <p className="mt-3 max-w-md text-muted-foreground">Cada horário livre que você vê existe de verdade. Escolha um, confirme e ele já aparece na agenda do profissional.</p>
        </div>
        <div className="pb-6"><HeroAgenda /></div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <h2 className="mb-10 text-3xl font-extrabold">Como funciona</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative list-none border-t-2 border-primary pt-5">
              <span className="font-display text-5xl font-extrabold leading-none text-muted-foreground tnum" aria-hidden>{i + 1}</span>
              <Icon className="mb-2 mt-3 size-5 text-primary" aria-hidden />
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="beneficios" className="scroll-mt-20 bg-secondary/40 py-20">
        <div className="mx-auto grid max-w-6xl gap-16 px-4">
          <Benefits title="Para clientes" items={CLIENT_BENEFITS} />
          <Benefits title="Para empresas" items={SHOP_BENEFITS} />
        </div>
      </section>

      <section id="seja-parceiro" className="scroll-mt-20 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold">Quero ser parceiro</h2>
            <p className="mt-3 max-w-md text-muted-foreground">Informe sua empresa e o responsável. Abriremos o WhatsApp com a mensagem pronta.</p>
          </div>
          <Card className="p-6"><PartnerForm /></Card>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
          <BrandMark />
          <p>© {new Date().getFullYear()} EasyService&amp;Cia. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
