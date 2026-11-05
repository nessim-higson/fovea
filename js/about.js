// ═══════════════════════════════════════════════════════════════════
// ABOUT — the write-up on a white sheet that comes in from the mark.
// Ported from tempo study B1 (Grow): the mark's own square grows until it
// is the screen and the write-up sets on it, ink on paper; the close is the
// open run backwards at .6 of the time. Five ways in (GROWS): square,
// circle, wipe, turn, scrim. One ease: cubic-bezier(.65,0,.35,1).
//
// initAbout({ host, mark, variant, onOpen, onClose }) builds the sheet
// into `host` (under the mark in DOM order, so the mark stays on top) and
// measures `mark` by its offsets, so the same module runs the comps frames.
// ═══════════════════════════════════════════════════════════════════

export const ABOUT = {
  // the studio write-up from iaah.work, verbatim; only the returns are new
  lines: [
    'Realization often comes in the most unexpected ways.',
    'We are an independent design studio focused on branding, visual identity, creative direction, print, title sequences, animation, interactive, etc.',
    'We have developed a network of creatives that span a variety of disciplines in which we partner to meet the specific needs of any project.',
    'Intentionally small, truly global with an intent to create the highest level of excellence in our work.',
  ],
  mail: 'ness@iamalwayshungry.com',
  instagram: 'iamalwayshungry',
};

export const GROWS = ['square', 'circle', 'wipe', 'turn', 'scrim'];
const EASE = 'cubic-bezier(.65,0,.35,1)';

export function initAbout({ host, mark, variant = 'square', onOpen, onClose }) {
  if (!GROWS.includes(variant)) variant = 'square';
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
  // the sheet's rest and cover states per variant
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
  }
  rest();

  function rise(at) {
    info.querySelectorAll('.ln').forEach((l, k) => {
      l.style.opacity = 0;
      anim(l, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 700, delay: at + k * 80, easing: EASE, fill: 'forwards' });
    });
  }
  function fall() {
    info.querySelectorAll('.ln').forEach(l => anim(l, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-out', fill: 'forwards' }));
  }

  function show(instant) {
    if (open) return; open = true; cancel();
    const s = states();
    root.classList.add('on'); host.classList.add('about-open');
    if (instant) {
      Object.assign(sheet.style, s.to); info.querySelectorAll('.ln').forEach(l => { l.style.opacity = 1; });
    } else {
      anim(sheet, [s.from, s.to], { duration: s.ms, easing: EASE, fill: 'forwards' });
      rise(variant === 'scrim' ? 300 : 520);
    }
    if (onOpen) onOpen();
  }
  function hide() {
    if (!open) return; open = false; cancel();
    const s = states();
    root.classList.remove('on'); host.classList.remove('about-open');
    fall();
    const a = anim(sheet, [s.to, s.from], { duration: Math.round(s.ms * .6), delay: 100, easing: EASE, fill: 'forwards' });
    a.onfinish = () => { if (!open) { cancel(); rest(); } };
    if (onClose) onClose();
  }
  x.addEventListener('click', hide);
  addEventListener('resize', () => { if (!open) rest(); });

  return { open: show, close: hide, toggle: () => (open ? hide() : show()), isOpen: () => open, variant, el: root };
}
