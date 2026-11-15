import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const VB = '0 0 400 520';

/** Cada peça da cadeira é uma camada SVG em profundidade (translateZ): ao girar, as peças se separam e dão volume. */
function Layer({ z, children }: { z: number; children: ReactNode }) {
  return (
    <svg viewBox={VB} className="absolute inset-0 size-full overflow-visible" style={{ transform: `translateZ(${z}px)` }} aria-hidden>
      {children}
    </svg>
  );
}

const CHROME = 'url(#chair-chrome)';
const LEATHER = 'url(#chair-leather)';

/**
 * Cadeira de barbeiro: começa pequena no centro do hero e, girando, atravessa até o lado direito, crescendo.
 * Sem movimento quando o usuário pede menos animação.
 */
export function BarberChair() {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  // Deslocamento do ponto final (lado direito) até o centro do hero: a cadeira nasce ali, pequena
  const [from, setFrom] = useState<{ dx: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const hero = el?.closest('section');
    if (!el || !hero) { setFrom({ dx: 0, dy: 0 }); return; }
    const a = el.getBoundingClientRect();
    const b = hero.getBoundingClientRect();
    // centro da parte do hero que está visível na tela
    const centerY = (Math.max(b.top, 0) + Math.min(b.bottom, window.innerHeight)) / 2;
    setFrom({
      dx: Math.round(b.left + b.width / 2 - (a.left + a.width / 2)),
      dy: Math.round(centerY - (a.top + a.height / 2)),
    });
  }, []);
  const start = `translate(${from?.dx ?? 0}px, ${from?.dy ?? 0}px) perspective(1100px) rotateY(-720deg) scale(0.14)`;
  const final = 'translate(0px, 0px) perspective(1100px) rotateY(0deg) scale(1)';
  return (
    // A caixa reserva o espaço final (aspect) desde o primeiro quadro; só a cadeira se move
    <div ref={box} className="relative mx-auto aspect-[400/520] w-full max-w-[24rem] lg:mx-0 lg:ml-auto" aria-hidden>
      {/* brilho de piso atrás da cadeira */}
      <div className="absolute -inset-x-8 bottom-0 h-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent),transparent)] opacity-80" />
      <div className="absolute inset-0" style={{ filter: 'drop-shadow(0 24px 28px rgb(var(--shadow-tint) / 0.35))' }}>
        {/* Só monta depois de medir: assim o primeiro quadro já está no centro, pequeno (antes partia da posição final) */}
        {(from !== null || reduce) && (
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          initial={reduce ? false : { transform: start, opacity: 0 }}
          animate={{ transform: final, opacity: 1 }}
          transition={{ transform: { duration: 3, delay: 0.35, ease: [0.65, 0, 0.2, 1] }, opacity: { duration: 0.3 } }}
        >
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <linearGradient id="chair-chrome" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#f6f9fc" /><stop offset="0.28" stopColor="#8e9bad" />
                <stop offset="0.52" stopColor="#eef2f7" /><stop offset="0.78" stopColor="#76849a" /><stop offset="1" stopColor="#dbe2ea" />
              </linearGradient>
              <linearGradient id="chair-leather" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2c313c" /><stop offset="0.35" stopColor="#12151b" /><stop offset="1" stopColor="#07080b" />
              </linearGradient>
            </defs>
          </svg>

          {/* base redonda e coluna hidráulica */}
          <Layer z={0}>
            <ellipse cx="200" cy="500" rx="150" ry="12" fill="rgb(0 0 0 / 0.22)" />
            <ellipse cx="200" cy="488" rx="135" ry="18" fill="#0b0d12" />
            <ellipse cx="200" cy="484" rx="135" ry="18" fill="none" stroke={CHROME} strokeWidth="5" />
            <ellipse cx="200" cy="482" rx="62" ry="8" fill={CHROME} />
            <rect x="176" y="398" width="48" height="84" rx="6" fill={CHROME} />
            <rect x="166" y="436" width="68" height="16" rx="6" fill="#6f7c90" />
          </Layer>

          {/* estrutura cromada */}
          <Layer z={18}>
            <path d="M104 296 L176 404 M296 296 L224 404" stroke={CHROME} strokeWidth="11" strokeLinecap="round" fill="none" />
          </Layer>

          {/* apoio de pés */}
          <Layer z={34}>
            <rect x="116" y="318" width="168" height="90" rx="12" fill="none" stroke={CHROME} strokeWidth="6" />
            <rect x="127" y="329" width="146" height="68" rx="8" fill={LEATHER} />
            <path d="M138 346 H262 M138 362 H262 M138 378 H262" stroke="#2b303a" strokeWidth="1.5" />
          </Layer>

          {/* encosto */}
          <Layer z={26}>
            <rect x="100" y="60" width="200" height="204" rx="38" fill="none" stroke="#aab4c2" strokeWidth="2.5" />
            <rect x="106" y="66" width="188" height="192" rx="34" fill={LEATHER} />
            <path d="M142 86 V238 M168 82 V242 M194 80 V244 M220 80 V244 M246 82 V242 M272 86 V238" stroke="#262b35" strokeWidth="2" />
            <path d="M128 78 Q200 66 272 78" stroke="#4a5262" strokeWidth="2" fill="none" />
          </Layer>

          {/* cabeceira */}
          <Layer z={30}><rect x="196" y="40" width="8" height="30" rx="3" fill={CHROME} /></Layer>
          <Layer z={44}>
            <rect x="156" y="4" width="88" height="38" rx="11" fill={LEATHER} />
            <path d="M166 12 H234" stroke="#4a5262" strokeWidth="2" />
          </Layer>

          {/* assento */}
          <Layer z={52}>
            <rect x="90" y="244" width="220" height="78" rx="24" fill={LEATHER} />
            <path d="M108 252 H292" stroke="#4a5262" strokeWidth="2" />
            <path d="M96 314 Q200 332 304 314" stroke={CHROME} strokeWidth="5" fill="none" strokeLinecap="round" />
          </Layer>

          {/* braços */}
          <Layer z={62}>
            {[0, 1].map((side) => {
              const x = side === 0 ? 40 : 316;
              const post = side === 0 ? 58 : 332;
              return (
                <g key={side}>
                  <rect x={post} y="192" width="10" height="92" rx="4" fill={CHROME} />
                  <rect x={side === 0 ? 70 : 292} y="268" width="30" height="9" rx="4" fill={CHROME} />
                  <rect x={x} y="158" width="44" height="36" rx="9" fill={CHROME} />
                  <rect x={x + 6} y="163" width="32" height="12" rx="5" fill="#1b1f28" />
                </g>
              );
            })}
          </Layer>
        </motion.div>
        )}
      </div>
    </div>
  );
}
