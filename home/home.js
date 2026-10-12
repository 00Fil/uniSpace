/* StudyKit — home */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const isMob = () => matchMedia('(max-width:760px)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const store = { get: (k, d) => { try { return JSON.parse(localStorage['sk_' + k]) ?? d; } catch { return d; } }, set: (k, v) => { localStorage['sk_' + k] = JSON.stringify(v); } };

/* ---------------------------------------------------------------- dati */
// elenco tool e categorie: generato da tools/*/tool.json durante la build del gateway
const REG = await fetch('tools.json', { cache: 'no-cache' }).then(r => r.json()).then(j => j.tools ? j : { categories: [], tools: [] }).catch(() => ({ categories: [], tools: [] }));
const CATS = REG.categories;
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const I = {
  cut: '<rect class="d" x="2.5" y="7" width="7.5" height="10" rx="2.2"/><rect class="d" x="14" y="7" width="7.5" height="10" rx="2.2"/><rect x="2.5" y="7" width="7.5" height="10" rx="2.2"/><rect x="14" y="7" width="7.5" height="10" rx="2.2"/><path d="M5.3 10.2v3.6l2.8-1.8z" class="f"/><path d="M12 4.5v2M12 10.5v3M12 17.5v2"/>',
  mic: '<rect class="d" x="8.5" y="2.5" width="7" height="12" rx="3.5"/><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  mark: '<path class="d" d="M6.5 4.5A2 2 0 0 1 8.5 2.5h7a2 2 0 0 1 2 2v17l-5.5-4-5.5 4z"/><path d="M6.5 4.5A2 2 0 0 1 8.5 2.5h7a2 2 0 0 1 2 2v17l-5.5-4-5.5 4z"/><path d="M10 7.5h4M10 11h2.5"/>',
  rec: '<circle class="d" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" class="f"/>',
  layers: '<path d="M15 6.5V5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2H8"/><rect class="d" x="9" y="7" width="11.5" height="14" rx="2"/><rect x="9" y="7" width="11.5" height="14" rx="2"/><path d="M12.5 12h4.5M12.5 15.5h3"/>',
  shrink: '<rect class="d" x="3" y="10.2" width="18" height="3.6" rx="1.8"/><rect x="3" y="10.2" width="18" height="3.6" rx="1.8"/><path d="M12 2.5v5m-2.8-2.6L12 7.5l2.8-2.6M12 21.5v-5m-2.8 2.6 2.8-2.6 2.8 2.6"/>',
  scan: '<path d="M3.5 8V6a2.5 2.5 0 0 1 2.5-2.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2"/><rect class="d" x="7" y="7" width="10" height="10" rx="2"/><path d="M9.5 10h5M12 10v4.5"/>',
  hl: '<path class="d" d="M14.5 3.5l6 6-8 8H6.5v-6z"/><path d="M14.5 3.5l6 6-8 8H6.5v-6z"/><path d="M11 8l5 5M3 21h18"/>',
  conv: '<rect class="d" x="2.5" y="2.5" width="9" height="11" rx="2"/><rect x="2.5" y="2.5" width="9" height="11" rx="2"/><rect x="12.5" y="10.5" width="9" height="11" rx="2"/><path d="M15 3h1.5A2.5 2.5 0 0 1 19 5.5V7m-1.8-1.6L19 7l1.8-1.6M9 21H7.5A2.5 2.5 0 0 1 5 18.5V17m1.8 1.6L5 17l-1.8 1.6"/>',
  cards: '<path d="M8 6V4.5A2 2 0 0 1 10 2.5h8.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17"/><rect class="d" x="3.5" y="6.5" width="13.5" height="15" rx="2.2"/><rect x="3.5" y="6.5" width="13.5" height="15" rx="2.2"/><path d="M7.5 12h5.5M7.5 15.5h3.5"/>',
  quiz: '<path class="d" d="M3.5 6a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20.5 6v8.5A2.5 2.5 0 0 1 18 17h-6l-4.5 4v-4H6a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M3.5 6a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20.5 6v8.5A2.5 2.5 0 0 1 18 17h-6l-4.5 4v-4H6a2.5 2.5 0 0 1-2.5-2.5z"/><path d="m8.5 10.3 2.3 2.3 4.7-4.7"/>',
  map: '<circle class="d" cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="4.5" cy="5" r="2"/><circle cx="19.5" cy="5" r="2"/><circle cx="4.5" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="m6 6.4 3.4 3.1M18 6.4l-3.4 3.1M6 17.6l3.4-3.1M18 17.6l-3.4-3.1"/>',
  formula: '<rect class="d" x="3" y="3" width="18" height="18" rx="4.5"/><rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M15.5 8H8.5l4 4-4 4h7"/>',
  graph: '<path class="d" d="M4 20v-6c2.5-5.5 5-6.5 7.5-3s5 3.5 8.5-3.5V20z"/><path d="M4 3.5V20h16.5"/><path d="M4 14c2.5-5.5 5-6.5 7.5-3s5 3.5 8.5-3.5"/>',
  eq: '<rect class="d" x="3" y="3" width="18" height="18" rx="4.5"/><rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M7 9.5h4M9 7.5v4M13.5 7.8l3.4 3.4M16.9 7.8l-3.4 3.4M7 15h4M13.5 14h3.5M13.5 16.5h3.5"/>',
  stats: '<rect class="d" x="3.5" y="11" width="4" height="9.5" rx="1.2"/><rect class="d" x="10" y="4" width="4" height="16.5" rx="1.2"/><rect class="d" x="16.5" y="8" width="4" height="12.5" rx="1.2"/><rect x="3.5" y="11" width="4" height="9.5" rx="1.2"/><rect x="10" y="4" width="4" height="16.5" rx="1.2"/><rect x="16.5" y="8" width="4" height="12.5" rx="1.2"/>',
  ruler: '<path class="d" d="M2.8 16.2 16.2 2.8l5 5L7.8 21.2z"/><path d="M2.8 16.2 16.2 2.8l5 5L7.8 21.2z"/><path d="m7 12 2 2M10 9l2.8 2.8M13 6l2 2"/>',
  table: '<rect class="d" x="3" y="3" width="8" height="8" rx="2"/><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><path d="M6 5.8v2.4M6 5.8h2" />',
  cap: '<path class="d" d="m1.8 9 10.2-5 10.2 5-10.2 5z"/><path d="m1.8 9 10.2-5 10.2 5-10.2 5z"/><path d="M6 11v5c3.3 2.6 8.7 2.6 12 0v-5M22.2 9v6"/>',
  cal: '<path class="d" d="M3 9.5V7a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 7v2.5z"/><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><circle cx="8" cy="14" r="1" class="f"/><circle cx="12" cy="14" r="1" class="f"/><circle cx="16" cy="14" r="1" class="f"/><circle cx="8" cy="17.5" r="1" class="f"/>',
  timer: '<circle class="d" cx="12" cy="13.5" r="8"/><circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.6 2.6M9.5 2.5h5M19 6l1.5-1.5"/>',
  week: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path class="d" d="M9 9h6v5.5H9z"/><path d="M3 9h18M3 14.5h18M9 3.5v17M15 3.5v17"/>',
  count: '<rect class="d" x="2.5" y="4" width="19" height="16" rx="3"/><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M6.5 9h5M6.5 12h4M6.5 15h5M15 9.5l-.8 5.5M18 9.5l-.8 5.5M13.8 11h4.7M13.4 13.6h4.7"/>',
  book: '<path class="d" d="M4 5a2.5 2.5 0 0 1 2.5-2.5H20v15H6.5A2.5 2.5 0 0 0 4 20z"/><path d="M4 20V5a2.5 2.5 0 0 1 2.5-2.5H20v15H6.5A2.5 2.5 0 0 0 4 20a1.5 1.5 0 0 0 1.5 1.5H20M8.5 7h7M8.5 10.5h4.5"/>',
  page: '<path class="d" d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 2.5V8h5.5M8.5 12.5h7M8.5 16h5"/>',
  lang: '<path class="d" d="M2.5 5a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 14.5 5v4.5A2.5 2.5 0 0 1 12 12H8.5L5 15v-3a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M2.5 5a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 14.5 5v4.5A2.5 2.5 0 0 1 12 12H8.5L5 15v-3a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M17.5 9H19a2.5 2.5 0 0 1 2.5 2.5V16a2.5 2.5 0 0 1-2.5 2.5v3l-3.5-3H12a2.5 2.5 0 0 1-2.5-2.5v-1M6.5 9.5l2-5 2 5M7.2 8h2.6"/>',
  box: '<rect class="d" x="3.5" y="3.5" width="17" height="17" rx="4"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 12h7M12 8.5v7"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
};
const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${I[k]}</svg>`;
const FALLBACK_CAT = { id: '', name: 'Altro', c: 'var(--text)' };
const TOOLS = REG.tools.map(t => ({ ...t, cat: CAT[t.cat] ? t.cat : '' }));
CAT[''] = FALLBACK_CAT;
const TOOL = Object.fromEntries(TOOLS.map(t => [t.id, t]));
const POPULAR = TOOLS.slice(0, 6).map(t => t.id);  // i primi per "order"
const FORMATS = [...new Set(TOOLS.flatMap(t => t.tags))];

/* ---------------------------------------------------------------- utilità */
let recents = store.get('recents', []);
function visit(id) { recents = [id, ...recents.filter(x => x !== id)].slice(0, 6); store.set('recents', recents); }
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 2400);
}
document.addEventListener('click', e => { const a = e.target.closest('a[data-tool]'); if (a) visit(a.dataset.tool); });
// pressione che arriva sempre in fondo
let pressEl = null, pressT = 0;
document.addEventListener('pointerdown', e => { const el = e.target.closest('.btn,.cbtn,.pi,.hsearch,.nsearch,.pal-x'); if (!el || e.button > 0) return;
  pressEl = el; pressT = performance.now(); el.classList.add('pressing'); }, true);
const unpress = () => { const el = pressEl; if (!el) return; pressEl = null; setTimeout(() => el.classList.remove('pressing'), Math.max(0, 120 - (performance.now() - pressT))); };
['pointerup', 'pointercancel', 'dragstart'].forEach(ev => document.addEventListener(ev, unpress, true));

/* ricerca: tutte le parole devono comparire; il nome pesa di più */
function search(q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return TOOLS.map(t => ({ t, s: 0 }));
  const out = [];
  for (const t of TOOLS) {
    const name = norm(t.name), kw = norm(t.kw), tags = norm(t.tags.join(' ')), desc = norm(t.desc), cat = norm(CAT[t.cat].name);
    let s = 0, ok = true;
    for (const w of words) {
      const stem = w.length > 4 ? w.slice(0, -1) : w;
      const sc = name.startsWith(w) ? 100 : name.includes(w) ? 60 : tags.split(' ').includes(w) ? 50 : kw.includes(stem) ? 40 : tags.includes(w) ? 30 : cat.includes(w) ? 20 : desc.includes(stem) ? 10 : 0;
      if (!sc) { ok = false; break; } s += sc;
    }
    if (ok) out.push({ t, s });
  }
  return out.sort((a, b) => b.s - a.s);
}
function hl(text, q) {
  const words = norm(q).split(/\s+/).filter(w => w.length > 1); if (!words.length) return esc(text);
  const n = norm(text); const marks = new Array(text.length).fill(false);
  for (const w of words) { let i = n.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = n.indexOf(w, i + w.length); } }
  let out = '', open = false;
  for (let i = 0; i < text.length; i++) { if (marks[i] !== open) { out += marks[i] ? '<mark>' : '</mark>'; open = marks[i]; } out += esc(text[i]); }
  return out + (open ? '</mark>' : '');
}
const tIcon = t => t.iconSvg ? `<svg viewBox="0 0 24 24">${t.iconSvg}</svg>` : svg(I[t.icon] ? t.icon : 'box');
const icon = t => `<span class="ic" style="--cc:${CAT[t.cat].c}">${tIcon(t)}</span>`;
const ext = t => t.external ? ' target="_blank" rel="noopener"' : '';


/* ---------------------------------------------------------------- hero: titolo che entra parola per parola */
(() => {
  const h = $('#title'), words = h.textContent.trim().split(/\s+/);
  h.setAttribute('aria-label', h.textContent.trim());
  h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${esc(w)}</span>`).join(' ');
  $$('.hero-copy .rv').forEach((el, i) => el.style.setProperty('--i', i === 0 ? 0 : words.length + i));
  document.fonts.ready.then(() => document.documentElement.classList.add('ready'));
})();

