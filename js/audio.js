// ═══════════════════════════════════════════════════════════════════
// AUDIO — ambient engine with scroll-driven warp.
//
// Graph:  source ─→ lowpass filter ─→ dry ──────────┐
//                            └──→ waveshaper → wet ─┤→ master → out
//                            └──→ delay (space) ────┘
//
// Scroll velocity (signed) drives:
//   • pitch  — oscillator detune / playbackRate bends with direction
//   • drive  — waveshaper wet mix rises with speed
//   • filter — lowpass opens with speed
//
// SETTINGS.audioSrc = null  → procedural ambient pad (no asset needed)
// SETTINGS.audioSrc = 'path/to/track.mp3' → your track, looped
// ═══════════════════════════════════════════════════════════════════

export function createAudioEngine(SETTINGS) {
  let ctx = null;
  let master, filter, dryGain, wetGain, analyser;
  let oscillators = [];   // procedural mode
  let baseDetunes = [];
  let mediaEl = null;     // file mode
  let running = false;

  function distortionCurve(amount) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * amount);
    }
    return curve;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0;

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;

    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(3.5);
    shaper.oversample = '2x';

    dryGain = ctx.createGain(); dryGain.gain.value = 1;
    wetGain = ctx.createGain(); wetGain.gain.value = 0;

    // feedback delay for space
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass'; fbFilter.frequency.value = 1600;
    delay.connect(fb); fb.connect(fbFilter); fbFilter.connect(delay);

    filter.connect(dryGain);
    filter.connect(shaper); shaper.connect(wetGain);
    dryGain.connect(master);
    wetGain.connect(master);
    dryGain.connect(delay); delay.connect(master);

    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(analyser);
    analyser.connect(ctx.destination);

    if (SETTINGS.audioSrc) {
      mediaEl = new Audio(SETTINGS.audioSrc);
      mediaEl.loop = true;
      mediaEl.crossOrigin = 'anonymous';
      const node = ctx.createMediaElementSource(mediaEl);
      node.connect(filter);
      mediaEl.play().catch(() => {});
    } else {
      buildPad();
    }
  }

  // procedural ambient pad: open A-chord drone + air noise
  function buildPad() {
    const chord = [110, 164.81, 220, 246.94, 329.63]; // A2 E3 A3 B3 E4
    chord.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const det = i % 2 ? 4 : -3;   // static chorus detune
      o.detune.value = det;
      baseDetunes.push(det);

      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.16 : 0.09;

      // slow tremolo so the pad breathes
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.023;
      const lfoG = ctx.createGain();
      lfoG.gain.value = g.gain.value * 0.5;
      lfo.connect(lfoG); lfoG.connect(g.gain);

      o.connect(g); g.connect(filter);
      o.start(); lfo.start();
      oscillators.push(o);
    });

    // air: looped band-passed noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.025;
    noise.connect(nf); nf.connect(ng); ng.connect(filter);
    noise.start();
  }

  return {
    // must be called from a user gesture (browser autoplay policy)
    toggle() {
      if (!ctx) build();
      running = !running;
      if (running) {
        ctx.resume();
        if (mediaEl) mediaEl.play().catch(() => {});
        master.gain.setTargetAtTime(SETTINGS.audioVolume * 0.3, ctx.currentTime, 0.5);
      } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
      return running;
    },

    setVolume(v) {
      if (ctx && running) {
        master.gain.setTargetAtTime(v * 0.3, ctx.currentTime, 0.1);
      }
    },

    // velSigned: smoothed scroll velocity (± px/frame, clamped)
    setWarp(velSigned, maxVel) {
      if (!ctx || !running) return;
      const warp = SETTINGS.audioWarp;
      const norm = Math.min(Math.abs(velSigned) / maxVel, 1);

      // pitch bends with scroll direction
      const cents = (velSigned / maxVel) * 80 * warp;
      oscillators.forEach((o, i) => { o.detune.value = baseDetunes[i] + cents; });
      if (mediaEl) mediaEl.playbackRate = 1 + (velSigned / maxVel) * 0.07 * warp;

      // drive + filter open with speed
      wetGain.gain.value = Math.min(1, norm * 1.4 * warp);
      dryGain.gain.value = 1 - wetGain.gain.value * 0.6;
      filter.frequency.value = 1100 + norm * 2600 * warp;
    },

    get running() { return running; },

    // average output level 0..1 (handy for debugging / future reactivity)
    level() {
      if (!analyser) return 0;
      const a = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(a);
      return a.reduce((s, v) => s + v, 0) / a.length / 255;
    },

    debug() {
      return ctx ? {
        state: ctx.state,
        filterHz: filter.frequency.value,
        wet: wetGain.gain.value,
        detune: oscillators[0] ? oscillators[0].detune.value : null,
      } : null;
    },
  };
}
