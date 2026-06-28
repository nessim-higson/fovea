// ═══════════════════════════════════════════════════════════════════
// WORKS BED — the global nav. An infinite, scroll/swipe-able bed of all
// covers with ONE lens-tunnel pass over the whole field (two-pass, same
// pipeline as the main site). `Works` zooms OUT from the landing to here;
// click a cover to zoom (dive) into the project; Esc zooms back.
// ═══════════════════════════════════════════════════════════════════

const isVid = u => /\.(mp4|m4v|webm|mov)$/i.test(u || '');
const coverOf = p => (p.image && !isVid(p.image)) ? p.image : ((p.images || []).find(u => !isVid(u)) || p.image);

const TW = 230, TH = 150, GAP = 10, DISP = 0.85;   // full lens distortion (the smear, not this, was the "too much")
const COARSE = matchMedia('(pointer: coarse)').matches;   // mobile / touch device
const gridVS = `attribute vec2 aUV;uniform vec4 uRect;varying vec2 vUv;
void main(){vUv=aUV;gl_Position=vec4(uRect.xy+aUV*uRect.zw,0.,1.);}`;
const gridFS = `precision highp float;varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uCov;uniform float uB;
vec2 fit(vec2 c,vec2 cov){return (c-0.5)*cov+0.5;}
void main(){gl_FragColor=vec4(texture2D(uTex,fit(vUv,uCov)).rgb*uB,1.0);}`;
const lensVS = `attribute vec2 aUV;varying vec2 vUv;void main(){vUv=aUV;gl_Position=vec4(aUV*2.0-1.0,0.,1.);}`;
const lensFS = `precision highp float;varying vec2 vUv;
uniform sampler2D uTex;uniform float uTime,uScrollDif,uZoom;uniform vec2 uZoomC;
const float TS=0.4,SF=10.1,SA=1.0;
void main(){
  vec2 uv=(vUv-uZoomC)*(1.0-uZoom*0.93)+uZoomC;
  float disp=${DISP.toFixed(2)}+uZoom*1.7;
  vec2 cVuv=uv-0.5;
  float outCircle=(0.5-length(cVuv))*(TS*10.0);
  vec2 n=uv-0.5;
  float baseScale=1.0+0.5*disp-(1.0-outCircle)*disp*0.5;
  n*=baseScale;
  n+=0.5;                                   // smear removed — radial lens only
  gl_FragColor=vec4(texture2D(uTex,n).rgb,1.0);   // no vignette/diffusion — crisp bed
}`;

