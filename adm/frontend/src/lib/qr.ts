// Gerador de QR Code (modo byte, correção de erro M, versões 1–40), sem dependências.
// Escrito para o 2FA: o segredo é transformado em QR no navegador, sem passar por nenhum serviço externo.

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const FORMAT_BITS_M = 0;

const bit = (v: number, i: number): boolean => ((v >>> i) & 1) === 1;

function rawModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const a = Math.floor(ver / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}
const dataCodewords = (ver: number): number => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver]! * NUM_BLOCKS[ver]!;

// ── Reed-Solomon em GF(256), polinômio 0x11D ──
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree: number): number[] {
  const r: number[] = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j]!, root);
      if (j + 1 < r.length) r[j] = r[j]! ^ r[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data: number[], divisor: number[]): number[] {
  const r: number[] = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift()!;
    r.push(0);
    divisor.forEach((c, i) => { r[i] = r[i]! ^ gfMul(c, f); });
  }
  return r;
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function buildCodewords(bytes: number[], ver: number): number[] {
  const capacity = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const nBlocks = NUM_BLOCKS[ver]!;
  const eccLen = ECC_PER_BLOCK[ver]!;
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nBlocks - (raw % nBlocks);
  const shortLen = Math.floor(raw / nBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((blk, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(blk[i]!); });
  }
  return out;
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;
  const lines = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      const seq: number[] = [];
      for (let b = 0; b < size; b++) {
        seq.push(get(a, b) ? 1 : 0);
        if (b > 0 && get(a, b) === get(a, b - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; } else run = 1;
      }
      const s = seq.join('');
      for (let i = 0; i + 11 <= s.length; i++) {
        const w = s.slice(i, i + 11);
        if (w === '10111010000' || w === '00001011101') score += 40;
      }
    }
  };
  lines((a, b) => m[a]![b]!);
  lines((a, b) => m[b]![a]!);
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y]![x]!;
    if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
  }
  const dark = m.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/** Matriz do QR (true = módulo escuro). Lança erro se o texto não couber (versão 40, nível M). */
export function qrMatrix(text: string): boolean[][] {
  const bytes = utf8(text);
  let ver = 1;
  for (; ; ver++) {
    if (ver > 40) throw new Error('Texto longo demais para um QR Code.');
    const countBits = ver <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  const size = ver * 4 + 17;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => { mod[y]![x] = dark; fn[y]![x] = true; };

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx; const y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const align: number[] = [];
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    align.push(6);
    for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
  }
  align.forEach((cx, i) => align.forEach((cy, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  const drawFormat = (mask: number) => {
    const data = (FORMAT_BITS_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(bits, i));
    setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(bits, i));
    setFn(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
      setFn(a, b, bit(bits, i)); setFn(b, a, bit(bits, i));
    }
  }

  const code = buildCodewords(bytes, ver);
  for (let i = 0, right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y]![x] && i < code.length * 8) { mod[y]![x] = bit(code[i >>> 3]!, 7 - (i & 7)); i++; }
    }
  }

  const apply = (mask: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y]![x] && MASKS[mask]!(x, y)) mod[y]![x] = !mod[y]![x];
  };
  let best = 0; let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    apply(m); drawFormat(m);
    const s = penalty(mod);
    if (s < bestScore) { bestScore = s; best = m; }
    apply(m);
  }
  apply(best); drawFormat(best);
  return mod;
}

/** QR como imagem SVG em data URL (cabe na CSP `img-src data:`). */
export function qrDataUrl(text: string, margin = 4): string {
  const m = qrMatrix(text);
  const n = m.length + margin * 2;
  let path = '';
  m.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + margin} ${y + margin}h1v1h-1z`; }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
