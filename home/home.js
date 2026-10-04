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

/* ---------------------------------------------------------------- carosello */
// in evidenza: i tool con "featured" nel tool.json (al massimo 6)
/* demo animate per le copertine: "featured.demo" nel tool.json sceglie quale usare.
   html() crea il markup, run(el) lo anima e restituisce { start, stop }. */
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
const easeIO = t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clock = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const DEMOS = {
  /* "cut": una vera forma d'onda da timeline. La testina la scorre, le parti piatte (pause) si accendono
     e si chiudono lentamente, poi la timeline sparisce: prima → dopo in grande, e infine i minuti risparmiati. */
  cut: {
    segs: [[9, 0], [3, 1], [7, 0], [4, 1], [11, 0], [2.5, 1], [6, 0], [3.5, 1], [8, 0]],
    from: 92, mid: 58, to: 29,
    html() {
      return `<div class="dm dm-cut"><div class="dm-stage">
        <div class="dm-tl">
          <div class="dm-row"><span class="dm-lbl">Lezione originale</span><span class="dm-r"><span class="dm-time">${this.from} min</span><span class="dm-x">1×</span></span></div>
          <canvas class="dm-cv"></canvas>
        </div>
        <svg class="dm-defs" aria-hidden="true"><filter id="dmMorph"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9"/></filter></svg>
        <div class="dm-morph">
          <div class="dm-cmp"><b class="dm-a">${this.from}<small>min</small></b><svg class="dm-arr" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg><b class="dm-b">${this.to}<small>min</small></b></div>
          <div class="dm-sv"><small>Risparmiati</small><b>${this.from - this.to} minuti</b></div>
        </div>
      </div></div>`;
    },
    run(root) {
      const self = this, cv = root.querySelector('.dm-cv'), ctx = cv.getContext('2d');
      const tl = root.querySelector('.dm-tl'), lbl = root.querySelector('.dm-lbl'), chip = root.querySelector('.dm-x'), time = root.querySelector('.dm-time');
      const morph = root.querySelector('.dm-morph'), cmp = root.querySelector('.dm-cmp'), sv = root.querySelector('.dm-sv');
      const cA = root.querySelector('.dm-a'), cArr = root.querySelector('.dm-arr'), cB = root.querySelector('.dm-b');
      const SEG = this.segs, U = SEG.reduce((a, s) => a + s[0], 0);
      // campioni della forma d'onda: parlato = sillabe con inviluppo, pausa = quasi piatta
      let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      const PER = 14, amp = [], starts = [];
      let u = 0;
      SEG.forEach(([w, sil]) => { starts.push(u); const n = Math.round(w * PER);
        let syl = 0, len = 0, peak = 0;
        for (let k = 0; k < n; k++) {
          if (sil) { amp.push(.025 + rnd() * .03); continue; }
          if (syl >= len) { syl = 0; len = 4 + Math.floor(rnd() * 7); peak = .35 + rnd() * .65; }
          const env = Math.sin(Math.PI * (syl + .5) / len) ** .8, edge = Math.min(1, k / 3, (n - 1 - k) / 3 + .2);
          amp.push(Math.max(.04, peak * env * (.55 + rnd() * .45) * edge)); syl++;
        }
        u += w; });
      const ampAt = (i, f) => { const s0 = Math.round(starts[i] * PER), n = Math.round(SEG[i][0] * PER); return amp[s0 + Math.min(n - 1, Math.floor(f * n))]; };
      // tempi (ms)
      const IN = 450, SCAN = 2700, S0 = IN, S1 = IN + SCAN, CUT = 820, SPD0 = S1 + 120, SPD1 = SPD0 + 520,
        TLO0 = SPD1 + 260, TLO1 = TLO0 + 380, B0 = TLO1 - 120, M0 = B0 + 1650, M1 = M0 + 750, OUT0 = M1 + 1700, CYCLE = OUT0 + 420;
      const uAt = c => U * Math.max(0, Math.min(1, (c - S0) / SCAN));
      const cutT = SEG.map((s, i) => s[1] ? S0 + SCAN * (starts[i] + s[0]) / U + 60 : 0); // la pausa si chiude dopo che la testina l'ha passata
      const clamp = x => Math.max(0, Math.min(1, x)), set = (el, t) => { if (el.textContent !== t) el.textContent = t; };
      const pop = el => el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      let raf = 0, t0 = 0, W = 0, H = 0, dpr = 1, lastCyc = -1, lastChip = '';
      const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); const w = cv.clientWidth, h = cv.clientHeight;
        if (w && (w !== W || h !== H)) { W = w; H = h; cv.width = w * dpr; cv.height = h * dpr; } };
      const style = (el, o, y = 0, blur = 0, sc = 1) => { el.style.opacity = o.toFixed(3); el.style.transform = `translateY(${y.toFixed(1)}px) scale(${sc.toFixed(3)})`; el.style.filter = blur > .05 ? `blur(${blur.toFixed(1)}px)` : ''; };
      function draw(c) {
        fit(); if (!W) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        const cuts = SEG.map((s, i) => s[1] ? easeIO((c - cutT[i]) / CUT) : 0);
        const spd = easeIO((c - SPD0) / (SPD1 - SPD0)), sx = 1 - .5 * spd;               // a 2× la timeline si dimezza
        const px = W / U * sx, reveal = ease((c) / IN), uh = uAt(c), mid = H / 2 + 6;
        // layout attuale
        const xs = []; let x = 0; SEG.forEach((s, i) => { xs.push(x); x += s[0] * px * (1 - cuts[i]); }); const total = x;
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, mid - .5, total * reveal, 1);
        SEG.forEach(([w, sil], i) => {
          const ws = w * px * (1 - cuts[i]); if (ws < .3) return;
          const x0 = xs[i], seen = clamp((uh - starts[i]) / w), gone = cuts[i];
          if (sil) { // pausa: si illumina mentre la testina la attraversa, poi si chiude
            const glow = clamp(seen * 1.6) * (1 - gone);
            if (glow > .01) {
              ctx.fillStyle = `rgba(255,86,86,${(.2 * glow).toFixed(3)})`; ctx.strokeStyle = `rgba(255,110,110,${(.65 * glow).toFixed(3)})`;
              ctx.beginPath(); ctx.roundRect(x0 + .5, 14.5, Math.max(0, ws - 1), H - 15, 7); ctx.fill(); ctx.stroke();
              if (ws > 22) { ctx.fillStyle = `rgba(255,150,150,${glow.toFixed(3)})`; ctx.font = '700 9.5px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSA', x0 + ws / 2, 9); }
            }
          }
          const step = 1.5, hgt = (H - 22) / 2;
          for (let p = 0; p < ws; p += step) {
            const gx = x0 + p; if (gx > W * reveal) break;
            const a = ampAt(i, p / ws) * hgt, played = starts[i] + w * (p / ws) <= uh;
            ctx.fillStyle = sil ? (played ? `rgba(255,140,140,${(.9 - gone * .6).toFixed(3)})` : 'rgba(255,255,255,.3)') : played ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.34)';
            ctx.fillRect(gx, mid - a, 1.1, a * 2 || 1);
          }
        });
        // testina
        if (c > S0 - 100 && c < SPD0) {
          let i = SEG.findIndex((s, k) => uh < starts[k] + s[0]); if (i < 0) i = SEG.length - 1;
          const hx = xs[i] + SEG[i][0] * px * (1 - cuts[i]) * clamp((uh - starts[i]) / SEG[i][0]);
          const o = clamp((c - S0 + 100) / 150) * (1 - clamp((c - S1) / 120));
          ctx.save(); ctx.globalAlpha = o; ctx.shadowColor = 'rgba(160,190,255,.95)'; ctx.shadowBlur = 12; ctx.fillStyle = '#fff';
          ctx.fillRect(Math.min(hx, total) - 1, 12, 2, H - 12); ctx.restore();
        }
        return { cuts, spd };
      }
      function frame(now) {
        const T = now - t0, c = T % CYCLE, cyc = Math.floor(T / CYCLE);
        if (cyc !== lastCyc) { lastCyc = cyc; lastChip = ''; }
        const st = draw(c) || { cuts: SEG.map(() => 0), spd: 0 };
        // intestazione: pause tolte e minuti che scendono man mano
        const nCut = st.cuts.filter(x => x >= 1).length, cutF = st.cuts.reduce((a, x) => a + x, 0) / 4;
        set(lbl, nCut ? `${nCut} paus${nCut === 1 ? 'a tolta' : 'e tolte'}` : 'Lezione originale');
        const mins = self.from - (self.from - self.mid) * cutF - (self.mid - self.to) * st.spd;
        set(time, `${Math.round(mins)} min`);
        const ch = st.spd > .02 ? '2×' : '1×'; if (ch !== lastChip) { if (lastChip) pop(chip); lastChip = ch; set(chip, ch); }
        // 1) la timeline sparisce
        const tlo = easeIO((c - TLO0) / (TLO1 - TLO0)), tin = ease(c / 300);
        style(tl, tin * (1 - tlo), -10 * tlo, 6 * tlo, 1 - .04 * tlo);
        // 2) prima → dopo, in grande (entrata veloce a cascata)
        const bIn = k => ease((c - B0 - k * 110) / 380), mOut = easeIO((c - M0) / (M1 - M0) * 1.35);
        [cA, cArr, cB].forEach((el, k) => { const e = bIn(k); style(el, e, 14 * (1 - e), 4 * (1 - e)); });
        // 3) dissolvenza + morphing nei minuti risparmiati (filtro a soglia sul contenitore)
        const mIn = easeIO((c - M0 - 180) / (M1 - M0 - 180)), out = easeIO((c - OUT0) / 380);
        cmp.style.opacity = (1 - mOut).toFixed(3); cmp.style.filter = mOut > .01 ? `blur(${(mOut * 12).toFixed(1)}px)` : '';
        style(sv, mIn * (1 - out), 0, (1 - mIn) * 12 + out * 6, .9 + .1 * mIn);
        const morphing = c > M0 && c < M1 + 60; if (morph.classList.contains('mf') !== morphing) morph.classList.toggle('mf', morphing);
        root.classList.toggle('saved', mIn > .5);
        raf = requestAnimationFrame(frame);
      }
      const final = () => { tl.style.opacity = 0; cmp.style.opacity = 0; sv.style.opacity = 1; root.classList.add('saved'); };
      return {
        start() { if (raf) return; if (reduce) return final(); t0 = performance.now(); lastCyc = -1; raf = requestAnimationFrame(frame); },
        stop() { cancelAnimationFrame(raf); raf = 0; },
      };
    },
  },
};
const FEAT = TOOLS.filter(t => t.featured).slice(0, 6).map(t => ({ id: t.id, fx: 'shapes', ...t.featured }));
if (!FEAT.length) $('.feat').hidden = true;
if (FEAT.length < 2) { $('.car-nav').hidden = true; $('#tabs').hidden = true; }
$('#tabs').style.setProperty('--n', Math.max(FEAT.length, 1));
const car = $('#car'), track = $('#track');
track.innerHTML = FEAT.map((f, i) => { const t = TOOL[f.id], c = CAT[t.cat];
  const demo = f.demoHtml || (DEMOS[f.demo] ? DEMOS[f.demo].html() : '');
  return `<article class="slide${demo ? ' has-demo' : ''}" data-i="${i}" style="--cc:${c.c}" aria-label="${esc(t.name)}">
    <canvas></canvas>
    <div class="s-copy">
      <div class="s-top">${icon(t)}<span class="s-name">${esc(t.name)}</span></div>
      <h3>${esc(f.headline || t.name)}</h3>
      <p>${esc(f.sub || t.desc)}</p>
      <div class="s-act"><a class="btn btn-p" href="${t.url}"${ext(t)} data-tool="${t.id}">Apri ${esc(t.name)}${svg('arrow')}</a></div>
    </div>
    ${demo ? `<div class="s-demo">${demo}</div>` : ''}
  </article>`; }).join('');
