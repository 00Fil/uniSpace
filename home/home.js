/* StudyKit — home */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const isMob = () => matchMedia('(max-width:760px)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const store = { get: (k, d) => { try { return JSON.parse(localStorage['sk_' + k]) ?? d; } catch { return d; } }, set: (k, v) => { localStorage['sk_' + k] = JSON.stringify(v); } };

/* ---------------------------------------------------------------- dati */
// elenco tool e categorie: generato da tools/*/tool.json durante la build del gateway
const REG = await fetch('tools.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ categories: [], tools: [] }));
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

/* ---------------------------------------------------------------- header + hero */
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$$('.kh').forEach(k => k.textContent = mac ? '⌘ K' : 'Ctrl K');
$('#lead').textContent = TOOLS.length === 1 ? `${TOOLS[0].name}: ${TOOLS[0].desc}` : TOOLS.length ? `${TOOLS.length} tool gratuiti per l’università, tutti in un posto. ${TOOLS.map(t => t.name).join(' · ')}.` : 'I tool sono in arrivo.';
// formati supportati che scorrono nel campo di ricerca
const pills = FORMATS.map(f => `<span class="fmt" data-q="${esc(f)}">${esc(f)}</span>`).join('');
$('#tick').innerHTML = `<span class="tick-g">${pills}</span><span class="tick-g" aria-hidden="true">${pills}</span>`;
// la ricerca dell'hero passa nella barra in alto quando scorre sotto l'header
const topBar = $('#top'), hs = $('#hsearch'), ns = $('#nsearch');
let docked = null;
function onScroll() {
  topBar.classList.toggle('scrolled', scrollY > 8);
  const d = hs.getBoundingClientRect().top < topBar.offsetHeight + 12;
  if (d === docked) return; docked = d;
  topBar.classList.toggle('docked', d); hs.classList.toggle('gone', d);
  ns.tabIndex = d ? 0 : -1; hs.tabIndex = d ? -1 : 0;
}
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
hs.onclick = e => { const p = e.target.closest('[data-q]'); openPal(p ? p.dataset.q : '', hs); };
ns.onclick = () => openPal('', ns);

/* ---------------------------------------------------------------- ricerca a schermo intero */
const pal = $('#pal'), pq = $('#pq'), plist = $('#pList'), psc = $('#palSc'), pin = $('#palIn');
let pSel = 0, pSrc = null, pKey = '', pAnim = null;
const radius = el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12;
function morph(from, reverse) {
  // la barra parte dalla forma del campo cliccato e si allarga al centro
  const a = from.getBoundingClientRect(), b = pin.getBoundingClientRect();
  if (!a.width || reduce) return null;
  const k0 = { transform: `translate(${a.left - b.left}px,${a.top - b.top}px)`, width: a.width + 'px', height: a.height + 'px', borderRadius: radius(from) + 'px' };
  const k1 = { transform: 'translate(0,0)', width: b.width + 'px', height: b.height + 'px', borderRadius: radius(pin) + 'px' };
  return pin.animate(reverse ? [k1, k0] : [k0, k1], { duration: reverse ? 320 : 560, easing: reverse ? 'cubic-bezier(.4,0,.2,1)' : 'cubic-bezier(.2,.9,.1,1)', fill: reverse ? 'forwards' : 'none' });
}
function openPal(q, src) {
  if (!pal.hidden) return;
  pSrc = src || (docked ? ns : hs);
  pal.hidden = false; pal.classList.remove('out'); pal.classList.add('in');
  document.documentElement.classList.add('lock');
  pq.value = q; pKey = ''; renderPal(); psc.scrollTop = 0;
  pSrc.classList.add('lift');
  pAnim = morph(pSrc, false);
  pq.focus({ preventScroll: true });
  if (q) pq.setSelectionRange(q.length, q.length);
  setTimeout(() => pal.classList.remove('in'), 600);
}
function closePal() {
  if (pal.hidden || pal.classList.contains('out')) return;
  pal.classList.add('out'); pq.blur();
  // torna nel campo visibile in quel momento (hero o barra in alto)
  const dest = docked ? ns : hs, a = psc.scrollTop < 40 ? morph(dest, true) : null;
  const done = () => { pal.hidden = true; pal.classList.remove('out'); document.documentElement.classList.remove('lock'); pin.getAnimations().forEach(x => x.cancel());
    hs.classList.remove('lift'); ns.classList.remove('lift'); };
  setTimeout(done, reduce ? 0 : 330);
}
function card(t, q, i) {
  return `<a class="pi" href="${t.url}"${ext(t)} data-tool="${t.id}" style="--i:${Math.min(i, 18)}">${icon(t)}<div class="pi-b"><div class="t">${hl(t.name, q)}${t.isNew ? '<span class="new">Nuovo</span>' : ''}</div><div class="d">${hl(t.desc, q)}</div><div class="tg">${t.tags.map(x => `<span>${hl(x, q)}</span>`).join('')}</div></div></a>`;
}
function renderPal() {
  const q = pq.value.trim(); let groups;
  if (!q) {
    const rec = recents.filter(id => TOOL[id]), sug = [...new Set([...rec.slice(0, 3), ...POPULAR])].slice(0, 6).map(id => TOOL[id]);
    groups = [...(TOOLS.length > 6 ? [[rec.length ? 'Consigliati e recenti' : 'Consigliati', sug]] : []), ...[...CATS, FALLBACK_CAT].map(c => [c.name, TOOLS.filter(t => t.cat === c.id), c.c]).filter(g => g[1].length)];
    $('#palHint').textContent = `${TOOLS.length} tool` + (FORMATS.length ? ` · prova con un formato (${FORMATS.slice(0, 3).join(', ')}) o con quello che devi fare` : '');
  } else {
    const r = search(q).map(x => x.t); groups = r.length ? [['', r]] : [];
    $('#palHint').textContent = r.length ? `${r.length} risultat${r.length === 1 ? 'o' : 'i'} per “${q}”` : `Nessun tool per “${q}”`;
  }
  const key = q ? groups.map(g => g[1].map(t => t.id).join()).join('|') : '*';
  const anim = key !== pKey; pKey = key;
  let i = 0;
  plist.innerHTML = groups.length ? groups.map(([g, ts, c]) => `<section class="pal-g">${g ? `<h4 style="--cc:${c || 'var(--text)'}">${c ? '<i></i>' : ''}${esc(g)}</h4>` : ''}<div class="pal-grid">${ts.map(t => card(t, q, i++)).join('')}</div></section>`).join('')
    : `<div class="pal-empty">${FORMATS.length ? `Prova con un formato: ${FORMATS.slice(0, 5).map(f => `<button data-q="${esc(f)}">${esc(f)}</button>`).join(', ')}.` : 'Nessun tool disponibile.'}</div>`;
  plist.classList.toggle('anim', anim && !reduce);
  selPal(0, false);
}
function selPal(i, scroll = true) {
  const els = $$('.pi'); if (!els.length) return; pSel = Math.max(0, Math.min(els.length - 1, i));
  els.forEach((e, k) => e.classList.toggle('on', k === pSel));
  if (scroll) els[pSel].scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
}
// frecce: la carta più vicina nella riga sopra o sotto
function moveV(dir) {
  const els = $$('.pi'), c = els[pSel]; if (!c) return; const r = c.getBoundingClientRect(); let best = -1, bd = 1e9;
  els.forEach((e, k) => { const o = e.getBoundingClientRect(); const dy = (o.top - r.top) * dir; if (dy < 5) return;
    const d = dy * 4 + Math.abs(o.left - r.left); if (d < bd) { bd = d; best = k; } });
  if (best >= 0) selPal(best);
}
pq.addEventListener('input', () => { renderPal(); if (isMob() && pq.value && psc.scrollTop < 2) psc.scrollTo({ top: $('#palHead').offsetTop - 8, behavior: 'smooth' }); });
pq.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveV(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); moveV(-1); }
  if (e.key === 'Tab' && $$('.pi').length) { e.preventDefault(); selPal(pSel + (e.shiftKey ? -1 : 1)); }
  if (e.key === 'Enter') { const el = $$('.pi')[pSel]; if (el) { visit(el.dataset.tool); el.target ? open(el.href, '_blank', 'noopener') : (location.href = el.href); } }
});
plist.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('.pi'); if (el) { const k = $$('.pi').indexOf(el); if (k !== pSel) selPal(k, false); } });
plist.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) { pq.value = b.dataset.q; renderPal(); pq.focus(); } });
psc.addEventListener('click', e => { if (e.target === psc || e.target.classList.contains('pal-g') || e.target === plist || e.target.id === 'palHead') closePal(); });
psc.addEventListener('scroll', () => pal.classList.toggle('stuck', psc.scrollTop > $('#palHead').offsetTop - 12), { passive: true });
$('#palX').onclick = closePal;
addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal('') : closePal(); return; }
  if (e.key === 'Escape') return closePal();
  if (e.key === '/' && pal.hidden && !e.target.matches('input,textarea')) { e.preventDefault(); openPal(''); }
});
addEventListener('pageshow', e => { if (e.persisted) { pal.hidden = true; document.documentElement.classList.remove('lock'); hs.classList.remove('lift'); ns.classList.remove('lift'); } });

