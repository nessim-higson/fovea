# FOVEA — STATE

_Last updated: 2026-11-05_ · **V.43 — the IAAH launch build, on lab as FOVEA V.2**

V.43: the write-up is set exactly as study B1 sets it — one paragraph, then `Contact:` in ink with the
address in mute; the Instagram line is Ness's own name, @nessimhigson (confirmed by Ness). Close is an
× in a round pill, in a project and on the bed.

V.42: the mark is 67 px (53 on a phone), its word 13 px like the site's type; the title word under the
landing and the bed's caption lose their hairline (the word alone).

V.41: the Works bed's hint line is gone; its caption is a sentence-case pill at the nav size, bottom
centre, like the title word on the landing; Sound moved up into the top row beside Works (Close ·
Works · Sound inside a project), so the bottom of the screen belongs to the title and the project copy.

V.40 (the same evening): the project's title is back bottom centre as a sentence-case word in the nav
style (click = into the project); the project copy sits 16 px further in from the edges; the write-up
column stays centred down to 600 px (the pane at 744 px used to get the phone layout); the sheet
leaves by fading (`exit: 'fade'` is the default). (branch `iaah-launch`, merged to `main`; GitHub Pages deploys from `main`).

## V.39 — pills, no View, the sheet as the study, one Works field, the original frozen (2026-11-05, evening)

Ness, on V.38, in a hurry: save this as a version on lab as **FOVEA V.2** and preserve the original;
rounded, quieter hairlines ("sophisticated buttons"); no button under a project; the project copy
at the label's size; the about exactly as the B1 study's screenshot; Works with no Commercial /
Personal split.

- **On lab, via the shares pipeline** (`~/CLAUDE/projects/shares/share.sh`'s Pages project, no gate change):
  https://lab.iamalwayshungry.com/s/fovea-v2/ = this build (V.39), https://lab.iamalwayshungry.com/s/fovea-v1/
  = the original V.35 of 2026-07-02. Both carry their own `content/`. The original is also frozen in
  the repo at `/v35.0/` (the snapshot convention: code only, `../content/`), live at
  nessim-higson.github.io/fovea/v35.0/.
- **Pills**: `.nav` is a 999px-radius hairline at .28 alpha (.22 ink on light imagery), 13px side
  padding. **No View word**: the cover itself (and Works) is the way in; the button is `display:none`.
- **The project copy** sets at 11/1.45 like the studies' label (44ch; full width on a phone).
- **The sheet is the study's own dark-theme look**: `#ecece8` paper, `#151514` type, the contact
  line at .6; no Close word (the mark or Esc closes it); the returns and the Instagram line stay.
- **Works is one field**: `CATS = ['Work']`, no category filter, no toggle.

## V.38 — the nav as words, Sound back, the project scrim (2026-11-05, later still)

Ness, on V.37: no boxes on the nav; no About word (the mark is the about); the paper square showing
behind the turning mark; Sound back; the nav words with a hairline round them, changing colour with
the imagery; a scrim at the bottom of a project so the copy reads.

- **The nav is words with a hairline** (`.nav` in `css/site.css`): transparent, 1 px rule at .45
  alpha, 11 px. Works top right (Close joins it inside a project), View bottom centre, Sound bottom
  right (a 6 px square marks it on). No About word; the mark opens the write-up.
- **The colour follows the imagery**: `sampleNav()` in `app.js` reads 8×8 px of the frame just drawn
  under each word (`gl.readPixels`, every 8th frame, before the buffer goes) and flips `.dark` with
  hysteresis (ink above .6 luminance, paper below .42). Inside a project the bottom words sit on
  the scrim, so Sound is forced light there.
- **The sheet shows nothing at rest** (`visibility:hidden` in `about.js` `rest()`): the level paper
  square used to peek out behind the turning mark.
- **Inside a project**: `body.in-project` raises `.scrim` (a black gradient, 46vh, .78 at the foot)
  under the copy, which sits bottom left in mute with an ink title line. The old paper-box card is gone.

## V.37 — the studies' type, the turning square, the ways out (2026-11-05, later)

Ness, on V.36: the B1 study's typeset, not the four comps; Helvetica handled as on the tempo studies
index; the mark's word must stay readable (the square turns, the word stays level, the square goes
black on the sheet); and studies of how the scrim comes *out*.

