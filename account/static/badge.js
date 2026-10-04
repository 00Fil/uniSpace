/* Badge account per i tool: <script src="/account/badge.js" defer></script>
   Mostra un pulsante con l'iniziale dell'utente; cliccandolo si vedono nome, spazio usato,
   "Profilo e spazio" (pagina /account/) ed "Esci".
   Dove metterlo: se nella pagina c'e' un elemento con l'attributo data-account il pulsante va li' dentro,
   altrimenti resta fisso in un angolo (data-pos sul tag script: "top-right" predefinito, "top-left",
   "bottom-right", "bottom-left"). Tutto dentro uno Shadow DOM: non tocca gli stili del tool. */
(() => {
  const me = document.currentScript, pos = (me && me.dataset.pos) || 'top-right';
  const size = b => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; b = Math.max(0, b || 0); while (b >= 1024 && i < 4) { b /= 1024; i++; }
    return `${b.toLocaleString('it-IT', { maximumFractionDigits: b < 10 && i ? 1 : 0 })} ${u[i]}`; };
  const CSS = `:host{all:initial;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;color:#ededee;z-index:2147483000}
  :host(.fixed){position:fixed;${pos.includes('bottom') ? 'bottom' : 'top'}:14px;${pos.includes('left') ? 'left' : 'right'}:14px}
  .w{position:relative}
  .b{all:unset;cursor:pointer;width:34px;height:34px;border-radius:11px;background:#141416;box-shadow:inset 0 0 0 1px #2a2a2e;display:grid;place-items:center;font-weight:650;font-size:13px;color:#ededee;transition:background .2s,transform .4s cubic-bezier(.25,1,.4,1)}
  .b:hover,.b[aria-expanded=true]{background:#ededee;color:#111113}.b:active{transform:scale(.92)}.b:focus-visible{outline:2px solid #ededee;outline-offset:2px}
  .m{position:absolute;${pos.includes('bottom') ? 'bottom' : 'top'}:42px;${pos.includes('left') ? 'left' : 'right'}:0;width:250px;background:#0d0d0f;border-radius:16px;padding:14px;
    box-shadow:0 0 0 1px #1f1f22,0 24px 60px -20px #000;transform-origin:${pos.includes('bottom') ? 'bottom' : 'top'} ${pos.includes('left') ? 'left' : 'right'};
    transition:opacity .2s,transform .4s cubic-bezier(.25,1,.4,1);opacity:0;transform:scale(.94);pointer-events:none}
  .m.open{opacity:1;transform:none;pointer-events:auto}
  .n{font-weight:650;font-size:14px}.s{display:flex;justify-content:space-between;color:#9a9aa0;font-size:12px;margin-top:12px;font-variant-numeric:tabular-nums}
  .bar{height:5px;border-radius:5px;background:#1c1c1f;margin-top:7px;overflow:hidden}.bar i{display:block;height:100%;background:#ededee;transform-origin:left;transition:transform .8s cubic-bezier(.16,1,.3,1)}
  .full .bar i{background:#e8877c}
  .a{display:flex;flex-direction:column;gap:4px;margin-top:12px;border-top:1px solid #1f1f22;padding-top:8px}
  .a a,.a button{all:unset;cursor:pointer;padding:8px 10px;border-radius:9px;color:#ededee;font-size:13px}.a a:hover,.a button:hover{background:#1c1c1f}`;
  async function init() {
    let u;
    try { const r = await fetch('/account/api/me', { credentials: 'same-origin' }); if (!r.ok) return; u = await r.json(); } catch { return; }
    const slot = document.querySelector('[data-account]'), host = document.createElement('div');
    if (!slot) host.className = 'fixed';
    const root = host.attachShadow({ mode: 'open' });
    const p = u.quota ? Math.min(1, u.used / u.quota) : 0;
    const prof = '/account/?from=' + encodeURIComponent(location.pathname);
    root.innerHTML = `<style>${CSS}</style><div class="w ${p > .9 ? 'full' : ''}"><button class="b" aria-haspopup="true" aria-expanded="false" title="${u.name}">${u.name[0].toUpperCase()}</button>
      <div class="m" role="menu"><div class="n"></div><div class="s"><span>Il tuo spazio</span><span>${size(u.used)} di ${size(u.quota)}</span></div>
      <div class="bar"><i style="transform:scaleX(${p.toFixed(4)})"></i></div>
      <div class="a"><a href="${prof}" role="menuitem">Profilo e spazio</a><button role="menuitem" class="o">Esci</button></div></div></div>`;
    root.querySelector('.n').textContent = u.name;
    const b = root.querySelector('.b'), m = root.querySelector('.m');
    const set = o => { m.classList.toggle('open', o); b.setAttribute('aria-expanded', o); };
    b.onclick = e => { e.stopPropagation(); set(!m.classList.contains('open')); };
    document.addEventListener('click', e => { if (!e.composedPath().includes(host)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    root.querySelector('.o').onclick = async () => { await fetch('/account/api/logout', { method: 'POST' }).catch(() => {}); location.href = '/'; };
    (slot || document.body).appendChild(host);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
