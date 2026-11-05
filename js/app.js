// ═══════════════════════════════════════════════════════════════════
// APP — renderer, image track, native-scroll loop, effect manager,
// project nav + detail mode, GUI.
//
// Architecture (mirrors vincent-lowe.info, reverse-engineered):
//   sceneA: image planes on a deformable track → render target (tex1)
//   sceneB: fullscreen quad with the active effect pass → screen
//   Native page scroll drives everything; G toggles the tweak panel.
//   Clicking a project in the bottom nav scrolls the track there and
//   opens detail mode (lens collapses flat — the original's route
//   transition).
// ═══════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { makePoster, makeGallery } from './posters.js';
import { EFFECTS, VERTEX } from './effects.js';
import { createAudioEngine } from './audio.js';
import { initWorksBed } from './worksbed.js?v=54';
import { initAbout } from './about.js?v=54';

// content sets: ?set=<name> loads js/config-<name>.js. Default is IAAH (the
// portfolio); ?set=fovea / ?set=uniqlock load the FOVEA demo content.
const CONTENT_SET = new URLSearchParams(location.search).get('set');
const { SITE, PROJECTS, SETTINGS } = await import(
  (CONTENT_SET ? `./config-${CONTENT_SET}.js` : './config-iaah.js') + '?v=54'
);
const COARSE = matchMedia('(pointer: coarse)').matches;   // mobile / touch device

/* ── DOM ───────────────────────────────────────────────────────────── */
const lensBtn  = document.getElementById('lens-btn');
const spacer   = document.getElementById('spacer');
const detailEl = document.getElementById('detail');
const detailX  = document.getElementById('detail-x');
const metaEl   = document.getElementById('detail-meta');
const descEl   = document.getElementById('detail-desc');
const beatDot  = document.getElementById('beat-dot');
const metroEl  = document.getElementById('metro');
const metroSq  = document.getElementById('metro-sq');   // the square turns; the word stays level
document.getElementById('metro-label').textContent = SITE.studio;

// detail mode state (declared early — layout() runs at module load)
let detailOpen = false;
let detailIdx = -1;

/* ── renderer + scenes ─────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('gl'), antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, COARSE ? 1.25 : 2));   // a phone's lens pass at 1.25 (V.49: was 1.5 — the load stuttered)

let VW = 0, VH = 0;   // set by layout() (which runs immediately below)

const camA = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const camB = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camA.position.z = 10; camB.position.z = 10;

const sceneA = new THREE.Scene();
sceneA.background = new THREE.Color(0x000000);
const sceneB = new THREE.Scene();

const rt = new THREE.WebGLRenderTarget(1, 1);  // sized in layout()

// ping-pong buffers for the feedback effect (previous frame → next frame)
let fbA = new THREE.WebGLRenderTarget(1, 1);
let fbB = new THREE.WebGLRenderTarget(1, 1);
let prevFb = fbA, curFb = fbB;

/* ── image track ───────────────────────────────────────────────────
   Each slide is a segmented plane so the TRACK BEND vertex shader can
   bow it with scroll velocity: scroll down → bows down, up → up.
*/
const slideVert = /* glsl */`
  varying vec2 vUv;
  uniform float uVel;    // signed, smoothed scroll velocity (px/frame)
  uniform float uBend;   // Track bend amount (GUI)

  void main() {
    vUv = uv;
    vec3 pos = position;
    // jelly bow: the middle of the card leads in the travel direction
    pos.y += sin(uv.x * 3.1416) * uVel * uBend * 0.002;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const imageFrag = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D map;
  uniform float time;
  uniform float detailMode;   // 1 = full image, 0 = luminance-grain ghost
  uniform float opacity;
  uniform float uLift;        // exposure lift (project images > 1 so they pop)

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    float grain = hash(vUv + fract(sin(vec2(time, time * 1.3)) * 100.0));
    vec4 outColor = texture2D(map, vUv);
    float avg = (outColor.r + outColor.g + outColor.b) / 3.0;
    outColor.rgb = outColor.rgb * detailMode
                 + vec3((1.0 - detailMode) * avg * (grain * 5.5 * (1.0 - avg)));
    outColor.rgb *= uLift;
    gl_FragColor = vec4(outColor.rgb, outColor.a * opacity);
  }
`;