$('#tabs').innerHTML = FEAT.map((f, i) => `<button class="tab" role="tab" data-i="${i}" aria-label="${esc(TOOL[f.id].name)}"><i></i><span class="tn">${tIcon(TOOL[f.id])}${esc(TOOL[f.id].name)}</span><small>${esc(CAT[TOOL[f.id].cat].name)}</small></button>`).join('');
const slides = $$('.slide'), tabs = $$('.tab'), N = slides.length;
const demos = slides.map((s, i) => { const d = DEMOS[FEAT[i].demo], el = s.querySelector('.dm'); return d && d.run && el ? d.run(el) : null; });
// effetti WebGL: uno per slide, acceso solo quello visibile
const fx = slides.map((s, i) => {
  const f = FEAT[i], cv = s.querySelector('canvas');
  if (!window.FX) return null;
  if (f.fx === 'waves') return FX.waves(cv, { mouseInteraction: true, ...f.preset });
  if (f.fx === 'topo') return FX.topo && FX.topo(cv, f.preset);
  if (f.fx === 'slats') return FX.slats && FX.slats(cv, f.preset);
  if (f.fx === 'tunnel') return FX.tunnel && FX.tunnel(cv, { ...f.preset,
    center: (W, H) => { const m = Math.min(W, H); return isMob() ? [0, (.5 - .24) * H / m] : innerWidth <= 1020 ? [.2 * W / m, 0] : [(.73 - .5) * W / m, 0]; } });
  if (!FX.shapes) return null;
  return FX.shapes(cv, { text: TOOL[f.id].name, ...f.preset, splashRadius: 46, splashStrength: .5, introDuration: 1.3, fontWeight: 700,
    textBox: () => { const W = cv.clientWidth, H = cv.clientHeight;
      return isMob() ? { cx: W / 2, cy: H * .2, w: W * .95, h: H * .34 } : W < 1000 * .97 && innerWidth <= 1020 ? { cx: W * .74, cy: H * .5, w: W * .48, h: H * .6 } : { cx: W * .73, cy: H * .5, w: W * .5, h: H * .62 }; } });
});
let cur = 0, prevO = slides.map(() => 0), carVisible = true;
function layout(jump = false) {
  slides.forEach((s, i) => {
    let o = ((i - cur) % N + N) % N; if (o > N / 2) o -= N;
    const big = Math.abs(o - prevO[i]) > 1;
    if (big || jump) s.classList.add('jump');
    s.style.setProperty('--o', o); s.style.setProperty('--s', o ? .9 : 1); s.style.setProperty('--op', Math.abs(o) <= 1 ? 1 : 0);
    s.classList.toggle('cur', o === 0); s.setAttribute('aria-hidden', o !== 0); s.inert = o !== 0;
    prevO[i] = o;
    if (big || jump) { void s.offsetWidth; requestAnimationFrame(() => s.classList.remove('jump')); }
  });
  tabs.forEach((t, i) => { t.classList.toggle('on', i === cur); t.setAttribute('aria-selected', i === cur); t.style.setProperty('--p', 0); });
  runFx();
}
let fxTimers = [];
function runFx() {
  fxTimers.forEach(clearTimeout); fxTimers = [];
  fx.forEach((f, i) => { if (!f) return;
    if (i === cur && carVisible) { f.relayout && f.relayout(); f.start(); }
    else fxTimers.push(setTimeout(() => f.stop(), 800)); });
  demos.forEach((d, i) => d && (i === cur && carVisible && !document.hidden ? d.start() : d.stop()));
}
document.addEventListener('visibilitychange', () => runFx());
function go(i) { if (!N) return; cur = (i + N) % N; layout(); restartAuto(); }
$('#prev').onclick = () => go(cur - 1); $('#next').onclick = () => go(cur + 1);
tabs.forEach(t => t.onclick = () => go(+t.dataset.i));
car.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
slides.forEach((s, i) => s.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); return; } if (i !== cur) { e.preventDefault(); go(i); } }, true));
// trascinamento
let drag = null, moved = false;
car.addEventListener('pointerdown', e => {
  if (e.button > 0 || e.target.closest('a,button')) { moved = false; if (e.pointerType === 'mouse') return; }
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, on: false, dx: 0, lx: e.clientX, lt: performance.now(), v: 0 }; moved = false;
});
addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.on) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; moved = true; car.classList.add('dragging'); pauseAuto(true); } else if (Math.abs(dy) > 10) { drag = null; return; } else return; }
  const now = performance.now(); drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.lt); drag.lx = e.clientX; drag.lt = now;
  drag.dx = dx; car.style.setProperty('--drag', `${dx}px`);
});
const dragEnd = () => {
  if (!drag) return; const d = drag; drag = null; if (!d.on) return;
  car.classList.remove('dragging'); car.style.setProperty('--drag', '0px'); pauseAuto(false);
  const w = slides[0].offsetWidth;
  if (d.dx < -w * .18 || d.v < -.45) go(cur + 1); else if (d.dx > w * .18 || d.v > .45) go(cur - 1); else layout();
  setTimeout(() => { moved = false; }, 50);
};
addEventListener('pointerup', dragEnd); addEventListener('pointercancel', dragEnd);
// autoplay con avanzamento nella tab
const DUR = 7000; let autoT0 = performance.now(), autoPaused = 0, hoverPause = false, pausedAt = 0;
function restartAuto() { autoT0 = performance.now(); }
function pauseAuto(on) { if (on) { if (!pausedAt) pausedAt = performance.now(); } else if (pausedAt) { autoT0 += performance.now() - pausedAt; pausedAt = 0; } }
car.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hoverPause = true; pauseAuto(true); } });
car.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hoverPause = false; pauseAuto(false); } });
(function tick() {
  const stop = reduce || document.hidden || !carVisible || !pal.hidden;
  if (stop && !pausedAt) pauseAuto(true); else if (!stop && !hoverPause && !drag && pausedAt) pauseAuto(false);
  if (N < 2) return;
  const p = Math.min(1, ((pausedAt || performance.now()) - autoT0) / DUR);
  tabs[cur].style.setProperty('--p', p.toFixed(4));
  if (p >= 1) go(cur + 1);
  requestAnimationFrame(tick);
})();
new IntersectionObserver(es => { carVisible = es[0].isIntersecting; runFx(); }, { threshold: .15 }).observe(car);
if (N) layout(true);
// disegna subito un fotogramma anche per le slide laterali
fx.forEach((f, i) => { if (f && i !== cur) { f.start(); setTimeout(() => i !== cur && f.stop(), 250 + i * 60); } });

/* sfondo dell'hero */
const heroFx = window.FX && FX.shapes($('#heroFx'), { color: '#1f1f23', hoverColor: '#d8d8dc', backgroundColor: '#000000', cellSize: 12, brightness: .3, fade: .4, splashRadius: 60, splashStrength: .45 });
if (heroFx) { $('#heroFx').classList.add('on'); new IntersectionObserver(es => es[0].isIntersecting ? heroFx.start() : heroFx.stop()).observe($('#heroFx')); }

