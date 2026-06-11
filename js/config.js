// ═══════════════════════════════════════════════════════════════════
// CONFIG — the two things you edit when plugging in real work.
// ═══════════════════════════════════════════════════════════════════

export const SITE = {
  studio: 'STUDIO of [YOUR NAME]',
  tagline: 'Creative Direction & Design',
};

// image: CORS-enabled URL (your CDN / Sanity / Cloudinary), or null for
// a procedural placeholder poster.
export const PROJECTS = [
  { client: 'ACME',      title: 'Brand System',    year: 2025, image: null,
    description: 'Full identity program: marks, type system, motion principles and rollout guidelines.' },
  { client: 'HELIOS',    title: 'Launch Campaign', year: 2025, image: null,
    description: 'Global launch campaign across film, OOH and social — concept to delivery.' },
  { client: 'NORTHSTAR', title: 'Site Redesign',   year: 2024, image: null,
    description: 'Editorial-led web experience with a custom WebGL navigation system.' },
  { client: 'MARU',      title: 'Editorial',       year: 2024, image: null,
    description: 'Art direction and layout system for a quarterly print publication.' },
  { client: 'FORMA',     title: 'Film Direction',  year: 2023, image: null,
    description: 'Direction and grade for a three-part brand film series.' },
];

// Global motion settings (all live-tweakable from the G panel too).
export const SETTINGS = {
  effect: 'lens-tunnel', // starting pass — see js/effects.js
  scrollLerp: 0.05,      // velocity smoothing (recovered from reference site)
  smoothLerp: 0.1,       // scroll position smoothing
  maxVelocity: 40,       // clamp on scroll velocity fed to shaders

  autoScroll: true,      // drift through projects on load
  autoSpeed: 60,         // px/second
  autoResume: 2,         // resume after N idle seconds (0 = never)

  trackBend: 1.0,        // how much the slide track bows with scroll velocity

  audioSrc: null,        // mp3/stream URL for the ambient track, or null
                         // for the procedural pad (no asset needed)
  audioVolume: 0.5,      // 0..1
  audioWarp: 1.0,        // how hard scroll velocity warps the audio
};