/* ── media loader: images AND videos become slide textures ─────────
   Videos (muted/looped/autoplaying) feed THREE.VideoTexture — same
   technique the reference site uses for its film content.
*/
const VIDEO_RE = /\.(mp4|m4v|webm|mov)(\?.*)?$/i;
// the loader queue (V.48): nothing loads all at once. Three at a time, in the
// order they are wanted — the landing project first, then its neighbours either
// way round the loop, then the rest; a project's images in order, ahead of the queue.
const loadQueue = []; let loadsLive = 0; const LOADS_AT_ONCE = COARSE ? 1 : 3;   // a phone takes one at a time: decode + GPU upload is where the load lag was
function pumpLoads() {
  while (loadsLive < LOADS_AT_ONCE && loadQueue.length) {
    const { src, holder } = loadQueue.shift();
    if (holder.disposed) continue;
    loadsLive++;
    loadMedia(src, holder, () => { loadsLive--; pumpLoads(); });
  }
}
function queueLoad(src, holder, first = false) {
  if (first) loadQueue.unshift({ src, holder }); else loadQueue.push({ src, holder });
  pumpLoads();
}
function loadMedia(src, holder, done = () => {}) {
  let finished = false; const fin = () => { if (!finished) { finished = true; done(); } };
  if (VIDEO_RE.test(src)) {
    // poster still FIRST — the slot is never black, and it's the graceful
    // fallback if the video can't play (autoplay block, decode, slow net).
    const posterUrl = src.replace(/\.(mp4|m4v|webm|mov)(\?.*)?$/i, '.jpg');
    const pImg = new Image(); pImg.crossOrigin = 'anonymous';
    pImg.onload = () => {
      if (holder._videoLive) return;
      const pt = new THREE.CanvasTexture(pImg); pt.colorSpace = THREE.SRGBColorSpace;
      holder.mat.uniforms.map.value = pt;
      holder.imgW = pImg.naturalWidth; holder.imgH = pImg.naturalHeight; holder.fit();
    };
    pImg.src = posterUrl;

    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');   // iOS inline autoplay
    v.crossOrigin = 'anonymous';
    v.src = src;
    holder.video = v;
    // wait for a REAL frame (loadeddata, not just metadata) before texturing —
    // uploading a frameless video is what throws / shows black.
    v.addEventListener('error', fin, { once: true });
    v.addEventListener('loadeddata', () => {
      fin();
      holder._videoLive = true;
      holder.imgW = v.videoWidth || 16;
      holder.imgH = v.videoHeight || 9;
      const t = new THREE.VideoTexture(v);
      t.colorSpace = THREE.SRGBColorSpace;
      holder.mat.uniforms.map.value = t;
      holder.fit();
      v.play().catch(() => {});
    });
    v.addEventListener('canplay', () => v.play().catch(() => {}));
    v.load();
    v.play().catch(() => {});
  } else {
    // downscale on load — the source art is ~1800px; full-size textures
    // exhaust GPU memory on phones. Cap the longest edge, keep the aspect.
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
    const webp = /\.jpg$/i.test(src) ? src.replace(/\.jpg$/i, '_m.webp') : null;   // the 1400 px WebP, a third of the JPEG's bytes
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => {   // decode off the main thread first
      const MAX = COARSE ? 1000 : 1600, nw = img.naturalWidth, nh = img.naturalHeight;
      let w = nw, h = nh;
      if (Math.max(w, h) > MAX) { const s = MAX / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      holder.mat.uniforms.map.value = t;
      holder.imgW = nw; holder.imgH = nh; holder.fit();
      holder.landed = performance.now();   // fades up from black over 500 ms (the frame loop)
      fin();
    });
    img.onerror = () => { if (webp && img.src.endsWith('_m.webp')) { img.src = src; } else fin(); };   // no WebP there: the JPEG
    img.src = webp || src;
  }
}