/* tessere che fluttuano intorno al titolo: un'icona per categoria (Chill è una di loro) */
(() => {
  const T = [
    { k: 'cut', x: 6, y: 20, s: 92, r: -9 }, { k: 'cards', x: 20, y: 52, s: 72, r: 7 }, { k: 'page', x: 3, y: 64, s: 66, r: -5 },
    { k: 'chill', x: 80, y: 13, s: 128, r: 0 }, { k: 'formula', x: 78, y: 54, s: 74, r: -7 }, { k: 'cal', x: 92, y: 62, s: 70, r: 6 },
  ];
  $('#tiles').innerHTML = T.map((t, i) => t.k === 'chill'
    ? `<div class="tile chill" style="--x:${t.x}%;--y:${t.y}%;--s:${t.s}px;--r:${t.r}deg;--d:${i * .7}s"><k-mascot intro></k-mascot></div>`
    : `<div class="tile k-tile" style="--x:${t.x}%;--y:${t.y}%;--s:${t.s}px;--r:${t.r}deg;--d:${i * .7}s">${svg(t.k)}</div>`).join('');
})();

/* anteprima di StudyCut che sale dal bagliore e si raddrizza scorrendo */
(() => {
  const st = TOOLS.find(t => t.id === 'studycut') || TOOLS.find(t => t.featured) || TOOLS[0];
  const p = $('#peek'); if (!st) { p.parentElement.remove(); return; }
  const segs = [[9, 's'], [3, 'p'], [7, 's'], [5, 'p'], [11, 's'], [2, 'p'], [6, 's'], [4, 'p'], [8, 's'], [3, 'p'], [10, 's'], [4, 'p'], [6, 's'], [3, 'p'], [11, 's']];
  const lib = [['Analisi II', 'Lezione 14', '1:32:10'], ['Fisica I', 'Lezione 9', '1:18:44'], ['Chimica', 'Esercitazione 3', '58:02'], ['Economia', 'Lezione 6', '1:41:30']];
  p.innerHTML = `<aside class="pk-side">
      <div class="pk-brand">${icon(st)}<b>${esc(st.name)}</b></div>
      <p class="pk-lab">Libreria</p>
      ${lib.map(([a, b, d], i) => `<div class="pk-item${i ? '' : ' on'}"><i></i><span><b>${a}</b><small>${b}, ${d}</small></span></div>`).join('')}
      <div class="pk-space"><span>Il tuo spazio</span><span>700 MB di 2 GB</span><div><i></i></div></div>
    </aside>
    <div class="pk-main">
      <div class="pk-top"><div class="pk-bar"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg><span>Incolla un link o cerca su YouTube</span><b>Scarica</b></div><span class="pk-av">G</span></div>
      <h3>Ciao, Giulia 👋</h3>
      <div class="pk-row">
        <div class="pk-stat sky"><small>Tempo risparmiato</small><b>4 h 12 min</b><span>questa settimana</span></div>
        <div class="pk-stat peri"><small>Velocità media</small><b>2,1×</b><span>senza pause</span></div>
        <div class="pk-card pk-lesson">
          <div class="pk-ch"><b>Analisi II, lezione 14</b><span class="pk-pill">Salta le pause</span></div>
          <div class="pk-tl">${segs.map(([m, k]) => `<i class="${k}" style="flex:${m}"></i>`).join('')}</div>
          <div class="pk-times"><span>Originale <b>1:32:10</b></span><span>Con ${esc(st.name)} <b>29:20</b></span></div>
        </div>
      </div>
      <div class="pk-row two">
        <div class="pk-card"><div class="pk-ch"><b>Velocità</b><span class="pk-pill ghost">2×</span></div>
          <div class="pk-speed">${['1×', '1,25×', '1,5×', '2×', '2,5×', '3×'].map((s, i) => `<span${i === 3 ? ' class="on"' : ''}>${s}</span>`).join('')}</div>
          <div class="pk-track"><i style="width:60%"></i></div></div>
        <div class="pk-card pk-export"><b>Portala con te</b><span>Esporti l’MP4 già tagliato, per telefono o tablet.</span><em>Crea a 2× senza pause</em></div>
      </div>
    </div>`;
  if (reduce) return;
  const w = p.parentElement;
  const tick = () => { const r = w.getBoundingClientRect(), vh = innerHeight;
    const k = Math.max(0, Math.min(1, (vh - r.top) / (vh * .9)));
    p.style.setProperty('--k', k.toFixed(3)); };
  addEventListener('scroll', () => requestAnimationFrame(tick), { passive: true }); addEventListener('resize', tick); tick();
})();

