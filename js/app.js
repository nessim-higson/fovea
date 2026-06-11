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
import GUI from 'lil-gui';
import { SITE, PROJECTS, SETTINGS } from './config.js';
import { makePoster, makeGallery } from './posters.js';
import { EFFECTS, VERTEX } from './effects.js';
import { createAudioEngine } from './audio.js';

/* ── DOM ───────────────────────────────────────────────────────────── */
document.getElementById('pill').innerHTML =
  `<b>${SITE.studio}</b><br>${SITE.tagline}`;
const lensBtn  = document.getElementById('lens-btn');
const spacer   = document.getElementById('spacer');
const navEl    = document.getElementById('projnav');
const detailEl = document.getElementById('detail');
const detailX  = document.getElementById('detail-x');
const metaEl   = document.getElementById('detail-meta');
const descEl   = document.getElementById('detail-desc');

// detail mode state (declared early — layout() runs at module load)
let detailOpen = false;
let detailIdx = -1;

/* ── renderer + scenes ─────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('gl'), antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

let VW = window.innerWidth, VH = window.innerHeight;

const camA = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const camB = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camA.position.z = 10; camB.position.z = 10;

const sceneA = new THREE.Scene();
sceneA.background = new THREE.Color(0x000000);
const sceneB = new THREE.Scene();

const rt = new THREE.WebGLRenderTarget(
  VW * renderer.getPixelRatio(), VH * renderer.getPixelRatio());

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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    float grain = hash(vUv + fract(sin(vec2(time, time * 1.3)) * 100.0));
    vec4 outColor = texture2D(map, vUv);
    float avg = (outColor.r + outColor.g + outColor.b) / 3.0;
    outColor.rgb = outColor.rgb * detailMode
                 + vec3((1.0 - detailMode) * avg * (grain * 5.5 * (1.0 - avg)));
    gl_FragColor = vec4(outColor.rgb, outColor.a * opacity);
  }
`;

const planeGeo = new THREE.PlaneGeometry(1, 1, 32, 32);
const slides = PROJECTS.map((p, i) => {
  const mat = new THREE.ShaderMaterial({
    vertexShader: slideVert,
    fragmentShader: imageFrag,
    uniforms: {
      map:        { value: makePoster(i, p) },
      time:       { value: 0 },
      detailMode: { value: 1 },
      opacity:    { value: 1 },
      uVel:       { value: 0 },
      uBend:      { value: SETTINGS.trackBend },
    },
  });
  const mesh = new THREE.Mesh(planeGeo, mat);
  sceneA.add(mesh);
  const slide = { mesh, mat, imgW: 1080, imgH: 1440 };
  if (p.image) {
    new THREE.TextureLoader().setCrossOrigin('anonymous').load(p.image, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      mat.uniforms.map.value = t;
      slide.imgW = t.image.naturalWidth;
      slide.imgH = t.image.naturalHeight;
      fitCover(slide);
    });
  }
  return slide;
});

// cover-fit a texture to the viewport-sized plane via UV transform
function fitCover(slide) {
  const tex = slide.mat.uniforms.map.value;
  const s = Math.max(VW / slide.imgW, VH / slide.imgH);
  const visW = VW / (slide.imgW * s);
  const visH = VH / (slide.imgH * s);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(visW, visH);
  tex.offset.set((1 - visW) / 2, (1 - visH) / 2);
}

/* ── project galleries (detail mode) ───────────────────────────────
   Each project's detail view is a long scroll of full-bleed images.
   Placeholder galleries come from makeGallery(); a real project can
   set PROJECTS[i].images = ['url', ...] instead.
*/
const galleries = {}; // index -> { items: [{mesh, mat, imgW, imgH}] }

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
    },
  });
}

function buildGallery(i) {
  if (galleries[i]) return galleries[i];
  const project = PROJECTS[i];
  const sources = (project.images && project.images.length)
    ? project.images
    : makeGallery(i, project);

  const items = sources.map((src) => {
    const isUrl = typeof src === 'string';
    const mat = makeSlideMaterial(isUrl ? makePoster(i, project) : src);
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.visible = false;
    sceneA.add(mesh);
    const item = { mesh, mat, imgW: 1080, imgH: 1440 };
    if (isUrl) {
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(src, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        mat.uniforms.map.value = t;
        item.imgW = t.image.naturalWidth;
        item.imgH = t.image.naturalHeight;
        fitCover(item);
      });
    }
    mesh.scale.set(VW, VH, 1);
    fitCover(item);
    return item;
  });

  galleries[i] = { items };
  return galleries[i];
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

