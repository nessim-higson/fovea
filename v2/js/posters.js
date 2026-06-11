// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL PLACEHOLDER POSTERS
// Bold type + a ring on color, so the lens passes have edges to chew
// on. Replaced by your images when PROJECTS[i].image is set.
// ═══════════════════════════════════════════════════════════════════
import * as THREE from 'three';

const PALETTES = [
  ['#0f4d2e', '#e9ffd0'],
  ['#101010', '#f5f5f0'],
  ['#1c2f6b', '#ffd23e'],
  ['#5e0f1f', '#f2d8c9'],
  ['#3a3a14', '#d7ff45'],
];

export function makePoster(i, project) {
  const W = 1080, H = 1440;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const [bg, fg] = PALETTES[i % PALETTES.length];
  x.fillStyle = bg; x.fillRect(0, 0, W, H);

  x.strokeStyle = fg; x.lineWidth = 90;
  x.beginPath(); x.arc(W * 0.5, H * 0.42, 330, 0, Math.PI * 2); x.stroke();

  x.fillStyle = fg;
  x.textAlign = 'center';
  x.font = '900 210px Helvetica, Arial, sans-serif';
  x.fillText(String(i + 1).padStart(2, '0'), W / 2, H * 0.5);
  x.font = '700 84px Helvetica, Arial, sans-serif';
  x.fillText(project.client, W / 2, H * 0.82);
  x.font = '400 52px Helvetica, Arial, sans-serif';
  x.fillText(project.title.toUpperCase() + ' — ' + project.year, W / 2, H * 0.89);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