/* ---------------------------------------------------------------- vetrina a schermo intero */
// un "film" per ogni tool con "featured" nel tool.json. featured.demo sceglie il film da FILMS;
// senza film si usa quello generico (logo, titolo, pulsante). Ogni film è una funzione del tempo:
// render(ms) disegna lo stato esatto di quell'istante, così riparte, si ferma e si salta senza sorprese.
const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const expoIO = t => { t = clamp(t); return t === 0 || t === 1 ? t : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));
const clock = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const css = (el, o, { x = 0, y = 0, s = 1, blur = 0 } = {}) => {
  el.style.opacity = o.toFixed(3); el.style.visibility = o < .002 ? 'hidden' : '';
  el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
  el.style.filter = blur > .05 ? `blur(${blur.toFixed(1)}px)` : '';
};
const setT = (el, t) => { if (el.textContent !== t) el.textContent = t; };

// logo iniziale e finale (comune a tutti i film)
const logoHtml = (t, f) => `
  <div class="sh-logo"><span class="sh-ic">${icon(t)}</span><span class="sh-name">${esc(t.name)}</span></div>
  <div class="sh-end"><h2>${esc(f.headline || t.name)}</h2><p>${esc(f.sub || t.desc)}</p>
    <div class="sh-act"><a class="btn btn-p" href="${t.url}"${ext(t)} data-tool="${t.id}">Apri ${esc(t.name)}${svg('arrow')}</a>
    <button class="btn btn-s sh-replay" type="button">Rivedi</button></div></div>`;
