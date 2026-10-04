/* PatternWaves (vanilla, WebGL): onde di seta che scorrono e si deformano sotto il cursore.
   PatternWaves(canvas, { preset:'silk', color, backgroundColor, fade:'edges'|'none', interactive, cursorSize, cursorStrength, speed })
   Restituisce { stop() }. Senza WebGL resta lo sfondo CSS del contenitore. */
(() => {
  const PRESETS = {
    silk: { scale: 1.1, rot: -0.55, speed: 1, folds: 5, fine: 20, warp: 0.03, contrast: 1.7, shine: 0.3, grain: 0.05 },
    calm: { scale: 0.8, rot: -0.3, speed: 0.6, folds: 3.5, fine: 12, warp: 0.02, contrast: 2, shine: 0.2, grain: 0.04 },
  };
  const hex = h => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h) || [0, '06', 'b6', 'd4']; return [1, 2, 3].map(i => parseInt(m[i], 16) / 255); };
  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime, uDpr;
uniform vec3 uColor, uBg; uniform vec4 uMouse; // xy = cursore (px), z = intensità 0..1, w = velocità
uniform float uSize, uStrength, uFade;
uniform float uScale, uRot, uFolds, uFine, uWarp, uContrast, uShine, uGrain;
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float silk(vec2 tex, float t){
  tex.y += uWarp * sin(8.0 * tex.x - t);
  return 0.6 + 0.4 * sin(uFolds * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * t) + sin(uFine * (tex.x + tex.y - 0.1 * t)));
}
void main(){
  vec2 frag = gl_FragCoord.xy;
  // il cursore spinge la stoffa verso l'esterno, come un dito sotto la seta
  vec2 d = frag - uMouse.xy; float r = length(d), R = uSize * uDpr * 2.2;
  float k = exp(-(r * r) / (R * R)) * uMouse.z;
  frag -= d * k * uStrength * 0.7;
  vec2 uv = frag / uRes.y * uScale;
  float c = cos(uRot), s = sin(uRot);
  vec2 tex = mat2(c, -s, s, c) * uv;
  float t = uTime;
  float p = silk(tex, t);
  float l = pow(clamp(p, 0.0, 1.0), uContrast);
  vec3 col = mix(uBg, uColor, l);
  col += vec3(pow(clamp(p, 0.0, 1.0), 14.0) * uShine);           // riflesso
  col += uColor * k * uStrength * 0.08;                              // alone sotto il cursore
  col -= (rnd(gl_FragCoord.xy + fract(t)) - 0.5) * uGrain;          // grana leggera
  if (uFade > 0.5) {
    vec2 q = gl_FragCoord.xy / uRes;
    float e = smoothstep(0.0, 0.28, q.x) * smoothstep(0.0, 0.28, 1.0 - q.x) * smoothstep(0.0, 0.22, q.y) * smoothstep(0.0, 0.22, 1.0 - q.y);
    col = mix(uBg, col, e);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
  window.PatternWaves = function (canvas, o = {}) {
    const P = { ...PRESETS[o.preset] || PRESETS.silk };
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return { stop() {} };
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const u = Object.fromEntries('uRes uTime uDpr uColor uBg uMouse uSize uStrength uFade uScale uRot uFolds uFine uWarp uContrast uShine uGrain'.split(' ').map(n => [n, U(n)]));
    gl.uniform3fv(u.uColor, hex(o.color || '#06B6D4'));
    gl.uniform3fv(u.uBg, hex(o.backgroundColor || '#000000'));
    gl.uniform1f(u.uSize, o.cursorSize ?? 50);
    gl.uniform1f(u.uStrength, o.interactive === false ? 0 : o.cursorStrength ?? 0.6);
    gl.uniform1f(u.uFade, o.fade === 'none' ? 0 : 1);
    for (const k of ['scale', 'rot', 'folds', 'fine', 'warp', 'contrast', 'shine', 'grain']) gl.uniform1f(u['u' + k[0].toUpperCase() + k.slice(1)], P[k]);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dpr = 1, W = 0, H = 0, raf = 0, last = performance.now(), t = 7, visible = true, alive = true;
    const m = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, z: 0, tz: 0 };
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      const r = canvas.getBoundingClientRect(); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDpr, dpr);
    }
    function frame(now) {
      raf = 0; if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduce) t += dt * 0.5 * (o.speed ?? P.speed);
      const f = 1 - Math.exp(-dt * 9);                 // il cursore viene seguito con un po' di inerzia
      m.x += (m.tx - m.x) * f; m.y += (m.ty - m.y) * f; m.z += (m.tz - m.z) * (1 - Math.exp(-dt * 4));
      gl.uniform1f(u.uTime, t); gl.uniform4f(u.uMouse, m.x, m.y, m.z, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visible && (!reduce || Math.abs(m.tz - m.z) > 0.01 || Math.hypot(m.tx - m.x, m.ty - m.y) > 0.5)) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const move = e => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * dpr, y = (r.bottom - e.clientY) * dpr;
      if (m.z < 0.02) { m.x = x; m.y = y; }
      m.tx = x; m.ty = y; m.tz = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0; kick();
    };
    const leave = () => { m.tz = 0; kick(); };
    if (o.interactive !== false) { addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave); }
    const ro = new ResizeObserver(() => { size(); kick(); }); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }); io.observe(canvas);
    const vis = () => { visible = !document.hidden; kick(); }; document.addEventListener('visibilitychange', vis);
    size(); kick();
    return { stop() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', vis); } };
  };
})();
