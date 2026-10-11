/* Chill, la mascotte · <k-mascot intro pose="base" size="420"></k-mascot>
   - intro: salto con occhiolino una volta, poi il loop "vivo" (respira, guarda, sbatte le palpebre, saluta)
   - pose: senza animazione mostra una posa ferma (base, chill, occhiolino, curioso, ciao, felice)
   - toccandolo rifà l'occhiolino. Fuori dallo schermo si ferma.
   Video WebM con trasparenza; Safari (che non la supporta) usa il loop in WebP animato. "Riduci movimento": posa ferma. */
(() => {
  const B = '/brand/mascot/';
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ua = navigator.userAgent, safari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua) || /iP(hone|ad|od)/.test(ua);
  const CSS = `:host{display:inline-block;position:relative;width:var(--size,420px);aspect-ratio:1;contain:layout paint;-webkit-tap-highlight-color:transparent}
    img,video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;user-select:none}
    video{opacity:0}video.on{opacity:1}
    .poster{transition:opacity .2s}.poster.off{opacity:0}
    :host([interactive]){cursor:pointer}`;
  class M extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const r = this.attachShadow({ mode: 'open' }), pose = this.getAttribute('pose') || 'base';
      if (this.getAttribute('size')) this.style.setProperty('--size', this.getAttribute('size') + 'px');
      this.setAttribute('role', 'img'); if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Chill, la mascotte di StudyKit');
      const still = `<img class="poster" src="${B}${pose}.webp" alt="" decoding="async">`;
      const animated = !reduce && !this.hasAttribute('still');
      if (!animated) { r.innerHTML = `<style>${CSS}</style>${still}`; return; }
      if (safari) { r.innerHTML = `<style>${CSS}</style><img src="${B}chill-loop.webp" alt="" decoding="async">`; return; }
      const intro = this.hasAttribute('intro');
      r.innerHTML = `<style>${CSS}</style>${still}
        ${intro ? `<video class="in" muted playsinline preload="auto" src="${B}chill-intro.webm"></video>` : ''}
        <video class="lp" muted playsinline loop preload="auto" src="${B}chill-loop.webm"></video>`;
      const vi = r.querySelector('.in'), vl = r.querySelector('.lp'), poster = r.querySelector('.poster');
      let cur = vi || vl, seen = false;
      const show = v => { [vi, vl].forEach(x => x && x.classList.toggle('on', x === v)); poster.classList.add('off'); cur = v; };
      const play = v => v.play().then(() => show(v)).catch(() => {});
      if (vi) {
        vi.addEventListener('ended', () => { vl.currentTime = 0; play(vl); });
        // tocco: rifà il salto con l'occhiolino
        this.setAttribute('interactive', '');
        this.addEventListener('click', () => { if (cur === vi && !vi.ended && vi.currentTime > 0) return; vi.currentTime = 0; play(vi); vl.pause(); });
      }
      new IntersectionObserver(es => {
        const vis = es[0].isIntersecting;
        if (vis) { if (!seen) { seen = true; play(cur); } else cur.paused && play(cur); } else cur.pause();
      }, { threshold: .2 }).observe(this);
    }
  }
  if (!customElements.get('k-mascot')) customElements.define('k-mascot', M);
})();
