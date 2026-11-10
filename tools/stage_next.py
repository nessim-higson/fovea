#!/usr/bin/env python3
"""fovea · tools/stage_next.py — build projects for the site from the Apple credentials material.

Sources are in the private apple-creds repo (~/CLAUDE/projects/prototypes/apple-creds). For each project below it
writes content/iaah/<slug>/NN.{jpg,_m.webp,_t.jpg,_t.webp} (+ NN.mp4 with its poster NN.jpg), next/projects.json
(the entries for js/config-iaah.js) and next/sheet-<slug>.jpg (a plan sheet: the sequence in order). next/ is not
tracked. Went live 10 Nov 2026 (V.58): Ani-May, Sorcerer, The Criterion Collection, Crunchyroll.
Run from the repo root: python3 tools/stage_next.py [slug ...] [--preview]
"""
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

SRC = os.path.expanduser('~/CLAUDE/projects/prototypes/apple-creds')
OUT = 'next'
BLACK = (0, 0, 0)

def find(n):
    for d in ('assets/src', 'renders', 'assets/motion', 'site/assets'):
        for ext in ('jpg', 'png', 'jpeg'):
            p = f'{SRC}/{d}/{n}.{ext}'
            if os.path.exists(p): return p
    sys.exit(f'missing image: {n}')
def load(n): return Image.open(find(n)).convert('RGB')

# ── boards: several pictures composed into one landscape plate on black ──
def row(names, h=1500, gutter=28, margin=64, bg=BLACK):
    ims = []
    for n in names:
        im = load(n); im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS); ims.append(im)
    w = sum(i.width for i in ims) + gutter * (len(ims) - 1) + 2 * margin
    B = Image.new('RGB', (w, h + 2 * margin), bg); x = margin
    for i in ims: B.paste(i, (x, margin)); x += i.width + gutter
    return B
