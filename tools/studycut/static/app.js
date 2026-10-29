/* StudyCut — logica dell'interfaccia */
const $ = s => document.querySelector(s);
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
// velocita' e salto delle pause sono del singolo video (salvati nel video, vedi saveSettings)
const state = { lib: [], cur: null, speed: 1, skip: true, skipCuts: true, whisper: true,
  links: [], jobs: [], seen: new Set(), vol: localStorage.vol ? +localStorage.vol : 1, muted: localStorage.muted === '1' };
const video = $('#video'), pv = $('#pv'), app = $('#app'), vwrap = $('#vwrap'), pbox = $('#pbox');
const mq = matchMedia('(max-width:860px),(pointer:coarse) and (max-height:520px)'), isMob = () => mq.matches;
const onMq = fn => mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
// errori inattesi: li mostriamo invece di lasciare l'interfaccia bloccata
addEventListener('error', e => { try { toast('Errore dell\'interfaccia', String(e.message || e), 'err'); } catch {} });
addEventListener('unhandledrejection', e => { const m = e.reason && e.reason.message || String(e.reason); if (!/abort|play\(\)|interrupted/i.test(m)) try { toast('Errore', m, 'err'); } catch {} });
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
  this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8.5 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L10 4.74a1 1 0 0 0-1.5.86z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/></svg>';
const ICON = {
  vol: l => `<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>${l === 0 ? '<path d="m16 9.5 5 5m0-5-5 5"/>' : '<path d="M15.5 9a4 4 0 0 1 0 6"/>' + (l > 1 ? '<path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>' : '')}</svg>`,
  audio: '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  tick: '<span class="tick"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></span>',
};

// sessione scaduta (gateway con gli account): torna alla pagina di accesso e poi qui
const relogin = () => location.assign('/account/login?next=' + encodeURIComponent(location.pathname + location.search));
const api = async (path, opts = {}) => {
  const r = await fetch(path, opts); const j = await r.json().catch(() => ({}));
  if (r.status === 401) { relogin(); throw new Error(j.error || 'Accesso richiesto'); }
  if (!r.ok) throw new Error(j.error || r.statusText); return j;
};
/* spazio personale (solo con gli account): barra in fondo alla libreria */
let spaceT = 0;
const gbf = n => n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} GB` : `${Math.round(n / (1 << 20))} MB`;
async function loadSpace(force) {
  if (!force && Date.now() - spaceT < 8000) return; spaceT = Date.now();
  try {
    const s = await api('api/space'); if (!s.quota) return;
    const p = Math.min(1, s.used / s.quota), el = $('#space');
    const prof = '/account/?from=' + encodeURIComponent(location.pathname);
    el.hidden = false; el.classList.toggle('full', p > .9); el.href = prof;
    if (s.user) { const b = $('#acctBtn'); b.hidden = false; b.href = prof; b.title = `${s.user} · profilo e spazio`; $('#acctI').textContent = s.user[0].toUpperCase(); }
    $('#spaceT').textContent = `${gbf(s.used)} di ${gbf(s.quota)}`;
    $('#spaceB').style.transform = `scaleX(${p.toFixed(4)})`;
  } catch {}
}
const post = (p, b) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const fmt = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const human = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} h ${m} min` : m ? `${m} min` : `${s} s`; };
const num = (n, d = 2) => n.toFixed(d).replace('.', ',');
const sp = s => `${num(s, s % 1 ? (Math.round(s * 100) % 10 ? 2 : 1) : 0)}×`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const d = Date.now() / 1000 - t; if (d < 60) return 'ora'; if (d < 3600) return `${Math.floor(d / 60)} min fa`;
  if (d < 86400) return `${Math.floor(d / 3600)} h fa`; return new Date(t * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); };
const isAudio = () => state.cur && state.cur.audio;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ---------- micro-motion helpers ---------- */
// testo che cambia con una piccola dissolvenza verticale
function swapText(el, text) {
  if (el._txt === text) return; const first = el._txt === undefined; el._txt = text;
  if (first || reduce) { el.textContent = text; return; }
  clearTimeout(el._sw); el.classList.add('swap');
  el._sw = setTimeout(() => { el.textContent = text; el.classList.remove('swap'); }, 140);
}
// numeri che scorrono verso il nuovo valore
function tween(el, to, render, ms = 420) {
  const from = el._v ?? to; el._v = to; cancelAnimationFrame(el._raf);
  if (from === to || reduce) { el.innerHTML = render(to); return; }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms), v = from + (to - from) * easeOut(k);
    el.innerHTML = render(k === 1 ? to : v); if (k < 1) el._raf = requestAnimationFrame(step); };
  el._raf = requestAnimationFrame(step);
}
const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
const replay = (el, cls = 'go') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/* ---------- sidebars (desktop: colonne · mobile: drawer + bottom sheet) ---------- */
const sideOpen = w => !app.classList.contains(w === 'l' ? 'no-l' : 'no-r');
function setSide(w, open, persist = true) {
  if (open && isMob()) app.classList.add(w === 'l' ? 'no-r' : 'no-l'); // su mobile uno alla volta
  app.classList.toggle(w === 'l' ? 'no-l' : 'no-r', !open);
  if (persist && !isMob()) localStorage['side_' + w] = open ? '1' : '0';
  $('#tglL').classList.toggle('on', sideOpen('l')); $('#tglR').classList.toggle('on', sideOpen('r'));
  app.classList.toggle('m-open', isMob() && (sideOpen('l') || sideOpen('r')));
  for (const s of ['#left', '#right']) $(s).style.transform = '';
  setTimeout(() => { tlKey = ''; segInd(); }, 460);
  renderJobsHeader();
}
// alla prima apertura le sidebar si aprono entrambe; poi si ricorda la scelta
const wantSide = w => isMob() ? false : localStorage['side_' + w] ? localStorage['side_' + w] === '1' : true;
function initSides() { setSide('l', wantSide('l'), false); setSide('r', wantSide('r'), false); }
$('#tglL').onclick = () => setSide('l', !sideOpen('l'));
$('#tglR').onclick = () => setSide('r', !sideOpen('r'));
$('#actInd').onclick = () => setSide('l', true);
$('#scrim').onclick = () => { setSide('l', false); setSide('r', false); };
const fitMob = () => { $('#quality option[value=audio]').textContent = isMob() ? 'Audio' : 'Solo audio'; renderBulk(); syncPaste(); };
onMq(() => { if (!app.classList.contains('pre')) initSides(); fitMob(); });
setSide('l', false, false); setSide('r', false, false);

// gesti: swipe dal bordo sinistro = libreria, dal bordo destro = controlli; swipe sul pannello aperto per chiuderlo
let G = null;
const EDGE = 28;
document.addEventListener('touchstart', e => {
  G = null;
  if (!isMob() || e.touches.length !== 1) return;
  const t = e.touches[0], x = t.clientX, W = innerWidth;
  let w = null, open = false;
  if (sideOpen('l')) { w = 'l'; open = true; } else if (sideOpen('r')) { w = 'r'; open = true; }
  else if (x <= EDGE) w = 'l'; else if (x >= W - EDGE) w = 'r';
  if (!w || (!open && e.target.closest('#seek,input[type=range]')) || (open && e.target.closest('input[type=range]'))) return;
  G = { w, open, x0: x, y0: t.clientY, t0: performance.now(), on: false, p: open ? 1 : 0, el: $(w === 'l' ? '#left' : '#right'), lx: x, lt: performance.now(), v: 0 };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!G) return;
  const t = e.touches[0], dx = t.clientX - G.x0, dy = t.clientY - G.y0;
  if (!G.on) {
    const dir = (G.w === 'l') === G.open ? -dx : dx; // verso utile del movimento
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2 && dir > 0) {
      G.on = true; G.el.classList.add('dragging'); $('#scrim').classList.add('dragging');
    } else if (Math.abs(dy) > 10 || Math.abs(dx) > 14) { G = null; return; } else return;
  }
  e.preventDefault();
  const size = G.el.offsetWidth || 1, now = performance.now();
  G.v = (t.clientX - G.lx) / Math.max(1, now - G.lt); G.lx = t.clientX; G.lt = now;
  let p = G.w === 'l' ? (G.open ? 1 + dx / size : dx / size) : (G.open ? 1 - dx / size : -dx / size);
  p = clamp(p, 0, 1); G.p = p;
  G.el.style.transform = `translateX(${(G.w === 'l' ? p - 1 : 1 - p) * 100}%)`;
  const sc = $('#scrim'); sc.style.opacity = String(p); sc.style.visibility = 'visible';
}, { passive: false });
const gEnd = () => {
  if (!G) return; const g = G; G = null; if (!g.on) return;
  g.el.classList.remove('dragging'); const sc = $('#scrim'); sc.classList.remove('dragging'); sc.style.opacity = ''; sc.style.visibility = '';
  const fling = g.w === 'l' ? g.v : -g.v; // >0 = verso l'apertura
  const open = Math.abs(fling) > .45 ? fling > 0 : g.p > .5;
  setSide(g.w, open);
};
document.addEventListener('touchend', gEnd); document.addEventListener('touchcancel', gEnd);

/* ---------- feedback di pressione: l'animazione arriva sempre in fondo anche con click rapidi ---------- */
const PRESS = '.ib,.btn,.pill,.paste,.item,.switch,.check,.row.tap,.menu button,.seg button,.bulk-h button,.exp a';
let pressEl = null, pressT = 0;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest(PRESS); if (!el || el.disabled || e.button > 0) return;
  pressEl = el; pressT = performance.now(); el.classList.add('pressing');
}, true);
const unpress = () => { const el = pressEl; if (!el) return; pressEl = null;
  setTimeout(() => el.classList.remove('pressing'), Math.max(0, 120 - (performance.now() - pressT))); };
['pointerup', 'pointercancel', 'dragstart'].forEach(ev => document.addEventListener(ev, unpress, true));

