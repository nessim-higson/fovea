// ═══════════════════════════════════════════════════════════════════
// ABOUT — the write-up on a sheet of paper that comes in from the mark.
// Ported from tempo study B1 (Grow): the mark's own square grows until it
// is the screen and the write-up sets on it, ink on paper. Five ways in
// (GROWS) and five ways out (EXITS); the close runs at .6 of the open.
// One ease: cubic-bezier(.65,0,.35,1).
//
// initAbout({ host, mark, variant, exit, onOpen, onClose }) builds the
// sheet into `host` (under the mark in DOM order, so the mark stays on
// top) and measures `mark` by its offsets, so the same module runs the
// comps frames.
// ═══════════════════════════════════════════════════════════════════

export const ABOUT = {
  // the studio write-up from iaah.work, verbatim, as one paragraph — set as tempo study B1 sets it (Ness, 5 Nov 2026)
  lines: [
    'Realization often comes in the most unexpected ways. We are an independent design studio focused on branding, visual identity, creative direction, print, title sequences, animation, interactive, etc. We have developed a network of creatives that span a variety of disciplines in which we partner to meet the specific needs of any project. Intentionally small, truly global with an intent to create the highest level of excellence in our work.',
  ],
  mail: 'ness@iamalwayshungry.com',
  instagram: 'nessimhigson',
};

export const GROWS = ['square', 'circle', 'wipe', 'turn', 'scrim'];
export const EXITS = ['reverse', 'fade', 'lift', 'sweep', 'turn'];
const EASE = 'cubic-bezier(.65,0,.35,1)';