// 1×1 black placeholder shown until real media streams in — so a real
// content set loads as clean void, never flashing the procedural temp
// posters (those only exist to fill the no-content default set).
const BLACK_TEX = new THREE.DataTexture(
  new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
BLACK_TEX.needsUpdate = true;

const planeGeo = new THREE.PlaneGeometry(1, 1, 32, 32);
const slides = PROJECTS.map((p, i) => {
  const mat = new THREE.ShaderMaterial({
    vertexShader: slideVert,
    fragmentShader: imageFrag,
    uniforms: {
      map:        { value: p.image ? BLACK_TEX : makePoster(i, p) },
      time:       { value: 0 },
      detailMode: { value: 1 },
      opacity:    { value: 1 },
      uVel:       { value: 0 },
      uBend:      { value: SETTINGS.trackBend },
      uLift:      { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(planeGeo, mat);
  sceneA.add(mesh);
  const slide = { mesh, mat, imgW: 1080, imgH: 1440 };
  slide.fit = () => fitCover(slide);   // home = full-bleed immersive
  return slide;   // loaded once START is known (below), nearest first
});

// cover-fit a texture to the viewport-sized plane via UV transform
// read the REAL pixel dims off whatever texture is mounted right now —
// images, videos, and canvases all differ, and reading live avoids the
// stale-cached-dimension bug that squished landscape stills.
function mediaDims(tex) {
  const im = tex && tex.image;
  if (!im) return [1, 1];
  const w = im.naturalWidth || im.videoWidth || im.width || 1;
  const h = im.naturalHeight || im.videoHeight || im.height || 1;
  return [w, h];
}

function fitCover(slide) {
  const tex = slide.mat.uniforms.map.value;
  const [iw, ih] = mediaDims(tex);
  const s = Math.max(VW / iw, VH / ih);
  const visW = VW / (iw * s);
  const visH = VH / (ih * s);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.center.set(0.5, 0.5);
  tex.repeat.set(visW, visH);
  tex.offset.set((1 - visW) / 2, (1 - visH) / 2);
}

// contain-fit: scale the MESH to the media's aspect so the WHOLE work
// shows, never cropped or stretched.
function fitContain(item) {
  const tex = item.mat.uniforms.map.value;
  const [iw, ih] = mediaDims(tex);
  const s = Math.min(VW / iw, VH / ih);
  item.mesh.scale.set(iw * s, ih * s, 1);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.center.set(0.5, 0.5);
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
}


/* ── the case track (detail mode) ──────────────────────────────────
   ALL projects' galleries live on ONE continuous looping track —
   projects bleed into each other on a long scroll. Clicking a pill
   while inside glides visibly along the track. Placeholder shots
   come from makeGallery(); real projects set PROJECTS[i].images.
*/
let caseTrack = null;   // { items, starts, N }
const CASE_LOOPS = 4;
// case images decode async → the strip re-flows as real dimensions land.
// while a project is freshly mounted and untouched, keep its first image
// pinned to the top so the arrival never appears to "scroll to find" it.
let casePinTop = false;
const DETAIL_LIFT = 1.22;   // exposure lift for in-project images (they read dark otherwise)

function makeSlideMaterial(texture) {
  return new THREE.ShaderMaterial({
    vertexShader: slideVert,
    fragmentShader: imageFrag,
    uniforms: {
      map:        { value: texture },
      time:       { value: 0 },
      detailMode: { value: 1 },
      opacity:    { value: 1 },
      uVel:       { value: 0 },
      uBend:      { value: SETTINGS.trackBend },
      uLift:      { value: DETAIL_LIFT },   // project images are lifted so they pop
    },
  });
}

// each project is its OWN self-contained track now — diving builds only that
// project's images. A clean deep dive (no scrolling through the others) and far
// less to load on mobile. The previous project's GPU resources are freed.
function disposeCaseTrack() {
  if (!caseTrack) return;
  caseTrack.items.forEach((it) => {
    it.disposed = true;   // anything still queued for it is skipped
    sceneA.remove(it.mesh);
    if (it.video) { it.video.pause(); it.video.removeAttribute('src'); }
    const tex = it.mat.uniforms.map.value;
    if (tex && tex !== BLACK_TEX && tex.dispose) tex.dispose();
    it.mat.dispose();
  });
  caseTrack = null;
}

function buildCaseTrack(only) {
  disposeCaseTrack();
  const project = PROJECTS[only];
  const sources = (project.images && project.images.length)
    ? project.images
    : makeGallery(only, project);
  const items = [];
  sources.forEach((src) => {
    const isUrl = typeof src === 'string';
    const mat = makeSlideMaterial(isUrl ? BLACK_TEX : src);
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.visible = false;
    sceneA.add(mesh);
    const item = { mesh, mat, imgW: 1080, imgH: 1440 };
    item.fit = relayoutCase;   // an image load re-flows this project's track
    items.push(item);
    if (isUrl) item.src = src;
  });
  // in order, ahead of the queue: the first image is wanted now, the last least
  for (let k = items.length - 1; k >= 0; k--) if (items[k].src) queueLoad(items[k].src, items[k], true);
  caseTrack = { items, proj: only, N: items.length, heights: [], tops: [], trackH: 0 };
  window.__caseTrack = caseTrack;
  relayoutCase();
  return caseTrack;
}

// FULL-WIDTH SCROLL-THROUGH layout: every sub-page image fills the
// viewport width at its natural aspect, stacked into one tall filmstrip.
// Tall pieces extend past the screen and are revealed by scrolling —
// nothing cropped, stretched, or skewed.
function relayoutCase() {
  if (!caseTrack) return;
  const its = caseTrack.items;
  let acc = 0;
  for (let k = 0; k < its.length; k++) {
    const it = its[k];
    const [iw, ih] = mediaDims(it.mat.uniforms.map.value);
    const h = VW * ih / iw;            // full width, natural height
    caseTrack.heights[k] = h;
    caseTrack.tops[k] = acc;
    acc += h;
    it.mesh.scale.set(VW, h, 1);
    const tex = it.mat.uniforms.map.value;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.center.set(0.5, 0.5);
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
  }
  caseTrack.trackH = acc;
  if (detailOpen) {
    spacer.style.height = (CASE_LOOPS * acc) + 'px';
    // re-flowed while freshly mounted → re-pin the first image to the top so
    // late-decoding images settle BELOW the fold, not by shoving the hero.
    if (casePinTop) {
      const y = caseTopY();
      window.scrollTo(0, y);
      smooth = lastSmooth = prevY = y; scrollDif = 0;
    }
  }
}

// scroll offset that puts the project's first image flush with the top of the
// viewport (pos ≡ VH/2, independent of trackH so it survives re-flows).
function caseTopY() {
  const cyc = (caseTrack && caseTrack.trackH) || VH;
  return Math.floor(CASE_LOOPS / 2) * cyc + VH / 2;
}


/* ── effect manager ────────────────────────────────────────────────── */
const lensQuad = new THREE.Mesh(planeGeo);
sceneB.add(lensQuad);

const materials = {};
let activeEffect = null;

function baseUniforms() {
  return {
    tex1:         { value: rt.texture },
    time:         { value: 0 },
    opacity:      { value: 0 },
    saturation:   { value: 1 },
    displacement: { value: 0 },
    scrollDif:    { value: 0 },
    uBeat:        { value: 0 },
    uMouse:       { value: new THREE.Vector2(0, 0) },
    uFeedback:    { value: rt.texture },   // previous frame (feedback effect)
  };
}

function setEffect(id) {
  const ef = EFFECTS[id];
  if (!ef) return console.warn(`unknown effect "${id}"`);
  if (!materials[id]) {
    const uniforms = baseUniforms();
    for (const p of ef.params) uniforms[p.key] = { value: p.value };
    materials[id] = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: ef.frag,
      transparent: true,
      uniforms,
    });
  }
  activeEffect = id;
  lensQuad.material = materials[id];
  rebuildParamsFolder();
}

/* ── native scroll → endless loop ──────────────────────────────────── */
const LOOPS = 6;
function cycleH() { return PROJECTS.length * VH; }

// On touch devices the OS already provides smooth momentum scrolling, so
// the extra position-smoothing only adds lag — and on a hard flick the
// lagged value has to finish catching up in the OLD direction before it
// reverses, which reads as a "blip" when you change scroll direction.
// Lock the render position to the real scroll on touch; keep the
// weighted glide on desktop (where wheel input is steppy and benefits).
// primary pointer is coarse → phone/tablet (true touch-scroll device with
// an address bar). a touchscreen laptop keeps a fine primary pointer, so
// it correctly stays on the desktop path.
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;

// smoothed cursor (-1..1), drives the parallax in the depth effect
const mouseTarget = new THREE.Vector2(0, 0);
const mouseSmooth = new THREE.Vector2(0, 0);
window.addEventListener('pointermove', (e) => {
  mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1,
                  -((e.clientY / window.innerHeight) * 2 - 1));
});

// a phone's LARGE viewport (the height once the address bar has folded away), read from a
// 100lvh probe. Sizing the loop to it from the first frame means the bar folding on the first
// drag changes nothing: no relayout, no remapping of the scroll onto another project (V.53).
let lvhProbe = null;
function largeViewportHeight() {
  if (!lvhProbe) { lvhProbe = document.createElement('div'); lvhProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none'; document.body.appendChild(lvhProbe); }
  const h = lvhProbe.clientHeight;
  return h > 0 ? h : window.innerHeight;
}
function layout() {
  const w = window.innerWidth;
  let h = IS_TOUCH ? Math.max(window.innerHeight, largeViewportHeight()) : window.innerHeight;
  if (!w || !h) { requestAnimationFrame(layout); return; }   // a zero-size moment (a pane opening) would poison every ratio — try again next frame
  // ignore the mobile address-bar height shrink (same width, smaller
  // height): relaying out on it would jump the content as the bar
  // reappears on a direction reversal. only grow the height, or relayout
  // fully on a width / orientation change.
  if (IS_TOUCH && VW && w === VW) {
    h = Math.max(VH, h);
    if (h === VH) return;
  }
  const oldVH = VH;
  VW = w; VH = h;
  renderer.setSize(VW, VH);
  const pr = renderer.getPixelRatio();
  rt.setSize(VW * pr, VH * pr);
  fbA.setSize(VW * pr, VH * pr);
  fbB.setSize(VW * pr, VH * pr);
  for (const cam of [camA, camB]) {
    cam.left = -VW / 2; cam.right = VW / 2;
    cam.top = VH / 2; cam.bottom = -VH / 2;
    cam.updateProjectionMatrix();
  }
  lensQuad.scale.set(VW, VH, 1);
  slides.forEach(s => { s.mesh.scale.set(VW, VH, 1); s.fit(); });
  if (caseTrack) relayoutCase();
  spacer.style.height = detailOpen && caseTrack
    ? (CASE_LOOPS * caseTrack.trackH) + 'px'
    : (LOOPS * cycleH()) + 'px';
  // the loop's unit is the viewport height, so a height change (a phone's address bar
  // folding away on the first drag) used to move the scroll onto a different project —
  // the blip. Keep the same place in the loop by scaling the scroll with the height (V.52).
  if (oldVH && h !== oldVH && !(detailOpen && caseTrack)) {
    const r = h / oldVH, y = window.scrollY * r;
    window.scrollTo(0, y);
    smooth *= r; lastSmooth = smooth; prevY = y; userVel = 0;
  }
}
layout();
window.addEventListener('resize', layout);
// land on a different project each visit (V.46): the loop is seamless, so any
// start is as good as the first. ?start=<n> pins one for checks.
const START = (() => { if (window.__start != null && PROJECTS[window.__start]) return window.__start;   // chosen by the opening, cover already on its way
  const q = new URLSearchParams(location.search).get('start');
  return q != null && PROJECTS[+q] ? +q : Math.floor(Math.random() * PROJECTS.length); })();
window.scrollTo(0, Math.floor(LOOPS / 2) * cycleH() + START * VH);
// load the covers nearest the landing first, then outward both ways round the loop
{ const n = PROJECTS.length;
  const ring = (from, to) => { for (let d = from; d <= to; d++) for (const i of d ? [(START + d) % n, (START - d + n) % n] : [START]) {
    if (i < 0 || i >= n || slides[i].queued || !PROJECTS[i].image) continue;
    slides[i].queued = true; queueLoad(PROJECTS[i].image, slides[i]);
  } };
  ring(0, 1);   // the landing cover and its two neighbours, now
  (window.__intro || Promise.resolve()).then(() => setTimeout(() => ring(2, Math.ceil(n / 2)), COARSE ? 1500 : 300));   // the rest, after the opening has settled
}

let smooth = window.scrollY, lastSmooth = smooth, scrollDif = 0;
// velocity that drives the distortion is computed from USER scroll only —
// the auto-drift is subtracted out (see frame loop), so auto-playing
// pages show clean, undistorted crops while manual scrolling still warps.
let prevY = window.scrollY, userVel = 0;

function rebase() {
  if (scrollAnim) return;    // don't teleport mid-glide
  const inCase = detailOpen && caseTrack;
  const cyc = inCase ? caseTrack.trackH : cycleH();
  const loops = inCase ? CASE_LOOPS : LOOPS;
  const y = window.scrollY, total = loops * cyc;
  if (y < cyc || y > total - cyc - VH) {
    const mid = Math.floor(loops / 2) * cyc + (y % cyc);
    window.scrollTo(0, mid);
    smooth += mid - y; lastSmooth += mid - y;
    prevY += mid - y;   // keep user-velocity continuous across the wrap
  }
}
window.addEventListener('scroll', rebase, { passive: true });

// eased scroll glide — used for riding the case track between projects
let scrollAnim = null;
function animateScrollTo(targetY, ms) {
  const from = window.scrollY, t0 = performance.now();
  scrollAnim = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // cubic inOut
    window.scrollTo(0, from + (targetY - from) * e);
    if (k >= 1) { scrollAnim = null; rebase(); }
  };
}

function currentIndex() {
  const n = PROJECTS.length;
  return ((Math.round(smooth / VH) % n) + n) % n;
}


/* ── auto-scroll: drift on load, yield to the visitor, resume on idle ── */
const auto = { active: false, acc: 0, idleTimer: null };

/* the IAAH square is a visible metronome: it turns proportional to the TOTAL
   scroll movement (auto-drift + manual), so it spins steadily while the page
   auto-plays and quickly on a fast scroll. Clicking it pauses that motion. */
const METRO_DEG_PER_PX = 0.6;
const METRO_CASE_SCALE = 0.35;  // project pages cover big pixel distances — calmer rate
const METRO_MAX_DPS = 300;      // hard °/s cap so a fast flick can't whip the square
let metroDeg = 0, metroPaused = false;

function startAuto() {
  // drifts on the home loop AND inside sub-pages (case track)
  if (metroPaused) return;            // square is manually paused — stay still
  if (SETTINGS.autoScroll) auto.active = true;
}
function stopAuto(resumable = true) {
  auto.active = false;
  auto.acc = 0;
  clearTimeout(auto.idleTimer);
  if (resumable && SETTINGS.autoScroll && SETTINGS.autoResume > 0) {
    auto.idleTimer = setTimeout(startAuto, SETTINGS.autoResume * 1000);
  }
}
// the mark's own turn, on demand (the write-up opening): a quarter further, 1.5 s,
// the one ease — then the scroll-driven rotation carries on from there.
function turnMetro(deg = 90, ms = 1500) {
  const from = metroDeg, to = metroDeg + deg;
  metroDeg = ((to % 360) + 360) % 360;
  const a = metroSq.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }],
    { duration: ms, easing: 'cubic-bezier(.65,0,.35,1)' });
  a.onfinish = () => { metroSq.style.transform = 'rotate(' + metroDeg.toFixed(2) + 'deg)'; };
}

