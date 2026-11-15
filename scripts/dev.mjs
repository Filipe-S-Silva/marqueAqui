// Sobe os quatro projetos em paralelo (APP e ADM, frontend e backend).
// Uso: npm run dev    |   Ctrl+C encerra todos.
import { spawn } from 'node:child_process';

const targets = [
  { name: 'app-backend', color: '\x1b[36m' },
  { name: 'app-frontend', color: '\x1b[32m' },
  { name: 'adm-backend', color: '\x1b[35m' },
  { name: 'adm-frontend', color: '\x1b[33m' },
];
const reset = '\x1b[0m';
const children = [];

for (const t of targets) {
  const child = spawn('npm', ['run', `dev:${t.name}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  const prefix = `${t.color}[${t.name}]${reset} `;
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) out.write(prefix + line + '\n');
      }
    });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}encerrou com código ${code}\n`);
  });
  children.push(child);
}

const stop = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
