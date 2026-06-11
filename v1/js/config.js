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
  { client: 'ACME',      title: 'Brand System',    year: 2025, image: null },
  { client: 'HELIOS',    title: 'Launch Campaign', year: 2025, image: null },
  { client: 'NORTHSTAR', title: 'Site Redesign',   year: 2024, image: null },
  { client: 'MARU',      title: 'Editorial',       year: 2024, image: null },
  { client: 'FORMA',     title: 'Film Direction',  year: 2023, image: null },
];

// Global motion settings (all live-tweakable from the G panel too).
export const SETTINGS = {
  effect: 'lens-tunnel', // starting pass — see js/effects.js
  scrollLerp: 0.05,      // velocity smoothing (recovered from reference site)
  smoothLerp: 0.1,       // scroll position smoothing
  maxVelocity: 40,       // clamp on scroll velocity fed to shaders
};
