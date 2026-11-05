// ═══════════════════════════════════════════════════════════════════
// EFFECT REGISTRY — the playground.
//
// Every effect is a full-screen pass over `tex1` (the rendered image
// stack). To add one: copy an entry, write a `main()` that produces
// `vec4 outColor`, list its params. It shows up in the G panel
// automatically, with sliders.
//
// HOUSE RULE — the "safe area": distortion lives at the top and
// bottom of the viewport; the middle of the page stays readable
// (this is what makes Lens Tunnel work). Every effect except
// lens-tunnel (whose geometry does this naturally) gets the shared
// `edgeMask()` helper and a Safe-area slider: 0 at the center band,
// ramping to 1 at the top/bottom edges. Multiply your warp by it.
//
// Shared uniforms every effect gets:
//   tex1         — the scene render target
//   time         — elapsed ms
//   opacity      — page-transition fade (0..1)
//   saturation   — 1 normal, 0 dims to gray (overlay state)
//   displacement — 1 home / 0 detail. ALWAYS multiply your warp by
//                  this so the "lens off" route transition works.
//   scrollDif    — smoothed scroll velocity, ± px/frame
// ═══════════════════════════════════════════════════════════════════

export const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vUv = uv;
  }
`;

const HEADER = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tex1;
  uniform float time;
  uniform float opacity;
  uniform float saturation;
  uniform float displacement;
  uniform float scrollDif;
  uniform float uBeat;     // clock-beat pulse (0..1), spikes each beat
  uniform vec2  uMouse;    // smoothed cursor (-1..1)
`;

// safe-area helper: 0 in the middle band, 1 at top/bottom edges
const SAFE = /* glsl */`
  uniform float safeArea;
  float edgeMask(vec2 uv) {
    float d = abs(uv.y - 0.5) * 2.0;   // 0 center → 1 top/bottom edge
    return smoothstep(safeArea, min(safeArea + 0.5, 1.0), d);
  }
`;
const SAFE_PARAM =
  { key: 'safeArea', label: 'Safe area', value: 0.35, min: 0, max: 0.9, step: 0.01 };

// value-noise + fbm, for the organic passes (glass, caustics)
const NOISE = /* glsl */`
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * vnoise(p); p *= 2.0; a *= 0.5; } return v; }
`;

// shared tail: saturation dim + transition fade, applied to `outColor`
const FINISH = /* glsl */`
    float avg = (outColor.r + outColor.g + outColor.b) / 3.0;
    outColor.rgb = outColor.rgb * vec3(saturation)
                 + vec3(1.0 - avg) * vec3(0.4) * vec3(1.0 - saturation);
    outColor.a = opacity;
    gl_FragColor = outColor;
`;

