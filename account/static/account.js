/* pagina di accesso: Accedi / Crea account */
const $ = s => document.querySelector(s);
const next = (() => { const n = new URLSearchParams(location.search).get('next') || '/'; return n.startsWith('/') && !n.startsWith('//') ? n : '/'; })();
let mode = 'login', cfg = { signup: true, code: false, quota: 2 << 30 };
const gb = b => (b / (1 << 30)).toLocaleString('it-IT', { maximumFractionDigits: 1 });
function setMode(m) {
  mode = m; $('#seg').dataset.m = m;
  document.querySelectorAll('#seg button').forEach(b => { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const up = m === 'signup';
  $('#ttl').textContent = up ? 'Crea il tuo account' : 'Bentornato';
  $('#lead').textContent = up ? `Hai ${gb(cfg.quota)} GB tutti tuoi: i tuoi video e i tuoi file li vedi solo tu.` : 'Un solo account per tutti i tool, con il tuo spazio personale.';
  $('#goL').textContent = up ? 'Crea account' : 'Accedi';
  $('#pw').autocomplete = up ? 'new-password' : 'current-password';
  $('#codeF').hidden = !(up && cfg.code);
  $('#hint').hidden = !up; $('#hint').textContent = 'Nome: lettere minuscole, numeri, . _ - · Password: almeno 8 caratteri.';
  msg('');
}
function msg(t, field) {
  const el = $('#msg'); el.textContent = t; el.classList.remove('show'); if (t) { void el.offsetWidth; el.classList.add('show'); }
  document.querySelectorAll('input').forEach(i => i.classList.toggle('bad', i === field));
}
document.querySelectorAll('#seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));
$('#eye').onclick = () => { const p = $('#pw'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#eye').classList.toggle('on', show); $('#eye').setAttribute('aria-label', show ? 'Nascondi password' : 'Mostra password'); };
$('#name').addEventListener('input', e => { const v = e.target.value.toLowerCase().replace(/\s/g, ''); if (v !== e.target.value) e.target.value = v; });
$('#f').onsubmit = async e => {
  e.preventDefault();
  const name = $('#name').value.trim(), password = $('#pw').value, code = $('#code').value.trim();
  if (!name) return msg('Scrivi il nome utente', $('#name'));
  if (!password) return msg('Scrivi la password', $('#pw'));
  if (mode === 'signup' && password.length < 8) return msg('La password deve avere almeno 8 caratteri', $('#pw'));
  const btn = $('#go'); btn.classList.add('busy'); msg('');
  try {
    const r = await fetch(`/account/api/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password, code }) });
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
  cfg = c; if (!c.signup) { $('#seg').hidden = true; $('#foot').textContent = 'Le registrazioni sono chiuse: chiedi un account a chi gestisce il sito.'; }
  setMode(new URLSearchParams(location.search).get('m') === 'signup' && c.signup ? 'signup' : 'login');
}).catch(() => setMode('login'));
$('#name').focus();
