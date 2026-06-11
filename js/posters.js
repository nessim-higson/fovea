// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL PLACEHOLDER IMAGERY
// makePoster(i, project)  — the project's cover (home track)
// makeGallery(i, project) — 5 "case study" shots in the same visual
//                           system (cover, pattern crop, type
//                           specimen, inverted, caption card)
// All replaced by real work when PROJECTS[i].image / .images is set.
// ═══════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const W = 1080, H = 1440;

const PALETTES = [
  { bg: '#0e4d2d', fg: '#eaffd0', accent: '#ff5c38' }, // stripes
  { bg: '#141414', fg: '#ffd23e', accent: '#f5f5f0' }, // rays
  { bg: '#14276b', fg: '#f2f0e9', accent: '#ff4d2e' }, // dots
  { bg: '#5e0f1f', fg: '#f2d8c9', accent: '#ffb03a' }, // checker
  { bg: '#2b2b12', fg: '#d7ff45', accent: '#ffffff' }, // waves
];

/* ── pattern painters ─────────────────────────────────────────────── */
function stripes(x, p) {
  x.fillStyle = p.fg;
  const w = 90;
  x.save();
  x.translate(W / 2, H / 2);
  x.rotate(-Math.PI / 4);
  for (let i = -2200; i < 2200; i += w * 2) x.fillRect(i, -2200, w, 4400);
  x.restore();
}

function rays(x, p) {
  x.fillStyle = p.fg;
  const cx = W / 2, cy = H * 0.42, n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI / n) * 0.55;
    x.beginPath();
    x.moveTo(cx, cy);
    x.arc(cx, cy, 2400, a0, a1);
    x.closePath();
    x.fill();
  }
}

function dots(x, p) {
  x.fillStyle = p.fg;
  const s = 120;
  for (let r = 0; r * s < H + s; r++) {
    for (let c = 0; c * s < W + s; c++) {
      const rad = 16 + 24 * ((r + c) % 4) / 3;
      x.beginPath();
      x.arc(c * s + s / 2 + (r % 2) * (s / 2), r * s + s / 2, rad, 0, Math.PI * 2);
      x.fill();
    }
  }
}

function checker(x, p) {
  x.fillStyle = p.fg;
  const s = 135;
  for (let r = 0; r * s < H; r++) {
    for (let c = 0; c * s < W; c++) {
      if ((r + c) % 2 === 0) x.fillRect(c * s, r * s, s, s);
    }
  }
}

