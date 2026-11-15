// Aplica o tema antes da primeira pintura (evita flash). Fica em arquivo próprio porque a CSP bloqueia scripts inline.
try {
  var t = localStorage.getItem('mq-theme');
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}