/* ---------------------------------------------------------------- tool: una tessera per categoria */
const SOON = { video: 'Lezioni, registrazioni e podcast.', pdf: 'Unire, comprimere, convertire.', memo: 'Flashcard, quiz e ripasso a intervalli.',
  calc: 'Formule, grafici e calcoli.', plan: 'Orari, scadenze e sessioni di studio.', write: 'Bibliografia, citazioni e tesi.' };
const CICON = { video: 'cut', pdf: 'page', memo: 'cards', calc: 'formula', plan: 'cal', write: 'book' };
(() => {
  const g = $('#grid'); if (!g) return;
  const cats = [...CATS, ...(TOOLS.some(t => !t.cat) ? [FALLBACK_CAT] : [])];
  g.innerHTML = cats.map(c => {
    const ts = TOOLS.filter(t => t.cat === c.id);
    if (!ts.length) return `<article class="cat soon"><span class="k-tile ct">${svg(CICON[c.id] || 'box')}</span><div><h3>${esc(c.name)}</h3><p>${esc(SOON[c.id] || 'Nuovi tool.')}</p></div><span class="soon-p">In arrivo</span></article>`;
    return `<article class="cat live"><div class="cat-h"><span class="k-tile ct">${svg(CICON[c.id] || 'box')}</span><h3>${esc(c.name)}</h3></div>
      ${ts.map(t => `<a class="tl-a" href="${t.url}"${ext(t)} data-tool="${t.id}"><span class="tl-n"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></span>
        ${t.tags.length ? `<span class="tags">${t.tags.map(x => `<span>${esc(x)}</span>`).join('')}</span>` : ''}<span class="k-btn">Apri ${esc(t.name)}</span></a>`).join('')}
      <div class="cat-f"><span class="st-t a"><small>${ts.length === 1 ? 'Tool pronto' : 'Tool pronti'}</small><b>${ts.length}</b></span><span class="st-t b"><small>Spazio per i tuoi file</small><b class="q">2 GB</b></span></div></article>`;
  }).join('');
  const live = TOOLS.length;
  $('#toolsN').textContent = `${live} ${live === 1 ? 'tool disponibile' : 'tool disponibili'}, gli altri sono in arrivo. Tutti gratis, con lo stesso account.`;
})();
fetch('/account/api/config').then(r => r.ok ? r.json() : null).then(c => { if (c && c.quota) { const q = `${Math.round(c.quota / (1 << 30))} GB`; $$('#factQ,.cat-f .q').forEach(e => e.textContent = q); } }).catch(() => {});

