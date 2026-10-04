/* StudyCut — logica dell'interfaccia */
const $ = s => document.querySelector(s);
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const state = { lib: [], cur: null, speed: +localStorage.speed || 1, skip: localStorage.skip !== '0',
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

const api = async (path, opts = {}) => {
  const r = await fetch(path, opts); const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText); return j;
};
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
function initSides() {
  if (isMob()) { setSide('l', false, false); setSide('r', false, false); }
  else {
    setSide('l', localStorage.side_l ? localStorage.side_l === '1' : innerWidth >= 1100, false);
    setSide('r', localStorage.side_r ? localStorage.side_r === '1' : innerWidth >= 900, false);
  }
}
$('#tglL').onclick = () => setSide('l', !sideOpen('l'));
$('#tglR').onclick = () => setSide('r', !sideOpen('r'));
$('#actInd').onclick = () => setSide('l', true);
$('#scrim').onclick = () => { setSide('l', false); setSide('r', false); };
const fitMob = () => { $('#quality option[value=audio]').textContent = isMob() ? 'Audio' : 'Solo audio'; renderBulk(); syncPaste(); };
onMq(() => { initSides(); fitMob(); });
initSides();

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
  $('#hc').classList.toggle('open', n > 0 && bulkOpen);
  $('#bulkT').textContent = n === 1 ? '1 link pronto' : `${n} link pronti`;
  let k = 0;
  $('#bulkL').innerHTML = state.links.map((u, i) => { const s = shortUrl(u), nw = !shownLinks.has(u);
    return `<li class="${nw ? 'in' : ''}" style="--i:${nw ? k++ : 0}"><span class="u"><b>${esc(s.host)}</b>${esc(s.rest)}</span><button type="button" class="ib" data-i="${i}" title="Rimuovi">${ICON.x}</button></li>`; }).join('');
  shownLinks.clear(); state.links.forEach(u => shownLinks.add(u));
  swapText($('#dlLbl'), n > 1 ? `Scarica ${n}` : 'Scarica');
  $('#url').placeholder = n ? (isMob() ? 'Altri link…' : 'Aggiungi altri link…') : (isMob() ? 'Incolla i link' : 'Incolla uno o più link');
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
$('#url').addEventListener('focus', () => setBulk(true));
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
  if (e.key === 'Escape') { setBulk(false); e.target.blur(); }
});
function removeLink(i) {
  const li = $('#bulkL').children[i];
  const done = () => { state.links.splice(i, 1); renderBulk(); };
  if (!li || reduce) return done();
  li.classList.add('out'); setTimeout(done, 180);
}
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#hc')) setBulk(false);
  if (!e.target.closest('.menu-w')) $('#speedMenu').classList.remove('open');
});
$('#bulkL').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { removeLink(+b.dataset.i); $('#url').focus(); } });
$('#bulkClear').onclick = () => { state.links = []; renderBulk(); $('#url').focus(); };
$('#dlForm').addEventListener('submit', async e => {
  e.preventDefault();
  const urls = [...state.links, ...extract($('#url').value)];
  if (!urls.length) { if ($('#url').value.trim()) toast('Link non valido', 'Il link deve iniziare con http:// o https://', 'err'); return $('#url').focus(); }
  try {
    await post('api/download', { urls, quality: $('#quality').value });
    state.links = []; $('#url').value = ''; setBulk(false); $('#url').blur();
    if (isMob()) toast(urls.length > 1 ? `${urls.length} download avviati` : 'Download avviato', 'Tocca l\'indicatore in alto per seguirli');
    else if (!sideOpen('l')) setSide('l', true);
    pollJobs();
  } catch (err) { toast('Impossibile scaricare', err.message, 'err'); }
});
$('#quality').value = localStorage.quality || '720';
$('#quality').onchange = e => { localStorage.quality = e.target.value; };