/* ── the write-up: a white sheet that grows out of the mark (js/about.js) ──
   click the mark (or About) to open; the mark, Esc or Close to close. The
   drift pauses while it is up and resumes after. ?about=square|circle|wipe|turn|scrim */
const QS = new URLSearchParams(location.search);
const about = initAbout({
  host: document.querySelector('.overlay'),
  mark: metroEl,
  variant: QS.get('about') || 'wipe',      // how the sheet comes in — the drop from the top, on a spring (Ness, V.50)
  exit: QS.get('out') || 'fade',           // how it goes out (?out=reverse|fade|lift|sweep|turn) — fade, Ness's pick
  drop: QS.get('drop') || 'soft',          // the drop's tempo (?drop=quick|soft|slow|slower) — soft, ω8 over 1.5 s
  onOpen: () => { stopAuto(false); document.body.style.overflow = 'hidden'; document.body.classList.add('about-open'); turnMetro(90); },
  onClose: () => { document.body.style.overflow = ''; document.body.classList.remove('about-open'); turnMetro(90, 900); stopAuto(true); },
});
// the mark: the write-up on the landing and inside a project; on the Works bed it is the way home
metroEl.addEventListener('click', () => { if (worksBedOpen()) worksBed.close(); else about.toggle(); });

for (const ev of ['wheel', 'touchstart']) {
  window.addEventListener(ev, () => { casePinTop = false; stopAuto(); }, { passive: true });
}
window.addEventListener('keydown', (e) => {
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) {
    casePinTop = false;   // visitor took the wheel — stop holding the top
    stopAuto();
  }
});

