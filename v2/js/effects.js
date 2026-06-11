// ═══════════════════════════════════════════════════════════════════
// EFFECT REGISTRY — the playground.
//
// Every effect is a full-screen pass over `tex1` (the rendered image
// stack). To add one: copy an entry, write a `main()` that produces
// `vec4 outColor`, list its params. It shows up in the G panel
// automatically, with sliders.
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

// shared tail: saturation dim + transition fade, applied to `outColor`
const FINISH = /* glsl */`
    float avg = (outColor.r + outColor.g + outColor.b) / 3.0;
    outColor.rgb = outColor.rgb * vec3(saturation)
                 + vec3(1.0 - avg) * vec3(0.4) * vec3(1.0 - saturation);
    outColor.a = opacity;
    gl_FragColor = outColor;
`;

export const EFFECTS = {

  /* ── 1. The recovered original: radial magnification + scroll smear ── */
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

  /* ── 2. Radial chromatic split + ghost echoes, driven by velocity ── */
  'rgb-echo': {
    name: 'RGB Echo',
    params: [
      { key: 'aberration', label: 'Aberration',  value: 1.2,  min: 0,   max: 4,   step: 0.05 },
      { key: 'echoSpread', label: 'Echo spread', value: 1.0,  min: 0,   max: 3,   step: 0.05 },
      { key: 'echoDecay',  label: 'Echo decay',  value: 0.55, min: 0.2, max: 0.9, step: 0.01 },
    ],
    frag: HEADER + /* glsl */`
      uniform float aberration;
      uniform float echoSpread;
      uniform float echoDecay;

      void main() {
        vec2 dir = vUv - vec2(0.5);
        float vel = clamp(abs(scrollDif), 0.0, 40.0);

        float amt = (0.004 + vel * 0.0006) * aberration * displacement;
        vec4 outColor = vec4(
          texture2D(tex1, vUv - dir * amt      ).r,
          texture2D(tex1, vUv - dir * amt * 2.0).g,
          texture2D(tex1, vUv - dir * amt * 3.0).b,
          1.0
        );

        // ghost trails marching outward, fed by scroll velocity
        float w = 1.0, wsum = 1.0;
        for (int i = 1; i <= 5; i++) {
          w *= echoDecay;
          vec2 off = dir * float(i) * (0.006 + vel * 0.0009) * echoSpread * displacement;
          outColor.rgb += texture2D(tex1, vUv - off).rgb * w;
          wsum += w;
        }
        outColor.rgb /= wsum;
        ${FINISH}
      }
    `,
  },

  /* ── 3. Concentric ripple from center, breathing + velocity-pumped ── */
  'ripple': {
    name: 'Ripple',
    params: [
      { key: 'rippleFreq',  label: 'Frequency', value: 28,  min: 2, max: 80, step: 1    },
      { key: 'rippleAmp',   label: 'Amplitude', value: 1.2, min: 0, max: 5,  step: 0.05 },
      { key: 'rippleSpeed', label: 'Speed',     value: 1.0, min: 0, max: 4,  step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform float rippleFreq;
      uniform float rippleAmp;
      uniform float rippleSpeed;

      void main() {
        vec2 cUv = vUv - vec2(0.5);
        float d = length(cUv);
        vec2 dirn = cUv / max(d, 0.0001);

        float amp = (rippleAmp * 0.004 + abs(scrollDif) * 0.0004 * rippleAmp) * displacement;
        float wave = sin(d * rippleFreq * 6.2831 - time * 0.002 * rippleSpeed * 6.2831);

        vec2 nVuv = vUv + dirn * wave * amp;
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },
};