function waves(x, p) {
  x.strokeStyle = p.fg;
  x.lineWidth = 26;
  for (let y = -40; y < H + 80; y += 80) {
    x.beginPath();
    for (let px = 0; px <= W; px += 8) {
      const py = y + Math.sin(px * 0.012 + y * 0.05) * 28;
      px === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  }
}

const PAINTERS = [stripes, rays, dots, checker, waves];

/* ── helpers ──────────────────────────────────────────────────────── */
function sheet() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return { c, x: c.getContext('2d') };
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wrapText(x, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (x.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ── cover poster (home track) ────────────────────────────────────── */
export function makePoster(i, project) {
  const { c, x } = sheet();
  const p = PALETTES[i % PALETTES.length];

  x.fillStyle = p.bg;
  x.fillRect(0, 0, W, H);
  PAINTERS[i % PAINTERS.length](x, p);

  const cy = H * 0.42;
  x.fillStyle = p.bg;
  x.beginPath(); x.arc(W / 2, cy, 300, 0, Math.PI * 2); x.fill();
  x.strokeStyle = p.accent;
  x.lineWidth = 14;
  x.beginPath(); x.arc(W / 2, cy, 300, 0, Math.PI * 2); x.stroke();

  x.fillStyle = p.fg;
  x.textAlign = 'center';
  x.font = '900 230px Helvetica, Arial, sans-serif';
  x.fillText(String(i + 1).padStart(2, '0'), W / 2, cy + 82);

  x.fillStyle = p.bg;
  x.fillRect(0, H * 0.76, W, H * 0.24);
  x.fillStyle = p.accent;
  x.fillRect(0, H * 0.76, W, 8);

  x.fillStyle = p.fg;
  x.font = '700 84px Helvetica, Arial, sans-serif';
  x.fillText(project.client, W / 2, H * 0.855);
  x.font = '400 50px Helvetica, Arial, sans-serif';
  x.fillText(project.title.toUpperCase() + ' — ' + project.year, W / 2, H * 0.915);

  return toTexture(c);
}

/* ── gallery shots ────────────────────────────────────────────────── */
function shotPatternCrop(i) {
  const { c, x } = sheet();
  const p = PALETTES[i % PALETTES.length];
  x.fillStyle = p.bg;
  x.fillRect(0, 0, W, H);

  // zoomed, tilted crop of the project's pattern
  x.save();
  x.translate(W / 2, H / 2);
  x.scale(2.2, 2.2);
  x.rotate(0.3);
  x.translate(-W / 2, -H / 2);
  PAINTERS[i % PAINTERS.length](x, p);
  x.restore();

  // accent corner registration marks
  x.fillStyle = p.accent;
  const m = 48, L = 120, T = 14;
  x.fillRect(m, m, L, T);           x.fillRect(m, m, T, L);
  x.fillRect(W - m - L, m, L, T);   x.fillRect(W - m - T, m, T, L);
  x.fillRect(m, H - m - T, L, T);   x.fillRect(m, H - m - L, T, L);
  x.fillRect(W - m - L, H - m - T, L, T); x.fillRect(W - m - T, H - m - L, T, L);
  return toTexture(c);
}

function shotType(i, project) {
  const { c, x } = sheet();
  const p = PALETTES[i % PALETTES.length];
  x.fillStyle = p.bg;
  x.fillRect(0, 0, W, H);

  // giant title words, stacked
  x.fillStyle = p.fg;
  x.textAlign = 'center';
  x.font = '900 170px Helvetica, Arial, sans-serif';
  const words = project.title.toUpperCase().split(' ');
  const lineH = 190;
  const y0 = H / 2 - ((words.length - 1) * lineH) / 2 + 60;
  words.forEach((w, k) => x.fillText(w, W / 2, y0 + k * lineH));

  x.fillStyle = p.accent;
  x.font = '500 46px Helvetica, Arial, sans-serif';
  x.fillText(`${project.client} — ${project.year}`, W / 2, H - 110);
  return toTexture(c);
}

function shotInverted(i) {
  const { c, x } = sheet();
  const base = PALETTES[i % PALETTES.length];
  const p = { bg: base.fg, fg: base.bg, accent: base.accent };
  x.fillStyle = p.bg;
  x.fillRect(0, 0, W, H);
  PAINTERS[i % PAINTERS.length](x, p);

  // accent frame
  x.strokeStyle = p.accent;
  x.lineWidth = 20;
  x.strokeRect(50, 50, W - 100, H - 100);
  return toTexture(c);
}

function shotCaption(i, project) {
  const { c, x } = sheet();
  const p = PALETTES[i % PALETTES.length];
  x.fillStyle = p.bg;
  x.fillRect(0, 0, W, H);

  x.fillStyle = p.accent;
  x.fillRect(W / 2 - 70, H * 0.36, 140, 10);

  x.fillStyle = p.fg;
  x.textAlign = 'center';
  x.font = '400 48px Helvetica, Arial, sans-serif';
  const lines = wrapText(x, project.description || project.title, W * 0.66);
  const y0 = H * 0.46;
  lines.forEach((l, k) => x.fillText(l, W / 2, y0 + k * 70));

  x.fillStyle = p.fg;
  x.globalAlpha = 0.55;
  x.font = '500 38px Helvetica, Arial, sans-serif';
  x.fillText(`${String(i + 1).padStart(2, '0')} · ${project.client}`, W / 2, H * 0.66);
  x.globalAlpha = 1;
  return toTexture(c);
}

export function makeGallery(i, project) {
  return [
    makePoster(i, project),
    shotPatternCrop(i),
    shotType(i, project),
    shotInverted(i),
    shotCaption(i, project),
  ];
}
