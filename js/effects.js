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
      { key: 'smearAmount',  label: 'Smear',       value: 1.0,  min: 0,    max: 4,  step: 0.05 },
      { key: 'smearFreq',    label: 'Smear freq',  value: 10.1, min: 1,    max: 40, step: 0.1  },
    ],
    frag: HEADER + /* glsl */`
      uniform float textureScale;
      uniform float smearAmount;
      uniform float smearFreq;

      void main() {
        vec4 ref = texture2D(tex1, vUv);
        float lum1 = (ref.r + ref.g + ref.b) / 3.0;

        vec2 cVuv = vUv - vec2(0.5);
        float outCircle = (0.5 - length(cVuv)) * (textureScale * 10.0);

        vec2 nVuv = vUv - vec2(0.5);
        // radial magnification: zoomed out at center, zoomed in at rim
        nVuv *= 1.0 + 0.5 * displacement - (1.0 - outCircle) * displacement * 0.5;
        // scroll-velocity smear keyed to x-position + source luminance
        nVuv.y *= 1.0 - sin(time * 0.001 + vUv.x * smearFreq + lum1 * smearFreq)
                      * scrollDif * 0.01 * smearAmount;
        nVuv += vec2(0.5);

        vec4 outColor = texture2D(tex1, nVuv);
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
};