function logoScenes(root, t0, t1) {
  // t0: fine del logo iniziale · t1: inizio del finale
  const logo = root.querySelector('.sh-logo'), ic = root.querySelector('.sh-ic'), nm = root.querySelector('.sh-name'), end = root.querySelector('.sh-end');
  const endKids = [...end.children];
  return t => {
    const inn = ease(span(t, 150, 950)), out = easeIO(span(t, t0 - 500, t0));
    const fin = ease(span(t, t1, t1 + 900));
    if (t < t1) {
      css(logo, inn * (1 - out), { y: -40 * out, s: (.86 + .14 * inn) * (1 + .5 * out), blur: 14 * (1 - inn) + 18 * out });
      css(ic, 1, { s: .7 + .3 * ease(span(t, 150, 1100)) }); css(nm, ease(span(t, 450, 1150)), { y: 14 * (1 - ease(span(t, 450, 1150))) });
    } else {
      css(logo, fin, { y: -root.clientHeight * .15 * easeIO(span(t, t1 + 600, t1 + 1500)), s: .9 + .1 * fin, blur: 10 * (1 - fin) });
      css(ic, 1, { s: 1 }); css(nm, 1);
    }
    endKids.forEach((k, i) => { const e = ease(span(t, t1 + 950 + i * 130, t1 + 1650 + i * 130)); css(k, e, { y: 22 * (1 - e), blur: 6 * (1 - e) }); });
    end.style.pointerEvents = t > t1 + 1000 ? 'auto' : 'none';
  };
}