- **One type system now** (`css/site.css` top): the tempo studies' tokens verbatim — Helvetica Neue
  13/1.45 (15 on a phone), weights 400 and 500, sentence case, hairline `--line` rules, square 32 px
  buttons (40 on a phone) in mute with a hairline, the mark 56 px at 24/22 (44 at 16/16), a 60ch
  measure. Dark tokens for the chrome over the canvas, light (`#f4f4f1` paper, `#111` ink) on the
  sheet. The a–d type comps and `?type=` are gone.
- **The mark** is `<button class="metro"><i class="sq"></i><span>IAAH</span></button>`: `metroSq`
  takes the rotation (scroll-driven and `turnMetro`), the word never turns. On the sheet the square
  goes `#111`, the word `#f4f4f1`.
- **Ways out** (`js/about.js` EXITS, `?out=reverse|fade|lift|sweep|turn`, comps at `comps/out/`):
  reverse (the way in backwards, ships), fade, lift (off the top), sweep (off to the right), turn
  (a quarter back into the mark). `comps/index.html` lists Grow and Out in the studies' row style.
- The project card is the studies' label (a box of paper, bottom left, 11 px); View is the one
  pressed button, bottom centre, "View Katla →" in sentence case (`titleCase` on the scraped names).

## V.36 — IAAH, for the time being (2026-11-05)

Ness's call: get a new site up for iamalwayshungry.com now, on this build. What changed:

- **Type: Helvetica Neue** throughout, as tokens (`css/site.css` top). Four treatments as comps —
  `comps/type/` — and the live site takes any with `?type=a|b|c|d`. **B (Selects: 11 px medium caps chrome,
  13/1.45 write-up on a 60ch measure) ships** until Ness picks.
- **The opening** (`js/intro.js`, a classic script so it runs before three.js lands): tempo study A1 ported —
  the white square fills the screen, shrinks to the mark's size at the centre over 2 s, "I Am Always · Hungry"
  slides in beside it, a 1 s hold (click skips), a 180° turn fading a third in, then the chrome fades in as the
  work arrives. `window.__intro` resolves when app.js may fade the canvas up. `?intro=0` skips, `?intro=bare`
  drops the name. Reduced motion: the square, a hold, a dissolve.
- **The write-up** (`js/about.js`, from tempo study B1 Grow): click the mark or About; a white sheet grows out of
  the mark and the studio paragraph sets on it, ink on paper, with returns and an Instagram line
  (`@iamalwayshungry` — **handle unconfirmed**, Ness to check). The mark inverts and turns a quarter on open
  and close; the drift pauses while it is up. Five ways in, comps at `comps/grow/`, live with
  `?about=square|circle|wipe|turn|scrim`. **Square ships** until Ness picks. Close = open backwards at .6.
  The mark no longer pauses the motion (that click is the write-up now).
- **Controls hidden**: Lens, Sound, the G hint, the version pill, the beat dot carry `hidden` — the keyboard
  (G) still works. Top-right is About · Works; View stays bottom-centre.
- `layout()` retries next frame on a zero-size viewport (the browser pane opening used to poison every ratio
  and kill the frame loop); `updateNav` guards an out-of-range index.
- Not done: the domain. iamalwayshungry.com still points at the Nuxt site; moving it means a `CNAME` file here
  plus DNS at the registrar (A records to GitHub Pages or a CNAME to nessim-higson.github.io) — Ness's call.
- Still no tag / `/v36.0/` snapshot (the convention lapsed after V.24).

*The sharpest point of vision — the edges blur, the center holds.*

A portfolio site that is **one WebGL canvas**. Project images live as textures on
stacked planes; native page scroll moves the stack; a swappable full-screen
**effect pass** warps the result. The flagship pass — **Lens Tunnel** — is
reverse-engineered from the shipped shaders of vincent-lowe.info. Everything
since has been about owning that idea rather than copying the site.

