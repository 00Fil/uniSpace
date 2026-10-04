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

/* ---------------------------------------------------------------- account */
// con gli account attivi (gateway) mostra chi è entrato, lo spazio usato, il profilo e il tasto Esci
(async () => {
  // la home è pubblica: senza sessione compare "Accedi" (i tool chiedono comunque l'accesso)
  const r = await fetch('/account/api/me', { cache: 'no-store' }).catch(() => null);
  if (r && r.status === 401) { $('#acctIn').hidden = false; return; }
  const me = r && r.ok ? await r.json().catch(() => null) : null;
  if (!me) return; // nessun servizio account (es. in locale)
  const gb = n => n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} GB` : `${Math.round(n / (1 << 20))} MB`;
  const box = $('#acct'), b = $('#acctB'), m = $('#acctM'), p = Math.min(1, me.used / me.quota);
  $('#acctI').textContent = $('#acctAv').textContent = me.name[0]; $('#acctN').textContent = me.name;
  $('#acctU').textContent = `${gb(me.used)} di ${gb(me.quota)}`; m.querySelector('.acct-s').classList.toggle('full', p > .9);
  box.hidden = false;
  const show = on => { m.hidden = !on; b.setAttribute('aria-expanded', on); if (on) requestAnimationFrame(() => $('#acctBar').style.transform = `scaleX(${p.toFixed(4)})`); };
  b.onclick = e => { e.stopPropagation(); show(m.hidden); };
  document.addEventListener('click', e => { if (!m.hidden && !box.contains(e.target)) show(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) show(false); });
  $('#acctOut').onclick = async () => { await fetch('/account/api/logout', { method: 'POST' }).catch(() => {}); location.reload(); };
})();

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
    length: 18600,
    from: 92 * 60 + 10, mid: 58 * 60 + 40, to: 29 * 60 + 20,
    segs: [[8, 0], [3.2, 1], [6, 0], [4.2, 1], [9, 0], [2.6, 1], [5, 0], [3.6, 1], [7, 0], [2.4, 1], [5.5, 0]],
    speeds: ['1×', '1,25', '1,5', '2×', '2,5', '3×'],
    html(t, f) {
      const m = s => Math.round(s / 60), ch = (d, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${d}</svg>`;
      return `${logoHtml(t, f)}
      <div class="sh-ed"><div class="sc-win">
        <div class="sc-hd">
          <div class="sc-brand">${icon(t)}<span>${esc(t.name)}</span></div>
          <div class="sc-title"><b>Analisi Matematica II</b> · Lezione 14</div>
          <div class="sc-hr"><span class="sc-chip sc-st">Originale</span></div>
        </div>
        <div class="sc-body">
          <div class="sc-stage">
            <div class="sc-vid"><div class="sc-scene">
              <div class="sc-slide">
                <span class="sc-kick">Integrali doppi</span>
                <b>Formula di riduzione</b>
                <div class="sc-f">∬<sub>D</sub> f(x, y) dx dy = ∫<sub>a</sub><sup>b</sup> ( ∫<sub>g₁(x)</sub><sup>g₂(x)</sup> f(x, y) dy ) dx</div>
                <svg class="sc-plot" viewBox="0 0 220 130"><path class="ax" d="M14 116h196M14 116V8"/><path class="rg" d="M44 96c30-6 60-4 120-14v-52c-50 10-84 6-120 18z"/><path class="cv" d="M44 96c30-6 60-4 120-14M44 48c36-12 70-8 120-18"/><path class="ax" d="M44 116V96M164 116V82"/><text x="40" y="128">a</text><text x="160" y="128">b</text><text x="96" y="70">D</text></svg>
              </div>
              <div class="sc-cap">…quindi l’integrale si spezza in due parti</div>
            </div></div>
            <canvas class="sc-seek"></canvas>
            <div class="sc-crow">
              <span class="sc-ib">${ch('<path d="M8.5 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L10 4.74a1 1 0 0 0-1.5.86z"/>', 'fill')}</span>
              <span class="sc-time"><b class="sc-cur">12:04</b> / <span class="sc-tot">${clock(this.from)}</span></span>
              <span class="sc-grow"></span>
              <span class="sc-pill sc-skip">${ch('<path d="m5 12.5 4.5 4.5L19 7.5"/>')}Salta silenzi</span>
              <span class="sc-pill sc-px">1×</span>
            </div>
          </div>
          <div class="sc-panel">
            <div class="sc-grp"><div class="sc-gt">Velocità</div><div class="sc-big"><span class="sc-sv">1,00</span><small>×</small></div>
              <div class="sc-seg"><span class="sc-ind"></span>${this.speeds.map((s, i) => `<span class="${i ? '' : 'on'}">${s}</span>`).join('')}</div></div>
            <div class="sc-grp"><div class="sc-row"><div><div class="sc-lbl">Salta i silenzi</div><div class="sc-sub">Tocca per cercare le pause</div></div><span class="sc-sw"></span></div></div>
            <div class="sc-grp sc-kvg"><div class="sc-gt">Durata</div><div class="sc-kv">
              <div><span>Originale</span><b>${clock(this.from)}</b></div>
              <div><span>Senza pause</span><b class="sc-k1">—</b></div>
              <div><span>Con velocità</span><b class="sc-k2">—</b></div>
              <div class="good"><span>Risparmi</span><b class="sc-k3">—</b></div></div></div>
            <div class="sc-grp"><span class="sc-btn"><i></i><span class="sc-bl">Crea a 1×</span></span></div>
          </div>
        </div>
      </div></div>
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
      const ed = q('.sh-ed'), win = q('.sc-win'), vid = q('.sc-vid'), scene = q('.sc-scene'), cv = q('.sc-seek'), ctx = cv.getContext('2d');
      const cur = q('.sc-cur'), tot = q('.sc-tot'), px2 = q('.sc-px'), skip = q('.sc-skip'), st = q('.sc-st');
      const sv = q('.sc-sv'), ind = q('.sc-ind'), segBtns = [...root.querySelectorAll('.sc-seg span:not(.sc-ind)')], sw = q('.sc-sw'), sub = q('.sc-sub');
      const k1 = q('.sc-k1'), k2 = q('.sc-k2'), k3 = q('.sc-k3'), btn = q('.sc-btn'), bFill = q('.sc-btn i'), bLbl = q('.sc-bl');
      const num = q('.sh-num'), cmp = q('.sh-cmp'), svd = q('.sh-sv'), nA = q('.sn-a'), nArr = q('.sn-arr'), nB = q('.sn-b'), arrP = q('.sn-arr path');
      // forma d'onda: parlato a sillabe, pause quasi piatte
      let seed = 5; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      const PER = 22, amp = [], starts = []; let u = 0;
      SEG.forEach(([w, sil]) => { starts.push(u); const n = Math.round(w * PER); let k2 = 0, len = 0, pk = 0;
        for (let k = 0; k < n; k++) {
          if (sil) { amp.push(.02 + rnd() * .02); continue; }
          if (k2 >= len) { k2 = 0; len = 5 + Math.floor(rnd() * 9); pk = .3 + rnd() * .7; }
          const env = Math.pow(Math.sin(Math.PI * (k2 + .5) / len), .7), edge = Math.min(1, (k + 1) / 4, (n - k) / 4);
          amp.push(Math.max(.035, pk * env * (.6 + rnd() * .4) * edge)); k2++;
        } u += w; });
      const ampAt = (i, f) => { const s0 = Math.round(starts[i] * PER), n = Math.round(SEG[i][0] * PER); return amp[s0 + Math.min(n - 1, Math.floor(f * n))]; };
      // tempi (ms)
      const LOGO_END = 2000, V_IN = 1650, DZ0 = 2800, DZ1 = 4300, TR0 = 3600, SC0 = 4800, SC1 = 8500, CUT = 1000,
        SP0 = 8900, SP1 = 9700, EX0 = 10200, EX1 = 10900, NB = 10700, MO0 = 12700, MO1 = 13600, SVOUT = 14900, END = 15100;
      const cutAt = SEG.map((s, i) => s[1] ? SC0 + (SC1 - SC0) * (starts[i] + s[0]) / U + 80 : 0);
      const logo = logoScenes(root, LOGO_END, END);
      // geometria: il video parte grande quanto la sezione, poi la finestra si allontana fino a starci tutta
      let G = null, W = 0, H = 0, dpr = 1;
      const measure = () => {
        win.classList.toggle('compact', root.clientWidth < 760);
        win.style.transform = 'none';
        const a = win.getBoundingClientRect(), v = vid.getBoundingClientRect(), RW = root.clientWidth, RH = root.clientHeight;
        const hdr = ($('#top') || {}).offsetHeight || 60, w = a.width, h = a.height;
        const fit = Math.min(RW * .92 / w, (RH - hdr - 36) * .94 / h), c = [v.left - a.left + v.width / 2, v.top - a.top + v.height / 2];
        const s0 = RH > RW ? RW / v.width : Math.max(RW / v.width, RH / v.height) * 1.01;
        const cx = RW / 2, cy = hdr + (RH - hdr) / 2;
        G = { fit, s0, c, P0: [RW / 2, RH / 2], P1: [cx - fit * w / 2 + fit * c[0], cy - fit * h / 2 + fit * c[1]] };
        dpr = Math.min(2, devicePixelRatio || 1) * Math.max(1, fit); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
        const ob = segBtns[0], tb = segBtns[3]; G.seg = [ob.offsetLeft, tb.offsetLeft, ob.offsetWidth];
      };
      addEventListener('resize', () => { G = null; });
      function wave(t) {
        if (!W) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0a0a0b'; ctx.fillRect(0, 0, W, H);
        const cuts = SEG.map((s, i) => s[1] ? easeIO((t - cutAt[i]) / CUT) : 0), spd = expoIO(span(t, SP0, SP1));
        const px = W / U * (1 - .5 * spd), reveal = easeIO(span(t, TR0, TR0 + 1000)), uh = U * span(t, SC0, SC1), mid = H / 2 + 7, hgt = (H - 26) / 2;
        let tot = 0; const xs = SEG.map((s, i) => { const x = tot; tot += s[0] * px * (1 - cuts[i]); return x; });
        const off = (W - tot) / 2;
        ctx.fillStyle = '#1f1f23'; ctx.fillRect(off, mid - .5, tot * reveal, 1);
        SEG.forEach(([w, sil], i) => {
          const ws = w * px * (1 - cuts[i]); if (ws < .3) return; const x0 = off + xs[i], gone = cuts[i];
          const seen = sil ? clamp((uh - starts[i]) / w) : 0, mark = sil && seen > 0;
          if (mark && ws > 2) { // pausa trovata: riquadro pieno, niente trasparenze
            ctx.fillStyle = '#211413'; ctx.strokeStyle = '#4d2622'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(x0 + .5, 18.5, Math.max(0, ws - 1), H - 19, 7); ctx.fill(); ctx.stroke();
            if (ws > 44 && gone < .5) { ctx.fillStyle = '#e8877c'; ctx.font = '650 10.5px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSA', x0 + ws / 2, 12); }
          }
          for (let p = 0; p < ws; p += 2) {
            const gx = x0 + p; if (gx - off > W * reveal) break;
            const a = ampAt(i, p / ws) * hgt, done = starts[i] + w * (p / ws) <= uh;
            ctx.fillStyle = sil ? (done ? '#e8877c' : '#3a3a3f') : done ? '#ededee' : '#55555b';
            ctx.fillRect(gx, mid - a, 1.3, Math.max(1, a * 2));
          }
        });
        const bo = t > SC0 - 100 && t < SC1 + 100;
        if (bo) { let i = SEG.findIndex((s, k) => uh < starts[k] + s[0]); if (i < 0) i = SEG.length - 1;
          const hx = off + xs[i] + SEG[i][0] * px * (1 - cuts[i]) * clamp((uh - starts[i]) / SEG[i][0]);
          ctx.fillStyle = '#5b93ff'; ctx.fillRect(hx - 1, 14, 2, H - 14); ctx.fillStyle = '#fff'; ctx.fillRect(hx - .5, 14, 1, H - 14); }
        return { cuts, spd };
      }
      const pct = t => Math.round(100 * (.85 * span(t, SC0, SC1) + .15 * span(t, SP0, SP1)));
      return t => {
        if (!G) measure();
        logo(t);
        // 1) video a schermo intero → la finestra di StudyCut si allontana
        const vin = ease(span(t, V_IN, V_IN + 700)), dz = expoIO(span(t, DZ0, DZ1)), ex = easeIO(span(t, EX0, EX1));
        const s = G.s0 * Math.pow(G.fit / G.s0, dz), P = [G.P0[0] + (G.P1[0] - G.P0[0]) * dz, G.P0[1] + (G.P1[1] - G.P0[1]) * dz];
        win.style.transform = `translate(${(P[0] - s * G.c[0]).toFixed(1)}px,${(P[1] - s * G.c[1]).toFixed(1)}px) scale(${s.toFixed(4)})`;
        vid.style.borderRadius = (12 * dz).toFixed(1) + 'px';
        css(ed, vin * (1 - ex), { s: 1 - .06 * ex, y: -20 * ex, blur: 12 * ex });
        scene.style.transform = `scale(${(1.06 - .06 * span(t, V_IN, DZ1)).toFixed(4)})`;
        // 2) elaborazione
        const r = wave(t) || { cuts: SEG.map(() => 0), spd: 0 };
        const nSil = SEG.filter(x => x[1]).length, nCut = r.cuts.filter(c => c >= 1).length, cutF = r.cuts.reduce((a, c) => a + c, 0) / nSil;
        const noPause = F.from - (F.from - F.mid) * cutF, dur = noPause - (F.mid - F.to) * r.spd;
        setT(tot, clock(dur)); setT(cur, clock(724 + 40 * span(t, V_IN, SC0)));
        const on = t > SC0 - 250; sw.classList.toggle('on', on); skip.classList.toggle('on', on);
        setT(sub, t < SC0 - 250 ? 'Tocca per cercare le pause' : t < SC1 ? `Cerco le pause… ${pct(t)}%` : `${nSil} pause trovate`);
        setT(k1, t > SC0 ? clock(noPause) : '—'); setT(k2, t > SP0 ? clock(dur) : '—');
        setT(k3, t > SP0 ? `−${Math.round((F.from - dur) / 60)} min` : t > SC0 ? `−${Math.round((F.from - noPause) / 60)} min` : '—');
        const sp = r.spd; setT(sv, (1 + sp).toFixed(2).replace('.', ','));
        ind.style.width = G.seg[2] + 'px'; ind.style.transform = `translateX(${(G.seg[0] + (G.seg[1] - G.seg[0]) * sp).toFixed(1)}px)`;
        segBtns.forEach((b, i) => b.classList.toggle('on', i === (sp > .5 ? 3 : 0)));
        setT(px2, sp > .5 ? '2×' : '1×'); px2.classList.toggle('on', sp > .5);
        const busy = t > SC0 && t < SP1; btn.classList.toggle('busy', busy); btn.classList.toggle('ok', t >= SP1);
        bFill.style.transform = `scaleX(${busy ? (pct(t) / 100).toFixed(3) : 0})`;
        setT(bLbl, t < SC0 ? 'Crea a 1×' : busy ? `Elaborazione ${pct(t)}%` : 'Pronto a 2×');
        setT(st, t < SC0 ? 'Originale' : t < SP1 ? 'Elaborazione' : `−${Math.round((F.from - F.to) / 60)} min`); st.classList.toggle('ok', t >= SP1);
        // 3) prima → dopo, in grande
        [nA, nArr, nB].forEach((el, i) => { const e = ease(span(t, NB + i * 160, NB + 520 + i * 160)); css(el, e, { y: 30 * (1 - e), blur: 10 * (1 - e) }); });
        arrP.style.strokeDashoffset = (1 - easeIO(span(t, NB + 160, NB + 760))).toFixed(3);
        // 4) dissolvenza + morphing nei minuti risparmiati
        const mo = easeIO(span(t, MO0, MO0 + 700)), mi = easeIO(span(t, MO0 + 120, MO1)), so = easeIO(span(t, SVOUT, SVOUT + 450));
        cmp.style.opacity = (1 - mo).toFixed(3); cmp.style.filter = mo > .01 ? `blur(${(9 * mo).toFixed(1)}px)` : '';
        css(svd, mi * (1 - so), { s: (.92 + .08 * mi) * (1 - .06 * so), blur: 9 * (1 - mi) + 10 * so, y: -24 * so });
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
  if (reduce) { draw(L - 1); return { sec, pause }; }
  draw(0);
  new IntersectionObserver(es => { const vis = es[0].isIntersecting && !document.hidden;
    if (vis && !on) { on = true; play(0); bg && bg.start(); } else if (!vis && on) { on = false; pause(); bg && bg.stop(); } }, { threshold: .55 }).observe(sec);
  return { sec, pause };
});
document.addEventListener('visibilitychange', () => { if (document.hidden) shows.forEach(s => s.pause()); });

/* scroll: la vetrina si aggancia allo schermo; per andare oltre serve una spinta in più (con un po' di elastico) */
(() => {
  const secs = shows.map(s => s.sec); if (!secs.length || reduce) return;
  const WHEEL = 240, TOUCH = 110, R = 70;
  let lock = null, pull = 0, busyUntil = 0, relaxT = 0, y0 = 0, settleT = 0;
  const film = s => s.querySelector('.sh-film');
  const band = d => Math.sign(d) * R * (1 - Math.exp(-Math.abs(d) / (R * 2.2)));
  const rubber = (s, d, anim) => { const f = film(s); f.style.transition = anim ? 'translate .55s var(--e-spring)' : 'none'; f.style.translate = d ? `0 ${(-band(d)).toFixed(1)}px` : '0 0'; };
  const go = y => { busyUntil = Date.now() + 800; scrollTo({ top: Math.round(y), behavior: 'smooth' }); };
  const aligned = s => Math.abs(s.getBoundingClientRect().top) < 6;
  const topOf = s => s.getBoundingClientRect().top + scrollY;
  function engage(s) { lock = s; pull = 0; rubber(s, 0, true); if (!aligned(s)) go(topOf(s)); }
  function release(dir) { const s = lock; lock = null; pull = 0; rubber(s, 0, true);
    go(dir > 0 ? topOf(s) + s.offsetHeight : Math.max(0, topOf(s) - innerHeight)); }
  const relax = () => { if (lock) { pull = 0; rubber(lock, 0, true); } };
  // quale vetrina sta entrando nello schermo, nella direzione dello scroll
  const entering = dir => secs.find(s => { const r = s.getBoundingClientRect();
    return dir > 0 ? r.top > 6 && r.top < innerHeight * .9 : r.top < -6 && r.bottom > innerHeight * .1; });
  const free = () => !pal.hidden;
  addEventListener('wheel', e => {
    if (free() || e.ctrlKey) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1); if (!dy) return;
    if (Date.now() < busyUntil) { e.preventDefault(); return; }       // durante l'aggancio ignora l'inerzia
    if (lock && !aligned(lock)) lock = null;
    if (lock) {
      e.preventDefault();
      if (Math.sign(dy) !== Math.sign(pull)) pull = 0;
      pull += dy; rubber(lock, pull, false);
      clearTimeout(relaxT); relaxT = setTimeout(relax, 220);
      if (Math.abs(pull) > WHEEL) release(Math.sign(pull));
      return;
    }
    const s = entering(Math.sign(dy)); if (s) { e.preventDefault(); engage(s); }
  }, { passive: false });
  addEventListener('touchstart', e => { y0 = e.touches[0].clientY; if (lock && !aligned(lock)) lock = null; }, { passive: true });
  addEventListener('touchmove', e => { if (!lock || free() || Date.now() < busyUntil) return; e.preventDefault();
    pull = y0 - e.touches[0].clientY; rubber(lock, pull * 1.6, false); }, { passive: false });
  addEventListener('touchend', () => { if (!lock) return; if (Math.abs(pull) > TOUCH) release(Math.sign(pull)); else relax(); });
  // dopo uno scroll libero (dito, barra, tastiera) si aggancia se la vetrina è quasi a schermo intero
  addEventListener('scroll', () => { clearTimeout(settleT); settleT = setTimeout(() => {
    if (lock || free() || Date.now() < busyUntil) return;
    const s = secs.find(s => { const r = s.getBoundingClientRect(); return Math.abs(r.top) > 6 && Math.abs(r.top) < innerHeight * .3; });
    if (s) engage(s); else { const a = secs.find(aligned); if (a) lock = a; }
  }, 160); }, { passive: true });
  addEventListener('keydown', e => { if (!lock || free() || e.target.matches('input,textarea')) return;
    const d = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key]; if (d) { e.preventDefault(); release(d); } });
})();

/* sfondo dell'hero */
const heroFx = window.FX && FX.shapes($('#heroFx'), { color: '#1f1f23', hoverColor: '#d8d8dc', backgroundColor: '#000000', cellSize: 12, brightness: .3, fade: .4, splashRadius: 60, splashStrength: .45 });
if (heroFx) { $('#heroFx').classList.add('on'); new IntersectionObserver(es => es[0].isIntersecting ? heroFx.start() : heroFx.stop()).observe($('#heroFx')); }

