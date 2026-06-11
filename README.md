# Studio Site

A portfolio site built around a single WebGL canvas — project images live
as textures on stacked planes, native page scroll moves the stack, and a
swappable full-screen **effect pass** warps the result. The flagship pass
("Lens Tunnel") is reverse-engineered from the shipped shaders of
vincent-lowe.info: radial magnification bends the seams between stacked
images into fisheye horizons, and scroll velocity drives a luminance-keyed
vertical smear.

No build step. Vanilla ES modules; Three.js and lil-gui from CDN.

## Run

```sh
python3 -m http.server 8924
# → http://localhost:8924
```

## Play

- **Scroll** — endless project loop through the active effect; the
  track itself bows with scroll direction (Track bend)
- **G** — toggle the effects panel (switch passes, drag sliders live)
- **Lens button** (bottom-left) — demos the home ↔ detail route
  transition (`displacement` 1 ↔ 0)
- **Sound button** (bottom-left) — ambient audio; scroll velocity
  bends its pitch, opens the filter and drives a waveshaper. With no
  `audioSrc` configured it synthesizes a procedural pad; point
  `SETTINGS.audioSrc` in [js/config.js](js/config.js) at an mp3 to use
  a real track.
- **Project nav** (bottom) — click to ride the track to a project and
  open its case study: a long scroll of full-bleed images (lens off,
  track bend still alive). X / Escape returns to the loop. Galleries
  are 5 generated shots per project until you set
  `PROJECTS[i].images = ['url', ...]`.

## Plug in your work

Edit [js/config.js](js/config.js) — studio name, tagline, and the
`PROJECTS` array. Give each project a CORS-enabled `image` URL; entries
with `image: null` get procedural placeholder posters.

## Add an effect

Copy an entry in [js/effects.js](js/effects.js). An effect is:

```js
'my-effect': {
  name: 'My Effect',
  params: [ { key: 'wiggle', label: 'Wiggle', value: 1, min: 0, max: 4, step: 0.05 } ],
  frag: HEADER + `
    uniform float wiggle;
    void main() {
      vec2 nVuv = vUv; // ...warp nVuv, multiply by `displacement`...
      vec4 outColor = texture2D(tex1, nVuv);
      ${FINISH}
    }
  `,
}
```

It appears in the panel automatically with sliders. Multiply any warp by
`displacement` so the lens-off route transition keeps working.

## Architecture

```
index.html          overlay DOM (pill, chip, buttons) + importmap
css/site.css
js/config.js        ← your content + motion defaults
js/posters.js       procedural placeholder posters
js/effects.js       ← the effect registry (the playground)
js/app.js           renderer, image stack, scroll loop, GUI
```

Pipeline per frame: image stack → render target → active effect pass →
screen. Everything tweakable lives in a uniform.