/* ---------- jobs ---------- */
const KIND = { download: 'Download', analyze: 'Ricerca delle pause', export: 'Esportazione' };
async function pollJobs() {
  try { state.jobs = await api('api/jobs'); } catch { return; }
  for (const j of state.jobs) {
    if (j.status === 'running' || j.status === 'queued' || state.seen.has(j.id)) continue;
    state.seen.add(j.id);
    if (j.status === 'error') { toast(`${KIND[j.kind]} non riuscito`, `${j.title || j.url || ''}\n${j.message}`, 'err'); continue; }
    const r = j.result || {};
    if (j.kind === 'download') { await loadLib(); if (!state.cur) await open(r.video); analyze(r.video, true); }
    if (j.kind === 'analyze') { if (state.cur && state.cur.id === r.video) await open(r.video); else loadLib(); }
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
function renderJobs() {
  const now = Date.now() / 1000;
  const vis = state.jobs.filter(j => !j.ended || now - j.ended < (j.status === 'error' ? 12 : 3))
    .filter(j => j.kind !== 'analyze' || !j.ended).sort((a, b) => a.created - b.created);
  $('#actSec').classList.toggle('show', vis.length > 0);
  renderJobsHeader();
  const box = $('#acts'), keep = new Set();
  for (const j of vis) {
    keep.add(j.id);
    let w = jobEls.get(j.id);
    if (!w) {
      w = document.createElement('div'); w.className = 'job-w' + (reduce ? '' : ' in');
      w.innerHTML = `<div><div class="job"><div class="thumb"></div><div class="info"><div class="t"></div><div class="s"></div><div class="pb"><i></i></div></div></div></div>`;
      jobEls.set(j.id, w); box.append(w);
    }
    const el = w.querySelector('.job'), lib = state.lib.find(m => m.id === j.video);
    const th = j.thumb || (lib && lib.thumb ? `media/${lib.id}/${lib.thumb}` : '');
    const sub = j.status === 'queued' ? 'In coda' : j.status === 'done' ? 'Completato' : j.status === 'error' ? 'Non riuscito' : (j.message || '');
    const title = j.title || (j.url ? shortUrl(j.url).host + ' · ' + shortUrl(j.url).rest : KIND[j.kind]);
    el.className = `job ${j.status}`;
    const tb = el.querySelector('.thumb'), thKey = th + '|' + !!j.audio;
    if (tb._k !== thKey) { tb._k = thKey; tb.style.backgroundImage = th ? `url('${th}')` : ''; tb.innerHTML = (j.audio ? `<span class="badge">${ICON.audio}</span>` : '') + ICON.tick; }
    const t = el.querySelector('.t'), full = (j.kind !== 'download' ? KIND[j.kind] + ' · ' : '') + title;
    if (t.textContent !== full) { t.textContent = full; t.title = title; }
    el.querySelector('.s').textContent = sub;
    el.querySelector('.pb i').style.transform = j.status === 'queued' ? '' : `scaleX(${j.status === 'done' ? 1 : clamp(j.progress, 0, 1)})`;
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
  progBtn($('#analyzeBtn'), an, state.cur && state.cur.analysis ? 'Analizza di nuovo' : 'Analizza');
  if (an) $('#skipSub').textContent = `Analisi in corso · ${Math.round(an.progress * 100)}%`;
}
function progBtn(btn, job, idle) {
  const lbl = btn.querySelector('.lbl'), fill = btn.querySelector('.fill'), was = btn.classList.contains('busy');
  btn.classList.toggle('busy', !!job);
  fill.style.transform = `scaleX(${job ? clamp(job.progress, 0, 1) : 0})`;
  const text = job ? (job.status === 'queued' ? 'In coda…' : `${job.kind === 'export' ? 'Esportazione' : 'Analisi'} ${Math.round(job.progress * 100)}%`) : idle;
  if (was === !!job && job) { lbl._txt = text; lbl.textContent = text; } else swapText(lbl, text);
}

/* ---------- library ---------- */
const libSeen = new Set(); let libKey = '';
async function loadLib() {
  state.lib = await api('api/library');
  $('#libCount').textContent = state.lib.length || '';
  const el = $('#lib');
  const key = JSON.stringify(state.lib.map(m => [m.id, m.thumb, m.title, m.analysis && m.analysis.kept])) + (state.cur && state.cur.id);
  if (key === libKey) return; libKey = key;
  if (!state.lib.length) { el.innerHTML = '<div class="lib-empty">Ancora nessun video. Incolla dei link oppure trascina dei file nella finestra.</div>'; return; }
  let k = 0;
  el.innerHTML = state.lib.map(m => { const nw = !libSeen.has(m.id); libSeen.add(m.id);
    return `<div class="item ${state.cur && state.cur.id === m.id ? 'on' : ''} ${nw && !reduce ? 'in' : ''}" style="--i:${nw ? Math.min(k++, 10) : 0}" data-id="${m.id}">
    <div class="thumb" style="${m.thumb ? `background-image:url('media/${m.id}/${m.thumb}')` : ''}">${m.audio ? `<span class="badge">${ICON.audio}</span>` : ''}</div>
    <div style="min-width:0"><div class="t">${esc(m.title)}</div>
    <div class="s">${fmt(m.duration)}${m.analysis ? ` → ${fmt(m.analysis.kept)}` : ''} · ${ago(m.created)}</div></div></div>`; }).join('');
}
$('#lib').addEventListener('click', e => {
  const it = e.target.closest('.item'); if (!it) return;
  document.querySelectorAll('#lib .item.on').forEach(x => x.classList.remove('on')); it.classList.add('on');
  if (isMob()) setSide('l', false);
  open(it.dataset.id);
});

async function open(id) {
  if (!id) return;
  const m = await api(`api/video/${id}`);
  const same = state.cur && state.cur.id === id, first = !state.cur;
  state.cur = m;
  $('#empty').hidden = true; $('#viewer').hidden = false; window.BGFX && BGFX.mode('waves');
  if (!same) {
    const src = `media/${m.id}/${m.file}`;
    video.src = src; video.playbackRate = state.speed;
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
  $('#exTitle').textContent = m.audio ? 'Esporta audio' : 'Esporta MP4';
  if (m.analysis) { $('#noise').value = m.analysis.noise; $('#mind').value = m.analysis.min; $('#pad').value = m.analysis.pad; syncAdv(); }
  renderAnalysis(); renderExports(!same); loadLib(); renderJobs(); tlKey = '';
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
  const a = m.analysis, d = m.duration, eff = (a && state.skip ? a.kept : d) / state.speed;
  $('#stOrig').textContent = fmt(d);
  $('#stNoSil').textContent = a ? fmt(a.kept) : '–';
  tween($('#stEff'), eff, fmt);
  tween($('#stSaved'), d - eff, v => v > 1 ? `${fmt(v)} · ${Math.round(v / d * 100)}%` : '–');
}
const exportLabel = () => `Crea a ${sp(state.speed)}`;
const expSeen = new Set();
function renderExports(reset) {
  const m = state.cur, ex = (m && m.exports) || [];
  if (reset) { expSeen.clear(); ex.forEach(e => expSeen.add(e.file)); }
  $('#exports').innerHTML = ex.map(e => { const nw = !expSeen.has(e.file); expSeen.add(e.file);
    return `<div class="exp ${nw ? 'in' : ''}"><div class="n">${sp(e.speed)}${e.remove ? ' · senza silenzi' : ''}
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

/* ---------- import ---------- */
$('#importBtn').onclick = () => $('#fileInput').click();
$('#fileInput').onchange = e => { [...e.target.files].forEach(importFile); e.target.value = ''; };
function importFile(f) {
  const x = new XMLHttpRequest();
  x.open('POST', 'api/import'); x.setRequestHeader('X-Filename', encodeURIComponent(f.name));
  x.onload = async () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {}
    if (x.status === 200) { await loadLib(); if (!state.cur) await open(j.id); analyze(j.id, true); }
    else toast('Importazione non riuscita', `${f.name}\n${j.error || ''}`, 'err'); };
  x.onerror = () => toast('Importazione non riuscita', f.name, 'err');
  x.send(f);
}
let dragN = 0;
addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { dragN++; $('#drop').classList.add('show'); } });
addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; $('#drop').classList.remove('show'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragN = 0; $('#drop').classList.remove('show'); [...e.dataTransfer.files].forEach(importFile); });

/* ---------- silences ---------- */
async function analyze(id, quiet) {
  id = typeof id === 'string' ? id : state.cur && state.cur.id; if (!id) return;
  try { await post('api/analyze', { id, noise: +$('#noise').value, min: +$('#mind').value, pad: +$('#pad').value }); pollJobs(); }
  catch (err) { if (!quiet) toast('Analisi non riuscita', err.message, 'err'); }
}
$('#analyzeBtn').onclick = () => analyze();
function syncAdv() {
  $('#noiseO').textContent = `${$('#noise').value} dB`;
  $('#mindO').textContent = `${num(+$('#mind').value, 1)} s`;
  $('#padO').textContent = `${num(+$('#pad').value, 2)} s`;
  ['noise', 'mind', 'pad'].forEach(id => fillRange($('#' + id)));
}
['noise', 'mind', 'pad'].forEach(id => $('#' + id).addEventListener('input', syncAdv));
const toggleSkip = () => { if (!state.cur || !state.cur.analysis) return; state.skip = !state.skip; localStorage.skip = state.skip ? '1' : '0'; renderAnalysis(); tlKey = ''; };
$('#skipRow').onclick = () => {
  const m = state.cur; if (!m) return;
  if (m.analysis) return toggleSkip();
  const busy = state.jobs.some(j => j.kind === 'analyze' && j.video === m.id && !j.ended);
  if (busy) return toast('Analisi in corso', 'Il salto dei silenzi si attiva appena finisce');
  state.skip = true; localStorage.skip = '1'; analyze(); toast('Cerco i silenzi…', 'Si attivano da soli appena l\'analisi è pronta');
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
  if (state.skip && state.cur && !video.paused && !video.seeking) {
    const sk = findSkip(video.currentTime);
    if (sk && sk[1] - video.currentTime > 0.05) {
      video.currentTime = Math.min(sk[1], video.duration || sk[1]);
      if (performance.now() - lastFlash > 1500 && sk[1] - sk[0] > 2) { lastFlash = performance.now(); flash(`Saltati ${num(sk[1] - sk[0], 1)} s di pausa`); }
    }
  }
  drawTL(); requestAnimationFrame(loop);
}
function flash(t) { const f = $('#flash'); f.textContent = t; f.classList.add('show'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('show'), 1300); }

/* ---------- player ---------- */
function togglePlay(fx) {
  if (!state.cur) return;
  if (video.paused) { video.play().catch(() => {}); if (fx) { $('#pulse').innerHTML = PLAY; replay($('#pulse')); } }
  else video.pause();
}
const syncPlay = () => { $('#playBtn').classList.toggle('playing', !video.paused); vwrap.classList.toggle('paused', video.paused); };
['play', 'pause', 'ended', 'loadedmetadata', 'emptied'].forEach(ev => video.addEventListener(ev, syncPlay));
const seekBy = d => { video.currentTime = clamp(video.currentTime + d, 0, video.duration || 0); };
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
  const key = [W, H, dpr, video.currentTime.toFixed(2), state.skip, m.id, m.analysis && m.analysis.count, hoverX, buf.toFixed(0), !!fsEl(), thick.toFixed(2), knob.toFixed(2), state.speed].join('|');
  if (key === tlKey || !W) return; tlKey = key;
  if (!colors) colors = { sil: cssv('--silence'), sp: cssv('--speech'), faint: cssv('--faint'), head: cssv('--head') };
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const d = video.duration || m.duration || 1, h = thick, y = (H - h) / 2, a = m.analysis, R = knob + 1;
  const px = Math.min(W, video.currentTime / d * W), X = x => R + x * (W - 2 * R) / W; // margine per il pallino
  const spans = (to) => { if (a) { let t = 0; for (const [s, e] of a.skips) { if (s > t) ctx.fillRect(X(t / d * W), y, (s - t) / d * (W - 2 * R), h); t = e; } if (t < d) ctx.fillRect(X(t / d * W), y, (d - t) / d * (W - 2 * R), h); } else ctx.fillRect(X(0), y, to / d * (W - 2 * R), h); };
  ctx.save(); ctx.beginPath(); ctx.roundRect(X(0), y, W - 2 * R, h, h / 2); ctx.clip();
  ctx.fillStyle = colors.sil; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = colors.sp; ctx.globalAlpha = .38; spans(buf);
  ctx.globalAlpha = 1; ctx.beginPath(); ctx.rect(0, y, X(px), h); ctx.clip(); spans(video.currentTime);
  ctx.restore();
  if (hoverX >= 0 && !dragging) { ctx.fillStyle = colors.faint; ctx.fillRect(X(hoverX) - .5, y - 3, 1, h + 6); }
  ctx.fillStyle = colors.head; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.arc(X(px), H / 2, knob, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  const rem = state.speed !== 1 || (a && state.skip) ? `<span class="rem"> · ${fmt(remaining())} rimanenti</span>` : '';
  const tt = `<b>${fmt(video.currentTime)}</b> / ${fmt(d)}${rem}`;
  const te = $('#tTime'); if (te._h !== tt) { te._h = tt; te.innerHTML = tt; }
}
function remaining() {
  const m = state.cur, d = video.duration || m.duration, t = video.currentTime; let left = d - t;
  if (m.analysis && state.skip) for (const [s, e] of m.analysis.skips) if (e > t) left -= e - Math.max(s, t);
  return Math.max(0, left) / state.speed;
}
const tAt = x => clamp(x / cv.clientWidth, 0, 1) * (video.duration || state.cur.duration);
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
  $('#tipT').innerHTML = `${fmt(t)}${findSkip(t) ? '<em>pausa</em>' : ''}`;
  seek.classList.add('hov');
  if (dragging) video.currentTime = t; else preview(t);
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
function setSpeed(s) {
  s = clamp(Math.round(s * 100) / 100, .5, 3);
  const changed = s !== state.speed;
  state.speed = s; localStorage.speed = s; video.playbackRate = s;
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
  const m = state.cur; if (!m) return; const remove = $('#exRemove').checked;
  if (remove && !m.analysis) return toast('Analizza prima i silenzi', '', 'err');
  try { await post('api/export', { id: m.id, speed: state.speed, remove }); pollJobs(); }
  catch (err) { toast('Esportazione non riuscita', err.message, 'err'); }
};
$('#delBtn').onclick = async () => {
  const m = state.cur; if (!confirm(`Eliminare "${m.title}" e le sue esportazioni?`)) return;
  await api(`api/video/${m.id}`, { method: 'DELETE' });
  if (!reduce) await $('#viewer').animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)', filter: 'blur(6px)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished;
  $('#viewer').getAnimations().forEach(a => a.cancel());
  video.removeAttribute('src'); video.load(); pv.removeAttribute('src'); state.cur = null;
  $('#viewer').hidden = true; $('#empty').hidden = false; window.BGFX && BGFX.mode('shapes'); loadLib();
};

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=range]),select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && isMob()) { setSide('l', false); setSide('r', false); return; }
  if (k === 'l') return setSide('l', !sideOpen('l'));
  if (k === 'p') return setSide('r', !sideOpen('r'));
  if (!state.cur) return;
  const map = { ' ': () => togglePlay(true), k: () => togglePlay(true), arrowright: () => seekBy(10), arrowleft: () => seekBy(-10), arrowup: () => volBy(.05), arrowdown: () => volBy(-.05),
    m: () => $('#muteBtn').click(), f: toggleFs, s: toggleSkip, ']': () => setSpeed(state.speed + .25), '[': () => setSpeed(state.speed - .25) };
  if (map[k]) { e.preventDefault(); map[k](); }
});

/* ---------- boot ---------- */
(async () => {
  setSpeed(state.speed); syncAdv(); applyVol(); syncPlay(); fitMob();
  setTimeout(() => app.classList.remove('boot'), 1300);
  try { const st = await api('api/status');
    if (!st.ffmpeg || !st.ytdlp) $('#status').textContent = !st.ffmpeg ? 'ffmpeg mancante' : 'yt-dlp mancante'; } catch {}
  await firstPoll;
  await loadLib();
  if (state.lib[0]) await open(state.lib[0].id); else window.BGFX && BGFX.mode('shapes');
  pollJobs();
  requestAnimationFrame(loop);
})();