/* ---------- toasts ---------- */
function toast(title, msg = '', kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast pop ${kind}`;
  el.innerHTML = `<div class="h"></div><div class="m"></div>`;
  el.querySelector('.h').textContent = title; el.querySelector('.m').textContent = msg; el.querySelector('.m').hidden = !msg;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, kind === 'err' ? 7000 : 2800);
}

/* ---------- link input (bulk) ---------- */
// anteprime e ricerche (vedi sotto): dichiarate qui perché la lista dei link le usa subito
const INFO = new Map();                       // link -> {title, channel, duration, views, thumb}
const PROBES = new Map(), SEARCHES = new Map();
const probe = url => { if (!PROBES.has(url)) { const p = api('api/probe?url=' + encodeURIComponent(url)); PROBES.set(url, p); p.catch(() => PROBES.delete(url)); } return PROBES.get(url); };
let look = { mode: null, q: '', data: null, sel: -1 }, lookT = 0, lookSeq = 0;
const URL_RE = /https?:\/\/[^\s"'<>,;]+/g;
const extract = t => (t.match(URL_RE) || []).flatMap(u => u.split(/(?=https?:\/\/)/)).filter(Boolean);
const shownLinks = new Set();
function addLinks(list) { for (const u of list) if (!state.links.includes(u)) state.links.push(u); renderBulk(); }
function shortUrl(u) {
  try { const x = new URL(u); const v = x.searchParams.get('v');
    return { host: x.hostname.replace(/^www\.|^m\./, ''), rest: v ? v : (x.pathname + x.search).replace(/^\//, '') };
  } catch { return { host: '', rest: u }; }
}
let bulkOpen = false, lastN = 0;
function renderBulk() {
  const n = state.links.length, c = $('#count');
  c.textContent = n || lastN || ''; c.classList.toggle('hide', n === 0);
  if (n && n !== lastN) bump(c); lastN = n;
  $('#hc').classList.toggle('open', n > 0 && bulkOpen && !look.mode);
  $('#bulkT').textContent = n === 1 ? '1 link pronto' : `${n} link pronti`;
  let k = 0;
  $('#bulkL').innerHTML = state.links.map((u, i) => { const s = shortUrl(u), nw = !shownLinks.has(u);
    return `<li class="${nw ? 'in' : ''}" style="--i:${nw ? k++ : 0}">${linkHTML(u, s)}<button type="button" class="ib" data-i="${i}" title="Rimuovi">${ICON.x}</button></li>`; }).join('');
  shownLinks.clear(); state.links.forEach(u => shownLinks.add(u));
  state.links.forEach(u => { if (!INFO.has(u)) probe(u).then(d => { INFO.set(u, d); const el = [...document.querySelectorAll('#bulkL [data-u]')].find(x => x.dataset.u === u); if (el) el.outerHTML = linkHTML(u); }).catch(() => {}); });
  swapText($('#dlLbl'), btnLabel());
  $('#url').placeholder = n ? (isMob() ? 'Altri link o ricerca…' : 'Aggiungi altri link o cerca su YouTube…') : (isMob() ? 'Link o ricerca YouTube' : 'Incolla un link o cerca su YouTube');
}
const setBulk = o => { bulkOpen = o; renderBulk(); };
$('#url').addEventListener('paste', e => {
  const urls = extract(e.clipboardData.getData('text'));
  if (urls.length > 1 || (urls.length && state.links.length)) { e.preventDefault(); addLinks(urls); setBulk(true); }
});
$('#url').addEventListener('input', e => {
  const urls = extract(e.target.value);
  if (urls.length > 1) { addLinks(urls); e.target.value = ''; setBulk(true); }
});
$('#url').addEventListener('focus', () => { setBulk(true); if ($('#url').value.trim()) onLookInput(true); });
const canPaste = !!(navigator.clipboard && navigator.clipboard.readText && isSecureContext);
function syncPaste() { $('#pasteBtn').hidden = !(canPaste && isMob() && !$('#url').value); }
$('#url').addEventListener('input', syncPaste);
$('#pasteBtn').onclick = async () => {
  try { const t = await navigator.clipboard.readText(); const urls = extract(t);
    if (!urls.length) return toast('Nessun link negli appunti', '', 'err');
    addLinks(urls); setBulk(true); syncPaste();
  } catch { $('#url').focus(); toast('Incolla manualmente', 'Tieni premuto nel campo e scegli Incolla'); }
};
$('#url').addEventListener('keydown', e => {
  if (e.key === 'Backspace' && !e.target.value && state.links.length) removeLink(state.links.length - 1);
  if (look.mode === 'search' && look.data && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault(); const n = look.data.length; if (!n) return;
    look.sel = e.key === 'ArrowDown' ? (look.sel + 1) % n : (look.sel <= 0 ? n - 1 : look.sel - 1); markSel(); return;
  }
  if (e.key === 'Escape') { if (look.mode) { setLook(null); return; } setBulk(false); e.target.blur(); }
});
function removeLink(i) {
  const li = $('#bulkL').children[i];
  const done = () => { state.links.splice(i, 1); renderBulk(); };
  if (!li || reduce) return done();
  li.classList.add('out'); setTimeout(done, 180);
}
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#hc')) { setBulk(false); if (look.mode) setLook(null); }
  if (!e.target.closest('.menu-w')) $('#speedMenu').classList.remove('open');
});
$('#bulkL').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { removeLink(+b.dataset.i); $('#url').focus(); } });
$('#bulkClear').onclick = () => { state.links = []; renderBulk(); $('#url').focus(); };
$('#dlForm').addEventListener('submit', async e => {
  e.preventDefault();
  const v = $('#url').value.trim();
  // ricerca per nome: Invio cerca subito; con un risultato scelto (frecce) lo scarica
  if (isQuery(v)) {
    const r = look.mode === 'search' && look.q === v && look.data && look.data[look.sel];
    if (r) return download([...state.links, r.url]);
    if (look.mode === 'search' && look.q === v && look.data && look.data.length) { look.sel = 0; return markSel(); }
    clearTimeout(lookT); return runSearch(v);
  }
  const urls = [...state.links, ...extract(v)];
  if (!urls.length) { if (v) toast('Link non valido', 'Il link deve iniziare con http:// o https://', 'err'); return $('#url').focus(); }
  download(urls);
});
async function download(urls) {
  try {
    await post('api/download', { urls, quality: $('#quality').value });
    state.links = []; $('#url').value = ''; setLook(null); setBulk(false); $('#url').blur(); syncPaste();
    if (isMob()) toast(urls.length > 1 ? `${urls.length} download avviati` : 'Download avviato', 'Tocca l\'indicatore in alto per seguirli');
    else if (!sideOpen('l')) setSide('l', true);
    pollJobs();
  } catch (err) { toast('Impossibile scaricare', err.message, 'err'); }
}

/* ---------- anteprima del link incollato e ricerca su YouTube per nome ---------- */
const isQuery = v => v.trim().length >= 2 && !/^https?:\/\//i.test(v.trim()) && !extract(v).length;
const views = n => n == null ? '' : n >= 1e6 ? `${num(n / 1e6, n < 1e7 ? 1 : 0)} Mln di visualizzazioni` : n >= 1e3 ? `${Math.round(n / 1e3)} mila visualizzazioni` : `${n} visualizzazioni`;
const meta = d => [d.channel, views(d.views)].filter(Boolean).map(esc).join(' · ');
const thumbHTML = (d, cls = '') => `<span class="lk-th ${cls}">${d && d.thumb ? `<img src="${esc(d.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${d && d.live ? '<em class="live">LIVE</em>' : d && d.duration ? `<em>${fmt(d.duration)}</em>` : ''}</span>`;
function linkHTML(u, s = shortUrl(u)) {
  const d = INFO.get(u);
  return d && d.title ? `<span class="u t" data-u="${esc(u)}">${thumbHTML(d, 'xs')}<b>${esc(d.title)}</b><span>${esc(d.channel || s.host)}${d.duration ? ' · ' + fmt(d.duration) : ''}</span></span>`
    : `<span class="u" data-u="${esc(u)}"><b>${esc(s.host)}</b>${esc(s.rest)}</span>`;
}
const SEARCH_IC = '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>', LINK_IC = $('#dlForm > svg').innerHTML;
function btnLabel() {
  const n = state.links.length;
  if (look.mode === 'search' && look.sel < 0) return 'Cerca';
  return n > 1 ? `Scarica ${n}` : 'Scarica';
}
function setLook(mode) {
  if (!mode) { look = { mode: null, q: '', data: null, sel: -1 }; lookSeq++; }
  else look.mode = mode;
  $('#hc').classList.toggle('look-on', !!mode); $('#url').setAttribute('aria-expanded', !!mode);
  renderBulk();
}
function onLookInput(now) {
  clearTimeout(lookT);
  const v = $('#url').value.trim(), urls = extract(v), q = isQuery(v);
  $('#dlForm > svg').innerHTML = q ? SEARCH_IC : LINK_IC;
  if (urls.length === 1 && v === urls[0]) { if (look.mode === 'probe' && look.q === v) return; lookT = setTimeout(() => showProbe(v), now ? 0 : 200); }
  else if (q) { if (look.mode === 'search' && look.q === v) return; if (look.mode !== 'search') { look.sel = -1; swapText($('#dlLbl'), 'Cerca'); } lookT = setTimeout(() => runSearch(v), now ? 0 : 500); }
  else if (look.mode) setLook(null);
}
$('#url').addEventListener('input', () => onLookInput());
async function showProbe(url) {
  const seq = ++lookSeq; look = { mode: 'probe', q: url, data: null, sel: -1 };
  renderLook({ loading: true }); setLook('probe');
  try { const d = await probe(url); INFO.set(url, d); if (seq === lookSeq) renderLook({ d }); }
  catch (e) { if (seq === lookSeq) renderLook({ err: e.message }); }
}
async function runSearch(q) {
  const seq = ++lookSeq; look = { mode: 'search', q, data: look.mode === 'search' ? look.data : null, sel: -1 };
  if (!look.data) renderLook({ loading: true }); else $('#look').classList.add('busy');
  setLook('search');
  try {
    if (!SEARCHES.has(q)) { const p = api('api/search?q=' + encodeURIComponent(q)); SEARCHES.set(q, p); p.catch(() => SEARCHES.delete(q)); }
    const r = await SEARCHES.get(q); if (seq !== lookSeq) return;
    r.results.forEach(x => { INFO.set(x.url, x); if (!PROBES.has(x.url)) PROBES.set(x.url, Promise.resolve(x)); });
    look.data = r.results; renderLook({});
  } catch (e) { if (seq === lookSeq) { look.data = null; renderLook({ err: e.message }); } }
}
function renderLook({ loading, d, err }) {
  const el = $('#look'); el.classList.remove('busy');
  const qual = $('#quality').selectedOptions[0].textContent;
  if (look.mode === 'probe' || (!look.mode && (d || loading))) {
    el.innerHTML = loading
      ? `<div class="lk-pv sk"><span class="lk-th"></span><span class="lk-tx"><i></i><i></i><i></i></span></div>`
      : d ? `<div class="lk-pv in">${thumbHTML(d)}<span class="lk-tx"><b>${esc(d.title || shortUrl(look.q).host)}</b><span>${meta(d)}</span>
          <span class="lk-k">${d.playlist ? 'Playlist · verrà scaricato il primo video' : `Invio per scaricare · ${esc(qual)}`}</span></span></div>`
      : `<div class="lk-pv in"><span class="lk-th none">${ICON.x}</span><span class="lk-tx"><b>Anteprima non disponibile</b><span>${esc((err || '').slice(0, 140))}</span>
          <span class="lk-k">Puoi comunque provare a scaricarlo</span></span></div>`;
    return;
  }
  const head = `<div class="bulk-h"><span>Risultati su YouTube</span><span class="lk-hint">↑ ↓ per scegliere · Invio per scaricare</span></div>`;
  if (loading) { el.innerHTML = head + '<ul class="lk-l">' + Array.from({ length: 4 }, () => '<li class="sk"><span class="lk-th sm"></span><span class="lk-tx"><i></i><i></i></span></li>').join('') + '</ul>'; return; }
  if (err) { el.innerHTML = head + `<div class="lk-empty">Ricerca non riuscita: ${esc(err.slice(0, 160))}</div>`; return; }
  if (!look.data.length) { el.innerHTML = head + `<div class="lk-empty">Nessun risultato per “${esc(look.q)}”</div>`; return; }
  el.innerHTML = head + '<ul class="lk-l" role="listbox">' + look.data.map((r, i) => `<li class="in" role="option" data-k="${i}" style="--i:${i}">${thumbHTML(r, 'sm')}
    <span class="lk-tx"><b>${esc(r.title)}</b><span>${meta(r)}</span></span>
    <button type="button" class="ib ${state.links.includes(r.url) ? 'on' : ''}" data-add="${i}" title="Aggiungi alla lista">${state.links.includes(r.url) ? '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'}</button>
    <button type="button" class="ib" data-dl="${i}" title="Scarica in ${esc(qual)}"><svg viewBox="0 0 24 24"><path d="M12 4v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg></button></li>`).join('') + '</ul>';
  markSel();
}
function markSel() {
  document.querySelectorAll('#look [data-k]').forEach(li => { const on = +li.dataset.k === look.sel; li.classList.toggle('cur', on); li.setAttribute('aria-selected', on); if (on) li.scrollIntoView({ block: 'nearest' }); });
  swapText($('#dlLbl'), btnLabel());
}
$('#look').addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) { const r = look.data[+add.dataset.add]; if (!state.links.includes(r.url)) addLinks([r.url]); bump($('#count')); renderLook({}); return $('#url').focus(); }
  const li = e.target.closest('[data-k]');
  if (li) return download([...state.links, look.data[+li.dataset.k].url]);
  if (e.target.closest('.lk-pv') && look.mode === 'probe' && INFO.has(look.q)) $('#dlForm').requestSubmit();
});
$('#look').addEventListener('pointermove', e => { const li = e.target.closest('[data-k]'); if (li && +li.dataset.k !== look.sel) { look.sel = +li.dataset.k; markSel(); } });
$('#quality').addEventListener('change', () => { if (look.mode === 'probe' && INFO.has(look.q)) renderLook({ d: INFO.get(look.q) }); });
$('#quality').value = localStorage.quality || '720';
$('#quality').onchange = e => { localStorage.quality = e.target.value; };

/* ---------- finestra flottante (cartelle: "In corso" e cartelle della libreria) + dialoghi ---------- */
const fw = { mode: null, id: null };
const fwin = $('#fwin');
function placeFw(anchor) {
  if (isMob() || !anchor) { fwin.style.removeProperty('--ox'); fwin.style.removeProperty('--oy'); return; }
  const r = anchor.getBoundingClientRect(), f = fwin.querySelector('.fwin-in').getBoundingClientRect();
  fwin.style.setProperty('--ox', `${r.left + r.width / 2 - f.left}px`); fwin.style.setProperty('--oy', `${r.top + r.height / 2 - f.top}px`);
}
function openFw(mode, id, anchor) {
  fw.mode = mode; fw.id = id; fwin.classList.add('show'); $('#fwGrid').scrollTop = 0;
  $('#fwGrid').innerHTML = ''; jobEls.clear(); libKey = '';
  renderFw(); placeFw(anchor);
}
function closeFw() { if (!fw.mode) return; fw.mode = null; fw.id = null; fwin.classList.remove('show'); setTimeout(() => { if (!fw.mode) $('#fwGrid').innerHTML = ''; jobEls.clear(); }, 400); }
function renderFw() {
  if (!fw.mode) return;
  const folder = fw.mode === 'folder' ? state.folders.find(f => f.id === fw.id) : null;
  if (fw.mode === 'folder' && !folder) return closeFw();
  const vids = folder ? state.lib.filter(m => !m.archived && m.folder === folder.id) : [];
  ['#fwRen', '#fwEdit', '#fwDel'].forEach(s => $(s).hidden = !folder);
  $('#fwT').textContent = folder ? folder.name : 'In corso';
  $('#fwS').textContent = folder ? `${vids.length} video` : '';
  if (!folder) return;
  const key = JSON.stringify(vids.map(m => [m.id, m.title, m.thumb, m.duration]));
  const g = $('#fwGrid'); if (g._k === key) return; g._k = key;
  g.innerHTML = vids.length ? vids.map((m, i) => `<div class="vcard in" style="--i:${Math.min(i, 12)}" data-id="${m.id}">
    <div class="thumb" style="${m.thumb ? `background-image:url('media/${m.id}/${m.thumb}')` : ''}">${m.audio ? `<span class="badge">${ICON.audio}</span>` : ''}<em>${fmt(m.duration)}</em></div>
    <div class="t">${esc(m.title)}</div>
    <button class="ib sm vc-x" data-out="${m.id}" title="Togli dalla cartella">${ICON.x}</button></div>`).join('')
    : '<div class="lib-empty">Cartella vuota. Trascina qui i video dalla libreria oppure usa Seleziona → Sposta in…</div>';
}
$('#fwClose').onclick = closeFw;
document.addEventListener('pointerdown', e => {
  if (fw.mode && !e.target.closest('#fwin,#actFold,.item.folder,#dlg,.toast')) closeFw();
}, true);
$('#actFold').onclick = () => fw.mode === 'jobs' ? closeFw() : openFw('jobs', null, $('#actFold'));
$('#fwGrid').addEventListener('click', async e => {
  const out = e.target.closest('[data-out]');
  if (out) { await post('api/move', { ids: [out.dataset.out], folder: null }); return refreshLib(); }
  const c = e.target.closest('.vcard'); if (!c) return;
  if (isMob()) { closeFw(); setSide('l', false); }
  open(c.dataset.id);
});
const refreshLib = () => { libKey = ''; return loadLib(); };
// trascinare video sulla finestra di una cartella aperta li sposta in quella cartella
fwin.addEventListener('dragover', e => { if (fw.mode === 'folder' && [...e.dataTransfer.types].includes('text/x-sc')) { e.preventDefault(); fwin.classList.add('drop'); } });
fwin.addEventListener('dragleave', e => { if (!fwin.contains(e.relatedTarget)) fwin.classList.remove('drop'); });
fwin.addEventListener('drop', async e => { fwin.classList.remove('drop'); if (fw.mode !== 'folder') return; e.preventDefault(); e.stopPropagation();
  await post('api/move', { ids: JSON.parse(e.dataTransfer.getData('text/x-sc')), folder: fw.id }); state.sel.clear(); refreshLib(); });
