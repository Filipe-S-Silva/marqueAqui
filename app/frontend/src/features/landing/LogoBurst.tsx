import { CalendarCheck } from 'lucide-react';
import { motion, type TargetAndTransition, type Transition } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* Introdução do hero: as letras do logo surgem devagar, se misturam no centro e explodem. */

const WORD = 'MarqueAqui';
const SPLIT = 6; // "Marque" escuro, "Aqui" na cor da marca
const STEP = 0.16; // segundos entre letras
const WRITE_MS = (WORD.length * STEP + 0.7) * 1000;
const MIX_MS = 750;
const BURST_MS = 700;
const EASE = [0.23, 1, 0.32, 1] as const;
const IN_OUT = [0.77, 0, 0.175, 1] as const;
const MID = (WORD.length - 1) / 2;
const PARTICLES = 18;
const COLORS = ['bg-primary', 'bg-[#06b6d4]', 'bg-highlight', 'bg-[#fbbf24]'];

// Pseudoaleatório fixo por índice: a explosão é sempre igual e não muda a cada renderização
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

type Stage = 'write' | 'mix' | 'burst';

function letter(stage: Stage, i: number): { animate: TargetAndTransition; transition: Transition } {
  const toCenter = (MID - i) * 0.55;
  if (stage === 'write') {
    return { animate: { opacity: 1, transform: 'translate(0em, 0em) rotate(0deg) scale(1)', filter: 'blur(0px)' }, transition: { duration: 0.6, ease: EASE, delay: i * STEP } };
  }
  if (stage === 'mix') {
    return {
      animate: { opacity: 1, transform: `translate(${toCenter}em, ${(rnd(i, 1) - 0.5) * 0.4}em) rotate(${(rnd(i, 2) - 0.5) * 120}deg) scale(0.85)`, filter: 'blur(0px)' },
      transition: { duration: MIX_MS / 1000, ease: IN_OUT },
    };
  }
  return {
    animate: { opacity: 0, transform: `translate(${toCenter + (rnd(i, 3) - 0.5) * 16}em, ${(rnd(i, 4) - 0.5) * 10}em) rotate(${(rnd(i, 5) - 0.5) * 720}deg) scale(0.3)`, filter: 'blur(6px)' },
    transition: { duration: BURST_MS / 1000, ease: EASE },
  };
}

export function LogoBurst({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('write');
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage('mix'), WRITE_MS),
      setTimeout(() => setStage('burst'), WRITE_MS + MIX_MS),
      setTimeout(() => done.current(), WRITE_MS + MIX_MS + BURST_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const icon: TargetAndTransition =
    stage === 'write' ? { opacity: 1, transform: 'translate(0em, 0em) rotate(0deg) scale(1)' }
    : stage === 'mix' ? { opacity: 1, transform: 'translate(3.4em, 0em) rotate(25deg) scale(0.7)' }
    : { opacity: 0, transform: 'translate(3.4em, 0em) rotate(90deg) scale(2.6)' };

  return (
    <div className="relative flex items-center justify-center" aria-hidden>
      <span className="inline-flex items-center gap-[0.18em] font-display text-4xl font-extrabold tracking-tight sm:text-7xl">
        <motion.span className="grid size-[1.6em] place-items-center rounded-[0.22em] bg-primary text-primary-foreground shadow-card"
          initial={{ opacity: 0, transform: 'translate(0em, 0em) rotate(-8deg) scale(0.6)' }} animate={icon}
          transition={{ duration: stage === 'write' ? 0.6 : stage === 'mix' ? MIX_MS / 1000 : BURST_MS / 1000, ease: stage === 'mix' ? IN_OUT : EASE }}>
          <CalendarCheck className="size-[0.95em]" />
        </motion.span>
        <span>
          {[...WORD].map((ch, i) => {
            const l = letter(stage, i);
            return (
              <motion.span key={i} className={cn('inline-block', i >= SPLIT && 'text-primary')}
                initial={{ opacity: 0, transform: 'translate(0em, 0.4em) rotate(0deg) scale(1)', filter: 'blur(8px)' }} animate={l.animate} transition={l.transition}>
                {ch}
              </motion.span>
            );
          })}
        </span>
      </span>

      {stage === 'burst' && (
        <>
          <motion.span className="absolute left-1/2 top-1/2 size-24 rounded-full border-4 border-highlight"
            initial={{ opacity: 1, transform: 'translate(-50%, -50%) scale(0.2)' }} animate={{ opacity: 0, transform: 'translate(-50%, -50%) scale(5)' }}
            transition={{ duration: BURST_MS / 1000, ease: EASE }} />
          {Array.from({ length: PARTICLES }, (_, i) => {
            const angle = (i / PARTICLES) * Math.PI * 2 + rnd(i, 6) * 0.4;
            const dist = 140 + rnd(i, 7) * 160;
            return (
              <motion.span key={i} className={cn('absolute left-1/2 top-1/2 size-3 rounded-full', COLORS[i % COLORS.length])}
                initial={{ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }}
                animate={{ opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.2)` }}
                transition={{ duration: BURST_MS / 1000, ease: EASE }} />
            );
          })}
        </>
      )}
    </div>
  );
}
