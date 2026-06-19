// ═══════════════════════════════════════════════════════════════════
// FOVEA — default content set (loads on the bare URL; also ?set=fovea).
// Imagery: 40 stills from the uniqlock-v2 study grouped into five
// chapters, the nevverland reel as a live video cover, procedural
// ambient pad. (Assets still live under content/uniqlock/ — folder name
// is internal; swap in real work by editing PROJECTS below.)
// ═══════════════════════════════════════════════════════════════════

export const SITE = {
  studio: 'FOVEA',
  tagline: 'Creative Direction & Design',
};

const IMG = (n) => `../content/uniqlock/img/${String(n).padStart(2, '0')}.jpg`;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => IMG(a + k));
const REEL = '../content/uniqlock/reel.mp4';

export const PROJECTS = [
  { client: 'BEATCUT', title: 'Tempo Study', year: 2026,
    image: IMG(0), images: range(0, 7),
    description: 'Cutting to the clock — five-minute music as an editing grid.' },
  { client: 'SWEEP', title: 'Second Hand Suite', year: 2026,
    image: IMG(8), images: range(8, 15),
    description: 'The sweep of a second hand traced through movement and blur.' },
  { client: 'HANDS', title: 'Clockwork Portraits', year: 2026,
    image: IMG(16), images: range(16, 23),
    description: 'Bodies as clock hands — choreography on a twelve-point dial.' },
  { client: 'ZRUSH', title: 'Depth Rush', year: 2026,
    image: IMG(24), images: range(24, 31),
    description: 'Zoom-rush studies: the dial as a tunnel, time as velocity.' },
  { client: 'NEVVERLAND', title: 'Reel', year: 2026,
    image: REEL, images: [REEL, ...range(32, 39)],
    description: 'The nevverland reel — the living clock cut to music, in motion.' },
];

export const SETTINGS = {
  effect: 'lens-tunnel',
  scrollLerp: 0.05,
  smoothLerp: 0.1,
  maxVelocity: 40,

  autoScroll: true,
  autoSpeed: 60,
  autoResume: 2,

  trackBend: 1.0,

  audioSrc: null,        // procedural ambient pad — scroll bends its pitch,
                         // opens the filter, and quickens the sparkles
  audioVolume: 0.5,
  audioWarp: 1.0,

  // ── EXPERIMENT: clock-beat motion (UNIQLOCK tempo) ──────────────────
  // the site pulses with the seconds: a zoom+chroma punch on every beat,
  // the filmstrip ticks forward in time, and a beat dot blinks along.
  beat: false,           // master on/off (clock tick removed by default)
  bpm: 60,               // 60 = one beat per real clock second
  beatAmount: 1.0,       // zoom-pulse intensity
  beatSharp: 4.0,        // pulse attack sharpness (higher = snappier)
  beatStep: 80,          // px the filmstrip ticks forward per beat (0 = smooth drift)
};