// dialoghi
let dlgRes = null;
function dialog({ title, text = '', body = '', ok = 'OK', input = null, hideOk = false }) {
  return new Promise(res => {
    const d = $('#dlg'); $('#dlgT').textContent = title; $('#dlgP').textContent = text; $('#dlgP').hidden = !text;
    $('#dlgB').innerHTML = input ? (input.area ? `<textarea id="dlgI" class="dlg-i area" maxlength="4000" rows="5" spellcheck="true">${esc(input.value || '')}</textarea>` : `<input id="dlgI" class="dlg-i" maxlength="120" spellcheck="false" autocomplete="off" placeholder="${esc(input.placeholder || '')}" value="${esc(input.value || '')}">`) + (input.extra || '') : body;
    $('#dlgOk').textContent = ok; $('#dlgOk').hidden = hideOk; d.classList.add('show');
    const done = v => { d.classList.remove('show'); dlgRes = null; res(v); };
    dlgRes = done;
    $('#dlgF').onsubmit = e => { e.preventDefault(); done(input ? $('#dlgI').value.trim() : true); };
    if (input && input.area) $('#dlgI').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#dlgF').requestSubmit(); };
    $('#dlgNo').onclick = () => done(null);
    d.onclick = e => { if (e.target === d) done(null); };
    $('#dlgB').onclick = e => { const b = e.target.closest('[data-pick]'); if (b) done(b.dataset.pick); };
    if (input) setTimeout(() => { const i = $('#dlgI'); i.focus(); i.select(); }, 60);
  });
}
addEventListener('keydown', e => { if (e.key === 'Escape' && dlgRes) { e.stopPropagation(); dlgRes(null); } }, true);
async function renameSeries(ids) {
  if (!ids.length) return;
  const v = await dialog({ title: 'Rinomina in serie', text: `${ids.length} video, nell'ordine in cui sono mostrati. Es. “Analisi” → Analisi 1, Analisi 2, Analisi 3…`,
    input: { value: 'Analisi', placeholder: 'Nome', extra: '<label class="dlg-l">Parti dal numero <input id="dlgS" class="dlg-i s" type="number" min="1" value="1"></label>' }, ok: 'Rinomina' });
  if (!v) return; const start = +($('#dlgS') && $('#dlgS').value) || 1;
  await post('api/rename-many', { ids, base: v, start }); toast('Rinominati', `${v} ${start} – ${v} ${start + ids.length - 1}`);
  await refreshLib(); if (state.cur && ids.includes(state.cur.id)) open(state.cur.id);
}
async function newFolder(ids = []) {
  const v = await dialog({ title: 'Nuova cartella', input: { placeholder: 'Nome della cartella' }, ok: 'Crea' }); if (!v) return null;
  const f = await post('api/folders', { name: v });
  if (ids.length) await post('api/move', { ids, folder: f.id });
  await refreshLib(); return f;
}
async function moveTo(ids) {
  if (!ids.length) return;
  const opts = state.folders.map(f => `<button type="button" class="dlg-o" data-pick="${f.id}"><svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>${esc(f.name)}</button>`).join('');
  const r = await dialog({ title: 'Sposta in…', body: `<div class="dlg-l2">${opts}<button type="button" class="dlg-o" data-pick="__new">+ Nuova cartella…</button>${state.folders.length ? '<button type="button" class="dlg-o" data-pick="__root">Fuori dalle cartelle</button>' : ''}</div>`, hideOk: true });
  if (!r) return;
  if (r === '__new') { await newFolder(ids); } else { await post('api/move', { ids, folder: r === '__root' ? null : r }); await refreshLib(); }
  setSelecting(false);
}
$('#newFolder').onclick = () => newFolder();
$('#fwEdit').onclick = async () => {
  const f = state.folders.find(x => x.id === fw.id); if (!f) return;
  const v = await dialog({ title: 'Rinomina cartella', input: { value: f.name }, ok: 'Salva' }); if (!v) return;
  await post('api/folders/rename', { id: f.id, name: v }); refreshLib();
};
$('#fwDel').onclick = async () => {
  const f = state.folders.find(x => x.id === fw.id); if (!f) return;
  if (!await dialog({ title: `Eliminare la cartella “${f.name}”?`, text: 'I video non vengono cancellati: tornano nella libreria.', ok: 'Elimina cartella' })) return;
  await post('api/folders/delete', { id: f.id }); closeFw(); refreshLib();
};
$('#fwRen').onclick = () => renameSeries(state.lib.filter(m => !m.archived && m.folder === fw.id).map(m => m.id));
// selezione multipla nella libreria
state.sel = new Set(); state.folders = [];
function setSelecting(on) {
  state.selecting = on; if (!on) state.sel.clear();
  $('#left').classList.toggle('selecting', on); $('#selMode').classList.toggle('on', on); updSel(); libKey = ''; loadLib();
}
function updSel() {
  const n = state.sel.size; $('#selN').textContent = n === 1 ? '1 scelto' : `${n} scelti`;
  $('#selBar').classList.toggle('show', !!state.selecting);
  $('#selRen').disabled = $('#selMove').disabled = !n;
  const all = [...document.querySelectorAll('#lib .item[data-id]')].map(x => x.dataset.id), full = all.length > 0 && all.every(i => state.sel.has(i));
  $('#selAll').textContent = full ? 'Deseleziona tutto' : 'Seleziona tutto'; $('#selAll').disabled = !all.length;
  document.querySelectorAll('#lib .item[data-id]').forEach(it => it.classList.toggle('picked', state.sel.has(it.dataset.id)));
}
$('#selMode').onclick = () => setSelecting(!state.selecting);
$('#selX').onclick = () => setSelecting(false);
$('#selAll').onclick = () => {
  const all = [...document.querySelectorAll('#lib .item[data-id]')].map(x => x.dataset.id), full = all.every(i => state.sel.has(i));
  state.sel.clear(); if (!full) all.forEach(i => state.sel.add(i)); updSel();
};
const selIds = () => [...document.querySelectorAll('#lib .item[data-id]')].map(x => x.dataset.id).filter(id => state.sel.has(id));
$('#selRen').onclick = () => renameSeries(selIds());
$('#selMove').onclick = () => moveTo(selIds());
// rinomina di un singolo video (doppio clic sul titolo in libreria, o dal titolo sotto il player)
async function renameOne(id, cur) {
  const v = await dialog({ title: 'Rinomina', input: { value: cur }, ok: 'Salva' }); if (!v || v === cur) return;
  await post('api/rename', { id, title: v }); await refreshLib(); if (state.cur && state.cur.id === id) open(id);
}

/* ---------- jobs ---------- */
const KIND = { transcribe: 'Trascrizione', download: 'Download', upload: 'Caricamento', analyze: 'Ricerca delle pause', prepare: 'Versione senza pause', export: 'Esportazione' };
async function pollJobs() {
  try { state.jobs = await api('api/jobs'); } catch { return; }
  for (const j of state.jobs) {
    if (j.status === 'running' || j.status === 'queued' || state.seen.has(j.id)) continue;
    state.seen.add(j.id);
    if (j.status === 'error' && j.kind === 'prepare' && state.cur && state.cur.id === j.video) await open(j.video);
    if (j.status === 'error') { toast(`${KIND[j.kind]} non riuscito`, `${j.title || j.url || ''}\n${j.message}`, 'err'); continue; }
    const r = j.result || {};
    if (j.kind === 'download' || j.kind === 'upload') { await loadLib(); if (!state.cur) await open(r.video); }
    if (j.kind === 'analyze' || j.kind === 'prepare') { if (state.cur && state.cur.id === r.video) await open(r.video); else loadLib(); }
    if (j.kind === 'transcribe') { if (state.cur && state.cur.id === r.video) trLoad(true); loadLib(); }
    if (j.kind === 'export') { toast('Esportazione pronta', j.title || ''); if (state.cur && state.cur.id === r.video) await open(r.video); }
  }
  renderJobs();
}
setInterval(pollJobs, 800);
const firstPoll = api('api/jobs').then(js => js.forEach(j => j.ended && state.seen.add(j.id))).catch(() => {});
const jobEls = new Map();
function renderJobsHeader() {
  const active = state.jobs.filter(j => j.status === 'running' || j.status === 'queued');
  $('#actInd').classList.toggle('show', active.length > 0 && !sideOpen('l'));
  if (active.length) $('#actN').textContent = isMob() ? String(active.length) : active.length === 1 ? '1 in corso' : `${active.length} in corso`;
  $('#actCount').textContent = active.length || '';
}
function jobThumb(j) { const lib = state.lib.find(m => m.id === j.video); return j.thumb || (lib && lib.thumb ? `media/${lib.id}/${lib.thumb}` : ''); }
function jobTitle(j) { return j.title || (j.url ? shortUrl(j.url).host + ' · ' + shortUrl(j.url).rest : KIND[j.kind]); }
function fillJobEl(w, j) {
  const el = w.querySelector('.job'), th = jobThumb(j);
  const sub = j.status === 'queued' ? 'In coda' : j.status === 'done' ? 'Completato' : j.status === 'error' ? 'Non riuscito' : (j.message || '');
  const title = jobTitle(j);
  el.className = `job ${j.status}`;
  const tb = el.querySelector('.thumb'), thKey = th + '|' + !!j.audio;
  if (tb._k !== thKey) { tb._k = thKey; tb.style.backgroundImage = th ? `url('${th}')` : ''; tb.innerHTML = (j.audio ? `<span class="badge">${ICON.audio}</span>` : '') + ICON.tick; }
  const t = el.querySelector('.t'), full = (j.kind !== 'download' ? KIND[j.kind] + ' \u00b7 ' : '') + title;
  if (t.textContent !== full) { t.textContent = full; t.title = title; }
  el.querySelector('.s').textContent = sub;
  el.querySelector('.pb i').style.transform = j.status === 'queued' ? '' : `scaleX(${j.status === 'done' ? 1 : clamp(j.progress, 0, 1)})`;
}
// "In corso" e' una cartella: occupa lo spazio di un solo video; la griglia completa sta nella finestra
function renderJobFolder(vis) {
  const act = vis.filter(j => j.status === 'running' || j.status === 'queued'), shown = act.length ? act : vis;
  const stk = $('#actStk'), ths = shown.slice(0, 3).map(jobThumb);
  const k = ths.join('|') + shown.length;
  if (stk._k !== k) { stk._k = k;
    stk.innerHTML = ths.map((t, i) => `<span class="stk-i" style="--i:${i};${t ? `background-image:url('${t}')` : ''}"></span>`).reverse().join('') || '<span class="stk-i"></span>'; }
  const n = act.length, p = shown.length ? shown.reduce((a, j) => a + (j.status === 'done' ? 1 : j.status === 'error' ? 0 : clamp(j.progress, 0, 1)), 0) / shown.length : 0;
  swapText($('#actT'), n ? (n === 1 ? '1 in corso' : `${n} in corso`) : 'Completati');
  const run = act.find(j => j.status === 'running');
  $('#actS').textContent = run ? (run.message || jobTitle(run)) : n ? 'In coda' : 'Pronti nella libreria';
  $('#actBar').style.transform = `scaleX(${clamp(p, 0, 1)})`;
}
function renderJobs() {
  const now = Date.now() / 1000;
  const vis = state.jobs.filter(j => !j.ended || now - j.ended < (j.status === 'error' ? 12 : 3))
    .filter(j => (j.kind !== 'analyze' && j.kind !== 'prepare') || !j.ended || j.status === 'error').sort((a, b) => a.created - b.created);
  $('#actSec').classList.toggle('show', vis.length > 0);
  renderJobsHeader();
  renderJobFolder(vis); trProgress();
  if (fw.mode === 'jobs' && !vis.length) closeFw();
  const box = $('#fwGrid'), keep = new Set();
  if (fw.mode !== 'jobs') { jobEls.clear(); }
  else for (const j of vis) {
    keep.add(j.id);
    let w = jobEls.get(j.id);
    if (!w || !w.isConnected) {
      w = document.createElement('div'); w.className = 'job-w' + (reduce ? '' : ' in');
      w.innerHTML = `<div><div class="job"><div class="thumb"></div><div class="info"><div class="t"></div><div class="s"></div><div class="pb"><i></i></div></div></div></div>`;
      jobEls.set(j.id, w); box.append(w);
    }
    fillJobEl(w, j);
  }
  for (const [id, w] of jobEls) if (!keep.has(id) && !w._out) {
    w._out = true; w.classList.remove('in'); w.classList.add('out');
    setTimeout(() => { w.remove(); jobEls.delete(id); }, 480);
  }
  // pulsanti con avanzamento nel pannello
  const cur = state.cur && state.cur.id;
  const ex = state.jobs.find(j => j.kind === 'export' && j.video === cur && !j.ended);
  const an = state.jobs.find(j => j.kind === 'analyze' && j.video === cur && !j.ended);
  progBtn($('#exportBtn'), ex, exportLabel());
  progBtn($('#analyzeBtn'), an, 'Ripristina predefiniti');
  const pr = state.jobs.find(j => j.kind === 'prepare' && j.video === cur && !j.ended);
  if (an) $('#skipSub').textContent = `Analisi in corso · ${Math.round(an.progress * 100)}%`;
  else if (pr && state.cur && state.cur.analysis) $('#skipSub').textContent = pr.status === 'queued' ? 'Versione senza pause in coda…' : `Senza pause, in streaming · ${Math.round(pr.progress * 100)}% pronto`;
}
function progBtn(btn, job, idle) {
  const lbl = btn.querySelector('.lbl'), fill = btn.querySelector('.fill'), was = btn.classList.contains('busy');
  btn.classList.toggle('busy', !!job);
  fill.style.transform = `scaleX(${job ? clamp(job.progress, 0, 1) : 0})`;
  const text = job ? (job.status === 'queued' ? 'In coda…' : `${job.kind === 'export' ? 'Esportazione' : 'Analisi'} ${Math.round(job.progress * 100)}%`) : idle;
  if (was === !!job && job) { lbl._txt = text; lbl.textContent = text; } else swapText(lbl, text);
}

/* ---------- library ---------- */
const libSeen = new Set(); let libKey = '', showArch = false;
const IC = {
  play: '<svg viewBox="0 0 24 24"><path d="M8.5 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L10 4.74a1 1 0 0 0-1.5.86z"/></svg>',
  arch: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></svg>',
  unarch: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M12 17v-5m-2.2 2L12 11.8l2.2 2.2"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
};
function itemHTML(m, k, nw) {
  const th = m.thumb ? `media/${m.id}/${m.thumb}` : '';
  return `<div class="item ${state.cur && state.cur.id === m.id ? 'on' : ''} ${nw && !reduce ? 'in' : ''} ${state.sel.has(m.id) ? 'picked' : ''}" style="--i:${nw ? Math.min(k, 10) : 0}" data-id="${m.id}" draggable="true">
    <div class="irow">
      <span class="chk"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></span>
      <div class="thumb" style="${th ? `background-image:url('${th}')` : ''}">${m.audio ? `<span class="badge">${ICON.audio}</span>` : ''}</div>
      <div style="min-width:0"><div class="t">${esc(m.title)}</div>
      <div class="s">${fmt(m.duration)}${m.analysis ? ` → ${fmt(m.analysis.kept)}` : ''} · ${ago(m.created)}</div></div>
    </div>
    <div class="pvw"><div class="pvw-in">
      <div class="pvw-media${m.audio ? ' audio' : ''}" style="${th ? `background-image:url('${th}')` : ''}"></div>
      <div class="resin"></div>
      <button class="pa pa-side" data-act="${m.archived ? 'unarchive' : 'archive'}" title="${m.archived ? 'Ripristina' : 'Archivia'}">${m.archived ? IC.unarch : IC.arch}</button>
      <button class="pa pa-open" data-act="open">${IC.play}<span>Apri</span></button>
      <button class="pa pa-side pa-del" data-act="delete" title="Elimina">${IC.del}<span>Elimina?</span></button>
      <div class="pvw-speed">10×</div>
    </div></div>
  </div>`;
}
function folderHTML(f, k, nw) {
  const vids = state.lib.filter(m => !m.archived && m.folder === f.id), th = vids.filter(m => m.thumb).slice(0, 4);
  const tot = vids.reduce((a, m) => a + (m.duration || 0), 0);
  return `<div class="item folder ${fw.mode === 'folder' && fw.id === f.id ? 'on' : ''} ${nw && !reduce ? 'in' : ''}" style="--i:${nw ? Math.min(k, 10) : 0}" data-fid="${f.id}">
    <div class="irow"><div class="mosaic">${[0, 1, 2, 3].map(i => `<span style="${th[i] ? `background-image:url('media/${th[i].id}/${th[i].thumb}')` : ''}"></span>`).join('')}</div>
    <div style="min-width:0"><div class="t">${esc(f.name)}</div><div class="s">${vids.length} video${vids.length ? ' \u00b7 ' + human(tot) : ''}</div></div>
    <span class="fold-go"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span></div></div>`;
}
const folderSet = () => new Set(state.folders.map(f => f.id));
async function loadLib() {
  const [lib, folders] = await Promise.all([api('api/library'), api('api/folders').catch(() => state.folders)]);
  state.lib = lib; state.folders = folders;
  loadSpace(false);
  const fs = folderSet();
  const live = state.lib.filter(m => !m.archived), arch = state.lib.filter(m => m.archived);
  const root = live.filter(m => !m.folder || !fs.has(m.folder));
  $('#libCount').textContent = live.length || '';
  const el = $('#lib');
  const key = JSON.stringify([state.lib.map(m => [m.id, m.thumb, m.title, m.archived, m.folder, m.analysis && m.analysis.kept]), state.folders]) + (state.cur && state.cur.id) + showArch + (fw.mode === 'folder' ? fw.id : '') + !!state.selecting;
  renderFw();
  if (key === libKey) return; libKey = key; loadSpace(true);
  stopPreview();
  let k = 0;
  const mk = m => { const nw = !libSeen.has(m.id); libSeen.add(m.id); return itemHTML(m, nw ? k++ : 0, nw); };
  const mf = f => { const id = 'f' + f.id, nw = !libSeen.has(id); libSeen.add(id); return folderHTML(f, nw ? k++ : 0, nw); };
  const sorted = [...state.folders].sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
  el.innerHTML = sorted.map(mf).join('') + (root.length ? root.map(mk).join('') : (state.folders.length ? '' : '<div class="lib-empty">Ancora nessun video. Incolla dei link oppure trascina dei file nella finestra.</div>'))
    + (arch.length ? `<button class="arch-h ${showArch ? 'open' : ''}" id="archTgl">${IC.chev}<span>Archiviati</span><em>${arch.length}</em></button>
      <div class="arch-l ${showArch ? 'open' : ''}"><div>${arch.map(mk).join('')}</div></div>` : '');
  updSel();
}
// anteprima al passaggio del mouse: video muto a 10× sotto un vetro sfocato
let pvItem = null, pvTimer = 0;
function startPreview(it) {
  if (pvItem === it || it.dataset.fid) return; stopPreview(); pvItem = it; it.classList.add('hov');
  const m = state.lib.find(x => x.id === it.dataset.id); if (!m || m.audio) return;
  const box = it.querySelector('.pvw-media');
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
  v.src = `media/${m.id}/${m.file}`;
  v.addEventListener('loadedmetadata', () => { v.currentTime = (v.duration || 0) * .08; v.playbackRate = 10; v.play().catch(() => {}); }, { once: true });
  v.addEventListener('playing', () => v.classList.add('on'), { once: true });
  box.append(v);
}
function stopPreview() {
  clearTimeout(pvTimer); const it = pvItem; pvItem = null; if (!it) return;
  it.classList.remove('hov'); const d = it.querySelector('.pa-del'); d && d.classList.remove('arm');
  const v = it.querySelector('.pvw-media video');
  if (v) setTimeout(() => { if (pvItem === it) return; v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }, 700);
}
const libEl = $('#lib');
libEl.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return; const it = e.target.closest('.item'); if (!it || it === pvItem) return;
  clearTimeout(pvTimer); startPreview(it);
});
libEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') stopPreview(); });
libEl.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse') return; const it = e.target.closest('.item');
  if (it && !it.contains(e.relatedTarget)) { clearTimeout(pvTimer); if (it === pvItem) stopPreview(); } });