export function initAbout({ host, mark, variant = 'square', exit = 'reverse', onOpen, onClose }) {
  if (!GROWS.includes(variant)) variant = 'square';
  if (!EXITS.includes(exit)) exit = 'reverse';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const root = el('div', 'about');
  const sheet = el('div', 'about-sheet');
  const info = el('div', 'about-info');
  ABOUT.lines.forEach(t => info.appendChild(el('p', 'ln', t)));
  const ct = el('p', 'ln ct');
  ct.append('Contact: '); const m = el('a', '', ABOUT.mail); m.href = 'mailto:' + ABOUT.mail; ct.appendChild(m);
  ct.appendChild(el('br'));
  ct.append('Instagram: '); const ig = el('a', '', '@' + ABOUT.instagram); ig.href = 'https://www.instagram.com/' + ABOUT.instagram + '/'; ig.target = '_blank'; ig.rel = 'noopener'; ct.appendChild(ig);
  info.appendChild(ct);
  const x = el('button', 'about-x', 'Close'); x.setAttribute('aria-label', 'Close the write-up');
  root.appendChild(sheet); root.appendChild(info); root.appendChild(x);
  host.insertBefore(root, host.firstChild);

  let open = false, anims = [];
  const anim = (e, kf, o) => { const a = e.animate(kf, o); anims.push(a); return a; };
  const cancel = () => { anims.forEach(a => a.cancel()); anims = []; };

  // geometry: the host's box and the mark inside it (offsets, so a turned mark measures square)
  function geo() {
    const w = host.clientWidth, h = host.clientHeight;
    const ms = mark.offsetWidth, mx = mark.offsetLeft, my = mark.offsetTop;
    const side = Math.max(w, h), diag = Math.hypot(w, h) + 2;
    return { w, h, ms, mx, my, cx: w / 2, cy: h / 2, side, diag, mcx: mx + ms / 2, mcy: my + ms / 2 };
  }
  // the sheet's rest and cover states per way in
  function states() {
    const g = geo();
    sheet.classList.toggle('full', variant === 'circle' || variant === 'wipe' || variant === 'scrim');
    if (variant === 'square') {
      sheet.style.width = sheet.style.height = g.ms + 'px'; sheet.style.transformOrigin = '0 0';
      return { from: { transform: `translate(${g.mx}px,${g.my}px) scale(1)` },
               to:   { transform: `translate(${g.cx - g.side / 2}px,${g.cy - g.side / 2}px) scale(${g.side / g.ms})` }, ms: 1100 };
    }
    if (variant === 'turn') {
      sheet.style.width = sheet.style.height = g.ms + 'px'; sheet.style.transformOrigin = 'center';
      return { from: { transform: `translate(${g.mx}px,${g.my}px) rotate(0deg) scale(1)` },
               to:   { transform: `translate(${g.cx - g.ms / 2}px,${g.cy - g.ms / 2}px) rotate(90deg) scale(${g.diag / g.ms})` }, ms: 1300 };
    }
    if (variant === 'circle') {
      const R = Math.hypot(Math.max(g.mcx, g.w - g.mcx), Math.max(g.mcy, g.h - g.mcy)) + 2;
      return { from: { clipPath: `circle(${g.ms / 2}px at ${g.mcx}px ${g.mcy}px)` },
               to:   { clipPath: `circle(${R}px at ${g.mcx}px ${g.mcy}px)` }, ms: 1000 };
    }
    if (variant === 'wipe') {
      return { from: { clipPath: 'inset(0 0 100% 0)' }, to: { clipPath: 'inset(0 0 0 0)' }, ms: 900 };
    }
    return { from: { opacity: 0 }, to: { opacity: 1 }, ms: 800 };   // scrim
  }
  function rest() {
    const s = states();
    sheet.style.transform = s.from.transform || ''; sheet.style.clipPath = s.from.clipPath || '';
    sheet.style.opacity = variant === 'scrim' ? 0 : '';
    root.style.transform = ''; root.style.opacity = ''; root.style.clipPath = ''; root.style.transformOrigin = '';
    sheet.style.visibility = 'hidden';   // at rest nothing shows: the square's own turn would reveal a level paper square behind it
  }
  rest();

  function rise(at) {
    info.querySelectorAll('.ln').forEach((l, k) => {
      l.style.opacity = 0;
      anim(l, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 700, delay: at + k * 80, easing: EASE, fill: 'forwards' });
    });
  }
  function fall(ms) {
    info.querySelectorAll('.ln').forEach(l => anim(l, [{ opacity: 1 }, { opacity: 0 }], { duration: ms || 250, easing: 'ease-out', fill: 'forwards' }));
  }

  function show(instant) {
    if (open) return; open = true; cancel();
    const s = states();
    rest();   // a close may have left the root moved
    sheet.style.visibility = '';
    root.classList.add('on'); host.classList.add('about-open');
    if (instant) {
      Object.assign(sheet.style, s.to); info.querySelectorAll('.ln').forEach(l => { l.style.opacity = 1; });
    } else {
      anim(sheet, [s.from, s.to], { duration: s.ms, easing: EASE, fill: 'forwards' });
      rise(variant === 'scrim' ? 300 : 520);
    }
    if (onOpen) onOpen();
  }

  // the ways out. `reverse` runs the way in backwards on the sheet; the others
  // take the whole page (sheet and type together) off, from wherever it is.
  function leave() {
    const s = states(), g = geo(), D = Math.round(s.ms * .6);
    if (exit === 'reverse') {
      fall();
      return anim(sheet, [s.to, s.from], { duration: D, delay: 100, easing: EASE, fill: 'forwards' });
    }
    Object.assign(sheet.style, s.to);   // hold the sheet at cover while the root leaves
    if (exit === 'fade') {
      fall(200);
      return anim(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 120, easing: 'ease-out', fill: 'forwards' });
    }
    if (exit === 'lift') {
      return anim(root, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: 660, easing: EASE, fill: 'forwards' });
    }
    if (exit === 'sweep') {
      return anim(root, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }], { duration: 660, easing: EASE, fill: 'forwards' });
    }
    // turn: the sheet turns a quarter back and shrinks into the mark, the type falling first
    fall(200);
    root.style.transformOrigin = `${g.mcx}px ${g.mcy}px`;
    return anim(root, [
      { transform: 'rotate(0deg) scale(1)', opacity: 1, offset: 0 },
      { opacity: 1, offset: .7 },
      { transform: `rotate(-90deg) scale(${g.ms / g.side})`, opacity: 0, offset: 1 },
    ], { duration: 780, delay: 100, easing: EASE, fill: 'forwards' });
  }
  function hide() {
    if (!open) return; open = false; cancel();
    root.classList.remove('on'); host.classList.remove('about-open');
    const a = leave();
    a.onfinish = () => { if (!open) { cancel(); rest(); } };
    if (onClose) onClose();
  }
  x.addEventListener('click', hide);
  addEventListener('resize', () => { if (!open) rest(); });

  return { open: show, close: hide, toggle: () => (open ? hide() : show()), isOpen: () => open, variant, exit, el: root };
}
