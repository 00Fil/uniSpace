// Controlla che le formule si compongano con KaTeX (la stessa libreria del pannello).
// Legge da stdin un array JSON [[latex, display], ...] e scrive un array: null se va bene, altrimenti il messaggio d'errore.
// Funziona sia con Deno (nel container) sia con Node:  deno run --allow-read latexcheck.mjs  |  node latexcheck.mjs
const isDeno = typeof Deno !== 'undefined';
const fs = isDeno ? null : await import('node:fs');
const here = decodeURIComponent(new URL('.', import.meta.url).pathname);
const read = p => isDeno ? Deno.readTextFileSync(p) : fs.readFileSync(p, 'utf8');
globalThis.self ??= globalThis;
new Function(read(here + 'static/vendor/katex/katex.min.js')).call(globalThis);
const input = isDeno ? await new Response(Deno.stdin.readable).text() : fs.readFileSync(0, 'utf8');
const out = JSON.parse(input).map(([x, d]) => {
  try { globalThis.katex.renderToString(x, { throwOnError: true, strict: 'ignore', displayMode: !!d }); return null; }
  catch (e) { return String(e.message || e).replace(/^KaTeX parse error: /, '').slice(0, 200); }
});
const s = JSON.stringify(out);
if (isDeno) await Deno.stdout.write(new TextEncoder().encode(s)); else process.stdout.write(s);