// touch: pressione lunga per aprire l'anteprima con i pulsanti
let lp = 0;
libEl.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; const it = e.target.closest('.item'); if (!it || e.target.closest('.pa')) return;
  clearTimeout(lp); lp = setTimeout(() => { it._lp = true; it === pvItem ? stopPreview() : startPreview(it); navigator.vibrate && navigator.vibrate(8); }, 450); });
['pointerup', 'pointercancel', 'pointermove'].forEach(ev => libEl.addEventListener(ev, e => { if (ev !== 'pointermove' || Math.abs(e.movementY) > 2) clearTimeout(lp); }));
libEl.addEventListener('dblclick', e => { const t = e.target.closest('.item[data-id] .t'); if (!t || state.selecting) return;
  const m = state.lib.find(x => x.id === t.closest('.item').dataset.id); if (m) renameOne(m.id, m.title); });
// trascina un video su una cartella per spostarlo
libEl.addEventListener('dragstart', e => { const it = e.target.closest('.item[data-id]'); if (!it) return; stopPreview();
  const ids = state.selecting && state.sel.has(it.dataset.id) ? [...state.sel] : [it.dataset.id];
  if (!state.selecting && !state.sel.has(it.dataset.id) && ids.length === 1) { /* trascinamento di un solo video */ }
  e.dataTransfer.setData('text/x-sc', JSON.stringify(ids)); e.dataTransfer.effectAllowed = 'move';
  if (ids.length > 1 && e.dataTransfer.setDragImage) { const g = document.createElement('div'); g.className = 'drag-img'; g.textContent = `${ids.length} video`; document.body.append(g); e.dataTransfer.setDragImage(g, 20, 16); setTimeout(() => g.remove(), 0); } });
const dropTarget = e => e.dataTransfer && [...e.dataTransfer.types].includes('text/x-sc') && e.target.closest('.item.folder');
libEl.addEventListener('dragover', e => { const f = dropTarget(e); document.querySelectorAll('.item.folder.drop').forEach(x => x !== f && x.classList.remove('drop')); if (f) { e.preventDefault(); f.classList.add('drop'); } });
libEl.addEventListener('dragleave', e => { if (e.target.closest) { const f = e.target.closest('.item.folder'); if (f && !f.contains(e.relatedTarget)) f.classList.remove('drop'); } });
libEl.addEventListener('drop', async e => { const f = dropTarget(e); if (!f) return; e.preventDefault(); e.stopPropagation(); f.classList.remove('drop');
  await post('api/move', { ids: JSON.parse(e.dataTransfer.getData('text/x-sc')), folder: f.dataset.fid }); state.sel.clear(); refreshLib(); });
libEl.addEventListener('contextmenu', e => { if (e.target.closest('.item') && matchMedia('(hover:none)').matches) e.preventDefault(); });

