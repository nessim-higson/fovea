/* fovea · js/intro.js — the opening, ported from tempo study A1 ("the live site's
   opening on our paper"): a white square fills the screen with IAAH level on it;
   it shrinks over 2 s to the mark's size at the centre as the name slides in
   either side; a 1 s hold (click skips); then it turns 180° and fades a third
   of the way in, the name slides off, and the corner mark fades in as the work
   arrives. One ease for everything: cubic-bezier(.65,0,.35,1).

   A classic script so it starts before the modules (three.js from the CDN)
   land. window.__intro resolves when the work may arrive — app.js waits on it
   before fading the canvas up and starting the drift.
   ?intro=0 skips it · ?intro=bare drops the name. */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);

  try { history.scrollRestoration = 'manual'; } catch (e) {}   /* a reload must not land where the last visit was */
  var resolve, done = new Promise(function (r) { resolve = r; });
  window.__intro = done;
  /* the landing project is chosen here, not in app.js, so its cover (the 1400 px WebP) starts
     downloading now; app.js reads window.__start and finds the file already in the cache */
  try {
    var covers = JSON.parse(document.getElementById('covers').textContent), n = covers.length;
    var st = q.get('start'); st = (st != null && covers[+st]) ? +st : Math.floor(Math.random() * n);
    window.__start = st;
    var pre = new Image(); pre.src = covers[st].replace(/\.jpg$/, '_m.webp');
  } catch (e) {}
  var mode = q.get('intro');
  if (mode === '0' || mode === 'off') { resolve(); return; }

  var EASE = 'cubic-bezier(.65,0,.35,1)';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement, W = innerWidth, H = innerHeight, mobile = W < 760;
  var MS = parseFloat(getComputedStyle(root).getPropertyValue('--ms')) || 56;
  var markWord = document.querySelector('.metro span');
  root.classList.add('intro');

  function el(cls, text) { var e = document.createElement('div'); e.className = cls; if (text != null) e.textContent = text; return e; }
  function anim(e, kf, o) { return e.animate(kf, o); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var layer = el('intro-layer');
  var side = Math.max(W, H), k = MS / side;
  var ld = el('ld');
  ld.style.width = ld.style.height = side + 'px';
  ld.style.left = (W / 2 - side / 2) + 'px'; ld.style.top = (H / 2 - side / 2) + 'px';
  var fin = markWord ? parseFloat(getComputedStyle(markWord).fontSize) : 13, big = mobile ? 25 : W >= 1024 ? 74 : 42, ks = big / fin;
  var ldw = el('ldw', 'IAAH'); ldw.style.fontSize = fin + 'px';
  ldw.style.transform = 'translate(-50%,-50%) scale(' + ks + ')';
  layer.appendChild(ld); layer.appendChild(ldw);
  var nl = null, nr = null;
  if (mode !== 'bare') {
    nl = el('nm l', 'I Am Always'); nr = el('nm r', 'Hungry');
    nl.style.transform = 'translateX(-120px)'; nr.style.transform = 'translateX(120px)';
    nl.style.opacity = nr.style.opacity = 0;
    layer.appendChild(nl); layer.appendChild(nr);
  }
  document.body.appendChild(layer);

  var skip, held = new Promise(function (r) { skip = r; });
  layer.addEventListener('click', function () { skip(); });

  if (reduce) {
    /* under reduced motion: the square at the mark's size, a hold, then a plain dissolve */
    ld.style.transform = 'scale(' + k + ')'; ldw.style.transform = 'translate(-50%,-50%)';
    if (nl) { nl.style.transform = nr.style.transform = ''; nl.style.opacity = nr.style.opacity = 1; }
    Promise.race([held, wait(1400)]).then(function () {
      anim(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
      resolve(); root.classList.remove('intro');
      return wait(650);
    }).then(function () { layer.remove(); });
    return;
  }

  wait(200).then(function () {
    anim(ld, [{ transform: 'scale(1)' }, { transform: 'scale(' + k + ')' }], { duration: 2000, easing: EASE, fill: 'forwards' });
    anim(ldw, [{ transform: 'translate(-50%,-50%) scale(' + ks + ')' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 2000, easing: EASE, fill: 'forwards' });
    if (nl) {
      anim(nl, [{ transform: 'translateX(-120px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 1900, delay: 200, easing: EASE, fill: 'forwards' });
      anim(nr, [{ transform: 'translateX(120px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 1900, delay: 200, easing: EASE, fill: 'forwards' });
    }
    return wait(2100);
  }).then(function () {
    return Promise.race([held, wait(1000)]);
  }).then(function () {
    /* out, as the site does it: the turn, the fade a third in, the name sliding off, the corner mark */
    anim(ld, [{ transform: 'scale(' + k + ') rotate(0deg)' }, { transform: 'scale(' + k + ') rotate(180deg)' }], { duration: 1250, delay: 200, easing: EASE, fill: 'forwards' });
    anim(ld, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 500, easing: 'ease-out', fill: 'forwards', composite: 'replace' });
    anim(ldw, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 500, easing: 'ease-out', fill: 'forwards' });
    if (nl) {
      anim(nl, [{ transform: 'translateX(0)' }, { transform: 'translateX(-24px)' }], { duration: 500, delay: 400, easing: EASE, fill: 'forwards' });
      anim(nr, [{ transform: 'translateX(0)' }, { transform: 'translateX(24px)' }], { duration: 500, delay: 400, easing: EASE, fill: 'forwards' });
      anim(nl, [{ opacity: 1 }, { opacity: 0 }], { duration: 1000, delay: 1000, easing: EASE, fill: 'forwards' });
      anim(nr, [{ opacity: 1 }, { opacity: 0 }], { duration: 1000, delay: 1000, easing: EASE, fill: 'forwards' });
    }
    /* the work arrives under the fading square; the chrome (the corner mark) follows */
    wait(500).then(resolve);
    wait(1450).then(function () { root.classList.remove('intro'); });
    return wait(2200);
  }).then(function () { layer.remove(); });
})();