/* ── tweens (svelte-tweened equivalents) ───────────────────────────── */
const state = { displacement: 0, opacity: 0, saturation: 1 };
const tweens = {};
function tween(key, to, ms) {
  const from = state[key], t0 = performance.now();
  tweens[key] = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3); // cubicOut
    state[key] = from + (to - from) * e;
    return k < 1;
  };
}
// intro, matching the reference: fade 1.5s, lens in over 2s — once the opening
// (js/intro.js, the square) lets the work arrive
(window.__intro || Promise.resolve()).then(() => {
  tween('opacity', 1, 1500);
  tween('displacement', 1, 2000);
  setTimeout(startAuto, 2500); // let the intro tweens land first
});

/* ── lens button ───────────────────────────────────────────────────── */
const ui = { lens: true, ghost: false };

function setLens(on, fast = false) {
  ui.lens = on;
  // reference timings: 0 in 100ms entering detail, 1 over 2s going home
  tween('displacement', on ? 1 : 0, on && !fast ? 2000 : 100);
  lensBtn.textContent = `Lens: ${on ? 'on' : 'off'}`;
}
lensBtn.addEventListener('click', () => setLens(!ui.lens));

/* ── ambient audio (user gesture required by browser policy) ───────── */
const audio = createAudioEngine(SETTINGS);
const soundBtn = document.getElementById('sound-btn');
let soundRunning = false, soundChosen = false;   // chosen = the visitor pressed the word themselves
soundBtn.addEventListener('click', () => {
  soundChosen = true;
  soundRunning = audio.toggle();
  soundBtn.classList.toggle('on', soundRunning);
});
// sound is on by default (V.48): the browser only lets it start on a gesture, so
// the first tap, click or key anywhere starts it — unless the visitor chose otherwise
function soundAtFirstTouch() {
  if (soundChosen || soundRunning) return;
  soundRunning = audio.toggle();
  soundBtn.classList.toggle('on', soundRunning);
}
addEventListener('pointerdown', soundAtFirstTouch, { once: true, capture: true });
addEventListener('keydown', soundAtFirstTouch, { once: true, capture: true });

/* ── global nav: the Works bed ─────────────────────────────────────── */
function worksBedOpen() { return typeof worksBed !== 'undefined' && worksBed.isOpen(); }
// the primary lens-scroll stays the landing; Works zooms out to an infinite
// lens-warped bed of every cover (js/worksbed.js). Click a cover to dive in.
const worksBed = initWorksBed({
  container: document.getElementById('works-bed'),
  projects: PROJECTS,
  onEnter: (i) => diveToProject(i),
  isPlaying: () => !metroPaused,        // the square's tempo conducts the drift
  label: (t) => titleCase(t),           // the bed's captions in sentence case, like the title word
});
document.getElementById('works-btn').addEventListener('click', () => {
  if (about.isOpen()) about.close();
  if (worksBed.isOpen()) worksBed.close();
  else worksBed.open(detailOpen ? detailIdx : currentIndex());
});

// dive into the project currently in view, straight from the landing
const viewBtn = document.getElementById('view-btn');
const glEl = document.getElementById('gl');
glEl.style.cursor = 'pointer';   // on the landing the cover is clickable — show it
function diveFromLanding() {
  if (transitioning || detailOpen || worksBed.isOpen() || about.isOpen()) return;
  const i = currentIndex();
  stopAuto(false);
  // symmetric with closing out: fade THROUGH BLACK (masks the scene swap so it
  // feels fluid), and bloom the project out of the lens as it fades up. the
  // resolve outlasts the fade (like the exit's 2s bloom) so the tunnel opens
  // gently instead of snapping flat.
  fadeSwap(() => {
    mountCase(i);
    delete tweens.displacement;
    state.displacement = 1;            // project starts fully lensed...
    ui.lens = true; lensBtn.textContent = 'Lens: on';
    tween('displacement', 0, 1800);    // ...then the tunnel opens out to flat
    stopAuto(true);
  }, 220, 1000);
}
viewBtn.addEventListener('click', diveFromLanding);
glEl.addEventListener('click', diveFromLanding);   // tap the cover too