libEl.addEventListener('click', async e => {
  if (e.target.closest('#archTgl')) { showArch = !showArch; libKey = ''; return loadLib(); }
  const it = e.target.closest('.item'); if (!it) return;
  if (it._lp) { it._lp = false; return; }
  if (it.dataset.fid) { e.stopPropagation(); return fw.mode === 'folder' && fw.id === it.dataset.fid ? closeFw() : openFw('folder', it.dataset.fid, it); }
  if ((state.selecting || e.ctrlKey || e.metaKey || e.shiftKey) && !e.target.closest('.pa')) {
    if (!state.selecting) { state.selecting = true; $('#left').classList.add('selecting'); $('#selMode').classList.add('on'); if (state.cur && !e.shiftKey) state.sel.add(state.cur.id); }
    const i = it.dataset.id, ids = [...document.querySelectorAll('#lib .item[data-id]')].map(x => x.dataset.id);
    if (e.shiftKey && state.selLast && ids.includes(state.selLast)) { const a = ids.indexOf(state.selLast), b = ids.indexOf(i); ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => state.sel.add(x)); }
    else state.sel.has(i) ? state.sel.delete(i) : state.sel.add(i);
    state.selLast = i; e.preventDefault(); updSel(); return;
  }
  const id = it.dataset.id, act = (e.target.closest('.pa') || {}).dataset?.act || 'open';
  e.stopPropagation();
  if (act === 'archive' || act === 'unarchive') {
    await post('api/archive', { id, archived: act === 'archive' });
    await vanish(it); if (act === 'archive' && state.cur && state.cur.id === id) closeViewer();
    libKey = ''; return loadLib();
  }
  if (act === 'delete') {
    const b = it.querySelector('.pa-del');
    if (!b.classList.contains('arm')) { b.classList.add('arm'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('arm'), 3000); return; }
    await api(`api/video/${id}`, { method: 'DELETE' });
    await vanish(it); if (state.cur && state.cur.id === id) closeViewer();
    libKey = ''; return loadLib();
  }
  stopPreview();
  document.querySelectorAll('#lib .item.on').forEach(x => x.classList.remove('on')); it.classList.add('on');
  if (isMob()) setSide('l', false);
  open(id);
});
async function vanish(it) {
  stopPreview(); if (reduce) return;
  const h = it.offsetHeight;
  await it.animate([{ opacity: 1, height: h + 'px', filter: 'blur(0)' }, { opacity: 0, height: '0px', marginTop: '-2px', filter: 'blur(6px)', transform: 'scale(.96)' }],
    { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished;
}

async function open(id) {
  if (!id) return;
  const m = await api(`api/video/${id}`);
  const same = state.cur && state.cur.id === id, first = !state.cur;
  state.cur = m;
  $('#empty').hidden = true; $('#viewer').hidden = false; window.BGFX && BGFX.mode('waves');
  maybeVideoTour();
  if (!same) {
    const src = `media/${m.id}/${m.file}`, st = m.settings || {};
    state.skip = st.skip !== undefined ? st.skip : true; state.skipCuts = st.skipCuts !== undefined ? st.skipCuts : true; setSpeed(st.speed || 1, false);
    $('#exCuts').checked = state.skipCuts; state.cutIn = state.cutOut = null; trSwitch(m.id);
    const a = m.analysis || {}; $('#noise').value = a.noise ?? DEF.noise; $('#mind').value = a.min ?? DEF.min; $('#pad').value = a.pad ?? DEF.pad; syncAdv();
    $('#exRemove').checked = state.skip;
    state.src = null; syncSrc(0, false);
    if (m.audio) pv.removeAttribute('src'); else pv.src = src;
    const poster = m.thumb ? `url('media/${m.id}/${m.thumb}')` : 'none';
    vwrap.style.setProperty('--poster', poster); vwrap.classList.toggle('audio', !!m.audio);
    video.poster = m.thumb && !m.audio ? `media/${m.id}/${m.thumb}` : '';
    $('#tip').classList.toggle('noprev', !!m.audio);
    if (!reduce) $('#viewer').animate([{ opacity: 0, transform: 'translateY(10px) scale(.99)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: first ? 700 : 480, easing: 'cubic-bezier(.16,1,.3,1)', delay: first ? 150 : 0, fill: 'backwards' });
    syncPlay();
  }
  $('#vTitle').textContent = m.title; $('#vTitle').title = m.title;
  let src = m.source; try { src = new URL(m.source).hostname.replace('www.', ''); } catch {}
  $('#vMeta').textContent = `${human(m.duration)} · ${m.audio ? 'solo audio · ' : ''}${src}`;
  $('#origDl').href = `media/${m.id}/${m.file}?dl=1`;
  $('#exTitle').textContent = m.audio ? 'Esporta questo audio' : 'Esporta questo video';
  if (m.analysis && !advDirty) { $('#noise').value = m.analysis.noise; $('#mind').value = m.analysis.min; $('#pad').value = m.analysis.pad; syncAdv(); }
  renderPanel();
  if (same) syncSrc();
  renderAnalysis(); renderCuts(); renderMarkers(); renderExports(!same); loadLib(); renderJobs(); tlKey = '';
}
function renderPanel() {
  const m = state.cur;
  $('#pEmpty').hidden = !!m; $('#pBody').hidden = !m; $('#pBody2').hidden = !m; $('#rpNone').hidden = !!m;
  ['#paneTr', '#paneMk', '#paneCt'].forEach(x => $(x).hidden = !m); $('#tabs').hidden = !m;
  if (!m) return;
  $('#pTitle').textContent = m.title; $('#pTitle').title = m.title;
  $('#pThumb').style.backgroundImage = m.thumb ? `url('media/${m.id}/${m.thumb}')` : '';
  segInd();
}
let setT = 0;
function saveSettings() { // salvate nel video: ogni video ricorda velocita' e salto delle pause
  const m = state.cur; if (!m) return;
  m.settings = { speed: state.speed, skip: state.skip, skipCuts: state.skipCuts };
  clearTimeout(setT); setT = setTimeout(() => post('api/settings', { id: m.id, ...m.settings }).catch(() => {}), 400);
}
function renderAnalysis() {
  const m = state.cur, a = m && m.analysis, on = !!a && state.skip;
  $('#skipToggle').classList.toggle('on', on); $('#skipToggle').setAttribute('aria-checked', on);
  $('#qSkip').disabled = !a; $('#qSkip').classList.toggle('on', on);
  $('#skipSub').textContent = a ? `${a.count} pause · ${fmt(m.duration - a.kept)} in meno` : 'Tocca per cercare le pause';
  renderStats();
}
function renderStats() {
  const m = state.cur; if (!m) return;
  const a = m.analysis, d = m.duration, rem = removedRanges();
  const removed = rem.reduce((t, [x, y]) => t + Math.max(0, Math.min(y, d) - x), 0), eff = (d - removed) / state.speed;
  $('#stOrig').textContent = fmt(d);
  $('#stNoSil').textContent = a ? fmt(a.kept) : '–';
  tween($('#stEff'), eff, fmt);
  tween($('#stSaved'), d - eff, v => v > 1 ? `${fmt(v)} <small>${Math.round(v / d * 100)}%</small>` : '–');
  $('#stSavedSub').textContent = d - eff > 1 ? `${fmt(d)} diventano ${fmt(eff)}` : 'in questo video';
  renderLibSaved();
}
function renderLibSaved() {
  const t = state.lib.reduce((a, m) => a + (m.analysis ? Math.max(0, m.duration - m.analysis.kept) : 0), 0);
  $('#stLibSaved').textContent = t > 1 ? human(t) : '–';
}
// parti da saltare in questo momento: silenzi (se attivi) + tagli (se attivi), unite
let rvKey = '', rvVal = [];
function removedRanges() {
  const m = state.cur; if (!m) return [];
  const k = [m.id, state.skip, state.skipCuts, m.analysis && m.analysis.key, (m.cuts || []).map(c => c.id + c.s + c.e).join()].join('|');
  if (k === rvKey) return rvVal;
  const r = []; if (m.analysis && state.skip) r.push(...m.analysis.skips); if (state.skipCuts && m.cuts) r.push(...m.cuts.map(c => [c.s, c.e]));
  r.sort((x, y) => x[0] - y[0]); const out = [];
  for (const [x, y] of r) { if (out.length && x <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], y); else out.push([x, y]); }
  rvKey = k; return rvVal = out;
}
const exportLabel = () => `Crea a ${sp(state.speed)}${$('#exRemove').checked ? ' · senza pause' : ''}${$('#exCuts').checked && state.cur && (state.cur.cuts || []).length ? ' · senza tagli' : ''}`;
['#exRemove', '#exCuts'].forEach(x => $(x).addEventListener('change', () => { if (!$('#exportBtn').classList.contains('busy')) swapText($('#exLabel'), exportLabel()); }));
const expSeen = new Set();
function renderExports(reset) {
  const m = state.cur, ex = (m && m.exports) || [];
  if (reset) { expSeen.clear(); ex.forEach(e => expSeen.add(e.file)); }
  $('#exports').innerHTML = ex.map(e => { const nw = !expSeen.has(e.file); expSeen.add(e.file);
    return `<div class="exp ${nw ? 'in' : ''}"><div class="n">${sp(e.speed)}${e.remove ? ' · senza silenzi' : ''}${e.cuts ? ' · senza tagli' : ''}
    <small>${fmt(e.duration)} · ${(e.size / 1e6).toFixed(e.size < 1e7 ? 1 : 0).replace('.', ',')} MB</small></div>
    <a href="media/${m.id}/${e.file}?dl=1">Salva</a>
    <button class="ib" data-del="${esc(e.file)}" title="Elimina">${ICON.x}</button></div>`; }).join('');
}
$('#exports').addEventListener('click', async e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const row = b.closest('.exp');
  if (!reduce) await row.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(12px)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished;
  state.cur = await api(`api/video/${state.cur.id}/export/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' });
  renderExports();
});

/* ---------- import (upload a pezzi: niente timeout del proxy, avanzamento e ripresa) ---------- */
const UP_EXT = ['mp4', 'webm', 'mkv', 'mov', 'm4v', 'm4a', 'mp3', 'wav', 'opus', 'ogg', 'aac', 'flac', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', 'mts', 'm2ts', '3gp', 'wma'];
const CHUNK = 8 << 20;
let uploading = 0;
$('#importBtn').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = e => { importFiles(e.target.files); e.target.value = ''; };
function importFiles(list) {
  const files = [...(list || [])];
  const bad = files.filter(f => !UP_EXT.includes((f.name.split('.').pop() || '').toLowerCase()));
  if (bad.length) toast('Formato non supportato', bad.map(f => f.name).join('\n'), 'err');
  files.filter(f => !bad.includes(f)).forEach(importFile);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function importFile(f) {
  uploading++;
  try {
    const { id } = await post('api/upload', { name: f.name, size: f.size });
    pollJobs();
    let off = 0, fails = 0;
    while (off < f.size) {
      const r = await fetch(`api/upload/${id}?offset=${off}`, { method: 'PUT', body: f.slice(off, Math.min(off + CHUNK, f.size)),
        headers: { 'Content-Type': 'application/octet-stream' } }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r && (r.ok || r.status === 409) && typeof j.got === 'number') { off = j.got; fails = 0; continue; }
      if (r && r.status === 401) { relogin(); throw new Error('Accesso richiesto'); }
      if (r && r.status === 404) throw new Error(j.error || 'Caricamento scaduto');
      if (++fails > 5) throw new Error(j.error || 'Connessione persa durante il caricamento');
      await sleep(1000 * fails);
    }
    await post(`api/upload/${id}/done`, {});
    pollJobs();
  } catch (err) { toast('Importazione non riuscita', `${f.name}\n${err.message}`, 'err'); }
  finally { uploading--; }
}
addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
let dragN = 0;
addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragN++; $('#drop').classList.add('show'); } });
addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#drop').classList.remove('show'); } });
addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
addEventListener('drop', e => { e.preventDefault(); dragN = 0; $('#drop').classList.remove('show'); importFiles(e.dataTransfer.files); });

/* ---------- versione senza pause ----------
   Dopo l'analisi il server prepara un file con i silenzi gia' tolti (cut): il browser lo riproduce di
   fila, senza salti e quindi senza buffering. La timeline resta nei tempi del video originale grazie
   alla mappa [inizio_originale, inizio_tagliato, durata] di ogni tratto. Finche' non e' pronto, i
   silenzi vengono saltati durante la riproduzione come ripiego. */
const MSE = window.ManagedMediaSource || window.MediaSource;
const NATIVE_HLS = !!document.createElement('video').canPlayType('application/vnd.apple.mpegurl');
const cutOk = m => !!(m && m.cut && m.cut.map && m.analysis && m.cut.key === m.analysis.key && (!m.cut.hls || MSE || NATIVE_HLS));

/* Streaming della versione senza pause, come su YouTube: il server la crea a pezzi da 2 s (HLS fMP4)
   e il player la scarica a pezzi mentre la guardi, anche quando non e' ancora finita. Tiene ~30 s
   avanti, libera la memoria dietro e salta direttamente al pezzo giusto quando cerchi. */
class CutStream {
  constructor(v, base, dur, audio) {
    Object.assign(this, { v, base, dur, audio, segs: [], ended: false, have: new Set(), busy: false, dead: false });
    this.ms = new MSE(); if (MSE === window.ManagedMediaSource) v.disableRemotePlayback = true;
    this.url = URL.createObjectURL(this.ms);
    this.ms.addEventListener('sourceopen', () => this.open().catch(e => this.dead || console.warn('stream', e)), { once: true });
    this.tick = this.tick.bind(this); this.evs = ['seeking', 'timeupdate', 'ratechange', 'waiting'];
    this.evs.forEach(e => v.addEventListener(e, this.tick));
  }
  destroy() { this.dead = true; this.evs.forEach(e => this.v.removeEventListener(e, this.tick)); URL.revokeObjectURL(this.url); }
  async get(name, text) { // aspetta che il pezzo esista (il server lo sta ancora creando)
    for (let i = 0; !this.dead; i++) {
      const r = await fetch(this.base + name, { cache: name.endsWith('.m3u8') ? 'no-store' : 'default' }).catch(() => null);
      if (r && r.ok) return text ? r.text() : r.arrayBuffer();
      if (r && r.status === 401) { relogin(); break; }
      await sleep(Math.min(1500, 250 + i * 100));
    }
    throw new Error('chiuso');
  }
  async list() {
    const txt = await this.get('index.m3u8', true), segs = []; let t = 0, d = null;
    for (const l of txt.split('\n').map(x => x.trim())) {
      if (l.startsWith('#EXTINF:')) d = parseFloat(l.slice(8));
      else if (l && !l.startsWith('#') && d !== null) { segs.push({ name: l, s: t, e: t + d }); t += d; d = null; }
    }
    this.segs = segs; this.ended = txt.includes('#EXT-X-ENDLIST'); this.onlist && this.onlist(t, this.ended);
  }
  async open() {
    try { this.ms.duration = this.dur; } catch {}
    this.sb = this.ms.addSourceBuffer(this.audio ? 'audio/mp4; codecs="mp4a.40.2"' : 'video/mp4; codecs="avc1.640028, mp4a.40.2"');
    await this.list(); await this.append(await this.get('init.mp4'));
    this.tick();
    while (!this.ended && !this.dead) { await sleep(1000); await this.list(); this.tick(); }
  }
  wait() { return new Promise((ok, ko) => { const sb = this.sb; const f = () => { sb.removeEventListener('updateend', f); sb.removeEventListener('error', g); ok(); };
    const g = () => { sb.removeEventListener('updateend', f); sb.removeEventListener('error', g); ko(new Error('append')); };
    sb.addEventListener('updateend', f); sb.addEventListener('error', g); }); }
  async append(buf) {
    for (let k = 0; k < 2; k++) {
      try { const p = this.wait(); this.sb.appendBuffer(buf); return await p; }
      catch (e) { if (e.name !== 'QuotaExceededError' || k) throw e; await this.evict(5); }
    }
  }
  async evict(back) { // libera i pezzi gia' visti
    const t = this.v.currentTime - back; if (t <= 0 || !this.sb.buffered.length || this.sb.buffered.start(0) >= t) return;
    const p = this.wait(); this.sb.remove(0, t); await p;
    this.segs.forEach((g, i) => { if (g.e <= t) this.have.delete(i); });
  }
  // i pezzi segnati come scaricati ma non piu' nel buffer (rimossi dal browser) vanno riscaricati
  resync() {
    const b = this.sb && this.sb.buffered; if (!b) return;
    // basta che il centro del pezzo sia nel buffer (ai confini ci possono essere scarti di pochi ms)
    const has = m => { for (let k = 0; k < b.length; k++) if (b.start(k) <= m && b.end(k) >= m) return true; return false; };
    this.segs.forEach((g, i) => { if (this.have.has(i) && !has((g.s + g.e) / 2)) this.have.delete(i); });
  }
  async tick() {
    if (this.dead || !this.sb) return;
    if (this.busy) { this.again = true; return; }   // un evento arrivato durante il lavoro non va perso
    this.busy = true;
    try {
      do { this.again = false; this.resync(); await this.fill(); } while (this.again && !this.dead);
    } finally { this.busy = false; }
  }
  async fill() {
    try {
      while (!this.dead) {
        const t = this.v.currentTime, ahead = t + 20 + 10 * (this.v.playbackRate || 1);
        if (this.sb.buffered.length && this.sb.buffered.start(0) < t - 60) await this.evict(30);
        let i = this.segs.findIndex(g => g.e > t + .05); if (i < 0) break;
        while (i < this.segs.length && this.have.has(i) && this.segs[i].s < ahead) i++;
        if (i >= this.segs.length || this.segs[i].s >= ahead) break;
        const buf = await this.get(this.segs[i].name); if (this.dead) break;
        await this.append(buf); this.have.add(i);
      }
      const last = this.segs.length - 1;
      if (this.ended && last >= 0 && this.have.has(last) && this.ms.readyState === 'open' && !this.sb.updating) this.ms.endOfStream();
    } catch (e) { if (!this.dead) { console.warn('stream', e); await sleep(400); this.again = true; } }
  }
}
/* Anti-blocco: se il video si ferma in un "buco" tra due pezzi del buffer (capita ai confini dei pezzi),
   il browser non riparte da solo finche' non si cerca piu' avanti. Qui saltiamo il buco, e se mancano
   dati riscarichiamo i pezzi. Vale per tutte le sorgenti (originale, streaming, file). */
let stallSince = 0;
function unstick() {
  if (!state.cur || video.paused || video.seeking || video.ended || !video.src) { stallSince = 0; return; }
  const t = video.currentTime, b = video.buffered;
  let inRange = false, next = null;
  for (let i = 0; i < b.length; i++) {
    if (b.start(i) <= t + .02 && b.end(i) > t + .25) inRange = true;
    if (b.start(i) > t && (next === null || b.start(i) < next)) next = b.start(i);
  }
  if (inRange && video.readyState >= 3) { stallSince = 0; return; }
  if (!stallSince) stallSince = performance.now();
  if (next !== null && next - t < 2.5 && performance.now() - stallSince > 250) {
    video.currentTime = next + .02; stallSince = 0; return;    // salta il buco
  }
  if (performance.now() - stallSince > 1500 && state.stream) {
    state.stream.have.clear(); state.stream.tick();               // forza il riscarico attorno alla posizione
  }
  if (performance.now() - stallSince > 4000 && !inRange) {       // ancora fermo: ricarica la sorgente nello stesso punto
    stallSince = performance.now(); const t0 = curT(); state.src = null; syncSrc(t0, true);
  }
}
setInterval(unstick, 300);
['waiting', 'stalled'].forEach(ev => video.addEventListener(ev, () => setTimeout(unstick, 200)));
const inCut = () => state.src === 'cut' && cutOk(state.cur);
function segAt(mp, t, k) { // ultimo tratto con mp[i][k] <= t
  let lo = 0, hi = mp.length - 1, r = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (mp[mid][k] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}
function toOrig(tc) { const mp = state.cur.cut.map; if (!mp.length) return tc; const s = mp[segAt(mp, tc, 1)]; return s[0] + clamp(tc - s[1], 0, s[2]); }
function toCut(to) {
  const mp = state.cur.cut.map; if (!mp.length) return to;
  const i = segAt(mp, to, 0), s = mp[i];
  if (to < s[0]) return s[1];
  if (to <= s[0] + s[2]) return s[1] + (to - s[0]);
  return i + 1 < mp.length ? mp[i + 1][1] : s[1] + s[2]; // dentro una pausa: riparte dal tratto dopo
}
// state.pend: posizione da raggiungere mentre la nuova sorgente si carica
const curT = () => !state.cur ? 0 : state.pend != null ? state.pend : inCut() ? toOrig(video.currentTime) : video.currentTime;
const durT = () => state.cur ? (inCut() ? state.cur.duration : (video.duration || state.cur.duration)) : 0;
let seekPend = null;
const seekTo = (t, drag) => {
  if (!state.cur) return;
  if (wantSrc(t, state.src) !== state.src) { // es. salto oltre la parte gia' pronta: cambia sorgente
    if (drag) { seekPend = t; return; }     // mentre trascini, solo al rilascio
    seekPend = null; return syncSrc(t);
  }
  seekPend = null;
  video.currentTime = inCut() ? toCut(t) : t;
};
// quanto della versione senza pause e' gia' pronto (aggiornato dalla playlist)
state.rendered = { key: null, end: 0, ended: false };
function wantSrc(t, from) {
  const m = state.cur; if (!(state.skip && cutOk(m))) return 'orig';
  const c = m.cut, r = state.rendered;
  if (c.ready || !c.hls || (r.key === c.key && r.ended)) return 'cut';
  const ct = toCut(t);
  if (r.key !== c.key) return ct < 3 ? 'cut' : 'orig';   // appena partita: l'inizio arriva subito
  return ct < r.end - (from === 'cut' ? 0.5 : 8) ? 'cut' : 'orig'; // margine per non rimbalzare
}
async function readRendered(c) {
  try {
    const r = await fetch(`media/${state.cur.id}/${c.dir}/index.m3u8`, { cache: 'no-store' }); if (!r.ok) return;
    const txt = await r.text(); let end = 0;
    for (const l of txt.split('\n')) if (l.startsWith('#EXTINF:')) end += parseFloat(l.slice(8));
    state.rendered = { key: c.key, end, ended: txt.includes('#EXT-X-ENDLIST') };
  } catch {}
}
// mentre si crea: se il player e' sull'originale (salto oltre la parte pronta) torna allo streaming
// appena possibile; se lo streaming resta senza pezzi pronti, passa all'originale
setInterval(async () => {
  const m = state.cur; if (!m || !state.skip || !cutOk(m) || !m.cut.hls || m.cut.ready) return;
  if (state.src === 'orig') { await readRendered(m.cut); if (state.cur === m) syncSrc(); }
  else if (state.src === 'cut') {
    if (!state.stream) await readRendered(m.cut); // HLS nativo (iPhone)
    if (state.cur === m && !video.paused && video.readyState < 3 && wantSrc(curT(), 'cut') === 'orig') syncSrc();
  }
}, 1500);
function syncSrc(t, play) {
  const m = state.cur; if (!m) return;
  if (t === undefined) t = curT();
  const want = wantSrc(t, state.src);
  if (want === state.src) return;
  if (play === undefined) play = !video.paused;
  state.src = want;
  if (state.stream) { state.stream.destroy(); state.stream = null; }
  if (want === 'cut' && m.cut.hls) {
    const base = `media/${m.id}/${m.cut.dir}/`;
    if (MSE) {
      state.stream = new CutStream(video, base, m.cut.duration, m.audio); video.src = state.stream.url;
      state.stream.onlist = (end, ended) => { state.rendered = { key: m.cut.key, end, ended }; };
    }
    else video.src = base + 'index.m3u8'; // iPhone: HLS nativo
  } else video.src = `media/${m.id}/${want === 'cut' ? m.cut.file : m.file}`;
  video.playbackRate = state.speed;
  const pos = want === 'cut' ? toCut(t) : t;
  state.pend = t; const src = video.src;
  video.addEventListener('loadedmetadata', () => { if (video.src !== src) return; if (pos > 0.05) video.currentTime = pos; state.pend = null; }, { once: true });
  if (play) video.play().catch(() => {});
  tlKey = '';
}

/* ---------- silences ---------- */
async function analyze(id, quiet) {
  id = typeof id === 'string' ? id : state.cur && state.cur.id; if (!id) return;
  try { await post('api/analyze', { id, noise: +$('#noise').value, min: +$('#mind').value, pad: +$('#pad').value }); pollJobs(); }
  catch (err) { if (!quiet) toast('Analisi non riuscita', err.message, 'err'); }
}
const DEF = { noise: -35, min: 0.6, pad: 0.12 };
let advDirty = false, advT = 0;
// sensibilita': si applica da sola (nuova analisi solo di questo video) quando lasci il cursore
function applyAdv() {
  const m = state.cur; if (!m) return; const a = m.analysis;
  if (a && +$('#noise').value === a.noise && +$('#mind').value === a.min && +$('#pad').value === a.pad) { advDirty = false; return; }
  advDirty = true; clearTimeout(advT);
  advT = setTimeout(async () => { await analyze(m.id); advDirty = false; }, 350);
}
['noise', 'mind', 'pad'].forEach(id => $('#' + id).addEventListener('change', applyAdv));
$('#analyzeBtn').onclick = () => { $('#noise').value = DEF.noise; $('#mind').value = DEF.min; $('#pad').value = DEF.pad; syncAdv(); applyAdv(); };
function syncAdv() {
  $('#noiseO').textContent = `${$('#noise').value} dB`;
  $('#mindO').textContent = `${num(+$('#mind').value, 1)} s`;
  $('#padO').textContent = `${num(+$('#pad').value, 2)} s`;
  ['noise', 'mind', 'pad'].forEach(id => fillRange($('#' + id)));
}
['noise', 'mind', 'pad'].forEach(id => $('#' + id).addEventListener('input', syncAdv));
const toggleSkip = () => { if (!state.cur || !state.cur.analysis) return; state.skip = !state.skip; saveSettings(); syncSrc(); renderAnalysis(); tlKey = ''; };
$('#skipRow').onclick = () => {
  const m = state.cur; if (!m) return;
  if (m.analysis) return toggleSkip();
  const busy = state.jobs.some(j => j.kind === 'analyze' && j.video === m.id && !j.ended);
  if (busy) return toast('Analisi in corso', 'Il salto dei silenzi si attiva appena finisce');
  state.skip = true; saveSettings(); analyze(); toast('Cerco i silenzi…', 'Si attivano da soli appena l\'analisi è pronta');
};
$('#qSkip').onclick = toggleSkip;
function findSkip(t) {
  const s = state.cur && state.cur.analysis && state.cur.analysis.skips; if (!s) return null;
  let lo = 0, hi = s.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (s[mid][1] <= t) lo = mid + 1; else if (s[mid][0] > t) hi = mid - 1; else return s[mid]; }
  return null;
}
let lastFlash = 0;
function loop() {
  if (state.skip && state.cur && !inCut() && !video.paused && !video.seeking) {
    const sk = findSkip(video.currentTime);
    if (sk && sk[1] - video.currentTime > 0.05) {
      video.currentTime = Math.min(sk[1], video.duration || sk[1]);
      if (performance.now() - lastFlash > 1500 && sk[1] - sk[0] > 2) { lastFlash = performance.now(); flash(`Saltati ${num(sk[1] - sk[0], 1)} s di pausa`); }
    }
  }
  if (state.skipCuts && state.cur && state.cur.cuts && state.cur.cuts.length && !video.paused && !video.seeking && state.pend == null) {
    const t = curT(), c = findCut(t);
    if (c && c.e - t > 0.05 && performance.now() - cutAt > 300) { cutAt = performance.now(); seekTo(Math.min(c.e, durT())); flash(`Taglio saltato · ${num(c.e - c.s, 1)} s`); }
  }
  trTick(); drawTL(); requestAnimationFrame(loop);
}
let cutAt = 0;
const findCut = t => (state.cur.cuts || []).find(c => t >= c.s && t < c.e) || null;
function flash(t) { const f = $('#flash'); f.textContent = t; f.classList.add('show'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('show'), 1300); }

/* ---------- player ---------- */
function togglePlay(fx) {
  if (!state.cur) return;
  if (video.paused) { video.play().catch(() => {}); if (fx) { $('#pulse').innerHTML = PLAY; replay($('#pulse')); } }
  else video.pause();
}
const syncPlay = () => { $('#playBtn').classList.toggle('playing', !video.paused); vwrap.classList.toggle('paused', video.paused); };
['play', 'pause', 'ended', 'loadedmetadata', 'emptied'].forEach(ev => video.addEventListener(ev, syncPlay));
const seekBy = d => seekTo(clamp(curT() + d, 0, durT()));
$('#playBtn').onclick = () => togglePlay(false);
$('#back').onclick = () => seekBy(-10); $('#fwd').onclick = () => seekBy(10);

// tocco: tap = play/pausa (ritardato per riconoscere il doppio tap), doppio tap ai lati = ±10 s, al centro = schermo intero
let lastPT = 'mouse', tapT = 0, tapX = 0, tapTimer = null, tapStreak = 0;
vwrap.addEventListener('pointerdown', e => { lastPT = e.pointerType; wake(); });
vwrap.addEventListener('click', e => {
  if (lastPT !== 'touch' && lastPT !== 'pen') return togglePlay(true);
  const r = vwrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, now = performance.now();
  const side = x < .35 ? -1 : x > .65 ? 1 : 0;
  if (now - tapT < 320 && Math.abs(e.clientX - tapX) < 80) {
    clearTimeout(tapTimer); tapTimer = null; tapT = now; tapX = e.clientX;
    if (side) { tapStreak++; seekBy(side * 10); const rp = $(side < 0 ? '#ripL' : '#ripR'); rp.querySelector('span').lastChild.textContent = `${tapStreak * 10} s`; replay(rp); }
    else if (tapStreak === 0) toggleFs();
    return;
  }
  tapT = now; tapX = e.clientX; tapStreak = 0;
  tapTimer = setTimeout(() => { tapTimer = null; togglePlay(true); }, 260);
});
vwrap.addEventListener('dblclick', e => { if (lastPT === 'mouse') toggleFs(); });

function applyVol() {
  video.volume = state.vol; video.muted = state.muted || state.vol === 0;
  const r = $('#volR'); r.value = video.muted ? 0 : state.vol; fillRange(r);
  $('#muteBtn').innerHTML = ICON.vol(video.muted ? 0 : state.vol < .5 ? 1 : 2);
  localStorage.vol = state.vol; localStorage.muted = state.muted ? '1' : '0';
}
$('#volR').addEventListener('input', e => { state.vol = +e.target.value; state.muted = state.vol === 0; applyVol(); });
$('#muteBtn').onclick = () => { state.muted = !state.muted; if (!state.muted && state.vol === 0) state.vol = .6; applyVol(); };
const volBy = d => { state.vol = clamp(Math.round((state.vol + d) * 100) / 100, 0, 1); state.muted = state.vol === 0; applyVol(); flash(`Volume ${Math.round(state.vol * 100)}%`); };

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function toggleFs() {
  if (fsEl()) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  const req = pbox.requestFullscreen || pbox.webkitRequestFullscreen;
  if (req) Promise.resolve(req.call(pbox)).then(() => { if (isMob() && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
  else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone
}
$('#fsBtn').onclick = toggleFs;
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { tlKey = ''; wake(); }));
let idleT;
function wake() { pbox.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!video.paused) pbox.classList.add('idle'); }, 2400); }
pbox.addEventListener('pointermove', wake);
if (!document.pictureInPictureEnabled) $('#pipBtn').hidden = true;
$('#pipBtn').onclick = async () => { try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture(); } catch {} };

/* speed menu */
$('#speedMenu').innerHTML = SPEEDS.map(s => `<button data-s="${s}">${sp(s)}</button>`).join('');
$('#qSpeed').onclick = () => $('#speedMenu').classList.toggle('open');
$('#speedMenu').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setSpeed(+b.dataset.s); $('#speedMenu').classList.remove('open'); } });

/* ---------- timeline + anteprima ---------- */
const cv = $('#tl'), ctx = cv.getContext('2d'), seek = $('#seek'), tip = $('#tip'), pctx = $('#prev').getContext('2d');
let tlKey = '', hoverX = -1, dragging = false, thick = 5, knob = 5, colors = null;
const cssv = n => getComputedStyle(pbox).getPropertyValue(n).trim();
function drawTL() {
  const m = state.cur; if (!m || $('#viewer').hidden) return;
  const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  const hov = hoverX >= 0 || dragging, base = isMob() ? 6 : 5;
  thick += ((hov ? (dragging ? 10 : 8) : base) - thick) * .22; knob += ((hov ? (dragging ? 9 : 7) : base + 1) - knob) * .22;
  if (Math.abs(thick - (hov ? 8 : base)) < .02) thick = Math.round(thick * 50) / 50;
  let buf = 0; try { const b = video.buffered; for (let i = 0; i < b.length; i++) if (b.start(i) <= video.currentTime + .5) buf = Math.max(buf, b.end(i)); } catch {}
  if (inCut()) buf = toOrig(buf);
  const ct = curT();
  const key = [W, H, dpr, ct.toFixed(2), state.skip, state.skipCuts, (m.cuts || []).map(c => c.s + c.e).join(), (m.markers || []).map(x => x.t).join(), state.cutIn, m.id, m.analysis && m.analysis.count, hoverX, buf.toFixed(0), !!fsEl(), thick.toFixed(2), knob.toFixed(2), state.speed].join('|');
  if (key === tlKey || !W) return; tlKey = key;
  if (!colors) colors = { sil: cssv('--silence'), sp: cssv('--speech'), faint: cssv('--faint'), head: cssv('--head') };
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const d = durT() || 1, h = thick, y = (H - h) / 2, a = m.analysis, R = knob + 1;
  const px = Math.min(W, ct / d * W), X = x => R + x * (W - 2 * R) / W; // margine per il pallino
  const spans = (to) => { if (a) { let t = 0; for (const [s, e] of a.skips) { if (s > t) ctx.fillRect(X(t / d * W), y, (s - t) / d * (W - 2 * R), h); t = e; } if (t < d) ctx.fillRect(X(t / d * W), y, (d - t) / d * (W - 2 * R), h); } else ctx.fillRect(X(0), y, to / d * (W - 2 * R), h); };
  ctx.save(); ctx.beginPath(); ctx.roundRect(X(0), y, W - 2 * R, h, h / 2); ctx.clip();
  ctx.fillStyle = colors.sil; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = colors.sp; ctx.globalAlpha = .38; spans(buf);
  ctx.globalAlpha = 1; ctx.save(); ctx.beginPath(); ctx.rect(0, y, X(px), h); ctx.clip(); spans(ct); ctx.restore();
  for (const c of m.cuts || []) { ctx.fillStyle = state.skipCuts ? 'rgba(238,138,108,.75)' : 'rgba(238,138,108,.3)'; ctx.fillRect(X(c.s / d * W), y, Math.max(2, (c.e - c.s) / d * (W - 2 * R)), h); }
  ctx.restore();
  for (const x of m.markers || []) { ctx.fillStyle = x.color || '#7d93f2'; const mx = X(x.t / d * W); ctx.fillRect(mx - 1, y - 4, 2, h + 8); ctx.beginPath(); ctx.arc(mx, y - 5, 2.6, 0, 7); ctx.fill(); }
  if (state.cutIn != null) { ctx.fillStyle = '#ee8a6c'; ctx.fillRect(X(state.cutIn / d * W) - 1, y - 5, 2, h + 10); }
  if (hoverX >= 0 && !dragging) { ctx.fillStyle = colors.faint; ctx.fillRect(X(hoverX) - .5, y - 3, 1, h + 6); }
  ctx.fillStyle = colors.head; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.arc(X(px), H / 2, knob, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  const rem = state.speed !== 1 || (a && state.skip) ? `<span class="rem"> · ${fmt(remaining())} rimanenti</span>` : '';
  const tt = `<b>${fmt(ct)}</b> / ${fmt(d)}${rem}`;
  const te = $('#tTime'); if (te._h !== tt) { te._h = tt; te.innerHTML = tt; }
}
function remaining() {
  const d = durT(), t = curT(); let left = d - t;
  for (const [x, y] of removedRanges()) if (y > t) left -= Math.min(y, d) - Math.max(x, t);
  return Math.max(0, left) / state.speed;
}
const tAt = x => clamp(x / cv.clientWidth, 0, 1) * durT();
let pvBusy = false, pvWant = null;
function preview(t) {
  if (isAudio() || !pv.src || matchMedia('(hover:none)').matches) return;
  pvWant = t; if (pvBusy || pv.readyState < 1) return;
  pvBusy = true; pv.currentTime = t;
}
pv.addEventListener('seeked', () => {
  const c = $('#prev'); try { pctx.drawImage(pv, 0, 0, c.width, c.height); } catch {}
  pvBusy = false; if (pvWant !== null && Math.abs(pvWant - pv.currentTime) > .3) { const w = pvWant; pvWant = null; preview(w); }
});
function seekHover(e) {
  if (!state.cur) return;
  const r = seek.getBoundingClientRect(); hoverX = clamp(e.clientX - r.left, 0, r.width);
  const t = tAt(hoverX), half = isAudio() || matchMedia('(hover:none)').matches ? 40 : 90;
  tip.style.left = `${clamp(hoverX, half, r.width - half)}px`;
  const near = (state.cur.markers || []).find(x => Math.abs(x.t - t) / (durT() || 1) * r.width < 7);
  $('#tipT').innerHTML = `${fmt(t)}${near ? `<em>${esc(near.label || 'Segnaposto')}</em>` : findCut(t) ? '<em>taglio</em>' : findSkip(t) ? '<em>pausa</em>' : ''}`;
  seek.classList.add('hov');
  if (dragging) seekTo(t, true); else preview(t);
}
let wasPlaying = false;
seek.addEventListener('pointerdown', e => {
  if (!state.cur || e.button) return;
  dragging = true; seek.setPointerCapture(e.pointerId); wasPlaying = !video.paused;
  if (wasPlaying && e.pointerType !== 'mouse') video.pause();
  seekHover(e); e.preventDefault();
});
seek.addEventListener('pointermove', e => { if (dragging || e.pointerType === 'mouse') seekHover(e); });
const seekEnd = e => {
  if (!dragging) return; dragging = false;
  if (seekPend !== null) seekTo(seekPend);
  if (wasPlaying && video.paused) video.play().catch(() => {});
  if (e.pointerType !== 'mouse') { hoverX = -1; seek.classList.remove('hov'); }
};
seek.addEventListener('pointerup', seekEnd); seek.addEventListener('pointercancel', seekEnd);
seek.addEventListener('pointerleave', e => { if (!dragging && e.pointerType === 'mouse') { hoverX = -1; seek.classList.remove('hov'); } });
addEventListener('resize', () => { tlKey = ''; segInd(); });

/* ---------- speed ---------- */
function fillRange(r) { r.style.setProperty('--p', `${(r.value - r.min) / (r.max - r.min) * 100}%`); }
$('#chips').insertAdjacentHTML('beforeend', SPEEDS.slice(0, 6).map(s => `<button data-s="${s}">${sp(s)}</button>`).join(''));
$('#chips').addEventListener('click', e => { const c = e.target.closest('button'); if (c) setSpeed(+c.dataset.s); });
$('#speed').addEventListener('input', e => setSpeed(+e.target.value));
function segInd() {
  const on = $('#chips button.on'), ind = $('#segInd');
  if (!on || !on.offsetWidth) { ind.style.opacity = '0'; return; }
  ind.style.opacity = '1'; ind.style.width = `${on.offsetWidth}px`; ind.style.transform = `translateX(${on.offsetLeft}px)`;
}
function setSpeed(s, save = true) {
  s = clamp(Math.round(s * 100) / 100, .5, 3);
  const changed = s !== state.speed;
  state.speed = s; video.playbackRate = s;
  if (save && changed) saveSettings();
  const r = $('#speed'); r.value = s; fillRange(r);
  tween($('#speedVal'), s, v => `${num(v)}<small>×</small>`, 360);
  $('#qSpeed').textContent = sp(s); $('#qSpeed').classList.toggle('on', s !== 1);
  if (changed) bump($('#qSpeed'));
  if (!$('#exportBtn').classList.contains('busy')) swapText($('#exLabel'), exportLabel());
  document.querySelectorAll('#chips button,#speedMenu button').forEach(c => c.classList.toggle('on', +c.dataset.s === s));
  segInd(); renderStats(); tlKey = '';
}
video.addEventListener('loadedmetadata', () => { video.playbackRate = state.speed; video.preservesPitch = true; applyVol(); tlKey = ''; });

/* ---------- export / delete ---------- */
$('#exportBtn').onclick = async () => {
  const m = state.cur; if (!m) return; const remove = $('#exRemove').checked, cuts = $('#exCuts').checked && (m.cuts || []).length > 0;
  if (remove && !m.analysis) return toast('Analizza prima i silenzi', '', 'err');
  try { await post('api/export', { id: m.id, speed: state.speed, remove, cuts }); pollJobs(); }
  catch (err) { toast('Esportazione non riuscita', err.message, 'err'); }
};
$('#renBtn').onclick = () => state.cur && renameOne(state.cur.id, state.cur.title);
$('#vTitle').addEventListener('dblclick', () => $('#renBtn').click());
$('#delBtn').onclick = async () => {
  const m = state.cur; if (!confirm(`Eliminare "${m.title}" e le sue esportazioni?`)) return;
  await api(`api/video/${m.id}`, { method: 'DELETE' });
  await closeViewer(); libKey = ''; loadLib();
};
async function closeViewer() {
  if (!state.cur) return;
  state.cur = null; state.src = null; state.pend = null; video.pause();
  if (state.stream) { state.stream.destroy(); state.stream = null; }
  if (!reduce) await $('#viewer').animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)', filter: 'blur(6px)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished;
  $('#viewer').getAnimations().forEach(a => a.cancel());
  video.removeAttribute('src'); video.load(); pv.removeAttribute('src');
  $('#viewer').hidden = true; $('#empty').hidden = false; renderPanel(); window.BGFX && BGFX.mode('shapes');
}

/* ---------- pannello laterale: schede ---------- */
function setTab(n) {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === n));
  ['tr', 'mk', 'ct'].forEach(k => $('#pane' + k[0].toUpperCase() + k[1]).classList.toggle('on', k === n));
  const on = $('#tabs button.on'), ind = $('#tabInd');
  if (on && on.offsetWidth) { ind.style.width = on.offsetWidth + 'px'; ind.style.transform = `translateX(${on.offsetLeft}px)`; ind.style.opacity = 1; }
  try { localStorage.tab = n; } catch {}
  if (n === 'tr') { TR.cur = -1; TR.keyT = 0; }
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
const tabIn = () => { try { return localStorage.tab || 'tr'; } catch { return 'tr'; } };
const revealTab = n => { if (!sideOpen('r')) setSide('r', true); setTab(n); };

/* ---------- trascrizione: stile "testi di Spotify" ---------- */
const TR = { id: null, status: 'none', segs: [], lang: null, msg: '', cur: -1, timer: 0, follow: true, userT: 0, words: [], seq: 0, built: 0, keyT: 0 };
const loadKatex = () => window.katex ? Promise.resolve() : new Promise(r => { const t = setInterval(() => { if (window.katex) { clearInterval(t); r(); } }, 80); });
const FM = new Map();
function fm(x) {
  if (!window.katex) return esc('$' + x + '$');
  let h = FM.get(x);
  if (h === undefined) { try { h = katex.renderToString(x, { throwOnError: false, strict: 'ignore', output: 'html' }); } catch { h = esc(x); } FM.set(x, h); }
  return h;
}
function segHTML(g, chars) {
  return g.u.map(u => {
    if (u.k === 'm') return `<span class="fm" data-s="${u.s}" data-e="${u.e}">${fm(u.x)}</span>${u.p ? `<span class="pn">${esc(u.p)}</span>` : ''} `;
    return `<span class="w" data-s="${u.s}" data-e="${u.e}">${chars ? [...u.x].map(c => `<i>${esc(c)}</i>`).join('') : esc(u.x)}</span> `;
  }).join('');
}
const rowHTML = (g, i) => `<div class="tl" data-i="${i}"><span class="tl-ts">${fmt(g.s)}</span><div class="tl-t">${segHTML(g, false)}</div></div>`;
const segText = g => g.u.map(u => u.k === 'm' ? `$${u.x}$${u.p || ''}` : u.x).join(' ');
function trSwitch(id) {
  if (TR.id === id) return;
  clearTimeout(TR.timer); Object.assign(TR, { id, status: 'none', segs: [], lang: null, msg: '', cur: -1, words: [], built: 0, seq: TR.seq + 1 });
  $('#trList').innerHTML = ''; trHead(); trLoad(true);
}
async function trLoad(reset) {
  const id = TR.id, seq = TR.seq; if (!id) return; clearTimeout(TR.timer);
  try {
    const from = reset ? 0 : TR.segs.length;
    const d = await api(`api/transcript?id=${id}&from=${from}`); if (seq !== TR.seq) return;
    if (reset || d.total < TR.segs.length) { TR.segs = d.segments; TR.built = 0; TR.cur = -1; $('#trList').innerHTML = ''; } else TR.segs.push(...d.segments);
    Object.assign(TR, { status: d.status, lang: d.language, msg: d.msg || '' });
    if (TR.segs.length && !window.katex) loadKatex().then(() => { if (seq === TR.seq) { TR.built = 0; TR.cur = -1; $('#trList').innerHTML = ''; trBuild(); } });
    trBuild(); trHead();
    if (d.status === 'running' || d.status === 'queued') TR.timer = setTimeout(() => trLoad(false), 2500);
  } catch { TR.timer = setTimeout(() => trLoad(false), 5000); }
}
function trBuild() {
  const box = $('#trList'); if (TR.built >= TR.segs.length) return;
  box.insertAdjacentHTML('beforeend', TR.segs.slice(TR.built).map((g, k) => rowHTML(g, TR.built + k)).join('')); TR.built = TR.segs.length;
}
function trHead() {
  const st = $('#trSt'), n = TR.segs.length;
  const btn = (id, t) => `<button class="tr-act" id="${id}">${t}</button>`;
  let h;
  if (!state.whisper) h = '<span class="tr-msg">Trascrizione non installata sul server</span>';
  else if (TR.status === 'none') h = `<span class="tr-msg">Nessuna trascrizione</span>${btn('trGo', 'Trascrivi')}`;
  else if (TR.status === 'queued') h = '<span class="tr-msg"><span class="spin"></span>In coda…</span>';
  else if (TR.status === 'running') h = `<span class="tr-msg"><span class="spin"></span><span id="trPct">Trascrizione in corso</span></span>`;
  else if (TR.status === 'done') h = `<span class="tr-msg">${n} frasi · ${TR.lang === 'it' ? 'italiano' : TR.lang === 'en' ? 'inglese' : esc(TR.lang || '')}</span>${btn('trGo', 'Rifai')}`;
  else h = `<span class="tr-msg err">${TR.status === 'interrupted' ? 'Interrotta' : esc((TR.msg || 'Non riuscita').slice(0, 110))}</span>${btn('trGo', 'Riprova')}`;
  if (st._h !== h) { st._h = h; st.innerHTML = h; }
  $('#trExp').disabled = !n; $('#trFollow').classList.toggle('on', TR.follow);
  if (!n && TR.status !== 'running' && TR.status !== 'queued') $('#trList').innerHTML = TR.status === 'done' ? '<div class="lib-empty">Nessun parlato riconosciuto.</div>' : '';
}
function trProgress() {
  const j = state.jobs.find(x => x.kind === 'transcribe' && x.video === TR.id && !x.ended), bar = $('#trBar i');
  bar.style.transform = j ? `scaleX(${clamp(j.progress, 0, 1)})` : 'scaleX(0)'; $('#trBar').classList.toggle('on', !!j);
  const p = $('#trPct'); if (p && j) p.textContent = j.progress > 0 ? `Trascrizione ${Math.round(j.progress * 100)}%` : (j.message || 'Avvio…');
}
$('#trSt').addEventListener('click', async e => {
  if (!e.target.closest('#trGo') || !TR.id) return;
  if (TR.status === 'done' && !await dialog({ title: 'Rifare la trascrizione?', text: 'La versione attuale, comprese le tue correzioni, verrà sostituita.', ok: 'Rifai' })) return;
  try { await post('api/transcribe', { id: TR.id, force: true }); TR.status = 'queued'; TR.segs = []; TR.built = 0; $('#trList').innerHTML = ''; trHead(); pollJobs(); TR.timer = setTimeout(() => trLoad(true), 1500); }
  catch (err) { toast('Trascrizione non avviata', err.message, 'err'); }
});
$('#trFollow').onclick = () => { TR.follow = !TR.follow; TR.userT = 0; trHead(); if (TR.follow) { TR.cur = -1; } };
const trListEl = $('#trList');
['wheel', 'touchmove'].forEach(ev => trListEl.addEventListener(ev, () => { TR.userT = Date.now(); }, { passive: true }));
trListEl.addEventListener('click', e => {
  const row = e.target.closest('.tl'); if (!row) return; const g = TR.segs[+row.dataset.i]; if (!g) return;
  const w = e.target.closest('.w,.fm'); seekTo(clamp(w ? +w.dataset.s : g.s, 0, durT())); TR.userT = 0;
});
trListEl.addEventListener('dblclick', async e => {
  const row = e.target.closest('.tl'); if (!row || TR.status === 'running' || TR.status === 'queued') return; const i = +row.dataset.i, g = TR.segs[i]; if (!g) return;
  const v = await dialog({ title: 'Correggi la frase', text: 'Le formule vanno fra dollari, come $x^2+1$. Se svuoti il testo la frase viene tolta.', input: { value: segText(g), area: true }, ok: 'Salva' });
  if (v === null) return;
  try { await post('api/transcript/edit', { id: TR.id, seg: i, text: v }); trLoad(true); } catch (err) { toast('Modifica non riuscita', err.message, 'err'); }
});
// evidenziazione: la frase attuale si illumina lettera per lettera, le formule si rivelano da sinistra a destra
function trActivate(i) {
  const rows = trListEl.children, a = TR.cur;
  const lo = a < 0 ? 0 : Math.min(a, i), hi = a < 0 ? rows.length - 1 : Math.max(a, i);
  for (let k = Math.max(0, lo); k <= Math.min(rows.length - 1, hi); k++) { const r = rows[k]; r.classList.toggle('past', k < i); r.classList.remove('cur'); if (r._chars) { r._chars = false; r.querySelector('.tl-t').innerHTML = segHTML(TR.segs[k], false); } }
  TR.cur = i; const row = rows[i]; if (!row) { TR.words = []; return; }
  row.classList.add('cur'); row._chars = true; row.querySelector('.tl-t').innerHTML = segHTML(TR.segs[i], true);
  TR.words = [...row.querySelectorAll('.w,.fm')].map(el => ({ el, s: +el.dataset.s, e: +el.dataset.e, ch: el.classList.contains('w') ? [...el.children] : null, lit: -1 }));
  if (TR.follow && Date.now() - TR.userT > 3500) trListEl.scrollTo({ top: row.offsetTop - trListEl.clientHeight * .34, behavior: reduce || a < 0 ? 'auto' : 'smooth' });
}
function trTick() {
  if (!TR.segs.length || !state.cur || state.cur.id !== TR.id || !$('#paneTr').classList.contains('on') || !sideOpen('r')) return;
  const t = curT(), segs = TR.segs;
  let lo = 0, hi = segs.length - 1, i = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (segs[mid].s <= t + .05) { i = mid; lo = mid + 1; } else hi = mid - 1; }
  if (i < 0) { if (TR.cur >= 0) trActivate(-1); return; }
  if (i !== TR.cur || TR.keyT !== trListEl.children.length) { TR.keyT = trListEl.children.length; if (i < trListEl.children.length) trActivate(i); }
  for (const w of TR.words) {
    if (t >= w.e) { if (w.lit !== 2) { w.lit = 2; w.el.classList.add('on'); w.ch && w.ch.forEach(c => c.classList.add('on')); w.el.style.removeProperty('--p'); } }
    else if (t < w.s) { if (w.lit !== 0) { w.lit = 0; w.el.classList.remove('on'); w.ch && w.ch.forEach(c => c.classList.remove('on', 'now')); w.el.style.setProperty('--p', 0); } }
    else {
      w.lit = 1; const f = (t - w.s) / Math.max(.05, w.e - w.s);
      if (w.ch) { const n = w.ch.length, k = Math.min(n, Math.floor(f * n + .02)); if (w._k !== k) { w._k = k; w.ch.forEach((c, x) => { c.classList.toggle('on', x < k); c.classList.toggle('now', x === k); }); } }
      else { const q = Math.round(f * 50) / 50; if (w._q !== q) { w._q = q; w.el.style.setProperty('--p', q); } }
    }
  }
}
// esportazione: .txt e .tex dal server, PDF stampando una pagina con le formule composte da KaTeX
$('#trExp').onclick = e => { e.stopPropagation(); $('#trMenu').classList.toggle('open'); };
document.addEventListener('pointerdown', e => { if (!e.target.closest('#trMenu,#trExp')) $('#trMenu').classList.remove('open'); });
$('#trMenu').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !TR.id) return; $('#trMenu').classList.remove('open');
  if (b.dataset.fmt === 'pdf') return trPdf();
  const a = document.createElement('a'); a.href = `api/transcript/export?id=${TR.id}&fmt=${b.dataset.fmt}`; document.body.append(a); a.click(); a.remove();
});
async function trPdf() {
  const m = state.cur; if (!m || !TR.segs.length) return;
  const w = window.open('', '_blank'); if (!w) return toast('Il browser ha bloccato la finestra', 'Consenti i popup per questo sito e riprova', 'err');
  w.document.write('<p style="font:15px system-ui;padding:30px">Preparo il PDF…</p>');
  await loadKatex();
  const paras = []; let cur = [], last = null;
  for (const g of TR.segs) {
    if (last !== null && g.s - last > 2.5 && cur.length) { paras.push(cur.join(' ')); cur = []; }
    cur.push((cur.length ? '' : `<span class="ts">${fmt(g.s)}</span> `) + g.u.map(u => u.k === 'm' ? fm(u.x) + esc(u.p || '') : esc(u.x)).join(' ')); last = g.e;
  }
  if (cur.length) paras.push(cur.join(' '));
  const css = new URL('vendor/katex/katex.min.css', location.href).href;
  w.document.open();
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(m.title)} · trascrizione</title><link rel="stylesheet" href="${css}">
<style>@page{size:A4;margin:22mm 20mm}body{font:11.5pt/1.6 "Latin Modern Roman","Computer Modern",Georgia,"Times New Roman",serif;color:#111;max-width:170mm;margin:24px auto;padding:0 16px}
h1{font-size:19pt;margin:0 0 4pt}.sub{color:#777;font:9pt system-ui;margin-bottom:18pt}p{margin:0 0 9pt;text-align:justify;hyphens:auto}.ts{font:8pt system-ui;color:#888;margin-right:3px}.katex{font-size:1.04em}</style></head>
<body><h1>${esc(m.title)}</h1><div class="sub">Trascrizione · ${fmt(m.duration)}</div>${paras.map(p => `<p>${p}</p>`).join('')}
<script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),400))<\/script></body></html>`);
  w.document.close();
}

/* ---------- segnaposti ---------- */
async function addMarker(label) {
  const m = state.cur; if (!m) return;
  const n = (m.markers || []).length + 1;
  try {
    const r = await post('api/markers', { id: m.id, t: curT(), label: label ?? `Segnaposto ${n}` });
    m.markers = r.markers; renderMarkers(); tlKey = ''; flash('Segnaposto aggiunto'); revealTab('mk');
    const inp = document.querySelector(`#mkList [data-id="${r.marker.id}"] .mk-l`); if (inp && !isMob()) { inp.focus(); inp.select(); }
  } catch (err) { toast('Segnaposto non aggiunto', err.message, 'err'); }
}
function renderMarkers() {
  const m = state.cur, mk = (m && m.markers) || [];
  $('#mkN').textContent = mk.length || '';
  const box = $('#mkList'), key = JSON.stringify(mk); if (box._k === key) return; box._k = key;
  box.innerHTML = mk.length ? mk.map(x => `<div class="mk" data-id="${x.id}"><button class="mk-t" data-go="${x.t}">${fmt(x.t)}</button>
    <input class="mk-l" value="${esc(x.label)}" placeholder="Senza nome" maxlength="80"><button class="ib sm" data-del="${x.id}" title="Elimina">${ICON.x}</button></div>`).join('')
    : '<div class="lib-empty">Nessun segnaposto. Premi <kbd>B</kbd> mentre guardi, oppure il pulsante con la bandierina sotto il video.</div>';
}
$('#mkAdd').onclick = () => addMarker(); $('#mkBtn').onclick = () => addMarker();
$('#mkList').addEventListener('click', async e => {
  const g = e.target.closest('[data-go]'); if (g) return seekTo(+g.dataset.go);
  const d = e.target.closest('[data-del]'); if (!d || !state.cur) return;
  const r = await post('api/markers/delete', { id: state.cur.id, mid: d.dataset.del }); state.cur.markers = r.markers; renderMarkers(); tlKey = '';
});
$('#mkList').addEventListener('change', async e => {
  const i = e.target.closest('.mk-l'); if (!i || !state.cur) return; const id = i.closest('.mk').dataset.id;
  const r = await post('api/markers/update', { id: state.cur.id, mid: id, label: i.value }); state.cur.markers = r.markers; $('#mkList')._k = JSON.stringify(r.markers);
});
$('#mkList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.mk-l')) e.target.blur(); });

/* ---------- tagli (parti saltate come i silenzi, ma scelte a mano) ---------- */
const parseT = v => { const p = String(v).trim().replace(',', '.').split(':').map(Number); if (!p.length || p.some(isNaN)) return null; return p.reduce((a, x) => a * 60 + x, 0); };
function cutMark(w) {
  if (!state.cur) return; const t = curT();
  if (w === 'in') { state.cutIn = t; if (state.cutOut != null && state.cutOut <= t) state.cutOut = null; }
  else { state.cutOut = t; if (state.cutIn != null) return cutAdd(); }
  revealTab('ct'); renderCuts(); tlKey = '';
}
async function cutAdd() {
  const m = state.cur; if (!m || state.cutIn == null || state.cutOut == null) return;
  const s = Math.min(state.cutIn, state.cutOut), e = Math.max(state.cutIn, state.cutOut);
  try { const r = await post('api/cuts', { id: m.id, s, e }); m.cuts = r.cuts; state.cutIn = state.cutOut = null; if (!state.skipCuts) { state.skipCuts = true; saveSettings(); } revealTab('ct'); renderCuts(); renderStats(); tlKey = ''; flash(`Taglio di ${num(e - s, 1)} s aggiunto`); }
  catch (err) { toast('Taglio non aggiunto', err.message, 'err'); }
}
function renderCuts() {
  const m = state.cur, cs = (m && m.cuts) || [], tot = cs.reduce((a, c) => a + c.e - c.s, 0);
  $('#ctN').textContent = cs.length || '';
  $('#cutToggle').classList.toggle('on', !!cs.length && state.skipCuts); $('#cutToggle').setAttribute('aria-checked', !!cs.length && state.skipCuts);
  $('#qCuts').disabled = !cs.length; $('#qCuts').classList.toggle('on', !!cs.length && state.skipCuts);
  $('#cutSub').textContent = cs.length ? `${cs.length} ${cs.length === 1 ? 'taglio' : 'tagli'} · ${fmt(tot)} in meno` : 'Nessun taglio';
  $('#ctInT').textContent = state.cutIn != null ? fmt(state.cutIn) : '–'; $('#ctOutT').textContent = state.cutOut != null ? fmt(state.cutOut) : '–';
  $('#ctAdd').disabled = state.cutIn == null || state.cutOut == null || Math.abs(state.cutOut - state.cutIn) < .3;
  const box = $('#ctList'), key = JSON.stringify(cs); if (box._k !== key) { box._k = key;
    box.innerHTML = cs.length ? cs.map(c => `<div class="ct" data-id="${c.id}"><button class="mk-t ct-r" data-go="${c.s}" title="Doppio clic per cambiare i tempi">${fmt(c.s)} – ${fmt(c.e)}</button>
      <span class="ct-d">−${num(c.e - c.s, 1)} s</span><button class="ib sm" data-del="${c.id}" title="Elimina">${ICON.x}</button></div>`).join('')
      : '<div class="lib-empty">Nessun taglio. Premi <kbd>I</kbd> all\'inizio della parte da saltare e <kbd>O</kbd> alla fine.</div>'; }
}
function toggleCuts() { const m = state.cur; if (!m || !(m.cuts || []).length) return; state.skipCuts = !state.skipCuts; saveSettings(); renderCuts(); renderStats(); tlKey = ''; }
$('#cutRow').onclick = toggleCuts; $('#qCuts').onclick = toggleCuts;
$('#ctIn').onclick = () => cutMark('in'); $('#ctOut').onclick = () => { state.cutOut = curT(); renderCuts(); tlKey = ''; };
$('#ctAdd').onclick = cutAdd;
$('#ctList').addEventListener('click', async e => {
  const g = e.target.closest('[data-go]'); if (g) return seekTo(Math.max(0, +g.dataset.go - 2));
  const d = e.target.closest('[data-del]'); if (!d || !state.cur) return;
  const r = await post('api/cuts/delete', { id: state.cur.id, cid: d.dataset.del }); state.cur.cuts = r.cuts; renderCuts(); renderStats(); tlKey = '';
});
$('#ctList').addEventListener('dblclick', async e => {
  const b = e.target.closest('.ct-r'); if (!b || !state.cur) return; const c = state.cur.cuts.find(x => x.id === b.closest('.ct').dataset.id); if (!c) return;
  const v = await dialog({ title: 'Tempi del taglio', text: 'Inizio e fine, per esempio 1:30 - 2:05', input: { value: `${fmt(c.s)} - ${fmt(c.e)}` }, ok: 'Salva' }); if (!v) return;
  const [a, z] = v.split(/\s*[-–—]\s*/).map(parseT); if (a == null || z == null || z - a < .3) return toast('Tempi non validi', 'Scrivi inizio e fine come 1:30 - 2:05', 'err');
  const r = await post('api/cuts/update', { id: state.cur.id, cid: c.id, s: a, e: z }); state.cur.cuts = r.cuts; renderCuts(); renderStats(); tlKey = '';
});

/* ---------- impostazioni (pagina a parte, come su YouTube) ---------- */
function toggleSettings(on) {
  const el = $('#settings'); on = on ?? el.hidden; if (on === !el.hidden) return;
  if (on) { el.hidden = false; el.getAnimations().forEach(a => a.cancel()); if (!reduce) el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' }); segInd(); renderStats(); }
  else if (reduce) el.hidden = true; else el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 200, easing: 'ease-in' }).finished.then(() => { el.hidden = true; });
  $('#setBtn').classList.toggle('on', on);
}
$('#setBtn').onclick = () => toggleSettings(); $('#setBack').onclick = () => toggleSettings(false);
const fitSet = () => document.documentElement.style.setProperty('--hdh', document.querySelector('header').offsetHeight + 'px');
addEventListener('resize', fitSet); fitSet();
async function loadPrefs() {
  try { const p = await api('api/prefs'); $('#prefAuto').classList.toggle('on', !!p.autotranscribe); $('#prefAuto').setAttribute('aria-checked', !!p.autotranscribe); $('#prefLang').value = p.language; } catch {}
}
$('#prefAutoRow').onclick = async () => { const on = !$('#prefAuto').classList.contains('on'); $('#prefAuto').classList.toggle('on', on); $('#prefAuto').setAttribute('aria-checked', on); try { await post('api/prefs', { autotranscribe: on }); } catch {} };
$('#prefLang').onchange = e => post('api/prefs', { language: e.target.value }).catch(() => {});

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=range]),select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && !$('#settings').hidden) { toggleSettings(false); return; }
  if (k === 'escape' && isMob()) { setSide('l', false); setSide('r', false); return; }
  if (k === 'l') return setSide('l', !sideOpen('l'));
  if (k === 'p') return setSide('r', !sideOpen('r'));
  if (!state.cur) return;
  const map = { ' ': () => togglePlay(true), k: () => togglePlay(true), arrowright: () => seekBy(10), arrowleft: () => seekBy(-10), arrowup: () => volBy(.05), arrowdown: () => volBy(-.05),
    m: () => $('#muteBtn').click(), f: toggleFs, s: toggleSkip, t: toggleCuts, b: () => addMarker(), i: () => cutMark('in'), o: () => cutMark('out'), ']': () => setSpeed(state.speed + .25), '[': () => setSpeed(state.speed - .25) };
  if (map[k]) { e.preventDefault(); map[k](); }
});