def centred(name, like_w, h=1500, margin=64, bg=BLACK):
    """one picture centred on a plate as wide as a pair, so it sits in the same rhythm"""
    im = load(name); im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    B = Image.new('RGB', (like_w, h + 2 * margin), bg); B.paste(im, ((like_w - im.width) // 2, margin)); return B
def plate(name, w=1800, h=1012, bg=BLACK, scale=1.0):
    """one picture at its own size (times scale), centred on a plain plate: small marks stay crisp"""
    im = load(name)
    if scale != 1.0: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if im.width > w - 120: im = im.resize((w - 120, round(im.height * (w - 120) / im.width)), Image.LANCZOS)
    if bg is None: bg = im.getpixel((2, 2))   # the picture's own ground, so no box shows round it
    B = Image.new('RGB', (w, h), bg); B.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); return B
def crop_to(im, w, h):
    s = max(w / im.width, h / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - w) // 2; y = (im.height - h) // 2; return im.crop((x, y, x + w, y + h))
def grid(names, cols=2, cw=1200, ch=675, gutter=0, margin=0, bg=BLACK):
    rows = (len(names) + cols - 1) // cols
    B = Image.new('RGB', (cols * cw + (cols - 1) * gutter + 2 * margin, rows * ch + (rows - 1) * gutter + 2 * margin), bg)
    for i, n in enumerate(names):
        B.paste(crop_to(load(n), cw, ch), (margin + (i % cols) * (cw + gutter), margin + (i // cols) * (ch + gutter)))
    return B

S = lambda n, note='': ('img', n, note)                 # a single picture
B = lambda fn, label, note='': ('board', fn, label, note)   # a composed plate
V = lambda n, note='', at=None: ('film', n, note, at)   # a film from site/assets (muted loop on the site); at = the second its poster frame is taken (default: the film's own poster)

PAIR_W = row(['cc-parasite', 'cc-mirror']).width

PROJECTS = [
  # ── batch two (staged 10 Nov 2026) ──
  dict(slug='east-of-eden', client='EAST OF EDEN', title='Title treatment, teaser campaign, Netflix', year=2026,
    description="Netflix's limited series of John Steinbeck's novel. IAAH helped develop a Visual Vocabulary approach for the series, the title treatment and key art, and the teaser campaign.",
    seq=[
      S('eoe-mat-velvet', 'cover: gold on velvet'),
      S('eoe-mat-print', 'woodblock print'), S('eoe-mat-lace', 'lace'), S('eoe-mat-mirror', 'antique mirror'),
      S('eoe-mat-linen', 'linen'), S('eoe-mat-branches', 'branches'),
      S('r31-eoe-artsdistrict', 'placement study: Arts District, Los Angeles'),
      S('r32-eoe-soho', 'placement study: Prince Street, SoHo'),
    ]),

  dict(slug='little-house', client='LITTLE HOUSE ON THE PRAIRIE', title='Brand, title treatment, key art, Netflix', year=2026,
    description="Netflix's return to the books of Laura Ingalls Wilder. IAAH developed the brand, the title treatment and the main key art.",
    seq=[
      S('xpage-057', 'cover: the key art, horizontal'),
      V('lh-title', 'the title, 8 s', at=5),
      B(lambda: row(['lh-ka-vertical-billed', 'lh-ka-vertical-clean'], h=1600), 'the vertical key art, billed and clean'),
      S('lh-ka-horizontal', 'the banner'),
      V('lh-seq', 'the sequence, 9 s', at=4.5),
      S('r35-lh-sunset-strip', 'placement study: Sunset Boulevard'),
      S('r04-lh-wallwrap', 'placement study: a wall wrap'),
      S('r10-lh-underground', 'placement study: underground'),
    ]),

  dict(slug='kill-current', client='KILL CURRENT', title='Announcement film, title design', year=2026,
    description='The announcement film for Kill Current, a Jon Hendricks thriller, with Keanu Reeves. Circuitry as landscape, in black and white, resolving into a title and a name. For The Arena, Zando and Two Dragonflies.',
    seq=[
      S('kc-frame-22', 'cover: the title'),
      V('kc-film', 'the announcement film, 30 s'),
      S('x033-01', 'circuitry drawn as landscape'),
      S('kc-frame-06'), S('kc-frame-14'), S('kc-frame-18'),
      B(lambda: grid(['kc-frame-02', 'kc-frame-10', 'kc-frame-26', 'kc-frame-30']), 'frames from the film'),
      V('kc-site', 'jonhendricks.com, 16 s'),
      V('kc-end', 'the end card, 8 s'),
    ]),

  dict(slug='the-arena', client='THE ARENA', title='Core brand, strategy, guidelines', year=2026,
    description='A new entertainment company in Los Angeles, uniting the worlds of gaming, fighting and live action. The partnership began with the core brand and continued into strategy: how the different forms of Arena IP work in hierarchy, parent to child, platform to franchise.',
    seq=[
      S('arena-mark', 'cover: four rings, read as a portal'),
      V('arena-portal', 'the portal opens, 3 s', at=2.2),
      S('x009-01', 'the rings in perspective'),
      S('x010-01', 'a second construction'),
      B(lambda: plate('arena-wordmark', h=760, scale=.8), 'the wordmark'),
      B(lambda: grid(['arena-portal-phone', 'arena-portal-ice', 'arena-portal-stadium', 'arena-portal-fire']), 'the portal: a phone, ice, a stadium, fire'),
      V('arena-light', 'as a tunnel of light, 5 s'),
      V('arena-concrete', 'as a concrete portal, 5 s'),
      S('arena-wildposting', 'titles wild-posted in Los Angeles'),
      V('arena-r3', 'the rings in motion, 3 s', at=1.7),
      B(lambda: grid(['arena-engine-1', 'arena-engine-2', 'arena-engine-3', 'arena-engine-6']), 'the Ring Engine: the mark as a generator'),
      S('arena-engine-4'),
      V('arena-engine', 'the Ring Engine, live, 17 s'),
    ]),

  dict(slug='black-rabbit', client='BLACK RABBIT', title='Title treatment, key art, Netflix', year=2025,
    description="Title treatment and key art for Netflix's Black Rabbit. The mark is a rabbit cut from torn paper and photocopy grain: a title that reads as evidence rather than decoration.",
    seq=[
      S('br-type-01-poster', 'cover: the letters, cut and recut'),
      V('br-type-01', 'motion sketches: the letters, 5 s'),
      S('br-shelter', 'bus shelter, New York'),
      B(lambda: row(['br-print-1', 'br-print-2', 'x069-03'], h=956, gutter=24, margin=48), 'prints'),
      V('br-type-02', 'motion sketches: the rabbit, the mask, the man, 5 s'),
      B(lambda: plate('br-mark', bg=None, scale=1.4), 'the mark'),
      S('br-wall', 'wild posting'),
    ]),

  dict(slug='stranger-things', client='STRANGER THINGS', title='Design system, Netflix', year=2025,
    description='A franchise that carries as much cultural weight as the Netflix brand itself. As the universe expands into spin-offs, events and global campaigns, the system keeps every extension recognisably Stranger Things: brand DNA and a design hierarchy that tell fans what is new.',
    seq=[
      S('xpage-102', 'cover: Vecna'),
      S('xpage-095', 'the franchise as a system'),
      S('x096-01', 'one hierarchy, every extension'),
      S('xpage-097', 'the universe, collected'),
      S('xpage-098', 'brand DNA: the star, the icons, the faces'),
      S('x099-01', 'the IP title template'),
      S('xpage-100', 'Hivemind'),
      S('xpage-101', 'the lockups, in a grid'),
      S('xpage-103', 'social, three titles'),
      S('xpage-104', 'four seasons, one motion language'),
      S('xpage-105', 'in the Netflix product'),
      S('x106-01', 'on a tee'),
    ]),

  dict(slug='ani-may', client='ANI-MAY', title='Campaign identity, Crunchyroll', year=2026,
    description='A global initiative to take over the month of May and make it all about anime, with and for its fans. IAAH designed the campaign identity and the style guide every market worked from.',
    seq=[
      S('am-p28', 'cover'),
      V('animay-03', 'the type system moving, 8 s'),
      B(lambda: row(['am-poster', 'am-p13'], h=1600), 'posters'),
      S('x039-02'), S('x040-01'), S('am-threeup'),
      V('animay-expansion', 'the messaging system expanding, 5 s'),
      S('am-p72'), S('am-p73'), S('am-p62'), S('am-p59'), S('am-p60'), S('am-p80'),
      S('am-timessquare', 'Times Square'), S('am-street'), S('am-mall'), S('am-shopfront'),
      B(lambda: row(['am-billboard-tall', 'am-hall', 'am-tower'], h=1400), 'in the world: Los Angeles, a hall, the tower'),
      V('animay-spot-end', 'the wordmark closing the 30 s spot, 3.5 s'),
    ],),

  dict(slug='sorcerer', client='SORCERER', title='Design, The Criterion Collection', year=2025,
    description="Cover design for William Friedkin's Sorcerer for the Criterion Collection. The routes on the way: the trucks, the skull, the stone idol, and the red glyph that became the cover.",
    seq=[
      S('cc-sorcerer', 'cover: the final'),
      B(lambda: row(['cc-sorcerer-02', 'cc-sorcerer-03']), 'the trucks'),
      B(lambda: row(['cc-sorcerer-04', 'cc-sorcerer-07']), 'the skull'),
      B(lambda: row(['cc-sorcerer-05', 'cc-sorcerer-06']), 'the stone idol'),
      B(lambda: row(['cc-sorcerer-08', 'cc-sorcerer-cover']), 'the red glyph, and the cover'),
    ],),

  dict(slug='criterion', client='THE CRITERION COLLECTION', title='Key art', year=2025,
    description='Covers, box sets and title treatments for the Criterion Collection since 2014, one film at a time. Seventeen titles so far, among them Parasite, World of Wong Kar Wai, Sorcerer, Dead Man, Mirror and Andrei Rublev.',
    seq=[
      S('cc-ren-cam02', 'cover: the spines'),
      V('crtrn-01', 'a cover turning in the light, 12 s'),
      B(lambda: row(['cc-ren-cam01', 'cc-ren-cam03'], margin=0, gutter=0), 'the spines'),
      B(lambda: row(['cc-parasite', 'cc-mirror']), 'Parasite · Mirror'),
      B(lambda: row(['cc-teorema', 'cc-codeunknown']), 'Teorema · Code Unknown'),
      B(lambda: row(['cc-clouds', 'cc-ytumama']), 'Clouds of Sils Maria · Y Tu Mamá También'),
      B(lambda: row(['cc-phoenix', 'cc-rublev']), 'Phoenix · Andrei Rublev'),
      B(lambda: row(['cc-deadman', 'cc-thetrial']), 'Dead Man · The Trial'),
      B(lambda: row(['cc-actorsrevenge', 'cc-fayadayi']), "An Actor's Revenge · Faya Dayi"),
      B(lambda: row(['cc-beasts', 'cc-sorcerer']), 'Beasts of No Nation · Sorcerer'),
      B(lambda: row(['cc-evesbayou', 'cc-burial-1']), "Eve's Bayou · This Is Not a Burial"),
      B(lambda: row(['cc-ren-st02', 'cc-ren-st06', 'cc-ren-st08'], margin=0, gutter=0), 'standing: Parasite, Teorema, Mirror'),
      B(lambda: row(['cc-ren-st03', 'cc-ren-st07', 'cc-ren-st01'], margin=0, gutter=0), 'standing: Phoenix, Andrei Rublev, Dead Man'),
      V('crtrn-02', 'World of Wong Kar Wai, turning, 12 s'),
      B(lambda: centred('cc-wkw-box', PAIR_W), 'World of Wong Kar Wai'),
      B(lambda: row(['iaah-cc-c-fan', 'iaah-cc-c-case'], margin=0, gutter=0), 'the C'),
    ],),

  dict(slug='crunchyroll', client='CRUNCHYROLL', title='Rebrand', year=2024,
    description='A rebrand built on more than 139 anime-inspired glyphs and textures and a seven-second audiovisual mnemonic. In research the glyphs proved an immediate gateway into the world of anime, so they run through the headlines and every communication.',
    seq=[
      S('cr-tile-1', 'cover'),
      V('cr-mnemonic', 'the mnemonic, 7 s'),
      S('cr-wordmark'),
      B(lambda: row(['x076-01', 'x077-01', 'x078-01'], h=1081, margin=0, gutter=0), 'the glyph families: speech, sound, action'),
      S('cr-alphabet'), S('cr-headline-home'), S('cr-headline-eye'), S('cr-headline-streaming'),
      B(lambda: row(['x086-01', 'x086-02', 'x086-03'], h=1500, gutter=40), 'posters'),   # the export's posters: cr-poster-1 is a dimmed copy
      B(lambda: grid(['cr-tile-2', 'cr-tile-3', 'cr-tile-4', 'cr-phone']), 'title cards'),
      S('cr-anime-wall'), S('cr-phone-2'), S('cr-frieren'),
      S('cr-ooh-wall'), S('cr-ooh-1'), S('cr-ooh-2'), S('cr-ooh-3'),
      B(lambda: grid(['cr-merch-1', 'cr-merch-2', 'cr-merch-3', 'cr-merch-4']), 'merchandise'),
      B(lambda: row(['cr-social-1', 'cr-social-2', 'cr-social-3'], h=1080, gutter=40), 'social'),
      V('cr-hype', 'the hype film, 54 s'),
    ],),
]

def save_all(im, base, quality=84):
    if im.width > 1800: im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
    if im.height > 2200: im = im.resize((round(im.width * 2200 / im.height), 2200), Image.LANCZOS)
    im.save(base + '.jpg', quality=quality, optimize=True, progressive=True)
    t = im.copy(); t.thumbnail((600, 600), Image.LANCZOS); t.save(base + '_t.jpg', quality=78, optimize=True)
    rs = ['-resize', '1400', '0'] if im.width > 1400 else []
    subprocess.run(['cwebp', '-quiet', '-q', '78', '-m', '6', *rs, base + '.jpg', '-o', base + '_m.webp'], check=True)
    subprocess.run(['cwebp', '-quiet', '-q', '72', '-m', '6', base + '_t.jpg', '-o', base + '_t.webp'], check=True)
    return im

def font(size, bold=False):
    try: return ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', size, index=1 if bold else 0)
    except Exception: return ImageFont.load_default()

def wrap(d, text, f, w):
    out, line = [], ''
    for word in text.split():
        t = (line + ' ' + word).strip()
        if d.textlength(t, font=f) > w and line: out.append(line); line = word
        else: line = t
    return out + [line]

def sheet(p, items):
    """the plan for one project as a picture: header, the sequence in order, what was left out, the open points"""
    W, pad, cols = 2400, 56, 5; cw = (W - 2 * pad - (cols - 1) * 20) // cols; ch = round(cw * .62); lab = 58
    rows = (len(items) + cols - 1) // cols
    lo = p.get('left_out', []); fl = p.get('flags', [])
    tmp = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    desc = wrap(tmp, p['description'], font(30), W - 2 * pad - 200)
    head = 150 + len(desc) * 40 + 40
    H = head + rows * (ch + lab) + 60 + (ch // 2 + 150 if lo else 0) + len(fl) * 44 + 100
    S_ = Image.new('RGB', (W, H), (21, 21, 20)); d = ImageDraw.Draw(S_)
    ink, mute, faint = (236, 236, 232), (141, 141, 135), (85, 85, 79)
    d.text((pad, 50), f"{p['client'].title().replace('Ani-May', 'Ani-May')}", font=font(56, True), fill=ink)
    d.text((pad, 122), f"{p['title']} · {p['year']} · {len(items)} plates, {sum(1 for i in items if i['film'])} films", font=font(28), fill=mute)
    y = 176
    for l in desc: d.text((pad, y), l, font=font(30), fill=ink); y += 40
    y = head
    for i, it in enumerate(items):
        x = pad + (i % cols) * (cw + 20); yy = y + (i // cols) * (ch + lab)
        im = Image.open(it['jpg']).convert('RGB'); im.thumbnail((cw, ch), Image.LANCZOS)
        d.rectangle([x, yy, x + cw, yy + ch], fill=(10, 10, 10)); S_.paste(im, (x + (cw - im.width) // 2, yy + (ch - im.height) // 2))
        if it['film']: d.rectangle([x + 10, yy + 10, x + 92, yy + 44], fill=ink); d.text((x + 20, yy + 14), 'FILM', font=font(22, True), fill=(21, 21, 20))
        d.text((x, yy + ch + 8), f"{i:02d}", font=font(22, True), fill=ink)
        d.text((x + 38, yy + ch + 8), (it['label'] or '')[:40], font=font(22), fill=mute)
    y = head + rows * (ch + lab) + 30
    if lo:
        d.text((pad, y), 'LEFT OUT', font=font(22), fill=faint); y += 40
        tw = cw // 2
        for k, (n, why) in enumerate(lo):
            x = pad + k * (tw + 190 + 20)
            im = load(n); im.thumbnail((tw, ch // 2), Image.LANCZOS); S_.paste(im, (x, y))
            for j, l in enumerate(wrap(d, why, font(20), 180)): d.text((x + tw + 12, y + j * 26), l, font=font(20), fill=mute)
        y += ch // 2 + 40
    for f_ in fl:
        d.text((pad, y), '—', font=font(24), fill=faint); d.text((pad + 40, y), f_, font=font(24), fill=ink); y += 44
    S_.save(f"{OUT}/sheet-{p['slug']}.jpg", quality=86)

def main():
    os.makedirs(OUT, exist_ok=True)
    only = [a for a in sys.argv[1:] if not a.startswith('--')]   # slugs to build; none = all
    notes = json.load(open(f'{OUT}/review.json')) if os.path.exists(f'{OUT}/review.json') else {}   # local review notes, not tracked
    cfg = []
    for p in PROJECTS:
        if only and p['slug'] not in only: continue
        p.update(notes.get(p['slug'], {}))
        d = f"content/iaah/{p['slug']}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(d); items = []; paths = []
        for i, it in enumerate(p['seq']):
            base = f'{d}/{i:02d}'
            if it[0] == 'img': save_all(load(it[1]), base); items.append(dict(jpg=base + '.jpg', film=False, label=it[2] or it[1])); paths.append(base + '.jpg')
            elif it[0] == 'board': save_all(it[1](), base); items.append(dict(jpg=base + '.jpg', film=False, label=it[2])); paths.append(base + '.jpg')
            else:
                shutil.copy(f'{SRC}/site/assets/{it[1]}.mp4', base + '.mp4')
                if it[3] is not None:   # a frame of the film as its poster (its own poster is black)
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(it[3]), '-i', base + '.mp4', '-frames:v', '1', '-q:v', '3', base + '.jpg'], check=True)
                else:
                    Image.open(f'{SRC}/site/assets/{it[1]}-poster.jpg').convert('RGB').save(base + '.jpg', quality=84)   # the poster the site shows first
                items.append(dict(jpg=base + '.jpg', film=True, label=it[2])); paths.append(base + '.mp4')
        sheet(p, items)
        cover = next(x for x in paths if x.endswith('.jpg'))
        cfg.append(dict(client=p['client'], title=p['title'], category='Commercial', year=p['year'], image=cover, images=paths, description=p['description']))
        size = sum(os.path.getsize(f'{d}/{f}') for f in os.listdir(d)) / 1048576
        print(f"{p['slug']:12s} {len(paths):2d} items  {size:5.1f} MB")
    json.dump(cfg, open(f'{OUT}/projects.json', 'w'), indent=2, ensure_ascii=False)
    if '--preview' in sys.argv:   # js/config-next.js (not tracked): what was just built, ahead of the live list, for ?set=next
        with open('js/config-next.js', 'w') as f:
            f.write("// LOCAL PREVIEW ONLY: written by tools/stage_next.py --preview\n")
            f.write("import { SITE as S, PROJECTS as LIVE, SETTINGS as T } from './config-iaah.js';\nexport const SITE = S; export const SETTINGS = T;\n")
            f.write("export const PROJECTS = [..." + json.dumps(cfg, indent=2, ensure_ascii=False) + ", ...LIVE];\n")

if __name__ == '__main__': main()
