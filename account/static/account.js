/* pagina di accesso: Accedi / Crea account (si passa dall'uno all'altro con il link in fondo) */
const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const next = (() => { const n = qs.get('next') || '/'; return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/account/login') ? n : '/'; })();
let mode = 'login', cfg = { signup: true, code: false, quota: 2 << 30 };
const gb = b => b >= 1 << 30 ? `${(b / (1 << 30)).toLocaleString('it-IT', { maximumFractionDigits: 1 })} GB` : `${Math.round(b / (1 << 20))} MB`;

// ingresso a cascata (molla): ogni elemento .st visibile parte un attimo dopo il precedente
function stagger(from = 0) {
  let i = 0;
  document.querySelectorAll('.side .st').forEach(el => {
    if (el.hidden || el.offsetParent === null) return;
    if (i++ < from) return;
    el.style.setProperty('--i', i - from);
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  });
}
function setMode(m, anim) {
  mode = m; document.body.dataset.m = m;
  const up = m === 'signup';
  $('#ttl').textContent = up ? 'Crea il tuo account' : 'Bentornato';
  $('#lead').textContent = up ? `Hai ${gb(cfg.quota)} tutti tuoi: i tuoi video e i tuoi file li vedi solo tu.`
    : 'Entra per usare i tool: un solo account per tutti, con il tuo spazio personale.';
  $('#goL').textContent = up ? 'Crea account' : 'Accedi';
  $('#swT').textContent = up ? 'Hai già un account?' : 'Non hai un account?';
  $('#swB').textContent = up ? 'Accedi' : 'Crea account';
  $('#pw').autocomplete = up ? 'new-password' : 'current-password';
  $('#pw').placeholder = up ? 'Almeno 8 caratteri' : 'La tua password';
  $('#codeF').hidden = !(up && cfg.code);
  $('#hint').hidden = !up;
  document.title = (up ? 'Crea account' : 'Accedi') + ' · StudyKit';
  history.replaceState(null, '', location.pathname + '?' + new URLSearchParams({ ...(next !== '/' ? { next } : {}), ...(up ? { m: 'signup' } : {}) }));
  msg('');
  if (anim) stagger(1);
}
function msg(t, field) {
  const el = $('#msg'); el.textContent = t; el.classList.remove('show'); if (t) { void el.offsetWidth; el.classList.add('show'); }
  document.querySelectorAll('input').forEach(i => i.classList.toggle('bad', i === field));
}
$('#swB').onclick = () => { setMode(mode === 'login' ? 'signup' : 'login', true); $('#name').focus(); };
$('#eye').onclick = () => { const p = $('#pw'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#eye').classList.toggle('on', show); $('#eye').setAttribute('aria-label', show ? 'Nascondi password' : 'Mostra password'); };
$('#name').addEventListener('input', e => { const v = e.target.value.toLowerCase().replace(/\s/g, ''); if (v !== e.target.value) e.target.value = v; });
$('#f').onsubmit = async e => {
  e.preventDefault();
  const name = $('#name').value.trim(), password = $('#pw').value, code = $('#code').value.trim(), remember = $('#keep').checked;
  if (!name) return msg('Scrivi il nome utente', $('#name'));
  if (!password) return msg('Scrivi la password', $('#pw'));
  if (mode === 'signup' && password.length < 8) return msg('La password deve avere almeno 8 caratteri', $('#pw'));
  const btn = $('#go'); btn.classList.add('busy'); msg('');
  try {
    const r = await fetch(`/account/api/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password, code, remember }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Qualcosa non ha funzionato, riprova');
    btn.classList.remove('busy'); btn.classList.add('ok'); $('#goL').textContent = mode === 'signup' ? 'Account creato' : 'Fatto';
    setTimeout(() => location.replace(next), 350);
  } catch (err) {
    btn.classList.remove('busy');
    msg(err.message, /password/i.test(err.message) ? $('#pw') : /nome|utente/i.test(err.message) ? $('#name') : /codice/i.test(err.message) ? $('#code') : null);
  }
};
fetch('/account/api/config').then(r => r.json()).then(c => {
  cfg = c;
  if (!c.signup) $('#switch').innerHTML = '<span>Le registrazioni sono chiuse: chiedi un account a chi gestisce il sito.</span>';
  $('#capQ').textContent = `${gb(c.quota)} di spazio personale, uguali in ogni tool.`;
  setMode(qs.get('m') === 'signup' && c.signup ? 'signup' : 'login');
}).catch(() => setMode('login')).finally(() => { stagger(); $('#name').focus({ preventScroll: true }); });

// onde "silk" ciano a destra, che seguono il cursore
if (window.PatternWaves) PatternWaves($('#waves'), { preset: 'silk', color: '#06B6D4', backgroundColor: '#000000', fade: 'edges', interactive: true, cursorSize: 50, cursorStrength: 0.6 });
