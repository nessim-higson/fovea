# FOVEA — STATE

_Last updated: 2026-11-10_ · **V.59 — LIVE on https://iamalwayshungry.com**

**`.nojekyll` (10 Nov 2026).** The Pages build no longer runs Jekyll: files are served as they are. Two
reasons: Jekyll silently dropped `comps/_comps.css` (leading underscore, 404 on the domain), and the V.59
builds failed twice during a GitHub incident, so the lighter build has less to go wrong.

**V.59 — batch two is live (10 Nov 2026).** Six more from the Apple material, on Ness's word: The Arena
(13 plates, 5 films), East of Eden (his September cut: six material tests, two placements), Little House on
the Prairie, Kill Current (all 2026), Black Rabbit and Stranger Things (2025). 34 projects in all. Placement
shots in East of Eden and Little House are generated studies. Left out: the deck's outcome lines, the Fatal
Fury IP board, key art comps with placeholder billing, low-resolution title tests.

**V.58 — recent work is live (10 Nov 2026).** Four projects built from the Apple credentials material
(`prototypes/apple-creds`, a private repo) by `tools/stage_next.py`, at the head of the list: Ani-May (2026,
19 plates, 3 films), Sorcerer (2025), The Criterion Collection (2025, 16 plates, 2 films; it replaces the
six-render entry, whose folder stays for the frozen snapshots) and Crunchyroll (2024, 20 plates, 2 films).
Portrait work is composed into landscape plates (covers in pairs, posters in threes). Third-party material was
left out (a collector's unboxing reel, watermarked box photos, Criterion's product shots, manga reference
pages, Crunchyroll's own trailer) and so were the deck's unconfirmed outcome claims. To add more: add a project
to the script, run it, paste its entry from `next/projects.json` into `js/config-iaah.js`, regenerate `#covers`.

**True colour (V.58).** Textures no longer carry `SRGBColorSpace`: they were decoded to linear on sampling and
never encoded back, so the whole site showed darker and more saturated than the sources (Crunchyroll's orange
read red). Values now pass through untouched; `DETAIL_LIFT` is 1.0 (the 1.22 lift was compensating).

V.56 (more phone work): the auto-drift on touch is an offset (`driftPx`) added to the scroll instead of a
`scrollBy` every frame (Safari does real work on each programmatic scroll); the drift resets wherever the
scroll is set outright. Phones render at 1×. The slide shader's grain runs only in the ghost look. Nothing
is drawn while the opening still covers the canvas. Nav sampling every 20th frame on a phone. **The write-up has its own layer** (`#about-host`, z 35, above the bed's 30 and below the mark's 40), so the mark opens it from anywhere, the Works bed included; closing it there returns to the bed with the scroll still locked.

V.55: **the mark turns with the Works bed** (`onMotion` from `worksbed.js` → `turnMetroWith`, the landing's
rate at half, same °/s cap). **Phone performance:** both WebGL contexts without multisampling, depth or
stencil (`antialias:false`; a full-screen quad gains nothing from MSAA); render targets without depth
attachments; the feedback ping-pong buffers sized only when that effect is on; on touch devices the nav's
colour comes from a 3×3 luminance grid read once per image at load (`lumGrid`, `lumUnder`) instead of a
GPU readback every N frames (desktop keeps `readPixels`). `img.decode()` is raced against a 1.5 s timer:
it never settles in a hidden tab and would stall the whole loader. Debug: `__slides`, `__lumUnder`, `__bed.debug()`.

V.54 (6 Nov): **the mark is top left on every screen** — `.metro` lives outside `.overlay` at z 40 (above
the bed's 30); on the bed a click is the way home. **Loading:** every full image has a 1400 px WebP
beside it (`NN_m.webp`, cwebp q78, ~a third of the JPEG) and every thumb a WebP (`NN_t.webp`); the loader
asks for the WebP and falls back to the JPEG on error. The opening (`intro.js`) now chooses the landing
project (`window.__start`, from the covers inlined in `index.html` as `#covers`) and starts its cover
download at t=0; `index.html` preconnects to esm.sh and modulepreloads three.mjs; lil-gui is imported only
on the first G. The bed's frame loop survives a zero-size viewport. Regenerate derivatives after adding
images: `cd content/iaah && find . -name '[0-9][0-9].jpg' -exec sh -c 'cwebp -q 78 -resize 1400 0 -m 6 "$1" -o "${1%.jpg}_m.webp"' _ {} \;`
and the same for `_t.jpg` → `_t.webp` at q72 without resize.

V.53: the phone's jump, properly — on a touch device `layout()` sizes the loop to the LARGE viewport from
the first frame (a `100lvh` probe, `largeViewportHeight()`), so the address bar folding away on the first
drag changes nothing: no relayout, no remap. The V.52 ratio scaling stays for real height changes
(rotation). Covers and project images fade up over 500 ms as they land (`holder.landed`) instead of popping.

V.52: the phone's first-drag blip — the loop's unit is VH, so when the address bar folds away on the first
drag (height grows, `layout()` re-runs) the same scrollY landed on a different project. `layout()` now
scales the scroll position and `smooth` by the height ratio, so the place in the loop is kept.

V.51: the drop slower, with its ease-in — a spring from rest (ζ .72, ω 8, 1.5 s) is the default; `?drop=quick`
(ω 11, 1.2 s), `slow` (ω 6.5, 1.8 s), `slower` (ω 5.5, 2.1 s) to compare. The type starts at 42 % of the drop.

V.50: the write-up's sheet drops in from the top (`variant: 'wipe'` is now a translateY drop, the default):
1.1 s on a spring (ζ .72, ω 13, as a `linear()` easing from the studies' `spring()`; expo where
`linear()` is unsupported), a 4 % overshoot hidden by 20 % headroom above the sheet; the type rises on the
expo from 380 ms as the sheet lands. The exit stays the fade.

V.49: the phone's load lag — a phone now renders at 1.25× (was 1.5), loads one cover at a time (desktop
three), decodes each image off the main thread (`img.decode()`) before the canvas scale, caps covers at
1000 px, loads only the landing cover and its two neighbours before the opening has run (the rest 1.5 s
after), and samples the nav colour every 30th frame (the readback stalls the GPU; desktop every 8th).
The title word under the landing has a faint stroke again (.16 alpha) so it reads as a thing to press.

V.48 (evening): **the Works bed glides on touch** — the finger's velocity over its last 100 ms carries on
after the lift and decays at 0.998/ms (iOS's normal rate, capped at 4 px/ms), a finger or a wheel stops it
(`vx/vy` in `worksbed.js`); the Apple page it was measured against scrolls natively, so native momentum is
the target. **A loader queue** (`queueLoad`/`pumpLoads` in `app.js`): three loads at a time; the landing
cover first, then its neighbours either way round the loop; a project's images in order, ahead of the
queue; disposed holders are skipped. **Sound is on by default**: the first pointerdown or key anywhere
starts it (browser policy needs a gesture) unless the visitor pressed the word themselves. **The bed's
close is the word Close**; the × stays for a project. V.47: small words lowercase inside titles.

V.46: the landing starts on a random project each visit (`START` in `app.js`; `?start=<n>` pins one).

**The domain moved on 5 Nov 2026 (afternoon).** DNS stayed at Media Temple, edited through GoDaddy's DNS
page for the domain (dcc.godaddy.com → Portfolio → iamalwayshungry.com → DNS): the apex A record went
from Netlify (75.2.60.5) to GitHub Pages' four addresses (185.199.108–111.153), `www` from
antinomy-iaah.netlify.app to `nessim-higson.github.io`. Mail (Google Workspace MX ×7) untouched. The
custom domain is set on the Pages site (`CNAME` file in the repo, committed by GitHub). GitHub only
started the certificate after the domain was removed and re-added (`PUT …/pages {"cname":null}` then
`-f cname=iamalwayshungry.com`); it covers apex + www, expires 2027-02-03, renews itself. **Enforce
HTTPS** is the remaining toggle (`gh api -X PUT repos/nessim-higson/fovea/pages -F https_enforced=true`).
nessim-higson.github.io/fovea now redirects to the domain; lab…/s/fovea-v2 is a separate copy and
stays. The old Netlify site is untouched in its own account, reachable only by its netlify.app URL.

V.45: the × is drawn as two hairlines (centred to the pixel) and fades and settles in when a project
opens, instead of popping.

**The domain, as found on 5 Nov 2026 (not yet moved):** iamalwayshungry.com's authoritative DNS is Media
Temple (ns1/ns2.mediatemple.net; registrar GoDaddy), not Cloudflare — the Cloudflare zone 4ae077f7… is a
partial setup that only carries the subdomains (lab, archive, riftbound point at pages.dev). The apex
and www resolve to Netlify (75.2.60.5, antinomy-iaah.netlify.app), which serves the old Nuxt site. Two
ways to go live on the domain, both Ness's to unlock: (a) deploy this build to that Netlify site, no
DNS change; (b) at Media Temple set the apex A records to GitHub Pages (185.199.108.153, .109.153,
.110.153, .111.153) and www CNAME to nessim-higson.github.io, then add a `CNAME` file here and enforce
HTTPS. Do NOT add the CNAME file before DNS points at GitHub: it would redirect the github.io URL to the
Netlify site.

V.44: inside a project the scrim is shorter (36vh, 340px at most) and the copy sits lower and further
in (56 px from the left on a laptop, 36 on a phone).

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
