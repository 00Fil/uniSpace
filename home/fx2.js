/* StudyKit FX 2 — MicroSlats, Topography, LightTunnel (WebGL2, senza dipendenze)
   FX.slats(canvas, opzioni) · FX.topo(canvas, opzioni) · FX.tunnel(canvas, opzioni) → { start, stop, relayout } */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const MOB = () => matchMedia('(max-width:760px)').matches;
  const VERT = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
  const hex = h => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h) || [0, 'ff', 'ff', 'ff']; return [1, 2, 3].map(i => parseInt(m[i], 16) / 255); };
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  function makeGL(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return gl;
  }
  function program(gl, frag) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'position'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = new Proxy({}, { get: (c, k) => c[k] ?? (c[k] = gl.getUniformLocation(p, k)) });
    return { p, u, use() { gl.useProgram(p); return u; } };
  }
  // ciclo comune: si ferma fuori schermo / scheda nascosta
  function loop(canvas, gl, draw, resizeFn, scale = 1) {
    let raf = 0, active = false, last = 0;
    const resize = () => { const k = Math.min(devicePixelRatio || 1, MOB() ? 1.5 : 2) * scale;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * k)); canvas.height = Math.max(1, Math.floor(canvas.clientHeight * k));
      resizeFn && resizeFn(); if (active) draw(0, performance.now()); };
    const tick = t => { raf = 0; if (!active || document.hidden) return; const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
      const more = draw(dt, t); if (!reduce.matches || more) raf = requestAnimationFrame(tick); };
    document.addEventListener('visibilitychange', () => { if (active && !raf) { last = 0; raf = requestAnimationFrame(tick); } });
    new ResizeObserver(resize).observe(canvas); resize();
    return { start() { if (active) return; active = true; last = 0; if (!raf) raf = requestAnimationFrame(tick); },
      stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = 0; }, relayout: resize, get active() { return active; } };
  }
  // puntatore relativo al canvas, con morbidezza
  function pointer(canvas) {
    const P = { x: -1e4, y: -1e4, u: .5, v: .5, inside: false, amt: 0 };
    addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); P.x = e.clientX - r.left; P.y = e.clientY - r.top;
      P.inside = P.x >= 0 && P.y >= 0 && P.x <= r.width && P.y <= r.height; if (P.inside) { P.u = P.x / r.width; P.v = 1 - P.y / r.height; } }, { passive: true });
    document.addEventListener('pointerleave', () => { P.inside = false; });
    return P;
  }

  /* ------------------------------------------------------------------ MicroSlats */
  const PRESETS = {
    swell: { scale: 1.5, speed: .6, direction: 250, chop: .55, stretch: 0, glint: .7, contrast: 1.25, perspective: .55, fog: .55 },
    tide: { scale: 1.3, speed: .5, direction: 262, chop: .2, stretch: .12, glint: .45, contrast: 1.1, perspective: .5, fog: .4 },
    storm: { scale: .55, speed: 1.6, direction: 236, chop: 1, stretch: .3, glint: 1.3, contrast: 1.8, perspective: .8, fog: .35 },
    signal: { scale: .85, speed: 1.2, direction: 180, chop: .6, stretch: .85, glint: .25, contrast: 1.2, perspective: 0, fog: 0 },
  };
  const FIELD = `#version 300 es
precision highp float;
uniform vec2 uSize; uniform vec4 uGrid; uniform vec2 uOrigin; uniform vec2 uSlat; uniform float uTime;
uniform float uScale, uDirection, uChop, uStretch, uGlint, uContrast, uPerspective, uFog, uIntro;
uniform vec2 uMouse; uniform float uInkAmt; uniform float uCursor;
out vec4 fragColor;
const float TURN[4]=float[4](0.0,-0.95,0.78,1.62); const float LEN[4]=float[4](2.6,1.7,1.12,0.76);
const float HGT[4]=float[4](1.0,0.75,0.5,0.3); const float SHIFT[4]=float[4](0.0,2.3,4.1,1.1);
void main(){
  vec2 cell=floor(gl_FragCoord.xy); float row=uGrid.y-1.0-cell.y;
  vec2 center=uOrigin+vec2(cell.x,row)*uGrid.zw+uSlat*0.5;
  float v=clamp(center.y/uSize.y,0.0,1.0);
  vec2 dm=(center-uMouse)/uCursor; float ink=exp(-dot(dm,dm))*uInkAmt;
  float horizon=mix(8.0,0.5,uPerspective); float depth=(1.0+horizon)/(v+horizon);
  vec2 world=vec2((center.x-uSize.x*0.5)/uSize.y*depth,(depth-1.0)*horizon*2.2); world/=max(uScale,0.05);
  float meander=0.55*sin(dot(world,vec2(0.23,0.41))*0.9+uTime*0.13)+0.3*sin(dot(world,vec2(-0.37,0.19))*1.4-uTime*0.09);
  float steep=uChop*0.45, h=0.0, tot=0.0;
  for(int i=0;i<4;i++){ float a=uDirection+TURN[i]; vec2 hd=vec2(cos(a),sin(a)); float k=6.2831853/LEN[i]; float om=sqrt(9.81*k)*0.35;
    float th=k*dot(world,hd)-om*uTime+SHIFT[i]+meander*(0.6+0.3*float(i)); h+=HGT[i]*(cos(th)+steep*cos(2.0*th)); tot+=HGT[i]*(1.0+steep); }
  float level=clamp(0.5+0.5*h/(tot*0.85),0.0,1.0); float crest=smoothstep(0.6,1.0,level); float glint=crest*crest*uGlint;
  float haze=mix(1.0,1.0-uFog,pow(1.0-v,1.4)); float light=(pow(level,uContrast)+glint*0.8)*haze;
  float glow=1.0-exp(-max(ink,0.0)*1.6); light=1.0-(1.0-clamp(light,0.0,1.0))*(1.0-glow);
  float front=uIntro*1.35; float reveal=1.0-smoothstep(front-0.35,front,v);
  float sweep=exp(-pow((v-front+0.22)/0.07,2.0))*(1.0-uIntro);
  light=(light+sweep*0.8)*reveal; light=max(light,0.045*reveal);
  float span=mix(1.0-uStretch,1.0,level)+glow*0.3; span=clamp(span,0.08,1.0)*mix(0.1,1.0,reveal);
  float tint=clamp(max(glint*1.4,glow*0.9)+sweep,0.0,1.0);
  fragColor=vec4(clamp(light,0.0,1.0),span,tint,0.5);
}`;
  const SLAT = `#version 300 es
precision highp float;
uniform sampler2D tField; uniform vec2 uSize; uniform float uDpr; uniform vec4 uGrid; uniform vec2 uOrigin; uniform vec2 uSlat; uniform float uRound;
uniform vec3 uColor; uniform vec3 uGlintColor; uniform vec4 uBackground;
out vec4 fragColor;
float pill(vec2 p,vec2 b,float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
void main(){
  vec2 p=vec2(gl_FragCoord.x,uSize.y*uDpr-gl_FragCoord.y)/uDpr; vec2 local=p-uOrigin; vec2 cell=floor(local/uGrid.zw);
  vec4 bg=vec4(uBackground.rgb*uBackground.a,uBackground.a); vec4 slat=vec4(0.0);
  if(cell.x>=0.0&&cell.y>=0.0&&cell.x<uGrid.x&&cell.y<uGrid.y){
    vec4 f=texelFetch(tField,ivec2(int(cell.x),int(uGrid.y-1.0-cell.y)),0);
    vec2 off=local-cell*uGrid.zw-uSlat*0.5; vec2 hs=vec2(uSlat.x*0.5,uSlat.y*0.5*f.g);
    float rad=uRound*min(hs.x,hs.y); float a=clamp(0.5-pill(off,hs,rad)*uDpr,0.0,1.0)*f.r;
    slat=vec4(mix(uColor,uGlintColor,f.b)*a,a);
  }
  fragColor=slat+bg*(1.0-slat.a);
}`;
  function MicroSlats(canvas, o) {
    const S = Object.assign({ preset: 'swell', color: '#A855F7', glintColor: '#ffffff', backgroundColor: '#000000', backgroundAlpha: 0, slatWidth: 10, slatHeight: 25, gap: 3,
      roundness: .75, interactive: true, cursorStrength: 1, cursorSize: 60, intro: true, introDuration: 1.5 }, o);
    Object.keys(PRESETS.swell).forEach(k => { if (S[k] === undefined) S[k] = (PRESETS[S.preset] || PRESETS.swell)[k]; });
    const gl = makeGL(canvas); if (!gl) return null;
    const fP = program(gl, FIELD), sP = program(gl, SLAT);
    const tex = gl.createTexture(), fb = gl.createFramebuffer(); let tw = 0, th = 0;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    const P = pointer(canvas); let time = 0, intro = S.intro ? 0 : 1, ink = 0, introT0 = performance.now();
    const draw = (dt, now) => {
      const W = Math.max(1, canvas.clientWidth), H = Math.max(1, canvas.clientHeight), dpr = canvas.width / W;
      if (!reduce.matches) time += dt * S.speed;
      intro = reduce.matches || !S.intro ? 1 : Math.min(1, (now - introT0) / 1000 / Math.max(.2, S.introDuration));
      const ie = intro < .5 ? 4 * intro ** 3 : 1 - Math.pow(-2 * intro + 2, 3) / 2;
      ink += ((S.interactive && P.inside ? S.cursorStrength : 0) - ink) * Math.min(1, dt * 4);
      const sw = clamp(S.slatWidth, 1, 64), sh = clamp(S.slatHeight, 2, 240), g = clamp(S.gap, 0, 64), px = sw + g, py = sh + g;
      const cols = Math.min(2048, Math.ceil((W + g) / px) + 1), rows = Math.min(2048, Math.ceil((H + g) / py) + 1);
      const ox = (W - (cols * px - g)) / 2, oy = (H - (rows * py - g)) / 2;
      if (cols !== tw || rows !== th) { tw = cols; th = rows; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); }
      let u = fP.use(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, cols, rows);
      gl.uniform2f(u.uSize, W, H); gl.uniform4f(u.uGrid, cols, rows, px, py); gl.uniform2f(u.uOrigin, ox, oy); gl.uniform2f(u.uSlat, sw, sh);
      gl.uniform1f(u.uTime, time); gl.uniform1f(u.uScale, S.scale); gl.uniform1f(u.uDirection, S.direction * Math.PI / 180); gl.uniform1f(u.uChop, clamp(S.chop, 0, 1.5));
      gl.uniform1f(u.uStretch, clamp(S.stretch, 0, .95)); gl.uniform1f(u.uGlint, S.glint); gl.uniform1f(u.uContrast, S.contrast); gl.uniform1f(u.uPerspective, S.perspective);
      gl.uniform1f(u.uFog, S.fog); gl.uniform1f(u.uIntro, ie); gl.uniform2f(u.uMouse, P.x, P.y); gl.uniform1f(u.uInkAmt, ink); gl.uniform1f(u.uCursor, S.cursorSize);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      u = sP.use(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u.tField, 0);
      gl.uniform2f(u.uSize, W, H); gl.uniform1f(u.uDpr, dpr); gl.uniform4f(u.uGrid, cols, rows, px, py); gl.uniform2f(u.uOrigin, ox, oy); gl.uniform2f(u.uSlat, sw, sh);
      gl.uniform1f(u.uRound, clamp(S.roundness, 0, 1)); gl.uniform3fv(u.uColor, hex(S.color)); gl.uniform3fv(u.uGlintColor, hex(S.glintColor));
      gl.uniform4f(u.uBackground, ...hex(S.backgroundColor), S.backgroundAlpha);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      return intro < 1;
    };
    const L = loop(canvas, gl, draw);
    const start = L.start; L.start = () => { if (!L.active && S.intro && !reduce.matches) { intro = 0; introT0 = performance.now(); } start(); };
    return L;
  }

  /* ------------------------------------------------------------------ Topography */
  const TOPO = `#version 300 es
precision highp float;
uniform vec2 iResolution; uniform float iTime; uniform float uMorphAmount, uBands, uThickness, uScale, uGlow, uContrast, uBrightness, uOpacity;
uniform vec3 uLow, uMid, uHigh; uniform vec2 uMouse; uniform float uMouseRadius, uMouseStrength, uMouseActive, uGrainIntensity;
uniform vec4 uCtrlA, uCtrlB, uCtrlC, uCtrlD;
out vec4 fragColor;
float bez(float t,vec4 c){ float w=6.2831853*t; return 0.5*(c.x*sin(w)+c.y*cos(w)+c.z*sin(2.0*w)+c.w*cos(2.0*w)); }
float field(vec2 uv){ vec2 a=vec2(bez(uv.x,uCtrlA),bez(uv.x,uCtrlB)); vec2 b=vec2(bez(uv.y,uCtrlC),bez(uv.y,uCtrlD)); return distance(a,b); }
vec3 elev(float e){ vec3 c=mix(uLow,uMid,smoothstep(0.0,0.5,e)); return mix(c,uHigh,smoothstep(0.5,1.0,e)); }
void main(){
  vec2 res=iResolution.xy; vec2 uv=gl_FragCoord.xy/res; vec2 suv=(uv-0.5)/max(uScale,0.001)+0.5;
  float fv=field(suv);
  vec2 d=uv-uMouse; d.x*=res.x/max(res.y,1.0); float r=max(uMouseRadius,0.001); fv+=exp(-dot(d,d)/(r*r))*uMouseStrength*uMouseActive;
  float f=fv*uBands; float fr=fract(f); float ld=min(fr,1.0-fr); float aa=fwidth(f)+0.0001;
  float mask=1.0-smoothstep(uThickness-aa,uThickness+aa,ld);
  float glow=(1.0-smoothstep(uThickness,uThickness+uGlow*0.5+aa,ld))*step(0.0001,uGlow);
  float e=clamp(fv/(uMorphAmount*2.5+0.001),0.0,1.0);
  float cov=pow(clamp(mask+glow*0.55,0.0,1.0),max(uContrast,0.001));
  vec3 col=clamp(elev(e)*uBrightness,0.0,1.0);
  float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+iTime)*43758.5453);
  float a=clamp(cov+(g-0.5)*uGrainIntensity,0.0,1.0)*uOpacity;
  fragColor=vec4(col*a,a);
}`;
  const CTRL = [[1, -2, 3, -4], [9, -8, 7, -6], [5, 2, 5, -5], [-1, -3, 8, 9]];
  function Topography(canvas, o) {
    const S = Object.assign({ lowColor: '#5227FF', midColor: '#FF9FFC', highColor: '#FFFFFF', speed: .35, morphAmount: 3, morphSpeed: .05, bands: 2, thickness: .01, scale: 1,
      glow: .5, contrast: 3, brightness: 1, opacity: 1, grainIntensity: .05, mouseRadius: .3, mouseStrength: .4, timeOffset: 0 }, o);
    const gl = makeGL(canvas); if (!gl) return null;
    const pr = program(gl, TOPO), u = pr.use();
    const f = (k, v) => gl.uniform1f(u[k], v);
    f('uMorphAmount', S.morphAmount); f('uBands', S.bands); f('uThickness', S.thickness); f('uScale', S.scale); f('uGlow', S.glow); f('uContrast', S.contrast);
    f('uBrightness', S.brightness); f('uOpacity', S.opacity); f('uGrainIntensity', S.grainIntensity); f('uMouseRadius', S.mouseRadius); f('uMouseStrength', S.mouseStrength);
    gl.uniform3fv(u.uLow, hex(S.lowColor)); gl.uniform3fv(u.uMid, hex(S.midColor)); gl.uniform3fv(u.uHigh, hex(S.highColor));
    const P = pointer(canvas), cm = [.5, .5]; let ma = 0, t = S.timeOffset;
    const draw = dt => {
      pr.use(); if (!reduce.matches) t += dt;
      ['uCtrlA', 'uCtrlB', 'uCtrlC', 'uCtrlD'].forEach((k, g) => gl.uniform4fv(u[k], CTRL[g].map(i => S.morphAmount * Math.sin(t * S.speed * Math.sin(i * S.morphSpeed) + i))));
      cm[0] += .05 * (P.u - cm[0]); cm[1] += .05 * (P.v - cm[1]); ma += .05 * ((P.inside ? 1 : 0) - ma);
      gl.uniform2f(u.uMouse, cm[0], cm[1]); f('uMouseActive', ma); f('iTime', t);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(u.iResolution, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    return loop(canvas, gl, draw);
  }

  /* ------------------------------------------------------------------ LightTunnel */
  const TUNNEL = `#version 300 es
precision highp float;
uniform vec2 iResolution; uniform float iTime; uniform float uSpeed, uFlowDir, uPulseSpeed, uPulseLength, uPulseBlend, uPulseWidth, uCableCount, uThickness, uRimWidth, uWaviness, uSway, uSize;
uniform vec2 uCenter, uMouseOffset; uniform float uGlow, uFadeNear, uFadeFar, uBrightness, uColorVariance, uOpacity, uTunnelOpacity, uGrainIntensity;
uniform vec3 uCableColor, uPulseColor, uTunnelColor;
out vec4 fragColor;
void main(){
  float size=uSize*2.0; float speedBase=uSpeed*4.0*uFlowDir; float wav=uWaviness*0.15; float rot=uSway*0.5;
  float baseThick=uThickness*0.35+0.05; float border=uRimWidth*0.15+0.01; float cc=floor(uCableCount);
  vec2 res=iResolution.xy; vec2 uv=(gl_FragCoord.xy-0.5*res)/min(res.y,res.x); uv-=(uCenter+uMouseOffset); uv/=(size+0.0001);
  float r=length(uv); float ang=atan(uv.y,uv.x); float depth=-log(r+0.0001);
  float swing=sin(iTime*(uSpeed*0.5+0.1))*rot; float wo=sin(depth*1.2+iTime*speedBase*0.25)*wav;
  float fa=fract((ang/6.2831853)+0.5+wo+swing); float id=floor(fa*cc); float gx=fract(fa*cc)-0.5;
  float rnd=fract(sin(id*12.9898)*43758.5453); float rs=(0.4+rnd*0.6)*speedBase*uPulseSpeed; float ct=baseThick*(0.6+rnd*0.4);
  vec3 col=uCableColor*(1.0+(rnd-0.5)*0.4*uColorVariance); col=mix(col,uPulseColor,rnd*0.25*uColorVariance);
  float scroll=depth+iTime*rs; float pf=fract(scroll); float dc=abs(gx);
  float wire=smoothstep(ct,ct-0.05,dc); float rim=smoothstep(border,0.0,abs(dc-ct));
  float pt=ct*uPulseWidth; float pm=smoothstep(pt,pt-0.05*uPulseWidth,dc);
  float pd=abs(pf-0.5); float core=uPulseLength*(1.0-uPulseBlend); float lo=min(core,uPulseLength-max(fwidth(scroll),1e-4));
  float pulse=1.0-smoothstep(lo,uPulseLength,pd);
  float aB=wire*uTunnelOpacity; float aP=clamp(pulse*pm,0.0,1.0);
  vec3 fc=uTunnelColor*aB+col*rim*1.3*uGlow+uPulseColor*pulse*3.0*pm;
  float fade=smoothstep(0.0,uFadeNear,r)*smoothstep(uFadeFar,uFadeFar-0.9,r);
  float inten=clamp(aB+rim+aP,0.0,1.0)*fade; float a=inten*uOpacity; vec3 o=fc*uBrightness*a;
  float gv=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+iTime)*43758.5453)-0.5)*uGrainIntensity;
  fragColor=vec4(clamp(o+gv,0.0,1.0),clamp(a+gv,0.0,1.0));
}`;
  function LightTunnel(canvas, o) {
    const S = Object.assign({ cableColor: '#A855F7', pulseColor: '#A855F7', tunnelColor: '#5227FF', tunnelOpacity: 0, speed: .1, flowDirection: 'outward', pulseSpeed: 2,
      pulseLength: .28, pulseBlend: 1, pulseWidth: 1, cableCount: 20, thickness: .35, rimWidth: .15, waviness: .3, sway: .5, size: 1, centerX: 0, centerY: 0,
      glow: 1, fadeNear: .5, fadeFar: 2, brightness: 1, colorVariance: true, grainIntensity: .05, opacity: 1, mouseStrength: .1, center: null }, o);
    const gl = makeGL(canvas); if (!gl) return null;
    const pr = program(gl, TUNNEL), u = pr.use(); const f = (k, v) => gl.uniform1f(u[k], v);
    f('uSpeed', S.speed); f('uFlowDir', S.flowDirection === 'outward' ? -1 : 1); f('uPulseSpeed', S.pulseSpeed); f('uPulseLength', S.pulseLength); f('uPulseBlend', S.pulseBlend);
    f('uPulseWidth', S.pulseWidth); f('uCableCount', S.cableCount); f('uThickness', S.thickness); f('uRimWidth', S.rimWidth); f('uWaviness', S.waviness); f('uSway', S.sway);
    f('uSize', S.size); f('uGlow', S.glow); f('uFadeNear', S.fadeNear); f('uFadeFar', S.fadeFar); f('uBrightness', S.brightness); f('uColorVariance', S.colorVariance ? 1 : 0);
    f('uOpacity', S.opacity); f('uTunnelOpacity', S.tunnelOpacity); f('uGrainIntensity', S.grainIntensity);
    gl.uniform3fv(u.uCableColor, hex(S.cableColor)); gl.uniform3fv(u.uPulseColor, hex(S.pulseColor)); gl.uniform3fv(u.uTunnelColor, hex(S.tunnelColor));
    const P = pointer(canvas), cm = [.5, .5]; let t = 0;
    const draw = dt => {
      pr.use(); if (!reduce.matches) t += dt; f('iTime', t);
      const tx = P.inside ? P.u : .5, ty = P.inside ? P.v : .5; cm[0] += .05 * (tx - cm[0]); cm[1] += .05 * (ty - cm[1]);
      gl.uniform2f(u.uMouseOffset, (cm[0] - .5) * S.mouseStrength, (cm[1] - .5) * S.mouseStrength);
      const c = S.center ? S.center(canvas.clientWidth, canvas.clientHeight) : [S.centerX, S.centerY]; gl.uniform2f(u.uCenter, c[0], c[1]);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(u.iResolution, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    return loop(canvas, gl, draw);
  }

  const safe = (name, fn) => (c, o) => { try { return fn(c, o); } catch (e) { console.warn(name, e); return null; } };
  Object.assign(window.FX = window.FX || {}, { slats: safe('MicroSlats', MicroSlats), topo: safe('Topography', Topography), tunnel: safe('LightTunnel', LightTunnel) });
})();