function layout() {
  VW = window.innerWidth; VH = window.innerHeight;
  renderer.setSize(VW, VH);
  rt.setSize(VW * renderer.getPixelRatio(), VH * renderer.getPixelRatio());
  for (const cam of [camA, camB]) {
    cam.left = -VW / 2; cam.right = VW / 2;
    cam.top = VH / 2; cam.bottom = -VH / 2;
    cam.updateProjectionMatrix();
  }
  lensQuad.scale.set(VW, VH, 1);
  slides.forEach(s => { s.mesh.scale.set(VW, VH, 1); fitCover(s); });
  Object.values(galleries).forEach(g =>
    g.items.forEach(it => { it.mesh.scale.set(VW, VH, 1); fitCover(it); }));
  spacer.style.height = detailOpen && galleries[detailIdx]
    ? (galleries[detailIdx].items.length * VH) + 'px'
    : (LOOPS * cycleH()) + 'px';
}
layout();
window.addEventListener('resize', layout);
window.scrollTo(0, Math.floor(LOOPS / 2) * cycleH());

let smooth = window.scrollY, lastSmooth = smooth, scrollDif = 0;

function rebase() {
  if (detailOpen) return;    // gallery scroll is finite, no looping
  const y = window.scrollY, total = LOOPS * cycleH(), cyc = cycleH();
  if (y < cyc || y > total - cyc - VH) {
    const mid = Math.floor(LOOPS / 2) * cyc + (y % cyc);
    window.scrollTo(0, mid);
    smooth += mid - y; lastSmooth += mid - y;
  }
}
window.addEventListener('scroll', rebase, { passive: true });

function currentIndex() {
  const n = PROJECTS.length;
  return ((Math.round(smooth / VH) % n) + n) % n;
}


/* ── auto-scroll: drift on load, yield to the visitor, resume on idle ── */
const auto = { active: false, acc: 0, idleTimer: null };

function startAuto() {
  if (SETTINGS.autoScroll && !detailOpen) auto.active = true;
}
function stopAuto(resumable = true) {
  auto.active = false;
  auto.acc = 0;
  clearTimeout(auto.idleTimer);
  if (resumable && SETTINGS.autoScroll && SETTINGS.autoResume > 0) {
    auto.idleTimer = setTimeout(startAuto, SETTINGS.autoResume * 1000);
  }
}
setTimeout(startAuto, 2500); // let the intro tweens land first