export const EFFECTS = {

  /* ── 1. The recovered original: radial magnification + scroll smear.
         Its geometry IS the safe area — center reads, edges tunnel. ── */
  'lens-tunnel': {
    name: 'Lens Tunnel (original)',
    params: [
      { key: 'textureScale', label: 'Distortion',  value: 0.4,  min: 0.05, max: 1,  step: 0.01 },
      { key: 'lensOut',      label: 'Lens outward', value: 0.0,  min: 0,    max: 1,  step: 0.05 },
      { key: 'smearAmount',  label: 'Smear',       value: 1.0,  min: 0,    max: 4,  step: 0.05 },
      { key: 'smearFreq',    label: 'Smear freq',  value: 10.1, min: 1,    max: 40, step: 0.1  },
    ],
    frag: HEADER + /* glsl */`
      uniform float textureScale;
      uniform float lensOut;       // 0 = inward tunnel, 1 = outward bulge
      uniform float smearAmount;
      uniform float smearFreq;

      void main() {
        vec4 ref = texture2D(tex1, vUv);
        float lum1 = (ref.r + ref.g + ref.b) / 3.0;

        vec2 cVuv = vUv - vec2(0.5);
        float outCircle = (0.5 - length(cVuv)) * (textureScale * 10.0);

        vec2 nVuv = vUv - vec2(0.5);
        // radial magnification. inward = center recedes / rim blows up
        // (the tunnel); outward = its reciprocal = convex bulge toward
        // the viewer. lensOut morphs between the two.
        float baseScale = 1.0 + 0.5 * displacement - (1.0 - outCircle) * displacement * 0.5;
        float scale = mix(baseScale, 1.0 / max(baseScale, 0.001), lensOut);
        nVuv *= scale;
        // scroll-velocity smear — runs everywhere (incl. detail pages),
        // keyed to scroll speed so it's zero at rest, alive on scroll
        nVuv.y *= 1.0 - sin(time * 0.001 + vUv.x * smearFreq + lum1 * smearFreq)
                      * scrollDif * 0.01 * smearAmount;
        nVuv += vec2(0.5);

        // clock-beat chroma kick: RGB splits radially on every beat
        vec2 bdir = (nVuv - 0.5) / max(length(nVuv - 0.5), 1e-4);
        float ca = uBeat * 0.006;
        vec4 outColor = vec4(
          texture2D(tex1, nVuv + bdir * ca).r,
          texture2D(tex1, nVuv).g,
          texture2D(tex1, nVuv - bdir * ca).b,
          1.0
        );
        ${FINISH}
      }
    `,
  },

  /* ── 2. Horizon Roll: top and bottom roll away like a drum seen
         face-on — compression + pinch + shading on the curve.
         Scroll velocity tips the drum. ── */
  'horizon-roll': {
    name: 'Horizon Roll',
    params: [
      { key: 'rollCurve',  label: 'Curve',  value: 1.0, min: 0.2, max: 2, step: 0.05 },
      { key: 'pinch',      label: 'Pinch',  value: 0.6, min: 0,   max: 2, step: 0.05 },
      { key: 'rollShade',  label: 'Shade',  value: 0.5, min: 0,   max: 1, step: 0.01 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float rollCurve;
      uniform float pinch;
      uniform float rollShade;

      void main() {
        float m = edgeMask(vUv) * displacement;

        float cy = (vUv.y - 0.5) * 2.0;                      // -1..1
        float theta = cy * 1.5708 * rollCurve
                    + scrollDif * 0.001;                     // velocity tips it

        // cylinder mapping: identity near center, compressed at edges
        float yS = 0.5 + sin(theta) / (3.1416 * max(rollCurve, 0.001));
        float nY = mix(vUv.y, yS, m);

        // the curve bulges x outward as it rolls back
        float nX = 0.5 + (vUv.x - 0.5) * (1.0 + (1.0 - cos(theta)) * pinch * m);

        vec4 outColor = texture2D(tex1, vec2(nX, nY));

        // shade the rolled-away surface
        outColor.rgb *= 1.0 - (1.0 - cos(theta)) * rollShade * m;
        ${FINISH}
      }
    `,
  },

  /* ── 3. Depth Smear: edges streak toward the vanishing point,
         multi-tap trails pumped by scroll velocity. ── */
  'depth-smear': {
    name: 'Depth Smear',
    params: [
      { key: 'smearLen', label: 'Length',      value: 1.0, min: 0, max: 3, step: 0.05 },
      { key: 'velBoost', label: 'Scroll pump', value: 1.0, min: 0, max: 3, step: 0.05 },
      { key: 'chroma',   label: 'Chroma',      value: 0.5, min: 0, max: 2, step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float smearLen;
      uniform float velBoost;
      uniform float chroma;

      void main() {
        float m = edgeMask(vUv) * displacement;
        float vel = clamp(abs(scrollDif), 0.0, 40.0);

        // streak direction: toward the center of the frame
        vec2 dir = vec2(0.5) - vUv;
        float len = (0.04 * smearLen + vel * 0.003 * velBoost) * m;

        vec4 acc = vec4(0.0);
        float w = 1.0, wsum = 0.0;
        for (int i = 0; i < 8; i++) {
          float t = float(i) / 7.0;
          acc += texture2D(tex1, vUv + dir * len * t) * w;
          wsum += w;
          w *= 0.82;
        }
        vec4 outColor = acc / wsum;

        // chromatic fringing on the trails
        outColor.r = mix(outColor.r,
          texture2D(tex1, vUv + dir * len * 1.25).r, chroma * m * 0.6);
        outColor.b = mix(outColor.b,
          texture2D(tex1, vUv + dir * len * 0.75).b, chroma * m * 0.6);
        ${FINISH}
      }
    `,
  },

  /* ── 4. Radial chromatic split + ghost echoes, edge-masked ── */
  'rgb-echo': {
    name: 'RGB Echo',
    params: [
      { key: 'aberration', label: 'Aberration',  value: 1.2,  min: 0,   max: 4,   step: 0.05 },
      { key: 'echoSpread', label: 'Echo spread', value: 1.0,  min: 0,   max: 3,   step: 0.05 },
      { key: 'echoDecay',  label: 'Echo decay',  value: 0.55, min: 0.2, max: 0.9, step: 0.01 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float aberration;
      uniform float echoSpread;
      uniform float echoDecay;

      void main() {
        float m = edgeMask(vUv) * displacement;
        vec2 dir = vUv - vec2(0.5);
        float vel = clamp(abs(scrollDif), 0.0, 40.0);

        float amt = (0.004 + vel * 0.0006) * aberration * m;
        vec4 outColor = vec4(
          texture2D(tex1, vUv - dir * amt      ).r,
          texture2D(tex1, vUv).g,
          texture2D(tex1, vUv - dir * amt * 3.0).b,
          1.0
        );

        // ghost trails marching outward, fed by scroll velocity
        float w = 1.0, wsum = 1.0;
        for (int i = 1; i <= 5; i++) {
          w *= echoDecay;
          vec2 off = dir * float(i) * (0.006 + vel * 0.0009) * echoSpread * m;
          outColor.rgb += texture2D(tex1, vUv - off).rgb * w;
          wsum += w;
        }
        outColor.rgb /= wsum;
        ${FINISH}
      }
    `,
  },

  /* ── 5. Mirror-segment kaleidoscope at the edges; middle stays real ── */
  'kaleido': {
    name: 'Kaleido',
    params: [
      { key: 'segments', label: 'Segments', value: 6,   min: 2,   max: 16,  step: 1    },
      { key: 'twist',    label: 'Twist',    value: 1.0, min: 0,   max: 4,   step: 0.05 },
      { key: 'kZoom',    label: 'Zoom',     value: 1.0, min: 0.5, max: 2.5, step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float segments;
      uniform float twist;
      uniform float kZoom;

      void main() {
        float m = edgeMask(vUv) * displacement;

        vec2 c = vUv - vec2(0.5);
        float a = atan(c.y, c.x);
        float r = length(c);

        float seg = 6.28318 / max(segments, 1.0);
        a += time * 0.0001 + scrollDif * 0.002 * twist;
        a = mod(a, seg);
        a = abs(a - seg * 0.5);

        vec2 k = vec2(cos(a), sin(a)) * r / kZoom;
        vec2 nVuv = mix(vUv, k + vec2(0.5), m);
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },

  /* ── 6. Slit-scan: bands shear sideways at the edges only ── */
  'slitscan': {
    name: 'Slit-Scan',
    params: [
      { key: 'bands',    label: 'Bands',     value: 24,  min: 4,   max: 120, step: 1    },
      { key: 'shear',    label: 'Shear',     value: 1.0, min: 0,   max: 4,   step: 0.05 },
      { key: 'bandFreq', label: 'Band freq', value: 3.0, min: 0.5, max: 12,  step: 0.1  },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float bands;
      uniform float shear;
      uniform float bandFreq;

      void main() {
        float m = edgeMask(vUv) * displacement;

        float band = floor(vUv.y * bands) / bands;
        float off = sin(band * 6.28318 * bandFreq + time * 0.001)
                  * (0.01 * shear + scrollDif * 0.0015 * shear)
                  * m;
        vec2 nVuv = vec2(vUv.x + off, vUv.y);
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },

  /* ── 7. Mosaic: edges pixelate (chunkier when scrolling), middle clean ── */
  'mosaic': {
    name: 'Mosaic',
    params: [
      { key: 'cellBase', label: 'Cells',       value: 80,  min: 8, max: 200, step: 1    },
      { key: 'velPump',  label: 'Scroll pump', value: 1.0, min: 0, max: 3,   step: 0.05 },
      { key: 'rgbSplit', label: 'RGB split',   value: 0.5, min: 0, max: 3,   step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float cellBase;
      uniform float velPump;
      uniform float rgbSplit;

      void main() {
        float m = edgeMask(vUv) * displacement;
        float vel = clamp(abs(scrollDif), 0.0, 40.0);
        float cells = max(cellBase - vel * velPump * 1.5, 4.0);

        vec2 cUv = (floor(vUv * cells) + 0.5) / cells;
        vec2 nVuv = mix(vUv, cUv, m);

        vec2 split = vec2(rgbSplit * 0.003 * m, 0.0);
        vec4 outColor = vec4(
          texture2D(tex1, nVuv + split).r,
          texture2D(tex1, nVuv).g,
          texture2D(tex1, nVuv - split).b,
          1.0
        );
        ${FINISH}
      }
    `,
  },

  /* ── 8. Concentric ripple, edge-masked + velocity-pumped ── */
  'ripple': {
    name: 'Ripple',
    params: [
      { key: 'rippleFreq',  label: 'Frequency', value: 28,  min: 2, max: 80, step: 1    },
      { key: 'rippleAmp',   label: 'Amplitude', value: 1.2, min: 0, max: 5,  step: 0.05 },
      { key: 'rippleSpeed', label: 'Speed',     value: 1.0, min: 0, max: 4,  step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float rippleFreq;
      uniform float rippleAmp;
      uniform float rippleSpeed;

      void main() {
        float m = edgeMask(vUv) * displacement;

        vec2 cUv = vUv - vec2(0.5);
        float d = length(cUv);
        vec2 dirn = cUv / max(d, 0.0001);

        float amp = (rippleAmp * 0.004 + abs(scrollDif) * 0.0004 * rippleAmp) * m;
        float wave = sin(d * rippleFreq * 6.2831 - time * 0.002 * rippleSpeed * 6.2831);

        vec2 nVuv = vUv + dirn * wave * amp;
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },

  /* ── LENS-FAMILY EXPERIMENTS (similar feeling, different mechanism) ── */

  /* 9. Radial focus / depth-of-field — center sharp, edges bokeh-blur.
        the fovea made literal, no geometry warp. */
  'radial-focus': {
    name: 'Radial Focus (DoF)',
    params: [
      { key: 'focusSize', label: 'Focus size',  value: 0.30, min: 0,  max: 0.9, step: 0.01 },
      { key: 'blurMax',   label: 'Edge blur',   value: 1.0,  min: 0,  max: 3,   step: 0.05 },
      { key: 'velBlur',   label: 'Scroll blur', value: 1.0,  min: 0,  max: 3,   step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform float focusSize;
      uniform float blurMax;
      uniform float velBlur;

      void main() {
        float d = length(vUv - 0.5) * 2.0;             // 0 center → 1 corner
        float t = smoothstep(focusSize, 1.0, d);       // sharp center, blur edges
        float vel = clamp(abs(scrollDif), 0.0, 40.0);
        float radius = (blurMax * 0.012 + vel * 0.0008 * velBlur) * t * displacement;

        vec3 sum = texture2D(tex1, vUv).rgb;
        float w = 1.0;
        for (int i = 0; i < 12; i++) {                 // golden-angle bokeh disk
          float fi = float(i);
          float a = fi * 2.39996;
          float r = radius * sqrt(fi / 12.0);
          sum += texture2D(tex1, vUv + vec2(cos(a), sin(a)) * r).rgb;
          w += 1.0;
        }
        vec4 outColor = vec4(sum / w, 1.0);
        ${FINISH}
      }
    `,
  },

  /* 10. Glass / water refraction — organic noise normal-map bends the
         image; surface flows with scroll. */
  'glass': {
    name: 'Glass / Water',
    params: [
      { key: 'glassScale', label: 'Ripple scale', value: 3.0, min: 0.5, max: 12, step: 0.1  },
      { key: 'glassAmt',   label: 'Refraction',   value: 1.0, min: 0,   max: 3,  step: 0.05 },
      { key: 'flowSpeed',  label: 'Flow speed',   value: 1.0, min: 0,   max: 4,  step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + NOISE + /* glsl */`
      uniform float glassScale;
      uniform float glassAmt;
      uniform float flowSpeed;

      void main() {
        float m = edgeMask(vUv) * displacement;
        float t = time * 0.0002 * flowSpeed + abs(scrollDif) * 0.01;
        vec2 p = vUv * glassScale;
        float e = 0.06;
        float n  = fbm(p + t);
        float nx = fbm(p + vec2(e, 0.0) + t) - n;      // surface gradient = normal
        float ny = fbm(p + vec2(0.0, e) + t) - n;
        vec2 refr = vec2(nx, ny) * (glassAmt * 1.6) * m;
        vec4 outColor = texture2D(tex1, vUv + refr);
        ${FINISH}
      }
    `,
  },

  /* 11. Chromatic dispersion — RGB splits radially toward the rim,
         the lens's colour physics as a prism. */
  'dispersion': {
    name: 'Chromatic Dispersion',
    params: [
      { key: 'dispAmt', label: 'Dispersion',   value: 1.0, min: 0, max: 3, step: 0.05 },
      { key: 'velDisp', label: 'Scroll split', value: 1.0, min: 0, max: 3, step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + /* glsl */`
      uniform float dispAmt;
      uniform float velDisp;

      void main() {
        float m = edgeMask(vUv) * displacement;
        float vel = clamp(abs(scrollDif), 0.0, 40.0);
        vec2 dir = vUv - 0.5;
        float amt = (dispAmt * 0.02 + vel * 0.0015 * velDisp) * m;
        vec4 outColor = vec4(
          texture2D(tex1, vUv + dir * amt).r,
          texture2D(tex1, vUv).g,
          texture2D(tex1, vUv - dir * amt).b,
          1.0
        );
        // a touch of wider rainbow on the fringes
        outColor.r = mix(outColor.r, texture2D(tex1, vUv + dir * amt * 1.4).r, 0.3);
        outColor.b = mix(outColor.b, texture2D(tex1, vUv - dir * amt * 1.4).b, 0.3);
        ${FINISH}
      }
    `,
  },

  /* 12. Caustics — a luminous pool-floor light web overlaid + a gentle
         refraction; light-based depth, not geometric. */
  'caustics': {
    name: 'Caustics',
    params: [
      { key: 'caScale',  label: 'Scale',      value: 4.0, min: 1, max: 14, step: 0.1  },
      { key: 'caBright', label: 'Brightness', value: 1.0, min: 0, max: 3,  step: 0.05 },
      { key: 'caSpeed',  label: 'Speed',      value: 1.0, min: 0, max: 4,  step: 0.05 },
      SAFE_PARAM,
    ],
    frag: HEADER + SAFE + NOISE + /* glsl */`
      uniform float caScale;
      uniform float caBright;
      uniform float caSpeed;

      void main() {
        float m = edgeMask(vUv) * displacement;
        float t = time * 0.0003 * caSpeed + abs(scrollDif) * 0.006;
        vec2 p = vUv * caScale;
        // domain-warped noise → sharp caustic ridges
        vec2 q = p + vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
        float n = fbm(q * 1.5 + t);
        float ca = pow(1.0 - abs(n * 2.0 - 1.0), 4.0);

        vec2 refr = (vec2(n) - 0.5) * 0.012 * m;
        vec4 outColor = texture2D(tex1, vUv + refr);
        outColor.rgb += ca * caBright * 0.6 * m;       // luminous overlay
        ${FINISH}
      }
    `,
  },

  /* 13. Relief — the image's own luminance is read as a 3D heightmap:
        bright = raised. A parallax ray (cursor + scroll) shifts the
        surface so it pops in depth, and a raking specular highlight
        lights the relief. Compound + content-aware, like the lens. */
  'relief': {
    name: 'Relief (depth)',
    params: [
      { key: 'depthAmt',    label: 'Depth',  value: 1.2, min: 0, max: 3,  step: 0.05 },
      { key: 'reliefSteps', label: 'Steps',  value: 12,  min: 2, max: 24, step: 1    },
      { key: 'shine',       label: 'Shine',  value: 0.6, min: 0, max: 2,  step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform float depthAmt;
      uniform float reliefSteps;
      uniform float shine;

      float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

      void main() {
        float m = displacement;   // depth across the WHOLE frame, not just edges
        float vel = clamp(scrollDif, -40.0, 40.0);
        // view ray from the cursor (+ a little scroll drift)
        vec2 view = (uMouse * 0.7 + vec2(0.0, vel * 0.02)) * depthAmt * 0.06 * m;

        // march the ray through the luminance heightmap — bright lifts more
        vec2 uv = vUv;
        for (int i = 0; i < 24; i++) {
          if (float(i) >= reliefSteps) break;
          float h = lum(texture2D(tex1, uv).rgb);
          uv += view * h / reliefSteps;
        }
        vec4 outColor = texture2D(tex1, uv);

        // raking specular: a highlight that sweeps across the relief as
        // the cursor/scroll moves, so it reads as a lit 3D surface
        float c  = lum(texture2D(tex1, uv).rgb);
        float cx = lum(texture2D(tex1, uv + vec2(0.004, 0.0)).rgb);
        float cy = lum(texture2D(tex1, uv + vec2(0.0, 0.004)).rgb);
        vec3 normal = normalize(vec3(c - cx, c - cy, 0.18));
        vec3 lightDir = normalize(vec3(uMouse * 0.8, 0.6));
        float spec = pow(max(dot(normal, lightDir), 0.0), 12.0) * shine * m;
        outColor.rgb += spec;
        ${FINISH}
      }
    `,
  },

  /* 14. Feedback / trails — the previous frame is zoomed, rotated and
        decayed, then blended under the current one (ping-pong buffer).
        Builds receding tunnels and motion-trails; depth from motion
        memory, so it works on any source. Scroll deepens it. */
  'feedback': {
    name: 'Feedback / Trails',
    params: [
      { key: 'fbAmount', label: 'Trail',  value: 0.92, min: 0,    max: 1,    step: 0.01 },
      { key: 'fbFade',   label: 'Decay',  value: 0.94, min: 0.5,  max: 0.99, step: 0.005 },
      { key: 'fbZoom',   label: 'Tunnel', value: 1.5,  min: -4,   max: 4,    step: 0.05 },
      { key: 'fbRotate', label: 'Spiral', value: 0.4,  min: -4,   max: 4,    step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform sampler2D uFeedback;
      uniform float fbAmount;
      uniform float fbFade;
      uniform float fbZoom;
      uniform float fbRotate;

      void main() {
        vec4 cur = texture2D(tex1, vUv);
        float vel = clamp(abs(scrollDif), 0.0, 40.0);

        // transform the feedback: zoom toward center (tunnel) + rotate (spiral),
        // both deepened by scroll velocity
        vec2 c = vUv - 0.5;
        float ang = (fbRotate + vel * 0.02) * 0.012;
        float s   = 1.0 - (fbZoom + vel * 0.06) * 0.01;
        mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        vec2 fuv = R * (c * s) + 0.5;

        vec3 trail = texture2D(uFeedback, fuv).rgb * fbFade;
        vec4 outColor = cur;
        // keep the brighter of current vs decayed-trail → luminous, stable
        outColor.rgb = max(cur.rgb, trail * fbAmount * displacement);
        ${FINISH}
      }
    `,
  },
};
