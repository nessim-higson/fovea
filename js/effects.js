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

  /* ── 3. Mirror-segment kaleidoscope; scroll twists the wheel ── */
  'kaleido': {
    name: 'Kaleido',
    params: [
      { key: 'segments', label: 'Segments', value: 6,   min: 2, max: 16, step: 1    },
      { key: 'twist',    label: 'Twist',    value: 1.0, min: 0, max: 4,  step: 0.05 },
      { key: 'kZoom',    label: 'Zoom',     value: 1.0, min: 0.5, max: 2.5, step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform float segments;
      uniform float twist;
      uniform float kZoom;

      void main() {
        vec2 c = vUv - vec2(0.5);
        float a = atan(c.y, c.x);
        float r = length(c);

        float seg = 6.28318 / max(segments, 1.0);
        a += time * 0.0001 + scrollDif * 0.002 * twist;
        a = mod(a, seg);
        a = abs(a - seg * 0.5);

        vec2 k = vec2(cos(a), sin(a)) * r / kZoom;
        vec2 nVuv = mix(vUv, k + vec2(0.5), displacement);
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },

  /* ── 4. Liquid: perlin flow warp (the perlin from the original
         site's own shader source); scroll stirs the ink ── */
  'liquid': {
    name: 'Liquid',
    params: [
      { key: 'flowScale', label: 'Scale',  value: 3.0, min: 0.5, max: 12, step: 0.1  },
      { key: 'flowAmp',   label: 'Amount', value: 1.0, min: 0,   max: 4,  step: 0.05 },
      { key: 'flowSpeed', label: 'Speed',  value: 1.0, min: 0,   max: 4,  step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform float flowScale;
      uniform float flowAmp;
      uniform float flowSpeed;

      vec3 random_perlin(vec3 p) {
        p = vec3(
          dot(p, vec3(127.1, 311.7, 69.5)),
          dot(p, vec3(269.5, 183.3, 132.7)),
          dot(p, vec3(247.3, 108.5, 96.5)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      float noise_perlin(vec3 p) {
        vec3 i = floor(p);
        vec3 s = fract(p);
        float a = dot(random_perlin(i), s);
        float b = dot(random_perlin(i + vec3(1, 0, 0)), s - vec3(1, 0, 0));
        float c = dot(random_perlin(i + vec3(0, 1, 0)), s - vec3(0, 1, 0));
        float d = dot(random_perlin(i + vec3(0, 0, 1)), s - vec3(0, 0, 1));
        float e = dot(random_perlin(i + vec3(1, 1, 0)), s - vec3(1, 1, 0));
        float f = dot(random_perlin(i + vec3(1, 0, 1)), s - vec3(1, 0, 1));
        float g = dot(random_perlin(i + vec3(0, 1, 1)), s - vec3(0, 1, 1));
        float h = dot(random_perlin(i + vec3(1, 1, 1)), s - vec3(1, 1, 1));
        vec3 u = smoothstep(0., 1., s);
        return mix(mix(mix(a, b, u.x), mix(c, e, u.x), u.y),
                   mix(mix(d, f, u.x), mix(g, h, u.x), u.y), u.z);
      }

      void main() {
        float t = time * 0.0002 * flowSpeed;
        float n1 = noise_perlin(vec3(vUv * flowScale, t));
        float n2 = noise_perlin(vec3(vUv * flowScale + 7.31, t * 1.3));

        float amp = (flowAmp * 0.02 + abs(scrollDif) * 0.0015) * displacement;
        vec2 nVuv = vUv + vec2(n1, n2) * amp;
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },

  /* ── 5. Slit-scan: horizontal bands shear sideways, editorial cut ── */
  'slitscan': {
    name: 'Slit-Scan',
    params: [
      { key: 'bands',    label: 'Bands',     value: 24,  min: 4, max: 120, step: 1    },
      { key: 'shear',    label: 'Shear',     value: 1.0, min: 0, max: 4,   step: 0.05 },
      { key: 'bandFreq', label: 'Band freq', value: 3.0, min: 0.5, max: 12, step: 0.1 },
    ],
    frag: HEADER + /* glsl */`
      uniform float bands;
      uniform float shear;
      uniform float bandFreq;

      void main() {
        float band = floor(vUv.y * bands) / bands;
        float off = sin(band * 6.28318 * bandFreq + time * 0.001)
                  * (0.01 * shear + scrollDif * 0.0015 * shear)
                  * displacement;
        vec2 nVuv = vec2(vUv.x + off, vUv.y);
        vec4 outColor = texture2D(tex1, nVuv);
        ${FINISH}
      }
    `,
  },

  /* ── 6. Mosaic: pixelation that chunks up as you scroll faster ── */
  'mosaic': {
    name: 'Mosaic',
    params: [
      { key: 'cellBase', label: 'Cells',       value: 80,  min: 8, max: 200, step: 1    },
      { key: 'velPump',  label: 'Scroll pump', value: 1.0, min: 0, max: 3,   step: 0.05 },
      { key: 'rgbSplit', label: 'RGB split',   value: 0.5, min: 0, max: 3,   step: 0.05 },
    ],
    frag: HEADER + /* glsl */`
      uniform float cellBase;
      uniform float velPump;
      uniform float rgbSplit;

      void main() {
        float vel = clamp(abs(scrollDif), 0.0, 40.0);
        float cells = max(cellBase - vel * velPump * 1.5, 4.0);

        vec2 cUv = (floor(vUv * cells) + 0.5) / cells;
        vec2 nVuv = mix(vUv, cUv, displacement);

        vec2 split = vec2(rgbSplit * 0.003 * displacement, 0.0);
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

  /* ── 7. VHS: scanlines + row-glitch bursts fed by velocity ── */
  'vhs': {
    name: 'VHS',
    params: [
      { key: 'glitchAmt',   label: 'Glitch',    value: 1.0,  min: 0,  max: 4,   step: 0.05 },
      { key: 'lineDensity', label: 'Scanlines', value: 200,  min: 40, max: 600, step: 5    },
      { key: 'noiseAmt',    label: 'Noise',     value: 0.15, min: 0,  max: 0.6, step: 0.01 },
    ],
    frag: HEADER + /* glsl */`
      uniform float glitchAmt;
      uniform float lineDensity;
      uniform float noiseAmt;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        float vel = clamp(abs(scrollDif), 0.0, 40.0);

        // row displacement bursts — more rows jump when scrolling fast
        float row = floor(vUv.y * lineDensity);
        float h = hash(vec2(row, floor(time * 0.01)));
        float burst = step(1.0 - 0.02 * glitchAmt - vel * 0.002 * glitchAmt, h);
        float off = (h - 0.5) * burst * (0.05 + vel * 0.002) * glitchAmt * displacement;

        vec2 nVuv = vec2(vUv.x + off, vUv.y);

        float ca = (0.0015 + vel * 0.0002) * glitchAmt * displacement;
        vec4 outColor = vec4(
          texture2D(tex1, nVuv + vec2(ca, 0.0)).r,
          texture2D(tex1, nVuv).g,
          texture2D(tex1, nVuv - vec2(ca, 0.0)).b,
          1.0
        );

        float scan = 1.0 - (0.5 + 0.5 * sin(vUv.y * lineDensity * 6.28318))
                          * 0.12 * displacement;
        float n = (hash(vUv * vec2(1920.0, 1080.0) + fract(time * 0.001)) - 0.5)
                * noiseAmt * displacement;
        outColor.rgb = outColor.rgb * scan + n;
        ${FINISH}
      }
    `,
  },

  /* ── 8. Spiral zoom: multi-tap fake feedback, scroll winds the spiral ── */
  'spiralzoom': {
    name: 'Spiral Zoom',
    params: [
      { key: 'taps',      label: 'Taps',       value: 6,    min: 2, max: 8,    step: 1     },
      { key: 'scaleStep', label: 'Zoom step',  value: 0.08, min: 0, max: 0.2,  step: 0.005 },
      { key: 'rotStep',   label: 'Twist step', value: 0.05, min: 0, max: 0.4,  step: 0.005 },
    ],
    frag: HEADER + /* glsl */`
      uniform float taps;
      uniform float scaleStep;
      uniform float rotStep;

      void main() {
        vec2 c = vUv - vec2(0.5);
        float vel = scrollDif * 0.002;

        vec4 acc = vec4(0.0);
        float wsum = 0.0, w = 1.0;
        for (int i = 0; i < 8; i++) {
          if (float(i) >= taps) break;
          float s = 1.0 - float(i) * scaleStep * displacement;
          float a = float(i) * (rotStep + vel) * displacement;
          mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
          acc += texture2D(tex1, R * (c * s) + vec2(0.5)) * w;
          wsum += w;
          w *= 0.8;
        }
        vec4 outColor = acc / wsum;
        ${FINISH}
      }
    `,
  },

  /* ── 9. Concentric ripple from center, breathing + velocity-pumped ── */
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