/* ---------------------------------------------------------------- header */
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$$('.kh').forEach(k => k.textContent = mac ? '⌘ K' : 'Ctrl K');
// la ricerca dell'hero passa nella barra in alto quando scorre sotto l'header
const topBar = $('#top'), hs = $('#hsearch'), ns = $('#nsearch');
let docked = null;
function onScroll() {
  topBar.classList.toggle('scrolled', scrollY > 8);
  const d = hs.getBoundingClientRect().bottom < topBar.offsetHeight;
  if (d === docked) return; docked = d;
  topBar.classList.toggle('docked', d);
  ns.tabIndex = d ? 0 : -1;
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
hs.onclick = () => openPal('', hs);
ns.onclick = () => openPal('', ns);

/* ---------------------------------------------------------------- account */
(async () => {
  // la home è pubblica: senza sessione compare "Accedi" (i tool chiedono comunque l'accesso)
  const r = await fetch('/account/api/me', { cache: 'no-store' }).catch(() => null);
  if (r && r.status === 401) { $('#acctIn').hidden = false; return; }
  const me = r && r.ok ? await r.json().catch(() => null) : null;
  if (!me) return; // nessun servizio account (es. in locale)
  const gb = n => n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} GB` : `${Math.round(n / (1 << 20))} MB`;
  const box = $('#acct'), b = $('#acctB'), m = $('#acctM'), p = Math.min(1, me.used / me.quota);
  $('#acctI').textContent = me.name[0].toUpperCase(); $('#acctN').textContent = me.name;
  $('#acctU').textContent = `${gb(me.used)} di ${gb(me.quota)}`; m.querySelector('.acct-s').classList.toggle('full', p > .9);
  box.hidden = false;
  const show = on => { m.hidden = !on; b.setAttribute('aria-expanded', on); if (on) requestAnimationFrame(() => $('#acctBar').style.transform = `scaleX(${p.toFixed(4)})`); };
  b.onclick = e => { e.stopPropagation(); show(m.hidden); };
  document.addEventListener('click', e => { if (!m.hidden && !box.contains(e.target)) show(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) { show(false); b.focus(); } });
  $('#acctOut').onclick = async () => { await fetch('/account/api/logout', { method: 'POST' }).catch(() => {}); location.reload(); };
})();

/* ---------------------------------------------------------------- ricerca */
const pal = $('#pal'), pq = $('#pq'), plist = $('#pList'), psc = $('#palSc');
let pSel = 0, pSrc = null;
function openPal(q, src) {
  if (!pal.hidden) return;
  pSrc = src || (docked ? ns : hs);
  pal.hidden = false; pal.classList.remove('out');
  document.documentElement.classList.add('lock');
  pq.value = q; renderPal();
  pq.focus({ preventScroll: true });
}
function closePal() {
  if (pal.hidden || pal.classList.contains('out')) return;
  pal.classList.add('out'); pq.blur();
  setTimeout(() => { pal.hidden = true; pal.classList.remove('out'); document.documentElement.classList.remove('lock'); pSrc && pSrc.focus({ preventScroll: true }); }, reduce ? 0 : 160);
}
const row = (t, q) => `<a class="pi" href="${t.url}"${ext(t)} data-tool="${t.id}">${icon(t)}<span class="pi-b"><b>${hl(t.name, q)}</b><span>${hl(t.desc, q)}</span></span><span class="pi-c">${esc(CAT[t.cat].name)}</span></a>`;
function renderPal() {
  const q = pq.value.trim();
  if (!q) {
    const rec = recents.filter(id => TOOL[id]), list = [...new Set([...rec, ...POPULAR])].slice(0, 8).map(id => TOOL[id]);
    plist.innerHTML = list.map(t => row(t, '')).join('');
    $('#palHint').textContent = FORMATS.length ? `Puoi cercare anche per formato, per esempio ${FORMATS.slice(0, 2).join(' o ')}.` : '';
  } else {
    const r = search(q).map(x => x.t);
    plist.innerHTML = r.map(t => row(t, q)).join('');
    $('#palHint').textContent = r.length ? '' : `Nessun tool per “${q}”. Prova con quello che devi fare, per esempio “togliere le pause”.`;
  }
  selPal(0, false);
}
function selPal(i, scroll = true) {
  const els = $$('.pi'); if (!els.length) return; pSel = (i + els.length) % els.length;
  els.forEach((e, k) => e.classList.toggle('on', k === pSel));
  if (scroll) els[pSel].scrollIntoView({ block: 'nearest' });
}
pq.addEventListener('input', renderPal);
pq.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); selPal(pSel + 1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); selPal(pSel - 1); }
  if (e.key === 'Enter') { const el = $$('.pi')[pSel]; if (el) { visit(el.dataset.tool); el.target ? open(el.href, '_blank', 'noopener') : (location.href = el.href); } }
});
plist.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('.pi'); if (el) { const k = $$('.pi').indexOf(el); if (k !== pSel) selPal(k, false); } });
psc.addEventListener('click', e => { if (e.target === psc) closePal(); });
$('#palX').onclick = closePal;
addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal('') : closePal(); return; }
  if (e.key === 'Escape') return closePal();
  if (e.key === '/' && pal.hidden && !e.target.matches('input,textarea')) { e.preventDefault(); openPal(''); }
});
addEventListener('pageshow', e => { if (e.persisted) { pal.hidden = true; document.documentElement.classList.remove('lock'); } });