/* ---------- tutorial guidato (discreto, saltabile, una volta sola) ---------- */
const TOURS = {
  intro: [
    { el: ['#dlForm'], t: 'Incolla un link o cerca', d: 'Metti qui il link della lezione (anche più di uno) e vedi subito l’anteprima, oppure scrivi il titolo per cercarla su YouTube.' },
    { el: ['#importBtn'], t: 'Hai già il file?', d: 'Caricalo da qui oppure trascinalo nella finestra.' },
    { el: ['#left .side-in', '#tglL'], t: 'La tua libreria', d: 'I video finiscono qui. Passa sopra a uno per l’anteprima, archiviarlo o eliminarlo.' },
    { el: ['#right .side-in', '#tglR'], t: 'Trascrizione', d: 'Qui scorre la trascrizione della lezione, insieme a segnaposti e tagli.' },
  ],
  video: [
    { el: ['#seek'], t: 'Le pause, in chiaro', d: 'Sulla barra vedi dove sono le pause. Passaci sopra per l’anteprima del fotogramma.' },
    { el: ['#qSkip'], t: 'Salta i silenzi', d: 'Attivalo e le pause vengono saltate mentre guardi. Tasto S.' },
    { el: ['#qSpeed'], t: 'Più veloce', d: 'Fino a 3× con la voce naturale. Tasti [ e ].' },
    { el: ['#tglR'], t: 'Trascrizione e segnaposti', d: 'La trascrizione scorre come i testi di Spotify, con le formule in LaTeX. Qui trovi anche segnaposti e tagli.' },
    { el: ['#setBtn'], t: 'Impostazioni', d: 'Tempo risparmiato, lingua della trascrizione, qualità ed esportazione in MP4.' },
  ],
};
const tour = { name: null, i: 0, raf: 0, queue: [] };
const seen = n => localStorage['tour_' + n] === '1';
function visibleEl(sels) {
  for (const s of sels) { const el = $(s); if (!el) continue;
    const r = el.getBoundingClientRect(), side = el.closest('#left,#right');
    if (side && !sideOpen(side.id === 'left' ? 'l' : 'r')) continue;
    if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && el.offsetParent !== null) return el; }
  return null;
}
function startTour(name) {
  if (seen(name)) return;
  if (tour.name) { if (tour.name !== name && !tour.queue.includes(name)) tour.queue.push(name); return; }
  tour.name = name; tour.i = -1;
  if (!$('#tourRing')) document.body.insertAdjacentHTML('beforeend', `<div class="tour-ring" id="tourRing"></div>
    <div class="tour" id="tour" role="dialog" aria-live="polite"><div class="tour-t"></div><div class="tour-d"></div>
    <div class="tour-f"><span class="tour-dots"></span><button class="tour-skip" id="tourSkip">Salta</button><button class="tour-next" id="tourNext">Avanti</button></div></div>`);
  $('#tourSkip').onclick = () => endTour(); $('#tourNext').onclick = () => stepTour(1);
  stepTour(1);
}
function stepTour(dir) {
  const steps = TOURS[tour.name];
  let i = tour.i + dir; while (i < steps.length && !visibleEl(steps[i].el)) i++;
  if (i >= steps.length) return endTour();
  tour.i = i; const st = steps[i], box = $('#tour');
  box.classList.remove('show'); void box.offsetWidth;
  box.querySelector('.tour-t').textContent = st.t; box.querySelector('.tour-d').textContent = st.d;
  box.querySelector('.tour-dots').innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  const last = !steps.slice(i + 1).some(s => visibleEl(s.el));
  $('#tourNext').textContent = last ? 'Fatto' : 'Avanti';
  tour.el = visibleEl(st.el); placeTour(true); box.classList.add('show'); $('#tourRing').classList.add('show');
  cancelAnimationFrame(tour.raf); const follow = () => { placeTour(); tour.raf = requestAnimationFrame(follow); }; tour.raf = requestAnimationFrame(follow);
}
function placeTour() {
  const el = tour.el; if (!el || !tour.name) return;
  const r = el.getBoundingClientRect(), ring = $('#tourRing'), box = $('#tour'), pad = 6, gap = 14;
  Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
  const bw = box.offsetWidth, bh = box.offsetHeight, W = innerWidth, H = innerHeight;
  let x, y;
  if (r.bottom + gap + bh < H - 8) { y = r.bottom + gap; x = r.left + r.width / 2 - bw / 2; }          // sotto
  else if (r.top - gap - bh > 8) { y = r.top - gap - bh; x = r.left + r.width / 2 - bw / 2; }          // sopra
  else if (r.right + gap + bw < W - 8) { x = r.right + gap; y = r.top + r.height / 2 - bh / 2; }       // a destra
  else { x = r.left - gap - bw; y = r.top + r.height / 2 - bh / 2; }                                   // a sinistra
  box.style.left = clamp(x, 8, W - bw - 8) + 'px'; box.style.top = clamp(y, 8, H - bh - 8) + 'px';
}
function endTour() {
  if (!tour.name) return;
  localStorage['tour_' + tour.name] = '1'; tour.name = null; cancelAnimationFrame(tour.raf);
  $('#tour').classList.remove('show'); $('#tourRing').classList.remove('show');
  const next = tour.queue.shift(); if (next) setTimeout(() => startTour(next), 500);
}
addEventListener('keydown', e => { if (tour.name && e.key === 'Escape') { e.stopPropagation(); endTour(); } }, true);
const maybeVideoTour = () => { if (state.cur && !app.classList.contains('pre')) setTimeout(() => startTour('video'), 700); };

