/* StudyKit FX — ShapeWaves + GradientWaves (WebGL2) per canvas singoli: window.FX.shapes(canvas, preset) / FX.waves(canvas, preset)
   - shapes: griglia di forme con noise, ripple al passaggio del mouse e testo in negativo (schermata vuota)
   - waves:  onde sfumate blu, discrete, dietro il player */
(() => {
  const MOB = () => matchMedia('(max-width:760px)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const VERT = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
  const hex = h => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h) || [0, 'ff', 'ff', 'ff'];
    return [1, 2, 3].map(i => parseInt(m[i], 16) / 255); };

  function makeGL(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return gl;
  }
  function program(gl, frag) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'position'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = new Proxy({}, { get: (c, k) => c[k] ?? (c[k] = gl.getUniformLocation(p, k)) });
    return u;
  }

  /* ------------------------------------------------------------------ Shape waves */
  const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fadeC(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0=floor(P), Pi1=Pi0+vec3(1.0); Pi0=mod289(Pi0); Pi1=mod289(Pi1);
  vec3 Pf0=fract(P), Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x), iy=vec4(Pi0.yy,Pi1.yy), iz0=Pi0.zzzz, iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy), ixy0=permute(ixy+iz0), ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0*(1.0/7.0); vec4 gy0=fract(floor(gx0)*(1.0/7.0))-0.5; gx0=fract(gx0);
  vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0); vec4 sz0=step(gz0,vec4(0.0));
  gx0-=sz0*(step(vec4(0.0),gx0)-0.5); gy0-=sz0*(step(vec4(0.0),gy0)-0.5);
  vec4 gx1=ixy1*(1.0/7.0); vec4 gy1=fract(floor(gx1)*(1.0/7.0))-0.5; gx1=fract(gx1);
  vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1); vec4 sz1=step(gz1,vec4(0.0));
  gx1-=sz1*(step(vec4(0.0),gx1)-0.5); gy1-=sz1*(step(vec4(0.0),gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x), g100=vec3(gx0.y,gy0.y,gz0.y), g010=vec3(gx0.z,gy0.z,gz0.z), g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x), g101=vec3(gx1.y,gy1.y,gz1.y), g011=vec3(gx1.z,gy1.z,gz1.z), g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 n0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=n0.x; g010*=n0.y; g100*=n0.z; g110*=n0.w;
  vec4 n1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=n1.x; g011*=n1.y; g101*=n1.z; g111*=n1.w;
  float n000=dot(g000,Pf0), n100=dot(g100,vec3(Pf1.x,Pf0.yz)), n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)), n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z)), n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z)), n011=dot(g011,vec3(Pf0.x,Pf1.yz)), n111=dot(g111,Pf1);
  vec3 f=fadeC(Pf0);
  vec4 nz=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),f.z);
  vec2 ny=mix(nz.xy,nz.zw,f.y);
  return 2.2*mix(ny.x,ny.y,f.x);
}
float fbm(vec3 p){ return (cnoise(p) + 0.5*cnoise(p*2.0)) / 1.5; }`;
  const INTRO_BAND = 0.2, INTRO_WARP = 0.3, INTRO_JITTER = 0.16, INTRO_END = 1 + INTRO_WARP + INTRO_JITTER + INTRO_BAND;
  const SHAPES_FRAG = `#version 300 es
