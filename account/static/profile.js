/* profilo: chi sei, quanto spazio usi (anche per tool), password e sessioni */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const size = b => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; b = Math.max(0, b || 0); while (b >= 1024 && i < 4) { b /= 1024; i++; }
  return `${b.toLocaleString('it-IT', { maximumFractionDigits: b < 10 && i ? 1 : 0 })} ${u[i]}`; };
const from = (() => { const f = new URLSearchParams(location.search).get('from') || ''; return f.startsWith('/') && !f.startsWith('//') && !f.startsWith('/account') ? f : ''; })();
const toLogin = () => location.replace('/account/login?next=' + encodeURIComponent(location.pathname + location.search));

function stagger() {
  [...document.querySelectorAll('.st')].forEach((el, i) => { el.style.setProperty('--i', i); el.classList.add('in'); });
}
async function load() {
  const [r, reg] = await Promise.all([fetch('/account/api/me'), fetch('/tools.json').then(x => x.ok ? x.json() : null).catch(() => null)]);
  if (r.status === 401) return toLogin();
  const me = await r.json(), tools = (reg && reg.tools) || [];
  // pulsante "Torna a ..." verso il tool da cui si arriva
  if (from) { const t = tools.find(x => from.startsWith(x.url)); $('#back').href = from; $('#backL').textContent = t ? `Torna a ${t.name}` : 'Torna indietro'; }
  $('#nm').textContent = me.name; $('#un').value = me.name; $('#ava').textContent = me.name[0].toUpperCase();
  $('#since').textContent = 'Account creato il ' + new Date(me.created * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const p = me.quota ? Math.min(1, me.used / me.quota) : 0;
  $('#used').textContent = size(me.used); $('#of').textContent = `di ${size(me.quota)}`;
  $('#free').textContent = p > .9 ? `Quasi pieno · ${size(Math.max(0, me.quota - me.used))} liberi` : `${size(Math.max(0, me.quota - me.used))} liberi`;
  $('#spc').classList.toggle('full', p > .9);
  requestAnimationFrame(() => requestAnimationFrame(() => $('#bar').style.transform = `scaleX(${p.toFixed(4)})`));
  const parts = Object.entries(me.tools || {}).filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]);
  $('#parts').innerHTML = parts.length ? parts.map(([id, b]) => {
    const t = tools.find(x => x.id === id), name = t ? t.name : id;
    const w = me.used ? b / me.used : 0;
    return `<li><span class="ic">${esc(name[0].toUpperCase())}</span><span class="nm"><b>${t ? `<a href="${esc(t.url)}">${esc(name)}</a>` : esc(name)}</b><span class="mini"><i style="--w:${w.toFixed(4)}"></i></span></span><span class="sz">${size(b)}</span></li>`;
  }).join('') : '<li><span class="ic">·</span><span class="nm"><b>Ancora nessun file</b></span><span class="sz">0 B</span></li>';
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.mini i').forEach(i => i.style.transform = `scaleX(${i.style.getPropertyValue('--w')})`)));
  const n = me.sessions || 1;
  $('#sesT').textContent = n > 1 ? `Sei connesso su ${n} dispositivi o browser.` : 'Sei connesso solo qui.';
  $('#outAll').hidden = n < 2;
}
const post = (p, b = {}) => fetch('/account/api/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
$('#out').onclick = async () => { await post('logout').catch(() => {}); location.replace('/'); };
$('#outAll').onclick = async () => { await post('logout-all').catch(() => {}); location.replace('/'); };
$('#pwf').onsubmit = async e => {
  e.preventDefault();
  const m = $('#pwMsg'), ok = $('#pwOk'), btn = $('#pwGo'); ok.hidden = true;
  const say = (t, f) => { m.textContent = t; m.classList.remove('show'); if (t) { void m.offsetWidth; m.classList.add('show'); } document.querySelectorAll('.pwf input').forEach(i => i.classList.toggle('bad', i === f)); };
  const old = $('#old').value, nw = $('#new').value;
  if (!old) return say('Scrivi la password attuale', $('#old'));
  if (nw.length < 8) return say('La nuova password deve avere almeno 8 caratteri', $('#new'));
  say(''); btn.classList.add('busy');
  try {
    const r = await post('password', { old, new: nw }); const j = await r.json().catch(() => ({}));
    if (r.status === 401) return toLogin();
    if (!r.ok) throw new Error(j.error || 'Non è stato possibile cambiarla');
    $('#old').value = $('#new').value = ''; ok.hidden = false; load();
  } catch (err) { say(err.message, /attuale/.test(err.message) ? $('#old') : $('#new')); }
  finally { btn.classList.remove('busy'); }
};
load().catch(() => { $('#sesT').textContent = 'Non riesco a leggere il profilo, ricarica la pagina.'; }).finally(stagger);