const FILMS = {
  // StudyCut: video a schermo intero → si allontana → la traccia audio viene elaborata e accorciata
  //           → 92 min → 29 min → "Risparmiati 63 minuti" → logo
  cut: {
    length: 18400,
    from: 92 * 60 + 10, mid: 58 * 60 + 40, to: 29 * 60 + 20,
    segs: [[8, 0], [3.2, 1], [6, 0], [4.2, 1], [9, 0], [2.6, 1], [5, 0], [3.6, 1], [7, 0], [2.4, 1], [5.5, 0]],
    html(t, f) {
      const m = s => Math.round(s / 60);
      return `${logoHtml(t, f)}
      <div class="sh-ed">
        <div class="sh-vid">
          <div class="sv-scene">
            <div class="sv-board"><b>Analisi Matematica II</b><small>Lezione 14 · Integrali doppi</small>
              <div class="sv-math"><i style="width:62%"></i><i style="width:44%"></i><i style="width:71%"></i><i style="width:38%"></i></div></div>
            <svg class="sv-prof" viewBox="0 0 100 120"><circle cx="50" cy="34" r="19"/><path d="M12 120c2-34 18-52 38-52s36 18 38 52z"/></svg>
            <div class="sv-cap">…quindi l’integrale si spezza in due parti</div>
          </div>
          <div class="sv-bar"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg><span class="sv-cur">12:04</span><span class="sv-prog"><i></i></span><span class="sv-tot">${clock(this.from)}</span><span class="sv-x">1×</span></div>
          <div class="sv-badge">${tIcon(t)}<span>Elaborazione</span><b>0%</b></div>
        </div>
        <div class="sh-trk">
          <div class="st-row"><span class="st-l">Traccia audio</span><span class="st-r"><span class="st-n"></span><span class="st-t">${clock(this.from)}</span></span></div>
          <canvas class="st-cv"></canvas>
        </div>
      </div>
      <svg class="sh-defs" aria-hidden="true"><filter id="shMorph"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -5"/></filter></svg>
      <div class="sh-num">
        <div class="sh-cmp"><b class="sn-a">${m(this.from)}<small>min</small></b>
          <svg class="sn-arr" viewBox="0 0 48 24"><path pathLength="1" d="M3 12h40M34 4l9 8-9 8"/></svg>
          <b class="sn-b">${m(this.to)}<small>min</small></b></div>
        <div class="sh-sv"><small>Risparmiati</small><b>${m(this.from) - m(this.to)} minuti</b></div>
      </div>`;
    },
    mount(root) {
      const F = this, q = s => root.querySelector(s), SEG = F.segs, U = SEG.reduce((a, s) => a + s[0], 0);
      const ed = q('.sh-ed'), vid = q('.sh-vid'), scene = q('.sv-scene'), trk = q('.sh-trk'), cv = q('.st-cv'), ctx = cv.getContext('2d');
      const vCur = q('.sv-cur'), vTot = q('.sv-tot'), vProg = q('.sv-prog i'), vX = q('.sv-x'), badge = q('.sv-badge'), bPct = q('.sv-badge b'), bTxt = q('.sv-badge span');
      const stN = q('.st-n'), stT = q('.st-t'), stL = q('.st-l'), num = q('.sh-num'), cmp = q('.sh-cmp'), sv = q('.sh-sv');
      const nA = q('.sn-a'), nArr = q('.sn-arr'), nB = q('.sn-b'), arrP = q('.sn-arr path');
      // forma d'onda: parlato a sillabe, pause quasi piatte
      let seed = 5; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      const PER = 22, amp = [], starts = []; let u = 0;
      SEG.forEach(([w, sil]) => { starts.push(u); const n = Math.round(w * PER); let k2 = 0, len = 0, pk = 0;
        for (let k = 0; k < n; k++) {
          if (sil) { amp.push(.02 + rnd() * .025); continue; }
          if (k2 >= len) { k2 = 0; len = 5 + Math.floor(rnd() * 9); pk = .3 + rnd() * .7; }
          const env = Math.pow(Math.sin(Math.PI * (k2 + .5) / len), .7), edge = Math.min(1, (k + 1) / 4, (n - k) / 4);
          amp.push(Math.max(.035, pk * env * (.6 + rnd() * .4) * edge)); k2++;
        } u += w; });
      const ampAt = (i, f) => { const s0 = Math.round(starts[i] * PER), n = Math.round(SEG[i][0] * PER); return amp[s0 + Math.min(n - 1, Math.floor(f * n))]; };
      // tempi (ms)
      const LOGO_END = 2000, V_IN = 1650, DZ0 = 2700, DZ1 = 4100, TR0 = 3500, SC0 = 4500, SC1 = 8100, CUT = 1000,
        SP0 = 8500, SP1 = 9300, EX0 = 9800, EX1 = 10500, NB = 10300, MO0 = 12300, MO1 = 13200, SVOUT = 14500, END = 14700;
      const cutAt = SEG.map((s, i) => s[1] ? SC0 + (SC1 - SC0) * (starts[i] + s[0]) / U + 80 : 0);
      const logo = logoScenes(root, LOGO_END, END);
      // geometria: il video parte grande quanto la sezione e si allontana fino al suo posto
      let geo = null, W = 0, H = 0, dpr = 1;
      const measure = () => { vid.style.transform = 'none'; const r = vid.getBoundingClientRect(), R = root.getBoundingClientRect();
        const s = R.height > R.width ? R.width / r.width : Math.max(R.width / r.width, R.height / r.height) * 1.02; // in verticale non ritaglia troppo
        geo = { s, dx: R.left + R.width / 2 - (r.left + r.width / 2), dy: R.top + R.height / 2 - (r.top + r.height / 2) };
        dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
      addEventListener('resize', () => { geo = null; });
      function wave(t) {
        if (!W) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        const cuts = SEG.map((s, i) => s[1] ? easeIO((t - cutAt[i]) / CUT) : 0), spd = expoIO(span(t, SP0, SP1));
        const px = W / U * (1 - .5 * spd), reveal = easeIO(span(t, TR0 + 200, TR0 + 1100)), uh = U * span(t, SC0, SC1), mid = H / 2 + 8, hgt = (H - 30) / 2;
        let tot = 0; const xs = SEG.map((s, i) => { const x = tot; tot += s[0] * px * (1 - cuts[i]); return x; });
        const off = (W - tot) / 2; // la traccia resta centrata mentre si accorcia
        ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(off, mid - .5, tot * reveal, 1);
        SEG.forEach(([w, sil], i) => {
          const ws = w * px * (1 - cuts[i]); if (ws < .3) return; const x0 = off + xs[i], gone = cuts[i];
          if (sil) {
            const seen = clamp((uh - starts[i]) / w), glow = clamp(seen * 1.5) * (1 - gone);
            if (glow > .01) {
              ctx.fillStyle = `rgba(255,80,80,${(.16 * glow).toFixed(3)})`; ctx.strokeStyle = `rgba(255,110,110,${(.6 * glow).toFixed(3)})`;
              ctx.beginPath(); ctx.roundRect(x0 + .5, 20.5, Math.max(0, ws - 1), H - 22, 8); ctx.fill(); ctx.stroke();
              if (ws > 40) { ctx.fillStyle = `rgba(255,150,150,${glow.toFixed(3)})`; ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSA', x0 + ws / 2, 13); }
            }
          }
          for (let p = 0; p < ws; p += 2) {
            const gx = x0 + p; if (gx - off > W * reveal) break;
            const a = ampAt(i, p / ws) * hgt, done = starts[i] + w * (p / ws) <= uh;
            ctx.fillStyle = sil ? (done ? `rgba(255,130,130,${(.9 - .6 * gone).toFixed(3)})` : 'rgba(255,255,255,.3)') : done ? '#fff' : 'rgba(255,255,255,.38)';
            ctx.fillRect(gx, mid - a, 1.25, Math.max(1, a * 2));
          }
        });
        // fascio di analisi
        const bo = span(t, SC0 - 150, SC0) * (1 - span(t, SC1, SC1 + 200));
        if (bo > 0) {
          let i = SEG.findIndex((s, k) => uh < starts[k] + s[0]); if (i < 0) i = SEG.length - 1;
          const hx = off + xs[i] + SEG[i][0] * px * (1 - cuts[i]) * clamp((uh - starts[i]) / SEG[i][0]);
          const g = ctx.createLinearGradient(hx - 70, 0, hx, 0); g.addColorStop(0, 'rgba(120,160,255,0)'); g.addColorStop(1, `rgba(120,160,255,${(.28 * bo).toFixed(3)})`);
          ctx.fillStyle = g; ctx.fillRect(hx - 70, 18, 70, H - 18);
          ctx.save(); ctx.globalAlpha = bo; ctx.shadowColor = 'rgba(160,190,255,1)'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.fillRect(hx - 1, 16, 2, H - 16); ctx.restore();
        }
        return { cuts, spd };
      }
      return t => {
        if (!geo) measure();
        logo(t);
        // 1) video a schermo intero che si allontana
        const vin = ease(span(t, V_IN, V_IN + 700)), dz = expoIO(span(t, DZ0, DZ1)), k = 1 - dz;
        const ex = easeIO(span(t, EX0, EX1));
        css(ed, 1 - ex, { s: 1 - .06 * ex, y: -20 * ex, blur: 12 * ex });
        css(vid, vin, { x: geo.dx * k, y: geo.dy * k, s: (1 + (geo.s - 1) * k) * (1.05 - .05 * vin) });
        vid.style.borderRadius = (18 * dz).toFixed(1) + 'px';
        scene.style.transform = `scale(${(1.08 - .08 * span(t, V_IN, DZ1)).toFixed(4)})`; // leggero movimento di camera
        // 2) traccia audio ed elaborazione
        const tin = ease(span(t, TR0, TR0 + 800)); css(trk, tin, { y: 40 * (1 - tin) });
        const st = wave(t) || { cuts: SEG.map(() => 0), spd: 0 };
        const nSil = SEG.filter(s => s[1]).length, nCut = st.cuts.filter(c => c >= 1).length;
        const cutF = st.cuts.reduce((a, c) => a + c, 0) / nSil, dur = F.from - (F.from - F.mid) * cutF - (F.mid - F.to) * st.spd;
        setT(stT, clock(dur)); setT(vTot, clock(dur));
        setT(stN, nCut ? `${nCut} paus${nCut === 1 ? 'a tolta' : 'e tolte'}` : '');
        setT(vX, st.spd > .05 ? '2×' : '1×'); vX.classList.toggle('on', st.spd > .05);
        const pct = Math.round(100 * (.85 * span(t, SC0, SC1) + .15 * span(t, SP0, SP1)));
        setT(bPct, t > SP1 ? '✓' : pct + '%'); setT(bTxt, t > SP1 ? 'Fatto' : t > SC1 ? 'Velocità 2×' : 'Elaborazione');
        badge.classList.toggle('ok', t > SP1); stL.classList.toggle('busy', t > SC0 && t < SP1);
        const bIn = ease(span(t, SC0 - 300, SC0 + 200)); css(badge, bIn, { y: -10 * (1 - bIn) });
        const play = span(t, V_IN, SC0); setT(vCur, clock(724 + play * 40));
        vProg.style.transform = `scaleX(${(.13 + .02 * play).toFixed(4)})`;
        // 3) prima → dopo, in grande
        [nA, nArr, nB].forEach((el, i) => { const e = ease(span(t, NB + i * 160, NB + 520 + i * 160)); css(el, e, { y: 30 * (1 - e), blur: 10 * (1 - e) }); });
        arrP.style.strokeDashoffset = (1 - easeIO(span(t, NB + 160, NB + 760))).toFixed(3);
        // 4) dissolvenza + morphing nei minuti risparmiati
        const mo = easeIO(span(t, MO0, MO0 + 700)), mi = easeIO(span(t, MO0 + 120, MO1)), so = easeIO(span(t, SVOUT, SVOUT + 450));
        cmp.style.opacity = (1 - mo).toFixed(3); cmp.style.filter = mo > .01 ? `blur(${(9 * mo).toFixed(1)}px)` : '';
        css(sv, mi * (1 - so), { s: (.92 + .08 * mi) * (1 - .06 * so), blur: 9 * (1 - mi) + 10 * so, y: -24 * so });
        num.classList.toggle('mf', t > MO0 && t < MO1 + 60);
        num.style.visibility = t > NB - 50 && t < SVOUT + 500 ? 'visible' : 'hidden';
      };
    },
  },
};
// film generico: logo → titolo → pulsante
const GENERIC = { length: 7000, html: (t, f) => logoHtml(t, f), mount(root) { const l = logoScenes(root, 2000, 2000); return t => l(t); } };

const FEAT = TOOLS.filter(t => t.featured).map(t => ({ id: t.id, ...t.featured }));
const shows = FEAT.map(f => {
  const t = TOOL[f.id], film = FILMS[f.demo] || GENERIC;
  const sec = document.createElement('section'); sec.className = 'show'; sec.style.setProperty('--cc', CAT[t.cat].c); sec.setAttribute('aria-label', t.name);
  sec.innerHTML = `<canvas class="sh-bg" aria-hidden="true"></canvas><div class="sh-vig"></div><div class="sh-film">${film.html(t, f)}</div><div class="sh-prog"><i></i></div>`;
  $('main').append(sec);
  const root = sec.querySelector('.sh-film'), render = film.mount(root), bar = sec.querySelector('.sh-prog i'), L = film.length;
  // sfondo WebGL dal tool.json (fx + preset), più visibile durante logo e finale
  const cv = sec.querySelector('.sh-bg');
  const bg = window.FX && (f.fx === 'tunnel' && FX.tunnel ? FX.tunnel(cv, { ...f.preset, center: () => [0, 0] })
    : f.fx === 'topo' && FX.topo ? FX.topo(cv, f.preset) : f.fx === 'slats' && FX.slats ? FX.slats(cv, f.preset)
    : f.fx === 'waves' && FX.waves ? FX.waves(cv, f.preset) : null);
  let raf = 0, t0 = 0, on = false;
  const draw = t => { render(t); bar.style.transform = `scaleX(${(t / L).toFixed(4)})`;
    const lo = t < 2300 ? .85 : t > L - 4000 ? .85 : .16; cv.style.opacity = lo; };
  const frame = () => { const t = performance.now() - t0;
    if (t >= L) { draw(L - 1); raf = 0; // resta sul finale, poi dissolve e ricomincia
      idleT = setTimeout(() => { if (!on) return; root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease-in' }).onfinish = () => on && play(0); }, 3000); return; }
    draw(t); raf = requestAnimationFrame(frame); };
  let idleT = 0;
  function play(from = 0) { cancelAnimationFrame(raf); clearTimeout(idleT); t0 = performance.now() - from; raf = requestAnimationFrame(frame); }
  function pause() { cancelAnimationFrame(raf); raf = 0; clearTimeout(idleT); }
  sec.querySelector('.sh-replay').onclick = () => play(0);
  if (reduce) { draw(L - 1); return; }
  draw(0);
  new IntersectionObserver(es => { const vis = es[0].isIntersecting && !document.hidden;
    if (vis && !on) { on = true; play(0); bg && bg.start(); } else if (!vis && on) { on = false; pause(); bg && bg.stop(); } }, { threshold: .55 }).observe(sec);
  return { sec, pause };
});
document.addEventListener('visibilitychange', () => { if (document.hidden) shows.forEach(s => s.pause()); });

/* sfondo dell'hero */
const heroFx = window.FX && FX.shapes($('#heroFx'), { color: '#1f1f23', hoverColor: '#d8d8dc', backgroundColor: '#000000', cellSize: 12, brightness: .3, fade: .4, splashRadius: 60, splashStrength: .45 });
if (heroFx) { $('#heroFx').classList.add('on'); new IntersectionObserver(es => es[0].isIntersecting ? heroFx.start() : heroFx.stop()).observe($('#heroFx')); }