precision highp float;
uniform vec4 uRes, uPlacement, uGrid, uField, uMotion;
uniform vec3 uColor, uHover, uBg;
uniform sampler2D uMask, uCharges;
out vec4 o;
const vec2 SEED = vec2(12.9898, 78.233);
${NOISE}
float sdTri(vec2 point, vec2 q){
  vec2 p=vec2(abs(point.x),point.y);
  vec2 a=p-q*clamp(dot(p,q)/dot(q,q),0.0,1.0);
  vec2 b=p-q*vec2(clamp(p.x/q.x,0.0,1.0),1.0);
  float s=-sign(q.y);
  vec2 d=min(vec2(dot(a,a),s*(p.x*q.y-p.y*q.x)),vec2(dot(b,b),s*(p.y-q.y)));
  return -sqrt(d.x)*sign(d.y);
}
float shapeDist(vec2 p,int shape,float c){
  if(shape==0) return max(abs(p.x),abs(p.y))-c;
  if(shape==1) return length(p)-c;
  return sdTri(vec2(p.x,p.y+c),vec2(c,2.0*c));
}
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 res=uRes.xy;
  vec2 pixel=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);
  vec2 uv=pixel/res;
  float cellPx=uGrid.x, dotSize=uGrid.y; int mode=int(uGrid.z+0.5), cols=int(uGrid.w+0.5);
  vec2 origin=uPlacement.xy; int rows=int(uPlacement.z+0.5);
  vec2 cell=floor((pixel-origin)/cellPx);
  if(cell.y<0.0||int(cell.y)>=rows||cell.x<0.0||int(cell.x)>=cols){ o=vec4(uBg,1.0); return; }
  vec2 center=origin+(cell+0.5)*cellPx;
  vec2 local=(pixel-center)/(cellPx*0.5);
  vec2 cellUv=center/res;
  if(uMotion.z>0.5 && texture(uMask,cellUv).r>0.5){ o=vec4(uBg,1.0); return; }
  float level=1.0, fade=uMotion.w;
  if(fade>0.0){ vec2 q=abs(uv*2.0-1.0);
    float radius=pow(pow(q.x,2.5)+pow(q.y,2.5),1.0/2.5)/pow(2.0,1.0/2.5);
    level=1.0-smoothstep(max(0.0,1.0-fade*2.2),1.0,radius); }
  float n=fbm(vec3((center+uMotion.xy)/uField.x+SEED,uField.w));
  float tone=clamp((n*0.5+0.5-uField.y)*uField.z+0.5,0.0,1.0);
  int band=int(min(tone,0.999999)*3.0);
  float charge=texelFetch(uCharges,ivec2(cell),0).r;
  int stepped=(band+int(clamp(charge,0.0,0.999)*3.0))%3;
  int shape=2-stepped; float size=dotSize;
  if(mode!=0){ shape=mode-1; size=dotSize*mix(0.45,1.0,float(stepped)/2.0); }
  float intro=uPlacement.w, front=0.0;
  if(intro<${INTRO_END.toFixed(2)}){
    float radial=length((center-res*0.5)/(res*0.5))*0.70710678;
    float warp=cnoise(vec3(cellUv*vec2(3.2,2.4)+SEED,4.7))*${INTRO_WARP.toFixed(2)};
    float jitter=hash21(cell)*${INTRO_JITTER.toFixed(2)};
    float spread=radial+warp+jitter+${INTRO_WARP.toFixed(2)};
    float bnd=${INTRO_BAND.toFixed(2)}*(0.6+0.8*hash21(cell+vec2(17.0,9.0)));
    float t=clamp((intro-spread)/bnd,0.0,1.0);
    if(t<=0.0){ o=vec4(uBg,1.0); return; }
    float back=t-1.0;
    size=max(size*(1.0+2.70158*back*back*back+1.70158*back*back),0.02);
    front=1.0-smoothstep(0.0,1.0,abs(intro-spread)/bnd);
  }
  float aa=2.0/cellPx;
  float cov=smoothstep(aa,-aa,shapeDist(local,shape,size));
  vec3 tint=mix(uColor,uHover,max(smoothstep(0.15,0.85,charge),front*0.35));
  o=vec4(mix(uBg,tint,cov*level),1.0);
}`;

  function ShapeWaves(canvas, o) {
    const S = Object.assign({ text: '', fontFamily: 'Inter, "SF Pro Display", -apple-system, "Segoe UI", system-ui, sans-serif',
      fontWeight: 600, textSize: 0.6, cellSize: 10, dotSize: 0.75, color: '#929292', hoverColor: '#ffffff', backgroundColor: '#000000',
      speed: 1, scale: 1, contrast: 1, brightness: 0.4, fade: 0.25, splashRadius: 40, splashStrength: 0.4, introDuration: 1.6,
      textBox: null }, o);
    const gl = makeGL(canvas); if (!gl) return null;
    const u = program(gl, SHAPES_FRAG);
    const tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, unit ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, unit ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const maskTex = tex(0), chargeTex = tex(1);
    gl.uniform1i(u.uMask, 0); gl.uniform1i(u.uCharges, 1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const maskCanvas = document.createElement('canvas'), mctx = maskCanvas.getContext('2d');

    let W = 1, H = 1, dpr = 1, cols = 1, rows = 1, cellPx = 10, origin = [0, 0];
    let heights = new Float32Array(1), prev = new Float32Array(1), charges8 = new Uint8Array(1), chargesActive = false;
    let time = 0, last = 0, raf = 0, active = false, introStart = 0, introProgress = INTRO_END, backlog = 0;
    const pointer = { x: 0, y: 0, at: 0, inside: false };

    function grid() {
      const nc = Math.max(1, Math.round(W / (S.cellSize * dpr)));
      cellPx = W / nc; const nr = Math.max(1, Math.floor(H / cellPx));
      origin = [0, (H - nr * cellPx) / 2];
      if (nc === cols && nr === rows && heights.length === cols * rows) return;
      cols = nc; rows = nr;
      heights = new Float32Array(cols * rows); prev = new Float32Array(cols * rows); charges8 = new Uint8Array(cols * rows); chargesActive = false;
      uploadCharges();
    }
    function uploadCharges() {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, chargeTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cols, rows, 0, gl.RED, gl.UNSIGNED_BYTE, charges8);
    }
    function drawMask() {
      const text = S.text.trim();
      const sc = text ? Math.min(1, 1024 / Math.max(W, H)) : 0;
      const mw = text ? Math.max(1, Math.round(W * sc)) : 1, mh = text ? Math.max(1, Math.round(H * sc)) : 1;
      maskCanvas.width = mw; maskCanvas.height = mh;
      mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mw, mh);
      if (text) {
        const box = S.textBox ? S.textBox() : { cx: W / dpr / 2, cy: H / dpr / 2, w: W / dpr, h: H / dpr };
        const k = dpr * sc;
        let px = Math.max(1, S.textSize * box.h * k);
        mctx.font = `${S.fontWeight} ${px}px ${S.fontFamily}`;
        const mw0 = mctx.measureText(text).width, max = box.w * k * 0.8;
        if (mw0 > max) { px = px * max / mw0; mctx.font = `${S.fontWeight} ${px}px ${S.fontFamily}`; }
        mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillStyle = '#fff';
        mctx.fillText(text, box.cx * k, box.cy * k);
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
    }
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, MOB() ? 1 : 1.5);
      W = Math.max(1, Math.round(canvas.clientWidth * dpr)); H = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H); grid(); drawMask(); wake();
    }
    function splash(x, y, strength) {
      const sigma = Math.max(0.5, (S.splashRadius * dpr / cellPx) * 0.5), reach = Math.ceil(sigma * 2.5);
      const cc = (x * dpr - origin[0]) / cellPx - 0.5, cr = (y * dpr - origin[1]) / cellPx - 0.5;
      for (let r = Math.max(0, Math.floor(cr - reach)); r <= Math.min(rows - 1, Math.ceil(cr + reach)); r++)
        for (let c = Math.max(0, Math.floor(cc - reach)); c <= Math.min(cols - 1, Math.ceil(cc + reach)); c++) {
          const dx = c - cc, dy = r - cr, i = r * cols + c;
          heights[i] = Math.min(1.2, heights[i] + strength * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
        }
      chargesActive = true;
    }
    function step() {
      let peak = 0; const lc = cols - 1, lr = rows - 1;
      for (let r = 0; r < rows; r++) {
        const up = (r === 0 ? r : r - 1) * cols, dn = (r === lr ? r : r + 1) * cols, b = r * cols;
        for (let c = 0; c < cols; c++) {
          const i = b + c, h = heights[i];
          const lap = heights[b + (c === 0 ? c : c - 1)] + heights[b + (c === lc ? c : c + 1)] + heights[up + c] + heights[dn + c] - 4 * h;
          const next = (h + (h - prev[i]) * 0.94 + 0.42 * lap) * 0.972;
          prev[i] = next; const ch = Math.min(1, Math.max(0, next)); charges8[i] = ch * 255; if (ch > peak) peak = ch;
        }
      }
      const s = heights; heights = prev; prev = s; return peak;
    }
    function render(now) {
      raf = 0; if (!active) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      const animating = !document.hidden && !reduce.matches;
      if (animating) time += dt * 0.1 * S.speed;
      if (chargesActive) {
        backlog = Math.min(backlog + dt, 4 / 60); let peak = 1;
        while (backlog >= 1 / 60) { backlog -= 1 / 60; peak = step(); }
        if (peak < 0.01) { heights.fill(0); prev.fill(0); charges8.fill(0); chargesActive = false; }
        uploadCharges();
      }
      if (introProgress < INTRO_END) introProgress = Math.min(INTRO_END, (now - introStart) / 1000 / S.introDuration * INTRO_END);
      gl.uniform4f(u.uRes, W, H, 1 / W, 1 / H);
      gl.uniform4f(u.uPlacement, origin[0], origin[1], rows, introProgress);
      gl.uniform4f(u.uGrid, cellPx, S.dotSize, S.mode || 0, cols);
      gl.uniform4f(u.uField, 32 * cellPx * S.scale, 0.5 - (S.brightness - 0.5) * 0.4, 2.8 * S.contrast, time);
      gl.uniform4f(u.uMotion, 0, 0, S.text.trim() ? 1 : 0, S.fade);
      gl.uniform3fv(u.uColor, hex(S.color)); gl.uniform3fv(u.uHover, hex(S.hoverColor)); gl.uniform3fv(u.uBg, hex(S.backgroundColor));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (animating || chargesActive || introProgress < INTRO_END) raf = requestAnimationFrame(render); else last = 0;
    }
    const wake = () => { if (active && !raf) raf = requestAnimationFrame(render); };
    addEventListener('pointermove', e => {
      if (!active) return;
      const now = performance.now(), rc = canvas.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
      if (x < -30 || y < -30 || x > rc.width + 30 || y > rc.height + 30) { pointer.inside = false; return; }
      const el = pointer.inside ? Math.max(8, now - pointer.at) : 16;
      const sp = pointer.inside ? Math.hypot(x - pointer.x, y - pointer.y) / el * 1000 : 0;
      splash(x, y, Math.min(1, 0.22 + sp * 0.0006) * S.splashStrength); wake();
      Object.assign(pointer, { x, y, at: now, inside: true });
    }, { passive: true });
    document.addEventListener('visibilitychange', wake);
    new ResizeObserver(resize).observe(canvas);
    resize();
    return {
      start() { if (active) return; active = true; if (!reduce.matches) { introStart = performance.now(); introProgress = 0; } wake(); },
      stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; },
      relayout() { drawMask(); wake(); },
    };
  }

  /* ------------------------------------------------------------------ Gradient waves */
  const WAVES_FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution; uniform float iTime;
uniform float uSpeed,uAmplitude,uWaveScale,uWaveRatio,uSwell,uTurbulence,uTilt,uZoom,uHeight,uFogDepth,uSteps,uBrightness,uOpacity,uGrain,uGrainIntensity,uParallax,uEnableMouse;
uniform vec2 uMouse; uniform vec3 uHorizonColor,uWaveColor,uCrestColor;
out vec4 fragColor;
const float MAX_DIST=20000.0;
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float plasma(vec3 r,vec2 freq,vec4 tc){
  float mx=r.x+tc.x; mx+=uSwell*sin((r.y+mx)/20.0+tc.y);
  float my=r.y-tc.z; my+=uTurbulence*cos(r.x/23.0+tc.w);
  return r.z-(sin(mx*freq.x)*uAmplitude+sin(my*freq.y)*uAmplitude+uHeight);
}
float raymarch(vec3 pos,vec3 dir,vec2 freq,vec4 tc){
  float dist=0.0;
  for(int i=0;i<128;i++){ if(float(i)>=uSteps) break;
    float d=plasma(pos+dist*dir,freq,tc); if(abs(d)<0.1) break; dist+=0.9*d;
    if(!(abs(dist)<MAX_DIST)) return MAX_DIST; }
  return dist;
}
void main(){
  float T=iTime*uSpeed; vec2 freq=vec2(uWaveScale/7.0,(uWaveScale*uWaveRatio)/3.0);
  vec4 tc=vec4(T/0.130,T/0.810,T/0.200,T/0.710); float c,s;
  float vfov=(3.14159/2.3)/max(uZoom,0.05); vec3 cam=vec3(0.0,0.0,30.0);
  vec2 uv=(gl_FragCoord.xy/iResolution.xy)-0.5; uv.x*=iResolution.x/iResolution.y; uv.y*=-1.0;
  vec3 dir=vec3(0.0,0.0,-1.0); float ulen=length(uv); float xrot=vfov*ulen;
  c=cos(xrot); s=sin(xrot); dir=mat3(1.0,0.0,0.0,0.0,c,-s,0.0,s,c)*dir;
  vec2 nuv=ulen>1e-5?uv/ulen:vec2(1.0,0.0); c=nuv.x; s=nuv.y; dir=mat3(c,-s,0.0,s,c,0.0,0.0,0.0,1.0)*dir;
  c=cos(uTilt); s=sin(uTilt); dir=mat3(c,0.0,s,0.0,1.0,0.0,-s,0.0,c)*dir;
  if(uEnableMouse>0.5){ float yaw=(uMouse.x-0.5)*uParallax*0.4, pitch=(uMouse.y-0.5)*uParallax*0.4;
    c=cos(yaw); s=sin(yaw); dir=mat3(c,0.0,s,0.0,1.0,0.0,-s,0.0,c)*dir;
    c=cos(pitch); s=sin(pitch); dir=mat3(1.0,0.0,0.0,0.0,c,-s,0.0,s,c)*dir; }
  float dist=raymarch(cam,dir,freq,tc); vec3 pos=cam+dist*dir;
  float t=clamp(uFogDepth/max(dist,0.001),0.0,1.0);
  vec3 body=mix(uWaveColor,uCrestColor,clamp(pos.z*0.08+0.5,0.0,1.0));
  vec3 col=clamp(mix(uHorizonColor,body,t)*uBrightness,0.0,1.0);
  float alpha=t*uOpacity;
  if(uGrain>0.5){ alpha+=(hash21(gl_FragCoord.xy+mod(iTime,64.0)*11.0)-0.5)*uGrainIntensity; }
  alpha=clamp(alpha,0.0,1.0); fragColor=vec4(col*alpha,alpha);
}`;
  function GradientWaves(canvas, o) {
    const S = Object.assign({ horizonColor: '#5227FF', waveColor: '#FF9FFC', crestColor: '#FFFFFF', speed: 0.4, amplitude: 2.5, waveScale: 0.6,
      waveRatio: 0.9, swell: 35, turbulence: 20, tilt: 1.11, zoom: 1, height: 5.5, fogDepth: 15, steps: 70, brightness: 1, opacity: 1,
      mouseInteraction: true, parallaxStrength: 0.5, grain: true, grainIntensity: 0.05, resolution: 0.6 }, o);
    const gl = makeGL(canvas); if (!gl) return null;
    const u = program(gl, WAVES_FRAG);
    const set = () => {
      const f = (k, v) => gl.uniform1f(u[k], v);
      f('uSpeed', S.speed); f('uAmplitude', S.amplitude); f('uWaveScale', S.waveScale); f('uWaveRatio', S.waveRatio); f('uSwell', S.swell);
      f('uTurbulence', S.turbulence); f('uTilt', S.tilt); f('uZoom', S.zoom); f('uHeight', S.height); f('uFogDepth', S.fogDepth);
      f('uSteps', S.steps); f('uBrightness', S.brightness); f('uOpacity', S.opacity); f('uGrain', S.grain ? 1 : 0);
      f('uGrainIntensity', S.grainIntensity); f('uParallax', S.parallaxStrength); f('uEnableMouse', S.mouseInteraction ? 1 : 0);
      gl.uniform3fv(u.uHorizonColor, hex(S.horizonColor)); gl.uniform3fv(u.uWaveColor, hex(S.waveColor)); gl.uniform3fv(u.uCrestColor, hex(S.crestColor));
    };
    set(); gl.clearColor(0, 0, 0, 0);
    const resize = () => { const k = Math.min(devicePixelRatio || 1, MOB() ? 1 : 2) * S.resolution;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * k)); canvas.height = Math.max(1, Math.floor(canvas.clientHeight * k));
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(u.iResolution, canvas.width, canvas.height); if (active && reduce.matches) frame(performance.now()); };
    const cur = [0.5, 0.5], tgt = [0.5, 0.5];
    addEventListener('pointermove', e => { if (!active) return; const r = canvas.getBoundingClientRect(); tgt[0] = Math.min(1.2, Math.max(-.2, (e.clientX - r.left) / r.width)); tgt[1] = Math.min(1.2, Math.max(-.2, 1 - (e.clientY - r.top) / r.height)); }, { passive: true });
    let raf = 0, active = false; const t0 = performance.now();
    const frame = t => {
      gl.uniform1f(u.iTime, (t - t0) * 0.001);
      cur[0] += 0.05 * (tgt[0] - cur[0]); cur[1] += 0.05 * (tgt[1] - cur[1]); gl.uniform2f(u.uMouse, cur[0], cur[1]);
      gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = t => { raf = 0; if (!active || document.hidden) return; frame(t); if (!reduce.matches) raf = requestAnimationFrame(loop); };
    document.addEventListener('visibilitychange', () => { if (active && !raf) raf = requestAnimationFrame(loop); });
    new ResizeObserver(resize).observe(canvas); resize();
    return {
      start() { if (active) return; active = true; if (!raf) raf = requestAnimationFrame(loop); },
      stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    };
  }

  window.FX = {
    shapes(c, o) { try { return ShapeWaves(c, o); } catch (e) { console.warn('ShapeWaves', e); return null; } },
    waves(c, o) { try { return GradientWaves(c, o); } catch (e) { console.warn('GradientWaves', e); return null; } },
  };
})();
