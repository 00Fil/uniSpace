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
  const CSS = `:host{all:initial;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;color:#f3eee6;z-index:2147483000;
    --mono:"Space Mono",ui-monospace,Menlo,monospace;--disp:"Anton","Impact",sans-serif}
  :host(.fixed){position:fixed;${pos.includes('bottom') ? 'bottom' : 'top'}:14px;${pos.includes('left') ? 'left' : 'right'}:14px}
  .w{position:relative}
  .b{all:unset;cursor:pointer;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;font:400 17px/1 var(--disp);color:#fff;
    background:linear-gradient(150deg,#55b3ad,#3f9c97 55%,#2c7672);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 0 rgba(0,0,0,.18);
    transition:filter .2s,transform .45s cubic-bezier(.25,1,.4,1)}
  .b:hover,.b[aria-expanded=true]{filter:brightness(1.1)}.b:active{transform:scale(.92)}.b:focus-visible{outline:0;box-shadow:0 0 0 4px rgba(63,156,151,.4)}
  .m{position:absolute;${pos.includes('bottom') ? 'bottom' : 'top'}:46px;${pos.includes('left') ? 'left' : 'right'}:0;width:264px;border-radius:20px;padding:16px;
    background:linear-gradient(160deg,rgba(40,42,44,.82),rgba(18,19,22,.9));backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);
    box-shadow:inset 0 0 0 1px rgba(246,240,230,.12),inset 0 1px 0 rgba(255,255,255,.08),0 30px 60px -24px rgba(0,0,0,.8);
    transform-origin:${pos.includes('bottom') ? 'bottom' : 'top'} ${pos.includes('left') ? 'left' : 'right'};
    transition:opacity .2s,transform .45s cubic-bezier(.25,1,.4,1);opacity:0;transform:scale(.94) translateY(${pos.includes('bottom') ? 6 : -6}px);pointer-events:none}
  .m.open{opacity:1;transform:none;pointer-events:auto}
  .k{font:700 9.5px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#a9a49b}
  .n{font:400 24px/1 var(--disp);text-transform:uppercase;letter-spacing:.005em;margin-top:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    background:linear-gradient(100deg,#e9f1ee,#c9ded9 35%,#f1c6b4 75%,#f6f0e6);-webkit-background-clip:text;background-clip:text;color:transparent}
  .s{display:flex;justify-content:space-between;align-items:baseline;margin-top:16px}
  .s b{font:400 11px/1 var(--mono);color:#f3eee6;font-variant-numeric:tabular-nums}
  .bar{height:6px;border-radius:6px;background:rgba(246,240,230,.08);margin-top:8px;overflow:hidden}
  .bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3f9c97,#9fd2c8 70%,#f6f0e6);transform-origin:left;transition:transform .8s cubic-bezier(.16,1,.3,1)}
  .full .bar i{background:linear-gradient(90deg,#c2574b,#ee8a6c)}
  .a{display:flex;flex-direction:column;gap:2px;margin:14px -6px -6px;border-top:1px solid rgba(246,240,230,.09);padding-top:8px}
  .a a,.a button{all:unset;cursor:pointer;padding:10px;border-radius:11px;font:700 10.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:#f3eee6;transition:background .2s}
  .a .o{color:#ee8a6c}
  .a a:hover,.a button:hover,.a a:focus-visible,.a button:focus-visible{background:rgba(246,240,230,.08)}`;
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
      <div class="m" role="menu"><div class="k">Account</div><div class="n"></div><div class="s"><span class="k">Il tuo spazio</span><b>${size(u.used)} di ${size(u.quota)}</b></div>
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
