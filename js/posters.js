// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL PLACEHOLDER POSTERS
// Each project gets its own pattern + palette so the projects feel
// distinct while navigating and clicking in/out. Replaced by your
// images when PROJECTS[i].image is set.
// ═══════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const PALETTES = [
  { bg: '#0e4d2d', fg: '#eaffd0', accent: '#ff5c38' }, // stripes
  { bg: '#141414', fg: '#ffd23e', accent: '#f5f5f0' }, // rays
  { bg: '#14276b', fg: '#f2f0e9', accent: '#ff4d2e' }, // dots
  { bg: '#5e0f1f', fg: '#f2d8c9', accent: '#ffb03a' }, // checker
  { bg: '#2b2b12', fg: '#d7ff45', accent: '#ffffff' }, // waves
];

/* ── pattern painters ─────────────────────────────────────────────── */
function stripes(x, W, H, p) {
  x.fillStyle = p.fg;
  const w = 90;
  x.save();
  x.translate(W / 2, H / 2);
  x.rotate(-Math.PI / 4);
  for (let i = -2200; i < 2200; i += w * 2) x.fillRect(i, -2200, w, 4400);
  x.restore();
}

function rays(x, W, H, p) {
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

function dots(x, W, H, p) {
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

function checker(x, W, H, p) {
  x.fillStyle = p.fg;
  const s = 135;
  for (let r = 0; r * s < H; r++) {
    for (let c = 0; c * s < W; c++) {
      if ((r + c) % 2 === 0) x.fillRect(c * s, r * s, s, s);
    }
  }
}

function waves(x, W, H, p) {
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

/* ── poster assembly ──────────────────────────────────────────────── */
export function makePoster(i, project) {
  const W = 1080, H = 1440;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const p = PALETTES[i % PALETTES.length];

  // pattern field
  x.fillStyle = p.bg;
  x.fillRect(0, 0, W, H);
  PAINTERS[i % PAINTERS.length](x, W, H, p);

  // center disc + accent ring + number
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

  // bottom plate with type
  x.fillStyle = p.bg;
  x.fillRect(0, H * 0.76, W, H * 0.24);
  x.fillStyle = p.accent;
  x.fillRect(0, H * 0.76, W, 8);

  x.fillStyle = p.fg;
  x.font = '700 84px Helvetica, Arial, sans-serif';
  x.fillText(project.client, W / 2, H * 0.855);
  x.font = '400 50px Helvetica, Arial, sans-serif';
  x.fillText(project.title.toUpperCase() + ' — ' + project.year, W / 2, H * 0.915);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
