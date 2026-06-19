# FOVEA — STATE

*The sharpest point of vision — the edges blur, the center holds.*

A portfolio site that is **one WebGL canvas**. Project images live as textures on
stacked planes; native page scroll moves the stack; a swappable full-screen
**effect pass** warps the result. The flagship pass — **Lens Tunnel** — is
reverse-engineered from the shipped shaders of vincent-lowe.info. Everything
since has been about owning that idea rather than copying the site.

- **Repo:** github.com/nessim-higson/fovea (public)
- **Live:** https://nessim-higson.github.io/fovea/ (GitHub Pages, legacy build from `main` root — plain pushes deploy)
- **Preview server:** `fovea` in `prototypes/.claude/launch.json`, port 4188
- **Current version: V.16** (pill top-right). No build step — vanilla ES modules, Three.js r0.160 + lil-gui from esm.sh via importmap.

Taste north star, do not lose it: **the lens is special because it makes *depth*
without a gradient-rich source.** Surface filters and luminance-parallax tricks
don't match it; recursive feedback does. Judge every new effect by: *does it
keep the center readable and feel like depth, not a gimmick.*

---

## Architecture

**Render pipeline** (`js/app.js`):
```
sceneA (image planes)  →  WebGLRenderTarget rt (tex1)
                       →  sceneB (fullscreen lensQuad w/ active ShaderMaterial)
                       →  screen
```
Two orthographic cameras (camA / camB). The feedback effect adds a ping-pong pair
(`fbA`/`fbB`, `prevFb`/`curFb`) sampled as `uFeedback`.