/* ---------- boot ---------- */
if (location.pathname === '/' || location.pathname === '/index.html') $('#homeBtn').hidden = true; // in locale non c'è la home

(async () => {
  setSpeed(state.speed); syncAdv(); applyVol(); syncPlay(); fitMob();
  try { const st = await api('api/status');
    state.whisper = !!st.whisper;
    if (!st.ffmpeg || !st.ytdlp) $('#status').textContent = !st.ffmpeg ? 'ffmpeg mancante' : 'yt-dlp mancante'; } catch {}
  await firstPoll; loadPrefs(); setTab(tabIn());
  await loadLib();
  const first = state.lib.find(m => !m.archived);
  if (first) await open(first.id); else window.BGFX && BGFX.mode('shapes');
  pollJobs();
  // l'interfaccia entra solo quando lo sfondo ha finito: prima la barra in alto, poi le sidebar insieme con un rimbalzo
  await Promise.race([window.BGFX ? BGFX.shown : Promise.resolve(), sleep(2600)]);
  app.classList.remove('pre'); app.classList.add('intro');
  await sleep(reduce ? 0 : 420);
  initSides();
  setTimeout(() => app.classList.remove('intro', 'intro-sides'), 1300);
  setTimeout(() => { startTour('intro'); maybeVideoTour(); }, 1250);
  requestAnimationFrame(loop);
})();