/* route transitions fade through black (the original site's pattern):
   fade out → swap the world while invisible → fade back in. */
let transitioning = false;
function fadeSwap(swapFn, fadeOut = 220, fadeIn = 700) {
  if (transitioning) return;
  transitioning = true;
  tween('opacity', 0, fadeOut);
  setTimeout(() => {
    swapFn();
    tween('opacity', 1, fadeIn);
    setTimeout(() => { transitioning = false; }, fadeIn);
  }, fadeOut + 30);
}

function populateCard(i) {
  const p = PROJECTS[i];
  metaEl.textContent = `${titleCase(p.client)} · ${p.title} · ${p.year}`;
  descEl.textContent = p.description || '';
}

// enter the case track at project i — runs at black, so it's instant
function mountCase(i) {
  detailOpen = true;
  detailIdx = i;
  casePinTop = false;   // armed only after the snap below, so the build re-flow is quiet
  populateCard(i);
  detailEl.hidden = false; detailX.classList.add('show');
  document.body.classList.add('in-project');

  const t = buildCaseTrack(i);   // just this project's images
  slides.forEach(s => s.mesh.visible = false);
  t.items.forEach(it => {
    it.mesh.visible = true;
    if (it.video) it.video.play().catch(() => {});
  });

  relayoutCase();            // ensure heights/tops current for this VW
  const cyc = caseTrack.trackH || VH;
  spacer.style.height = (CASE_LOOPS * cyc) + 'px';
  void spacer.offsetHeight;   // force reflow so the page is actually scrollable to y (mobile)
  // start at the project's first image, top-aligned
  const y = caseTopY();
  window.scrollTo(0, y);
  smooth = y; lastSmooth = y; scrollDif = 0;
  prevY = y; userVel = 0;   // no smear flash from the position jump
  casePinTop = true;        // hold the top through async image re-flows

  // lens off instantly — we're at black, no need to animate it
  delete tweens.displacement;
  state.displacement = 0;
  ui.lens = false;
  lensBtn.textContent = 'Lens: off';
  glEl.style.cursor = 'default';    // inside a project the cover isn't a dive target

  // let the sub-page auto-play too, after a beat
  stopAuto(true);
}

function openProject(i) {
  if (transitioning) return;
  if (detailOpen && i === detailIdx) return;
  stopAuto(false);
  fadeSwap(() => mountCase(i));   // mountCase rebuilds the project's own track
}

// the dive: emerge INTO the project THROUGH the lens (no black cut). the
// project mounts fully lensed, then the tunnel resolves to flat — reads as one
// continuous push-through from the Works bed's zoom-into-cover.
function diveToProject(i) {
  if (transitioning) return;
  transitioning = true;
  mountCase(i);                      // self-contained per-project track
  delete tweens.displacement;
  state.displacement = 1;            // start deep inside the lens
  ui.lens = true; lensBtn.textContent = 'Lens: on';
  tween('displacement', 0, 1000);    // ...then the tunnel opens out to flat
  stopAuto(true);                    // auto-play through the project's images (per-project loop, settles then drifts)
  setTimeout(() => { transitioning = false; }, 1000);
}

function closeDetail() {
  if (transitioning || !detailOpen) return;
  // return home at whichever project is currently in view
  const homeY = Math.floor(LOOPS / 2) * cycleH() + detailIdx * VH;
  fadeSwap(() => {
    detailOpen = false;
    detailIdx = -1;
    detailEl.hidden = true; detailX.classList.remove('show');
    document.body.classList.remove('in-project');

    disposeCaseTrack();
    slides.forEach(s => s.mesh.visible = true);
    glEl.style.cursor = 'pointer';    // back on the landing — cover is clickable again
    spacer.style.height = (LOOPS * cycleH()) + 'px';
    window.scrollTo(0, homeY);
    smooth = homeY; lastSmooth = homeY; scrollDif = 0;
    prevY = homeY; userVel = 0;

    setLens(true);           // lens blooms back during the fade-in
    stopAuto(true);          // schedules the idle resume
  }, 220, 900);
}

detailX.addEventListener('click', closeDetail);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (about.isOpen()) about.close();
    else if (worksBed.isOpen()) worksBed.close();
    else if (detailOpen) closeDetail();
  }
});