**Effect registry** (`js/effects.js`) — the whole point of the project ("adjust
and play with different effects"). Each effect is a ~30-line entry:
`HEADER` (shared uniforms) + optional `SAFE` (`edgeMask`) + `frag` + `FINISH`
(saturation/opacity tail) + a `params` array that **auto-generates the GUI
sliders**. Shared uniforms: `tex1, time, opacity, saturation, displacement,
scrollDif, uBeat, uMouse, uFeedback`.

**Two house rules baked into every effect:**
1. Multiply every warp by `displacement` — so fade-through-black route
   transitions can flatten the world to zero distortion.
2. Multiply every warp by `edgeMask()` — distortion lives at the top/bottom of
   the viewport; the middle band stays readable (Safe-area slider, default 0.35).

**Effects shipped:** lens-tunnel (north star, with `lensOut` inward/outward +
beat chroma kick), feedback/trails (the lens-league alternative), horizon-roll,
depth-smear, rgb-echo, kaleido, slitscan, mosaic, ripple, radial-focus, glass,
dispersion, caustics, relief. The four "lens-family" surface passes
(radial-focus/glass/dispersion/caustics) and relief were judged **thin** — kept
in the registry, not contenders.

**Infinite scroll:** a huge spacer gives the page real height; `rebase()`
teleports back to the middle of the loop (`pos = scrollY % cyc`) so the loop is
seamless. `LOOPS=6` on home, `CASE_LOOPS=4` on the case track.

**Touch path** (`IS_TOUCH = pointer:coarse`): render position locks to real
`scrollY` (no smoothing lag), and the mobile address-bar shrink is ignored
(grow-only VH). `overscroll-behavior:none` kills pull-to-refresh.

**Content sets:** `?set=<name>` → `js/config-<name>.js`; bare URL → `config.js`.
Each config exports `SITE`, `PROJECTS`, `SETTINGS`.

---

## Navigation (V.16 — the current scheme)

User picked "category tabs + live rail" from nav comps. The pieces:

- **Studio pill → top-left** (`.pill`, left-aligned). Shows `SITE.studio` + tagline.
- **Category tabs → bottom-center** (`#cat-tabs`). Derived from
  `PROJECTS[].category`; hidden when there's <2 categories; active tab is a white
  pill. Switching tabs swaps which projects the rail lists.
- **Live project rail → right edge** (`#rail`). Vertical list of the active
  category's projects; the current one is highlighted with a trailing ` ◂`. Has a
  text-shadow so it stays legible over both bright and dark imagery.
- **Detail card → bottom-left** (`#detail`): `NN · CLIENT — TITLE · YEAR` + description.

**The "don't zoom through every project to reach one" answer = a direct
fade-jump.** Once you're inside a project (`detailOpen`), clicking a rail item
runs `openProject → fadeSwap(jumpToProject, 200, 600)`; `jumpToProject` teleports
`scrollTo` the target project's start on the case track *under the black fade* —
no glide past the projects in between. From home, the first click still
`mountCase`s into the bleeding case track. `updateNav()` (in the render loop)
flips the active category + highlights the rail by `detailIdx` as you scroll
within the track, so the rail always reflects where you are.

The bleeding scroll-through (all projects' images end-to-end) is still intact
*within* and between adjacent projects — the fade-jump is only for hopping across
the catalog via the rail.

---

## Content sets

- **`config.js` (default, bare URL)** — FOVEA content: the uniqlock-v2 stills +
  nevverland reel, `SITE.studio='FOVEA'`, tagline "Creative Direction & Design".
  Paths `./content/uniqlock/…`. `beat:false`.
- **`?set=iaah`** — all 25 iamalwayshungry.com projects, scraped from the IAAH
  DatoCMS per-project Nuxt payloads, classified `Commercial` (16) / `Personal`
  (9), year-desc. Drives the V.16 category tabs. 162 images @1800px in
  `content/iaah/` (~51MB). `SITE.studio='IAAH'`.
- **`?set=uniqlock` / `?set=fovea`** — aliases re-exporting `config.js`.
- **`?set=placeholder`** — the original procedural-poster demo.

---

## Audio

`js/audio.js`: scroll-warped ambient engine — 4-chord progression that morphs
(~19s), root-following sub, scroll-reactive pentatonic sparkles. Default content
uses the **procedural pad** (`audioSrc:null`), which the user preferred over
warping a real track. Sound is off by default (it used to chug — fixed). The
clock-beat motion experiment (V.12) is off (`beat:false`); the user found the
tick unsophisticated and Feedback replaced it as the "interesting" motion.

---

## Versioning & snapshots (a hard convention)

Every change batch: bump the `#version` pill in `index.html`, commit, `git tag
V.N`, and **freeze a `/vN.0/` snapshot** — a code-only copy whose
`config*.js` content paths are rewritten `./content/` → `../content/` so the
snapshot shares the root `content/` folder instead of duplicating 50MB of assets.
After every deploying push, reply with the **cache-busted live link**
(`?v=<version>`).

Snapshots live at `/v1.0/` … `/v16.0/`. (Older `/v1/`, `/v2/` are pre-convention.)

The version ladder (recent): V.8 full-width scroll-through filmstrip · V.9 clean
black load · V.10 overscroll-behavior · V.11 touch reversal-blip fix ·
V.12 clock-beat (later disabled) · V.13 four lens-family passes (thin) ·
V.14 relief (not a win) · V.15 **Feedback/Trails** (the lens-league win) ·
**V.16 navigation rework** (category tabs + live rail + fade-jump, IAAH set).

---

## Debug handles (on `window`)

`__snap(effectName)` renders one representative frame on demand even with rAF
paused — **the verification recipe.** Also: `__setEffect`, `__setParam`,
`__openDetail`, `__closeDetail`, `__audio`, `__state`, `__vel`, `__THREE__`.

Verification gotchas: the preview tab pauses rAF (black screenshots) — verify via
Chrome MCP and `__snap`. A **hard** reload purges the esm.sh CDN cache and hangs
the module — do a **soft** navigate. Feedback needs `__snap` called ~50× to
accumulate. To drive nav in tests, click `#rail button` (openProject/jumpToProject
aren't exposed) and **re-grab the NodeList after entering detail** — the rail
re-renders, so older references are detached.

---

## Honest current state

- **V.16 is live and verified** — top-left pill, bottom-center tabs, right-edge
  rail, and the rail fade-jump all confirmed on the deployed site.
- The rail lists **every project in the active category** (16 for Commercial), so
  on short screens it's a tall list. Fine on desktop; would want a scroll-window
  or cap on small screens.
- The lens remains the one effect that feels genuinely deep; Feedback is the only
  peer. The rest are texture, not the headline.
- IAAH descriptions are scraped verbatim and a couple are truncated / placeholder
  (e.g. SQSP REBRAND is lorem). Worth a curation pass if IAAH becomes the public set.

## Next (open, not started)

- **Constellation-map nav** as the "signature" scheme layered on top of the rail.
- Curate / split the IAAH sets; bring in the IAAH reel video.
- Small-screen rail behavior (scroll-window or collapse).