export function initWorksBed({ container, projects, onEnter, isPlaying }) {
  container.innerHTML =
    '<canvas class="wb-gl"></canvas>' +
    '<div class="wb-cap"></div>' +
    '<div class="wb-toggle"></div>' +
    '<div class="wb-hint">scroll / swipe to move · click to enter · esc to close</div>' +
    '<button class="wb-close" aria-label="Back to the landing">&#10005;&nbsp;Close</button>' +
    '<div class="wb-flash"></div>';
  const cv = container.querySelector('.wb-gl');
  const cap = container.querySelector('.wb-cap');
  const toggleEl = container.querySelector('.wb-toggle');
  const flashEl = container.querySelector('.wb-flash');
  container.querySelector('.wb-close').onclick = () => close();

  const gl = cv.getContext('webgl', { antialias: true });
  function mk(vs, fs) { const p = gl.createProgram();
    const a = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(a, vs); gl.compileShader(a); gl.attachShader(p, a);
    const b = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(b, fs); gl.compileShader(b); gl.attachShader(p, b);
    gl.linkProgram(p); return p; }
  const grid = mk(gridVS, gridFS), lens = mk(lensVS, lensFS);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const gA = gl.getAttribLocation(grid, 'aUV'), lA = gl.getAttribLocation(lens, 'aUV');
  const gRect = gl.getUniformLocation(grid, 'uRect'), gCov = gl.getUniformLocation(grid, 'uCov'), gB = gl.getUniformLocation(grid, 'uB');
  const lTime = gl.getUniformLocation(lens, 'uTime'), lScr = gl.getUniformLocation(lens, 'uScrollDif'),
        lZoom = gl.getUniformLocation(lens, 'uZoom'), lZC = gl.getUniformLocation(lens, 'uZoomC');

  const texCache = {};
  function getTex(url) {
    if (texCache[url]) return texCache[url];
    const t = { tex: gl.createTexture(), asp: 1.5 };
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([16, 16, 16, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      // thumbnails only need ~640px — downscale before upload so the bed isn't
      // holding 25 full-res (1800px) textures in GPU memory on a phone
      const MAX = 640, nw = im.naturalWidth, nh = im.naturalHeight; let w = nw, h = nh;
      if (Math.max(w, h) > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h; cc.getContext('2d').drawImage(im, 0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cc); t.asp = nw / nh;
    };
    im.src = url; texCache[url] = t; return t;
  }
  let fbo, fboTex;
  function makeFBO() {
    if (fboTex) gl.deleteTexture(fboTex); if (fbo) gl.deleteFramebuffer(fbo);
    fboTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const CATS = [...new Set(projects.map(p => p.category || 'Work'))];
  let activeCat = CATS[0];
  let list = [], ox = 0, oy = 0, pox = 0, poy = 0, vel = 0, t0 = 0, running = false;
  let zoom = 0, zoomTarget = 0, zoomC = [0.5, 0.5], diveActive = false;
  let panFromX = 0, panFromY = 0, panToX = 0, panToY = 0, diveT0 = 0;
  let hoverPt = null, lastFocus = '';
  const smoothstep = t => t * t * (3 - 2 * t);
  const W = () => innerWidth, H = () => innerHeight;

  function buildToggle() {
    toggleEl.innerHTML = '';
    if (CATS.length < 2) return;
    CATS.forEach(cat => { const b = document.createElement('button'); b.textContent = cat; b.classList.toggle('on', cat === activeCat);
      b.onclick = () => { if (cat === activeCat) return; activeCat = cat; setCat(); }; toggleEl.appendChild(b); });
  }
  function setCat(centerGlobal) {
    // pool EVERY image across the category's projects (not just the cover) so the
    // bed reads as a varied field, not 16 repeating covers. Lazy-loaded (only the
    // tiles actually drawn pull a texture), so the pool can be large cheaply.
    list = [];
    projects.forEach((p, gi) => {
      if ((p.category || 'Work') !== activeCat) return;
      const imgs = (p.images && p.images.length ? p.images : [coverOf(p)]).filter(u => !isVid(u));
      imgs.forEach(src => list.push({ p, gi, src }));
    });
    buildToggle();
    let si = list.findIndex(o => o.gi === centerGlobal); if (si < 0) si = 0;   // centre the project's first image
    ox = W() / 2 - (si + 0.5) * TW; oy = H() / 2 - 0.5 * TH;
  }
  function cell(c, r) { const N = list.length; return list[(((c + r * 7) % N) + N) % N]; }
  function cov(asp) { const ta = (TW - GAP) / (TH - GAP); return asp > ta ? [ta / asp, 1] : [1, asp / ta]; }
  function clip(px, py, pw, ph) { return [px / W() * 2 - 1, 1 - (py + ph) / H() * 2, pw / W() * 2, ph / H() * 2]; }
  function cellAt(cxpx, cypx) {
    const z = Math.max(0, zoom);
    let ux = cxpx / W(), uy = 1 - cypx / H();
    ux = (ux - zoomC[0]) * (1 - z * 0.93) + zoomC[0];   // undo the lens zoom first
    uy = (uy - zoomC[1]) * (1 - z * 0.93) + zoomC[1];
    const dx = ux - 0.5, dy = uy - 0.5, len = Math.hypot(dx, dy);
    const outCircle = (0.5 - len) * 4, bs = 1 + 0.5 * DISP - (1 - outCircle) * DISP * 0.5;
    const n = [dx * bs + 0.5, dy * bs + 0.5];
    return { c: Math.floor((n[0] * W() - ox) / TW), r: Math.floor(((1 - n[1]) * H() - oy) / TH) };
  }
  const focusCell = () => hoverPt ? cellAt(hoverPt[0], hoverPt[1]) : cellAt(W() / 2, H() / 2);

  function frame(now) {
    if (!running) return;
    const dpr = Math.min(COARSE ? 1.25 : 2, devicePixelRatio || 1);
    if (cv.width !== W() * dpr) { cv.width = W() * dpr; cv.height = H() * dpr; makeFBO(); }
    if (diveActive) {
      const e = (now || performance.now()) - diveT0;
      const tf = smoothstep(Math.min(1, e / 240));                       // focus: slide the tile to centre
      ox = panFromX + (panToX - panFromX) * tf;
      oy = panFromY + (panToY - panFromY) * tf;
      zoom = smoothstep(Math.min(1, Math.max(0, (e - 200) / 460)));       // then zoom into the centred tile
    } else {
      if (Math.abs(zoom) < 0.03 && zoomTarget === 0 && (isPlaying ? isPlaying() : true)) { ox += 0.22; oy += 0.16; }
      zoom += (zoomTarget - zoom) * 0.1;
    }
    vel = Math.min(46, Math.hypot(ox - pox, oy - poy) * 1.3); pox = ox; poy = oy;
    const fc = diveActive ? null : focusCell();
    if (fc) { const k = fc.c + ',' + fc.r; if (k !== lastFocus) { lastFocus = k; const o = cell(fc.c, fc.r);
      cap.innerHTML = `${o.p.client}<span class="yr">${o.p.year}</span>`; cap.style.opacity = 1; } }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(grid); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(gA); gl.vertexAttribPointer(gA, 2, gl.FLOAT, false, 0, 0);
    const c0 = Math.floor(-ox / TW) - 1, c1 = Math.ceil((W() - ox) / TW) + 1, r0 = Math.floor(-oy / TH) - 1, r1 = Math.ceil((H() - oy) / TH) + 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const o = cell(c, r), t = getTex(o.src), px = c * TW + ox + GAP / 2, py = r * TH + oy + GAP / 2;
      gl.uniform4fv(gRect, clip(px, py, TW - GAP, TH - GAP)); gl.uniform2fv(gCov, cov(t.asp));
      gl.uniform1f(gB, (fc && c === fc.c && r === fc.r) ? 1.12 : 1.0);   // crisp, full-brightness tiles
      gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(lens); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(lA); gl.vertexAttribPointer(lA, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1f(lTime, (now || 0) - t0); gl.uniform1f(lScr, vel);
    gl.uniform1f(lZoom, Math.max(0, zoom)); gl.uniform2fv(lZC, zoomC);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }

  function enter() {
    if (diveActive) return;
    const p = hoverPt || [W() / 2, H() / 2];
    const k = cellAt(p[0], p[1]); const o = cell(k.c, k.r);
    // focus → zoom: first slide the tapped tile to the centre (time-based, so it
    // can't lag on mobile), THEN zoom straight into the centred tile.
    panFromX = ox; panFromY = oy;
    panToX = W() / 2 - (k.c + 0.5) * TW; panToY = H() / 2 - (k.r + 0.5) * TH;
    diveActive = true; diveT0 = performance.now(); zoomC = [0.5, 0.5]; cap.style.opacity = 0;
    // hand off at the peak of the zoom: the project mounts fully lensed on the
    // SAME cover the bed is zoomed deep into, so a clean cut (no crossfade ghost,
    // no flash) reads as one continuous lens push-through. The project's lens then
    // resolves to flat. (overflow unlocked first — see the V.22 scrollTo fix.)
    setTimeout(() => { document.body.style.overflow = ''; onEnter(o.gi); hide(); }, 560);
  }

  // input — scroll / swipe to move, click / tap to enter
  function onWheel(e) { if (!running || diveActive || zoomTarget !== 0) return; e.preventDefault(); ox -= e.deltaX; oy -= e.deltaY; }
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; hoverPt = [e.clientX, e.clientY]; });
  container.addEventListener('click', e => { if (e.target.closest('.wb-toggle,.wb-close')) return; if (!diveActive) enter(); });
  let tx = 0, ty = 0, tmoved = 0, touching = false;
  container.addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tmoved = 0; touching = true; hoverPt = [tx, ty]; }, { passive: true });
  container.addEventListener('touchmove', e => { if (diveActive) return; e.preventDefault();   // don't let the page scroll under the bed
    const t = e.touches[0];
    const dx = t.clientX - tx, dy = t.clientY - ty; ox += dx; oy += dy; tmoved += Math.abs(dx) + Math.abs(dy); tx = t.clientX; ty = t.clientY; hoverPt = [t.clientX, t.clientY]; }, { passive: false });
  container.addEventListener('touchend', e => { if (touching && tmoved < 8 && !diveActive) { e.preventDefault(); hoverPt = [tx, ty]; enter(); } touching = false; }, { passive: false });
  addEventListener('resize', () => { if (running) { const dpr = Math.min(COARSE ? 1.25 : 2, devicePixelRatio || 1); cv.width = W() * dpr; cv.height = H() * dpr; makeFBO(); } });

  function open(startGlobal) {
    if (startGlobal != null && projects[startGlobal]) activeCat = projects[startGlobal].category || 'Work';
    container.hidden = false; document.body.style.overflow = 'hidden';   // freeze the page behind
    const dpr = Math.min(COARSE ? 1.25 : 2, devicePixelRatio || 1); cv.width = W() * dpr; cv.height = H() * dpr; makeFBO();
    setCat(startGlobal);
    diveActive = false; zoomC = [0.5, 0.5]; zoom = 0.82; zoomTarget = 0;   // zoom OUT from the cover into the field
    if (!running) { running = true; t0 = performance.now(); requestAnimationFrame(frame); }
  }
  function hide() {
    running = false; container.hidden = true; document.body.style.overflow = '';
    container.style.transition = ''; container.style.opacity = '';
    zoom = 0; zoomTarget = 0; diveActive = false;
  }
  function close(immediate) {
    if (immediate) { hide(); return; }
    zoomTarget = 0.82;            // zoom back in toward the cover, then hide → reveals the landing
    setTimeout(hide, 360);
  }
  return { open, close: () => close(false), isOpen: () => running };
}
