// ═══════════════════════════════════════════════════════════════════
// ORBITAL — the secondary "index" nav, summoned over the primary site.
// A wheel of project names orbiting a full-bleed cover that is warped by
// the SAME lens-tunnel distortion as the main scroll (radial magnification
// + scroll-velocity smear). Spin to browse, click the centre to dive in.
// ═══════════════════════════════════════════════════════════════════

const isVid = u => /\.(mp4|m4v|webm|mov)$/i.test(u || '');
function coverOf(p) {
  if (p.image && !isVid(p.image)) return p.image;
  return (p.images || []).find(u => !isVid(u)) || p.image;
}

const VS = `attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;
// the lens-tunnel pass, lifted from effects.js: radial magnification keyed to
// uDisp, vertical smear keyed to uScrollDif (spin velocity here), + a faint
// spin chroma. uDive zooms the cover toward the viewer on enter.
const FS = `precision highp float;varying vec2 vUv;
uniform sampler2D uA,uB;uniform vec2 uCovA,uCovB;
uniform float uFade,uDisp,uScrollDif,uTime,uSpin,uDive;
const float TS=0.4, SF=10.1, SA=1.0;
vec2 fit(vec2 c,vec2 cov){return (c-0.5)*cov+0.5;}
vec3 lensSample(sampler2D tex,vec2 cov){
  vec2 base=(vUv-0.5)*(1.0-uDive*0.55)+0.5;        // dive = push the cover in
  vec2 cVuv=base-0.5;
  float outCircle=(0.5-length(cVuv))*(TS*10.0);
  vec2 nVuv=base-0.5;
  float baseScale=1.0+0.5*uDisp-(1.0-outCircle)*uDisp*0.5;
  nVuv*=baseScale;
  float lum1=dot(texture2D(tex,fit(base,cov)).rgb,vec3(0.3333));
  nVuv.y*=1.0 - sin(uTime*0.001 + base.x*SF + lum1*SF)*uScrollDif*0.01*SA;
  nVuv+=0.5;
  vec2 bdir=(nVuv-0.5)/max(length(nVuv-0.5),1e-4);
  float ca=uSpin*0.004;
  return vec3(
    texture2D(tex,fit(nVuv+bdir*ca,cov)).r,
    texture2D(tex,fit(nVuv,cov)).g,
    texture2D(tex,fit(nVuv-bdir*ca,cov)).b);
}
void main(){
  vec3 col=mix(lensSample(uA,uCovA),lensSample(uB,uCovB),uFade);
  float r=length(vUv-0.5);
  col*=0.5;
  col*=1.0-0.55*smoothstep(0.42,1.05,r);
  gl_FragColor=vec4(col,1.0);
}`;

export function initOrbital({ container, projects, onEnter, isPlaying }) {
  container.innerHTML =
    '<canvas class="orb-gl"></canvas>' +
    '<div class="orb-ring"></div>' +
    '<div class="orb-meta"></div>' +
    '<div class="orb-enter"></div>' +
    '<div class="orb-toggle"></div>' +
    '<div class="orb-hint">▣ square · tempo<br>scroll · spin<br>⊙ center · enter<br>esc · close</div>' +
    '<button class="orb-close" aria-label="Close index">&#10005;</button>';
  const cv = container.querySelector('.orb-gl');
  const ringEl = container.querySelector('.orb-ring');
  const metaEl = container.querySelector('.orb-meta');
  const enterEl = container.querySelector('.orb-enter');
  const toggleEl = container.querySelector('.orb-toggle');
  container.querySelector('.orb-close').onclick = () => close();

  const gl = cv.getContext('webgl', { antialias: true });
  function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uA = U('uA'), uB = U('uB'), uCovA = U('uCovA'), uCovB = U('uCovB'), uFade = U('uFade');
  const uDisp = U('uDisp'), uScrollDif = U('uScrollDif'), uTime = U('uTime'), uSpin = U('uSpin'), uDive = U('uDive');
  gl.uniform1i(uA, 0); gl.uniform1i(uB, 1);

  const texCache = {};
  function getTex(url) {
    if (texCache[url]) return texCache[url];
    const t = { tex: gl.createTexture(), asp: 1.5, ready: false };
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([18, 18, 18, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const im = new Image();
    im.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      t.asp = im.naturalWidth / im.naturalHeight; t.ready = true;
    };
    im.src = url; texCache[url] = t; return t;
  }
  function cov(asp) { const ca = cv.width / cv.height; return asp > ca ? [ca / asp, 1] : [1, asp / ca]; }

  const CATS = [...new Set(projects.map(p => p.category || 'Work'))];
  let activeCat = CATS[0];
  let list = [], items = [], rot = -90, target = -90, focus = -1, prevRot = -90, spin = 0, vel = 0;
  let diving = false, dive = 0;
  let slotA = getTex(coverOf(projects[0])), slotB = slotA, fade = 0, fading = false;
  let cx, cy, rx, ry, running = false, t0 = 0;
  const TEMPO = 0.16;
  const lerp = (a, b, t) => a + (b - a) * t, smoothstep = t => t * t * (3 - 2 * t);

  function buildToggle() {
    toggleEl.innerHTML = '';
    if (CATS.length < 2) return;
    CATS.forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat; btn.classList.toggle('on', cat === activeCat);
      btn.onclick = () => { if (cat === activeCat) return; activeCat = cat; build(); };
      toggleEl.appendChild(btn);
    });
  }
  function build(startGlobal) {
    ringEl.innerHTML = ''; items = []; rot = -90; target = -90; prevRot = -90; focus = -1;
    list = projects.map((p, gi) => ({ p, gi })).filter(o => (o.p.category || 'Work') === activeCat);
    list.forEach(o => getTex(coverOf(o.p)));
    list.forEach((o, i) => {
      const el = document.createElement('div'); el.className = 'orb-item'; el.textContent = o.p.client;
      el.onclick = () => { const n = list.length, step = 360 / n; let t = -90 - i * step;
        while (t - target > 180) t -= 360; while (t - target < -180) t += 360; target = t; };
      ringEl.appendChild(el);
      o.maxSize = Math.max(11, Math.min(18, 200 / o.p.client.length));  // smaller type
      items.push(o); o.el = el;
    });
    let si = list.findIndex(o => o.gi === startGlobal);
    if (si > 0) { rot = target = -90 - si * (360 / list.length); }
    buildToggle();
    const f0 = Math.max(0, si);
    slotA = getTex(coverOf(list[f0].p)); slotB = slotA; fade = 0; fading = false;
    layout();
  }
  function focusTo(o) { const t = getTex(coverOf(o.p)); if (t === slotB && !fading) return;
    if (fading) slotA = slotB; slotB = t; fade = 0; fading = true; }
  function layout() {
    const n = items.length, step = 360 / n; let fIdx = 0, fBest = 1e9;
    items.forEach((o, i) => {
      const deg = i * step + rot, a = deg * Math.PI / 180;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      let d = (((deg + 90) % 360) + 360) % 360; if (d > 180) d = 360 - d;
      const e = smoothstep(Math.max(0, 1 - d / 52));
      const size = lerp(8, o.maxSize, e), off = spin * 6;
      const s = o.el.style;
      s.left = x + 'px'; s.top = y + 'px'; s.fontSize = size.toFixed(2) + 'px';
      s.opacity = lerp(0.10, 1, Math.pow(e, 1.25)).toFixed(3);
      s.fontWeight = Math.round(lerp(300, 700, e));
      s.letterSpacing = lerp(0.09, 0.01, e).toFixed(4) + 'em';
      s.filter = 'blur(' + (lerp(1.8, 0, e) + spin * 3.0).toFixed(2) + 'px)';
      s.transform = 'translate(-50%,-50%) scaleX(' + (1 + spin * 0.14).toFixed(3) + ')';
      s.textShadow = off < 0.4 ? 'none' : `${off.toFixed(1)}px 0 rgba(255,40,95,.55), ${(-off).toFixed(1)}px 0 rgba(0,210,255,.55)`;
      s.zIndex = Math.round(e * 100);
      if (d < fBest) { fBest = d; fIdx = i; }
    });
    if (fIdx !== focus) { focus = fIdx; focusTo(items[fIdx]);
      metaEl.style.opacity = 0;
      setTimeout(() => { const o = items[fIdx]; if (o) { metaEl.textContent = `${o.p.year} · ${o.p.category || ''}`.replace(/ · $/, ''); metaEl.style.opacity = 1; } }, 200);
    }
  }
  function dims() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; gl.viewport(0, 0, cv.width, cv.height);
    cx = innerWidth / 2; cy = innerHeight * 0.52;
    rx = Math.min(innerWidth * 0.40, 600); ry = Math.min(innerHeight * 0.42, 380);
  }
  function frame(now) {
    if (!running) return;
    if (!diving && (isPlaying ? isPlaying() : true) && !drag) target += TEMPO;
    rot += (target - rot) * 0.10;
    const dRot = rot - prevRot; prevRot = rot;
    spin += (Math.min(1.4, Math.abs(dRot) / 4.5) - spin) * 0.3;
    vel += (dRot - vel) * 0.3;
    if (diving) dive += (1 - dive) * 0.14;
    layout();
    if (fading) { fade += 0.05; if (fade >= 1) { slotA = slotB; fading = false; fade = 0; } }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, slotA.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (slotB || slotA).tex);
    gl.uniform2fv(uCovA, cov(slotA.asp)); gl.uniform2fv(uCovB, cov((slotB || slotA).asp));
    gl.uniform1f(uFade, fading ? smoothstep(Math.min(1, fade)) : 0);
    gl.uniform1f(uDisp, 1 + dive * 1.6);                                  // tunnel deepens on dive
    gl.uniform1f(uScrollDif, Math.max(-42, Math.min(42, vel * 7)));        // spin → same smear as scroll
    gl.uniform1f(uTime, (now || 0) - t0);
    gl.uniform1f(uSpin, spin);
    gl.uniform1f(uDive, dive);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  let drag = false, lx = 0, ly = 0;
  function onWheel(e) { if (!running || diving) return; e.preventDefault(); target += e.deltaY * 0.16; }
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointerdown', e => { if (diving || e.target.closest('.orb-toggle,.orb-close')) return; drag = true; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointermove', e => { if (!drag) return; target += ((e.clientX - lx) + (e.clientY - ly)) * 0.25; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointerup', () => drag = false);

  // ENTER = a continuous lens dive: the cover pushes through the lens while the
  // overlay fades, and the project blooms out of the lens underneath it.
  function enter() {
    const o = items[focus]; if (!o || diving) return;
    diving = true;
    container.style.transition = 'opacity .5s ease'; container.style.opacity = '0';
    setTimeout(() => onEnter(o.gi), 250);     // mount the project under the fade
    setTimeout(() => close(), 560);
  }
  enterEl.onclick = enter;

  function open(startGlobal) {
    if (startGlobal != null && projects[startGlobal])
      activeCat = projects[startGlobal].category || 'Work';
    container.hidden = false; container.style.opacity = ''; container.style.transition = '';
    diving = false; dive = 0; dims(); build(startGlobal);
    if (!running) { running = true; t0 = performance.now(); requestAnimationFrame(frame); }
  }
  function close() {
    running = false; container.hidden = true;
    container.style.opacity = ''; container.style.transition = ''; diving = false; dive = 0;
  }
  addEventListener('resize', () => { if (running) { dims(); layout(); } });

  return { open, close, isOpen: () => running, enter };
}