for (const ev of ['wheel', 'touchstart']) {
  window.addEventListener(ev, () => stopAuto(), { passive: true });
}
window.addEventListener('keydown', (e) => {
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) {
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
// intro, matching the reference: fade 1.5s, lens in over 2s
tween('opacity', 1, 1500);
tween('displacement', 1, 2000);

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
soundBtn.addEventListener('click', () => {
  const on = audio.toggle();
  soundBtn.textContent = `Sound: ${on ? 'on' : 'off'}`;
  soundBtn.classList.toggle('on', on);
});

/* ── project nav + detail mode ─────────────────────────────────────── */
const navBtns = PROJECTS.map((p, i) => {
  const b = document.createElement('button');
  b.textContent = p.client;
  b.addEventListener('click', () => openProject(i));
  navEl.appendChild(b);
  return b;
});

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

let homeScrollY = 0;

// swap to project i's gallery — runs at black, so everything is instant
function mountGallery(i) {
  detailOpen = true;
  detailIdx = i;
  const p = PROJECTS[i];
  metaEl.textContent =
    `${String(i + 1).padStart(2, '0')} · ${p.client} — ${p.title} · ${p.year}`;
  descEl.textContent = p.description || '';
  detailEl.hidden = false;

  const g = buildGallery(i);
  slides.forEach(s => s.mesh.visible = false);
  Object.values(galleries).forEach(gg => gg.items.forEach(it => it.mesh.visible = false));
  g.items.forEach(it => it.mesh.visible = true);

  // closing later returns home AT this project
  homeScrollY = Math.floor(LOOPS / 2) * cycleH() + i * VH;
  spacer.style.height = (g.items.length * VH) + 'px';
  window.scrollTo(0, 0);
  smooth = 0; lastSmooth = 0; scrollDif = 0;

  // lens off instantly — we're at black, no need to animate it
  delete tweens.displacement;
  state.displacement = 0;
  ui.lens = false;
  lensBtn.textContent = 'Lens: off';
}

function openProject(i) {
  if (transitioning) return;
  if (detailOpen && i === detailIdx) return;
  stopAuto(false);
  fadeSwap(() => mountGallery(i));
}

function closeDetail() {
  if (transitioning || !detailOpen) return;
  fadeSwap(() => {
    detailOpen = false;
    detailIdx = -1;
    detailEl.hidden = true;

    Object.values(galleries).forEach(gg => gg.items.forEach(it => it.mesh.visible = false));
    slides.forEach(s => s.mesh.visible = true);
    spacer.style.height = (LOOPS * cycleH()) + 'px';
    window.scrollTo(0, homeScrollY);
    smooth = homeScrollY; lastSmooth = homeScrollY; scrollDif = 0;

    setLens(true);           // lens blooms back during the fade-in
    stopAuto(true);          // schedules the idle resume
  }, 220, 900);
}

detailX.addEventListener('click', closeDetail);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailOpen) closeDetail();
});

let lastNavIdx = -1;
function updateNav() {
  const idx = detailOpen ? detailIdx : currentIndex();
  if (idx === lastNavIdx) return;
  lastNavIdx = idx;
  navBtns.forEach((b, i) => b.classList.toggle('active', i === idx));
}

/* ── GUI panel ─────────────────────────────────────────────────────── */
const gui = new GUI({ title: 'EFFECTS' });
gui.hide();
let guiVisible = false;
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
    guiVisible = !guiVisible;
    guiVisible ? gui.show() : gui.hide();
  }
});

const sel = { effect: SETTINGS.effect };
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

let paramsFolder = null;
function rebuildParamsFolder() {
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
window.__audio = audio;
window.__state = state;

/* ── render loop ───────────────────────────────────────────────────── */
const start = performance.now();
let lastNow = start;
function frame(now) {
  const dt = Math.min(now - lastNow, 100); // clamp tab-switch gaps
  lastNow = now;

  for (const k of Object.keys(tweens)) {
    if (!tweens[k](now)) delete tweens[k];
  }

  // auto-scroll: accumulate fractional pixels so slow speeds stay smooth
  if (auto.active) {
    auto.acc += SETTINGS.autoSpeed * dt / 1000;
    const whole = Math.trunc(auto.acc);
    if (whole !== 0) { window.scrollBy(0, whole); auto.acc -= whole; }
  }

  smooth += (window.scrollY - smooth) * SETTINGS.smoothLerp;
  scrollDif += ((smooth - lastSmooth) - scrollDif) * SETTINGS.scrollLerp;
  lastSmooth = smooth;

  const vel = THREE.MathUtils.clamp(
    scrollDif, -SETTINGS.maxVelocity, SETTINGS.maxVelocity);

  const ms = now - start;
  if (detailOpen && galleries[detailIdx]) {
    // finite gallery scroll — no wrapping
    galleries[detailIdx].items.forEach((it, k) => {
      it.mesh.position.y = -(k * VH - smooth);
      it.mat.uniforms.time.value = ms;
      it.mat.uniforms.uVel.value = vel;
      it.mat.uniforms.uBend.value = SETTINGS.trackBend;
    });
  } else {
    const cyc = cycleH();
    const pos = ((smooth % cyc) + cyc) % cyc;
    slides.forEach((s, i) => {
      let d = i * VH - pos;
      d = ((d % cyc) + cyc * 1.5) % cyc - cyc / 2; // wrap to nearest copy
      s.mesh.position.y = -d;
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

  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(sceneA, camA);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(sceneB, camB);

  updateNav();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
