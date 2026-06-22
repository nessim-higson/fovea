// ═══════════════════════════════════════════════════════════════════
// ORBITAL — the secondary "index" nav, summoned over the primary site.
// A lens-distorted wheel of project names orbiting a full-bleed cover;
// spin to browse, click the centre to enter. Self-contained WebGL +
// DOM; only runs its loop while open.
// ═══════════════════════════════════════════════════════════════════

const isVid = u => /\.(mp4|m4v|webm|mov)$/i.test(u || '');
function coverOf(p) {                       // a still cover, never a video
  if (p.image && !isVid(p.image)) return p.image;
  return (p.images || []).find(u => !isVid(u)) || p.image;
}

const VS = `attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;
const FS = `precision highp float;varying vec2 vUv;
uniform sampler2D uA,uB;uniform vec2 uCovA,uCovB;uniform float uFade,uVel;
vec2 fit(vec2 c,vec2 cov){return c*cov+0.5;}
vec3 lens(sampler2D t,vec2 cov){
  vec2 c=vUv-0.5;float r=length(c);
  float k=1.3+uVel*3.0;                        // barrel; grows hard with spin
  vec2 q=c*(1.0-k*0.34*r*r);
  float ca=(0.8+uVel*2.6)*(0.004+r*0.026);     // chromatic split along radius
  float R=texture2D(t,fit(q*(1.0+ca),cov)).r;
  float G=texture2D(t,fit(q,cov)).g;
  float B=texture2D(t,fit(q*(1.0-ca),cov)).b;
  return vec3(R,G,B);
}
void main(){
  vec3 col=mix(lens(uA,uCovA),lens(uB,uCovB),uFade);
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
  const uA = U('uA'), uB = U('uB'), uCovA = U('uCovA'), uCovB = U('uCovB'), uFade = U('uFade'), uVel = U('uVel');
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

  // categories → lists carrying each project's GLOBAL index
  const CATS = [...new Set(projects.map(p => p.category || 'Work'))];
  let activeCat = CATS[0];
  let list = [], items = [], rot = -90, target = -90, focus = -1, prevRot = -90, spin = 0, kick = 0;
  let slotA = getTex(coverOf(projects[0])), slotB = slotA, fade = 0, fading = false;
  let cx, cy, rx, ry, running = false;
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
    list.forEach(o => getTex(coverOf(o.p)));               // warm textures
    list.forEach((o, i) => {
      const el = document.createElement('div'); el.className = 'orb-item'; el.textContent = o.p.client;
      el.onclick = () => { const n = list.length, step = 360 / n; let t = -90 - i * step;
        while (t - target > 180) t -= 360; while (t - target < -180) t += 360; target = t; };
      ringEl.appendChild(el);
      o.maxSize = Math.max(15, Math.min(27, 280 / o.p.client.length));
      items.push(o); o.el = el;
    });
    // open focused on the project you were viewing, if it's in this category
    let si = list.findIndex(o => o.gi === startGlobal);
    if (si > 0) { const off = -90 - si * (360 / list.length); rot = target = off; }
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
      const size = lerp(8, o.maxSize, e), off = spin * 7;
      const s = o.el.style;
      s.left = x + 'px'; s.top = y + 'px'; s.fontSize = size.toFixed(2) + 'px';
      s.opacity = lerp(0.10, 1, Math.pow(e, 1.25)).toFixed(3);
      s.letterSpacing = lerp(0.05, -0.012, e).toFixed(4) + 'em';
      s.filter = 'blur(' + (lerp(2.0, 0, e) + spin * 3.5).toFixed(2) + 'px)';
      s.fontVariationSettings = "'opsz' " + Math.min(144, size * 1.7).toFixed(0) + ", 'wght' " + lerp(330, 560, e).toFixed(0);
      s.transform = 'translate(-50%,-50%) scaleX(' + (1 + spin * 0.16).toFixed(3) + ')';
      s.textShadow = off < 0.4 ? 'none' : `${off.toFixed(1)}px 0 rgba(255,40,95,.6), ${(-off).toFixed(1)}px 0 rgba(0,210,255,.6)`;
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
  function frame() {
    if (!running) return;
    if ((isPlaying ? isPlaying() : true) && !drag) target += TEMPO;
    rot += (target - rot) * 0.10;
    spin += (Math.min(1.4, Math.abs(rot - prevRot) / 4.5) - spin) * 0.3; prevRot = rot;
    kick *= 0.90; layout();
    if (fading) { fade += 0.05; if (fade >= 1) { slotA = slotB; fading = false; fade = 0; } }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, slotA.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (slotB || slotA).tex);
    gl.uniform2fv(uCovA, cov(slotA.asp)); gl.uniform2fv(uCovB, cov((slotB || slotA).asp));
    gl.uniform1f(uFade, fading ? smoothstep(Math.min(1, fade)) : 0);
    gl.uniform1f(uVel, spin + kick * 2.2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  // input
  let drag = false, lx = 0, ly = 0;
  function onWheel(e) { if (!running) return; e.preventDefault(); target += e.deltaY * 0.16; }
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointerdown', e => { if (e.target.closest('.orb-toggle,.orb-close')) return; drag = true; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointermove', e => { if (!drag) return; target += ((e.clientX - lx) + (e.clientY - ly)) * 0.25; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointerup', () => drag = false);
  function flash() { container.classList.remove('flash'); void container.offsetWidth; container.classList.add('flash'); }
  function enter() {
    const o = items[focus]; if (!o) return;
    kick = 1.0; flash();
    setTimeout(() => { close(); onEnter(o.gi); }, 240);
  }
  enterEl.onclick = enter;

  function open(startGlobal) {
    if (startGlobal != null && projects[startGlobal])   // land in that project's category
      activeCat = projects[startGlobal].category || 'Work';
    container.hidden = false; dims(); build(startGlobal);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  function close() { running = false; container.hidden = true; }
  addEventListener('resize', () => { if (running) { dims(); layout(); } });

  return { open, close, isOpen: () => running, enter };
}
