/* StudyKit · bande di vetro (lo sfondo degli inviti, in tempo reale)
   Bands(canvas, { palette:'petrolio', bias:0, speed:1, res:.5, interactive:true }) → { start, stop, set(palette) }
   Senza WebGL resta il colore CSS del contenitore. Con "riduci movimento" disegna un solo fotogramma. */
(() => {
  const P = { // sabbia, colore, scuro, accento (come negli inviti)
    petrolio: ['#C9BBAE', '#3F9C97', '#3B3633', '#C2574B'], cobalto: ['#CEC5BA', '#3D5BD8', '#22233A', '#E0755A'],
    ruggine: ['#D8C8B4', '#C25A34', '#382D29', '#2F6F8F'], salvia: ['#D2CCBA', '#7D8E46', '#2E3129', '#D07A4A'],
    prugna: ['#D6C7C4', '#8E4E8C', '#2D2532', '#E08A6B'], ocra: ['#DCCDB4', '#C99A2E', '#33302B', '#3E7C8C'],
    rosa: ['#DCC9C4', '#CF6A86', '#31292D', '#4E8C88'], ottanio: ['#C8C6BE', '#2E7390', '#23282D', '#D96A4E'],
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const FRAG = `precision highp float;
uniform vec2 uR; uniform float uT, uBias, uSeed; uniform vec3 uS, uP, uD, uA; uniform vec2 uM;
float h1(float n){ return fract(sin(n * 127.1 + uSeed) * 43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ return .62 * vn(p) + .28 * vn(p * 2.03 + 7.1) + .1 * vn(p * 4.1 + 3.3); }
vec3 field(vec2 px, float sh){
  float sc = max(uR.x, uR.y * 1.25);
  vec2 q = vec2(px.x, uR.y - px.y) / sc;
  vec2 dir = vec2(.6157, .788);                       // 52 gradi, come negli inviti
  float wb = .34, u = dot(q, dir) + sh - uT * .0035;
  float g = u / wb; g += .3 * sin(1.3 * g);
  float b = floor(g), f = fract(g);
  vec2 off = vec2(h1(b), h1(b + 19.7)) - .5;
  vec2 sp = q * 1.7 + off * .6 + vec2(uT * .006, -uT * .004) + uM * .025;
  float t = clamp((fbm(sp * 1.25) - .28) / .44, 0., 1.);
  float r = fbm(sp * 1.05 + 11.3);
  t += .22 * (f - .5);                                // piega del vetro
  float yy = px.y / uR.y;
  t = t * .6 + .8 * exp(-pow(yy / .2, 2.)) + .85 * exp(-pow((1. - yy) / .2, 2.)) + .03;
  t = clamp(mix(t, 1., uBias), 0., 1.); t = t * t * (3. - 2. * t);
  vec3 c1 = uS * .55 + uP * .45, c3 = uP * .35 + uD * .65, col;
  if (t < .32) col = mix(uS, c1, t / .32); else if (t < .55) col = mix(c1, uP, (t - .32) / .23);
  else if (t < .78) col = mix(uP, c3, (t - .55) / .23); else col = mix(c3, uD, (t - .78) / .22);
  float m = clamp((r - .6) / .16, 0., 1.) * (1. - clamp(t * 1.6 - .8, 0., 1.)) * .7;
  col = mix(col, uA, m);
  float fpx = f * wb * sc / (1. + .39 * cos(1.3 * g));
  col += .075 * exp(-pow(fpx / 1.6, 2.)) * (1. - t * .6);   // filo di luce sul bordo
  return col;
}
void main(){
  vec2 px = gl_FragCoord.xy;
  float ab = 2.2 / max(uR.x, uR.y * 1.25);           // aberrazione cromatica lungo la normale
  vec3 c = vec3(field(px, ab).r, field(px, 0.).g, field(px, -ab).b);
  c += (h2(px + fract(uT) * 91.7) - .5) * .045;
  gl_FragColor = vec4(c, 1.);
}`;
  window.Bands = function (canvas, o = {}) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return null;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const u = { R: U('uR'), T: U('uT'), B: U('uBias'), S: U('uS'), P: U('uP'), D: U('uD'), A: U('uA'), M: U('uM'), Z: U('uSeed') };
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const res = o.res || .5, speed = o.speed ?? 1;
    let raf = 0, t0 = performance.now(), mx = 0, my = 0, tx = 0, ty = 0;
    const set = name => { const c = (P[name] || P.petrolio).map(rgb); gl.uniform3fv(u.S, c[0]); gl.uniform3fv(u.P, c[1]); gl.uniform3fv(u.D, c[2]); gl.uniform3fv(u.A, c[3]); };
    set(o.palette); gl.uniform1f(u.B, o.bias || 0); gl.uniform1f(u.Z, o.seed ?? 3.0);
    const size = () => { const w = Math.max(1, Math.round(canvas.clientWidth * res * Math.min(2, devicePixelRatio || 1))),
      h = Math.max(1, Math.round(canvas.clientHeight * res * Math.min(2, devicePixelRatio || 1)));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); } gl.uniform2f(u.R, w, h); };
    const draw = () => { size(); mx += (tx - mx) * .04; my += (ty - my) * .04;
      gl.uniform1f(u.T, (performance.now() - t0) / 1000 * speed + 40); gl.uniform2f(u.M, mx, my); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    if (o.interactive !== false) addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
    addEventListener('resize', () => reduce && draw());
    canvas.classList.add('on');
    const api = { start() { if (reduce) return draw(); if (!raf) loop(); }, stop() { cancelAnimationFrame(raf); raf = 0; }, set(n) { set(n); if (!raf) draw(); }, draw };
    draw(); return api;
  };
  window.Bands.palettes = P;
})();
