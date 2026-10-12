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
  const CSS = `:host{all:initial;font:400 14.5px/1.45 "Inter Tight",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#16162e;z-index:2147483000}
  :host(.fixed){position:fixed;${pos.includes('bottom') ? 'bottom' : 'top'}:14px;${pos.includes('left') ? 'left' : 'right'}:14px}
  .w{position:relative}
  .b{all:unset;cursor:pointer;width:34px;height:34px;border-radius:999px;display:grid;place-items:center;font-weight:500;font-size:15px;color:#fff;background:linear-gradient(135deg,#76c6f7,#8b89f4);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 3px #fff,0 6px 16px -6px rgba(80,84,220,.6);transition:transform .2s}
  .b:hover,.b[aria-expanded=true]{transform:scale(1.05)}.b:focus-visible{outline:2px solid #8b89f4;outline-offset:4px}
  .m{position:absolute;${pos.includes('bottom') ? 'bottom' : 'top'}:44px;${pos.includes('left') ? 'left' : 'right'}:0;width:264px;border-radius:18px;padding:16px 8px 8px;background:#fff;
    box-shadow:0 0 0 1px #e5e6f0,0 1px 2px rgba(40,44,110,.05),0 20px 40px -18px rgba(60,66,160,.35);
    transition:opacity .15s,transform .2s cubic-bezier(.16,1,.3,1);opacity:0;transform:translateY(${pos.includes('bottom') ? 4 : -4}px);pointer-events:none}
  .m.open{opacity:1;transform:none;pointer-events:auto}
  .n{padding:0 8px;font-size:17px;font-weight:500;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .s{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding:0 8px;font-size:13.5px;color:#666983}
  .bar{height:4px;border-radius:4px;background:#f3f4f9;margin:8px 8px 0;overflow:hidden}
  .bar i{display:block;height:100%;background:linear-gradient(90deg,#76c6f7,#8b89f4);transform-origin:left;transition:transform .7s cubic-bezier(.16,1,.3,1)}
  .full .bar i{background:#d9475a}
  .a{display:flex;flex-direction:column;margin-top:14px;border-top:1px dashed #d6d8ea;padding-top:6px}
  .a a,.a button{all:unset;cursor:pointer;padding:9px 8px;border-radius:10px;font-size:14.5px;color:#16162e}
  .a a:hover,.a button:hover,.a a:focus-visible,.a button:focus-visible{background:#f3f4f9}`;
  async function init() {
    let u;
    try { const r = await fetch('/account/api/me', { credentials: 'same-origin' }); if (!r.ok) return; u = await r.json(); } catch { return; }
    // font del marchio (solo @font-face, non tocca gli stili del tool)
    if (!document.querySelector('link[href="/brand/fonts.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/brand/fonts.css">');
    const slot = document.querySelector('[data-account]'), host = document.createElement('div');
    if (!slot) host.className = 'fixed';
    const root = host.attachShadow({ mode: 'open' });
    const p = u.quota ? Math.min(1, u.used / u.quota) : 0;
    const prof = '/account/?from=' + encodeURIComponent(location.pathname);
    root.innerHTML = `<style>${CSS}</style><div class="w ${p > .9 ? 'full' : ''}"><button class="b" aria-haspopup="true" aria-expanded="false" title="${u.name}">${u.name[0].toUpperCase()}</button>
      <div class="m" role="menu"><div class="n"></div><div class="s"><span>Spazio usato</span><span>${size(u.used)} di ${size(u.quota)}</span></div>
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