- **Repo:** github.com/nessim-higson/fovea (public)
- **Live:** https://nessim-higson.github.io/fovea/ (GitHub Pages, legacy build from `main` root — plain pushes deploy)
- **Preview server:** `fovea` in `prototypes/.claude/launch.json`, port 4188
- **Current version: V.35** (pill top-right). No build step — vanilla ES modules, Three.js r0.160 + lil-gui from esm.sh via importmap (`app.js?v=35` cache-bust on module loads).

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

## Navigation (V.20–V.35 — the Works Bed era)

The V.16 rail/tabs scheme is **retired**. The nav-comps round (`comps/nav/`:
portal / drawer / orbital, then works-grid / works-bed) settled it: V.19 briefly
made the orbital a summonable INDEX; **V.20 made the Works Bed the global nav.**

- **Works Bed** (`js/worksbed.js`, imported by `app.js`): an infinite,
  scroll/swipe-able bed of every project cover with **ONE lens-tunnel pass over
  the whole field** (two-pass, same pipeline as the main site). `Works` zooms
  OUT from the landing to the bed; click a cover to zoom (dive) into the
  project; Esc zooms back. Point/scroll movement (no click-drag), touch swipe,
  center reticle. Opens showing the whole field, not zoomed onto one tile
  (V.32); fast thumbnails + per-tile fade-in (V.29); eager-prefetch.
- **Dive transitions**: focus-then-zoom into the clicked cover; grid↔project
  moves are crossfades, no hard renderer-swap (V.26); landing dive-in fades
  through black with a lens bloom, symmetric with the close (V.33–V.35).
- **Projects are self-contained tracks** (V.24) — the old single bleeding case
  track was divided; each project scrolls on its own, first image pinned to the
  top through async re-flow (V.34). Auto-play inside a project (V.28).
- **Video support** (V.30–V.31): Body Type clip + NEVVERLAND reel wired in,
  poster-first with poster fallback; reel integrated into the IAAH set.
- Detail card bottom-left survives; V.18 dropped the nameplate for a larger
  IAAH square (68px).

---

## Content sets

- **Default (bare URL) is now `config-iaah.js`** (V.21) — `app.js` loads
  `config-iaah.js` unless `?set=` says otherwise.
- **`config.js` / `?set=fovea`** — FOVEA content: the uniqlock-v2 stills +
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

Snapshots live at `/v1.0/` … `/v16.0/` + `/v24.0/`. (Older `/v1/`, `/v2/` are
pre-convention; V.17–23 and V.25–35 were never frozen.)

The version ladder (recent): V.15 **Feedback/Trails** (the lens-league win) ·
V.16 rail/tabs nav (retired) · V.18 nameplate drop · V.19 orbital INDEX (brief) ·
**V.20 Works Bed = global nav** · V.21 IAAH default + mobile perf ·
V.22–23 dive fixes · **V.24 self-contained project tracks** (last frozen
snapshot + tag) · V.25–29 bed/transition polish (crossfades, fast thumbs) ·
V.30–31 video (Body Type + NEVVERLAND reel, poster-first) · V.32–35 dive-in
smoothing (whole-field open, fade-through-black + lens bloom, pinned first image).

⚠️ **The convention lapsed after V.24**: V.25–V.35 have no `git tag` and no
`/vN.0/` snapshot. If work resumes, either backfill a `/v35.0/` freeze or accept
V.24 as the last frozen point.

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

- **V.35 is the head** (2026-07-02): landing → Works Bed → dive-into-project
  flow, IAAH as the default set, videos in. The project has been **dormant since
  early July** — no commits, no open work in flight.
- V.25–35 shipped without tags or snapshots (see the convention note above) —
  first order of business on resume.
- Working tree is clean except an untracked `.claude/` dir (local tooling, not
  content).
- The lens remains the one effect that feels genuinely deep; Feedback is the only
  peer. The rest are texture, not the headline.
- IAAH descriptions are scraped verbatim and a couple are truncated / placeholder
  (e.g. SQSP REBRAND is lorem). Worth a curation pass now that IAAH IS the
  default public set.

## Next (open, not started)

- Backfill the V.35 tag + `/v35.0/` snapshot (restore the freeze convention).
- Curate / split the IAAH sets (descriptions, ordering).
- Decide whether FOVEA-the-portfolio ships as-is or waits on more content;
  relation to the MINIMAL personal-site build is unresolved.