// the chrome is sentence case; the scraped client names are shouted
const titleCase = (t) => t.toLowerCase().replace(/(^|[\s(\-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bIaah\b/g, 'IAAH').replace(/\bSqsp\b/g, 'SQSP').replace(/\bWetransfer\b/g, 'WeTransfer')
  .replace(/(?!^)\b(Of|And|The|A|To|In|X)\b/g, (m) => m.toLowerCase());   // small words stay small inside a title
let lastViewIdx = -2;
function updateNav() {
  // the View button names the cover currently in view, on the landing only
  const onHome = !detailOpen && !worksBed.isOpen() && !transitioning;
  viewBtn.hidden = !onHome;
  if (onHome) {
    const i = currentIndex();
    if (i !== lastViewIdx && PROJECTS[i]) { lastViewIdx = i; viewBtn.textContent = titleCase(PROJECTS[i].client); }
  } else { lastViewIdx = -2; }
}

/* ── GUI panel — lil-gui is fetched the first time G is pressed (V.54), not on every visit ── */
let gui = null, guiVisible = false;
const sel = { effect: SETTINGS.effect };
window.addEventListener('keydown', async (e) => {
  if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
    if (!gui) { const { default: GUI } = await import('lil-gui'); buildGui(GUI); }
    guiVisible = !guiVisible;
    guiVisible ? gui.show() : gui.hide();
  }
});
function buildGui(GUI) {
gui = new GUI({ title: 'EFFECTS' });
gui.hide();
gui.add(sel, 'effect', Object.keys(EFFECTS)).name('Pass').onChange(setEffect);
gui.add(ui, 'lens').name('Lens (route demo)').onChange(v => setLens(v));
gui.add(ui, 'ghost').name('Ghost images').onChange(v => {
  slides.forEach(s => s.mat.uniforms.detailMode.value = v ? 0 : 1);
});
gui.add(state, 'saturation', 0, 1, 0.01).name('Saturation');
gui.add(SETTINGS, 'trackBend', 0, 3, 0.05).name('Track bend');
gui.add(SETTINGS, 'smoothLerp', 0.02, 0.3, 0.005).name('Scroll ease');
gui.add(SETTINGS, 'scrollLerp', 0.01, 0.3, 0.005).name('Velocity ease');
gui.add(SETTINGS, 'autoScroll').name('Auto-scroll')
  .onChange(v => v ? startAuto() : stopAuto(false));
gui.add(SETTINGS, 'autoSpeed', 10, 300, 5).name('Auto speed');
gui.add(SETTINGS, 'autoResume', 0, 20, 1).name('Auto-resume (s)');
gui.add(SETTINGS, 'audioVolume', 0, 1, 0.01).name('Volume')
  .onChange(v => audio.setVolume(v));
gui.add(SETTINGS, 'audioWarp', 0, 3, 0.05).name('Audio warp');

const beatFolder = gui.addFolder('Clock beat');
beatFolder.add(SETTINGS, 'beat').name('Beat on');
beatFolder.add(SETTINGS, 'bpm', 20, 240, 1).name('BPM (60 = secs)');
beatFolder.add(SETTINGS, 'beatAmount', 0, 3, 0.05).name('Pulse');
beatFolder.add(SETTINGS, 'beatSharp', 1, 10, 0.5).name('Sharpness');
beatFolder.add(SETTINGS, 'beatStep', 0, 400, 5).name('Tick step (px)');
rebuildParamsFolder();
}

let paramsFolder = null;
function rebuildParamsFolder() {
  if (!gui) return;
  if (paramsFolder) paramsFolder.destroy();
  paramsFolder = gui.addFolder(EFFECTS[activeEffect].name);
  for (const p of EFFECTS[activeEffect].params) {
    paramsFolder
      .add(materials[activeEffect].uniforms[p.key], 'value', p.min, p.max, p.step)
      .name(p.label);
  }
}
setEffect(SETTINGS.effect);

// console handles for scripted control:
//   __setEffect('rgb-echo')   __setParam('smearAmount', 3)
//   __openDetail(2)           __closeDetail()
window.__setEffect = (id) => { sel.effect = id; setEffect(id); };
window.__setParam = (key, v) => {
  const u = materials[activeEffect].uniforms;
  if (u[key]) u[key].value = v;
};
window.__openDetail = openProject;
window.__closeDetail = closeDetail;
window.__about = about;
window.__vh = () => [VW, VH, smooth, window.scrollY];   // for checks: the layout's idea of the viewport and the loop position
window.__layout = layout;
window.__bed = worksBed;
window.__audio = audio;
window.__state = state;
window.__vel = () => userVel;
// render one representative frame on demand (home state) — lets a paused/
// hidden tab still be screenshotted for verification.
window.__snap = (eff) => {
  if (eff) { sel.effect = eff; setEffect(eff); }
  for (const k of Object.keys(tweens)) delete tweens[k];
  state.displacement = 1; state.opacity = 1; state.saturation = 1;
  frame(performance.now());
  return sel.effect;
};

/* ── render loop ───────────────────────────────────────────────────── */
const start = performance.now();
let lastNow = start;
let lastBeatPhase = 0, beatStepRemaining = 0;
function frame(now) {
  // while the Works bed owns the screen, skip the main render entirely — no
  // point driving two WebGL contexts at once (a big win on mobile)
  if (worksBed.isOpen()) { lastNow = now; requestAnimationFrame(frame); return; }
  const dt = Math.min(now - lastNow, 100); // clamp tab-switch gaps
  lastNow = now;

  // ── clock beat (UNIQLOCK tempo) ─────────────────────────────────────
  // a pulse on every beat; at 60 BPM that's one per real clock second.
  const beatPeriod = 60000 / (SETTINGS.bpm || 60);
  const beatPhase = (Date.now() % beatPeriod) / beatPeriod;  // 0..1 each beat
  const newBeat = beatPhase < lastBeatPhase;                 // wrapped → a tick
  lastBeatPhase = beatPhase;
  const beatEnv = Math.pow(1 - beatPhase, SETTINGS.beatSharp || 4); // spike at tick
  const beat = SETTINGS.beat ? beatEnv * (SETTINGS.beatAmount ?? 1) : 0;

  for (const k of Object.keys(tweens)) {
    if (!tweens[k](now)) delete tweens[k];
  }
  if (scrollAnim) scrollAnim(now);

  // auto-advance: either a smooth drift, or — in beat mode — a tick that
  // steps the filmstrip forward in time with the seconds (eased out).
  let autoWhole = 0;
  if (auto.active && !scrollAnim) {
    if (SETTINGS.beat && SETTINGS.beatStep > 0) {
      if (newBeat) beatStepRemaining = SETTINGS.beatStep;
      if (beatStepRemaining > 0.5) {
        const px = Math.max(1, Math.round(beatStepRemaining * 0.18));
        window.scrollBy(0, px);
        beatStepRemaining -= px;
        autoWhole = px;                 // counted as auto so it doesn't smear
      }
    } else {
      auto.acc += SETTINGS.autoSpeed * dt / 1000;
      autoWhole = Math.trunc(auto.acc);
      if (autoWhole !== 0) { casePinTop = false; window.scrollBy(0, autoWhole); auto.acc -= autoWhole; }
    }
  }

  // slide positions follow the TOTAL scroll (auto + user + glide).
  // touch: lock to the real scroll (no lag, no direction-reversal blip,
  // and rebase teleports stay perfectly seamless). desktop: weighted glide.
  if (IS_TOUCH) smooth = window.scrollY;
  else smooth += (window.scrollY - smooth) * SETTINGS.smoothLerp;
  lastSmooth = smooth;

  // distortion velocity follows USER scroll only — subtract the auto
  // drift so a drifting page is a clean focused crop, not a warped one
  const curY = window.scrollY;
  const userDelta = (curY - prevY) - autoWhole;
  prevY = curY;
  userVel += (userDelta - userVel) * SETTINGS.scrollLerp;

  // turn the IAAH square with the TOTAL motion (auto-drift + manual scroll).
  // (autoWhole + userDelta == this frame's scroll, rebase-safe via prevY.)
  // inside a project the strip covers big pixel distances, so the rate drops
  // and a °/s cap keeps a fast flick from whipping the square.
  const metroMove = autoWhole + userDelta;
  if (metroMove) {
    const rate = detailOpen ? METRO_DEG_PER_PX * METRO_CASE_SCALE : METRO_DEG_PER_PX;
    const cap = METRO_MAX_DPS * dt / 1000;   // frame-rate independent speed limit
    const step = THREE.MathUtils.clamp(metroMove * rate, -cap, cap);
    metroDeg = (metroDeg + step) % 360;
    metroSq.style.transform = 'rotate(' + metroDeg.toFixed(2) + 'deg)';
  }

  const vel = THREE.MathUtils.clamp(
    userVel, -SETTINGS.maxVelocity, SETTINGS.maxVelocity);

  const ms = now - start;
  if (detailOpen && caseTrack) {
    // one self-contained project — its images loop within their own height
    const cyc = caseTrack.trackH || VH;
    const pos = ((smooth % cyc) + cyc) % cyc;
    caseTrack.items.forEach((it, k) => {
      const center = caseTrack.tops[k] + caseTrack.heights[k] / 2;
      let d = center - pos;
      d = ((d % cyc) + cyc * 1.5) % cyc - cyc / 2; // wrap to nearest copy
      it.mesh.position.y = -d;
      if (it.landed) it.mat.uniforms.opacity.value = Math.min(1, (now - it.landed) / 500);
      it.mat.uniforms.time.value = ms;
      it.mat.uniforms.uVel.value = vel;
      it.mat.uniforms.uBend.value = 0;
    });
    // detailIdx is fixed = caseTrack.proj (single project) — no derivation
  } else {
    const cyc = cycleH();
    const pos = ((smooth % cyc) + cyc) % cyc;
    slides.forEach((s, i) => {
      let d = i * VH - pos;
      d = ((d % cyc) + cyc * 1.5) % cyc - cyc / 2; // wrap to nearest copy
      s.mesh.position.y = -d;
      if (s.landed) s.mat.uniforms.opacity.value = Math.min(1, (now - s.landed) / 500);
      s.mat.uniforms.time.value = ms;
      s.mat.uniforms.uVel.value = vel;
      s.mat.uniforms.uBend.value = SETTINGS.trackBend;
    });
  }

  audio.setWarp(vel, SETTINGS.maxVelocity);

  const u = materials[activeEffect].uniforms;
  u.time.value = ms;
  u.displacement.value = state.displacement;
  u.opacity.value = state.opacity;
  u.saturation.value = state.saturation;
  u.scrollDif.value = vel;
  u.uBeat.value = beat;
  mouseSmooth.lerp(mouseTarget, 0.08);
  u.uMouse.value.copy(mouseSmooth);

  // beat zoom-punch on the output (effect-agnostic — works lens on/off,
  // home or sub-page) + the blinking beat dot.
  camB.zoom = 1 + beat * 0.045;
  camB.updateProjectionMatrix();
  beatDot.style.transform = 'scale(' + (1 + beat * 1.1).toFixed(3) + ')';
  beatDot.style.opacity = SETTINGS.beat ? (0.18 + beat * 0.82).toFixed(3) : '0';

  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(sceneA, camA);

  if (activeEffect === 'feedback') {
    // feed the previous frame back in, render this frame to curFb AND the
    // screen, then swap — building receding tunnels / motion trails.
    u.uFeedback.value = prevFb.texture;
    renderer.setRenderTarget(curFb);
    renderer.clear();
    renderer.render(sceneB, camB);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(sceneB, camB);
    const t = prevFb; prevFb = curFb; curFb = t;
  } else {
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(sceneB, camB);
  }

  updateNav();
  if ((++navTick % NAV_EVERY) === 0) sampleNav();   // straight after the draw (before the buffer goes); a readback stalls the GPU, so rarely on a phone
  requestAnimationFrame(frame);
}

/* ── the nav's colour follows the imagery: read a few pixels of the frame
   just drawn under each word and flip it ink / paper with some hysteresis ── */
const navEls = [...document.querySelectorAll('.nav')];
const navBuf = new Uint8Array(8 * 8 * 4);
let navTick = 0; const NAV_EVERY = COARSE ? 30 : 8;
function sampleNav() {
  const gl = renderer.getContext(), pr = renderer.getPixelRatio();
  const cw = gl.drawingBufferWidth, ch = gl.drawingBufferHeight;
  for (const el of navEls) {
    if (el.hidden) continue;
    const r = el.getBoundingClientRect();
    const x = Math.round((r.left + r.width / 2) * pr) - 4, y = Math.round((VH - (r.top + r.height / 2)) * pr) - 4;
    if (x < 0 || y < 0 || x + 8 > cw || y + 8 > ch) continue;
    gl.readPixels(x, y, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, navBuf);
    let lum = 0;
    for (let k = 0; k < navBuf.length; k += 4) lum += 0.2126 * navBuf[k] + 0.7152 * navBuf[k + 1] + 0.0722 * navBuf[k + 2];
    lum /= (navBuf.length / 4) * 255;
    if (lum > 0.6) el.classList.add('dark'); else if (lum < 0.42) el.classList.remove('dark');
  }
}
requestAnimationFrame(frame);
