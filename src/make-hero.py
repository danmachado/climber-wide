# Packs a hero animation pack (native 16px strips + manifest) into the sheet the game embeds.
import json, base64, io, sys
from PIL import Image
def rgb(h): h = h.lstrip('#'); return [int(h[i:i+2], 16) for i in (0, 2, 4)]
# WHICH HERO THE GAME USES. Change this one line, then run:  python3 make-hero.py && node build.js
#   'lantern'        the simple lantern character drawn in code (no sprite sheet)
#   'hero-mustache'  Dan's mustached hero (sprite pack in hero-mustache/)
#   'hero'           the earlier human with the orange hat (sprite pack in hero/)
#   'hero-wolf'      the lone climber with the bandana (drawn in code by hero-wolf/draw.py; the tails are simulated in the game)
#   'hero-army'      the army guy with the rifle (Dan's armyguy.png, posed by hero-army/draw.py; tails simulated in the game)
HERO_CHOICE = 'hero-wolf'

# colour roles per pack: the game recolours these for "dash used" and "tired", and takes its effect colours from here
ROLES = {
    'hero': {
        'spent': '#8A482C',                                                   # badge when the dash is used: hat band brown
        'tired': [['#6391D7', '#355A9D'], ['#F1C69A', '#C89468']],            # low stamina: shirt and skin drop to their shadow tones
        'trail': ['#F47A20', '#F1C69A'], 'burst': ['#f1c69a', '#f47a20'],
    },
    'hero-mustache': {
        'spent': '#3A2E14',                                                   # belt buckle goes dull when there is not enough stamina to dash
        'tired': [['#FFFFFF', '#C9CEDD'], ['#E0E0E0', '#A9AFC2'], ['#EEC39A', '#CFA07A'], ['#EABD8B', '#C2936C']],   # low stamina: shirt and skin go grey and flat
        'trail': ['#FFFFFF', '#EEC39A'], 'burst': ['#ffffff', '#eec39a'],     # dash afterimages and the death burst: shirt white, then skin
    },
    'hero-wolf': {
        'spent': '#5A5F6E',                                                   # band goes slate grey when there is not enough stamina to dash
        'spentPairs': [['#F05C46', '#6E7382'], ['#D93A2E', '#5A5F6E'], ['#A0261E', '#40444F']],   # every shade of the band, not just one
        'tired': [['#606E58', '#3E483A'], ['#3E483A', '#2C342A'], ['#D8A77A', '#B2805A'], ['#B2805A', '#8C6244'], ['#9A6D4C', '#7A5238']],   # low stamina: shirt and skin drop a tone (far arm too)
        'trail': ['#D93A2E', '#D8A77A'], 'burst': ['#d93a2e', '#d8a77a'],     # afterimages and the death burst: bandana red, then skin
        'chain': { 'can': ['#D93A2E', '#F05C46'], 'spent': ['#5A5F6E', '#6E7382'], 'tired': ['#C47F24', '#FFB74A'], 'flash': '#FFFFFF', 'hair': '#543A30' },   # the simulated tails and the lock of hair
    },
    'hero-army': {
        'spent': '#5A5F6E',                                                   # bandana goes slate grey when there is not enough stamina to dash
        'spentPairs': [['#AC3232', '#5A5F6E'], ['#8E2A2A', '#40444F']],       # the band and its knot
        'tired': [['#4B692F', '#323C39'], ['#524B24', '#323C39'], ['#EEC39A', '#D9A066'], ['#D9A066', '#B8824C'], ['#B8824C', '#8C6244']],   # low stamina: vest and skin drop a tone
        'trail': ['#AC3232', '#EEC39A'], 'burst': ['#ac3232', '#eec39a'],     # afterimages and the death burst: bandana red, then skin
        'chain': { 'can': ['#AC3232', '#C84040'], 'spent': ['#5A5F6E', '#6E7382'], 'tired': ['#C47F24', '#FFB74A'], 'flash': '#FFFFFF', 'hair': '#45283C' },   # the simulated tails and the lock of hair
    },
}
PACK = HERO_CHOICE if HERO_CHOICE != 'lantern' else 'hero-mustache'           # the lantern still carries a sheet, it just is not switched on
USE_SPRITES = HERO_CHOICE != 'lantern'
R = ROLES[PACK]
m = json.load(open(PACK + '/hero-animation-manifest.json'))
pal = {v['hex'].upper(): k for k, v in m['palette'].items()}
rows = m['animations']
atlas = Image.new('RGBA', (max(a['frameCount'] for a in rows) * 16, 16 * len(rows)), (0, 0, 0, 0))
meta = {}
for i, a in enumerate(rows):
    im = Image.open(PACK + '/hero-%s.png' % a['name']).convert('RGBA')
    assert im.size == (a['frameCount'] * 16, 16), (a['name'], im.size)
    atlas.paste(im, (0, i * 16))
    meta[a['name']] = {'row': i, 'n': a['frameCount'], 'fps': a['fps'] or 16, 'loop': bool(a['loop'])}
    if a.get('anchors'): meta[a['name']]['anchors'] = a['anchors']
    if a.get('muzzles'): meta[a['name']]['muzzles'] = a['muzzles']        # aim animations: where the blaster's muzzle is, per frame
    if a.get('loopFrom') is not None: meta[a['name']]['from'] = a['loopFrom']   # play once, then loop from this frame
buf = io.BytesIO(); atlas.save(buf, 'PNG', optimize=True)
cfg = {
    'enabled': USE_SPRITES,
    'frame': 16,
    'dashColor': rgb(m['dashIndicator']['hex']),
    'spentColor': rgb(R['spent']),
    'spentPairs': [[rgb(a), rgb(b)] for a, b in R.get('spentPairs', [])],
    'chain': R.get('chain'),
    'tired': [[rgb(a), rgb(b)] for a, b in R['tired']],
    'trail': [rgb(c) for c in R['trail']],
    'burst': R['burst'] if USE_SPRITES else ['#ffe9b8', '#ffb74a'],          # death, respawn and trail colours
    'anims': meta,
    'src': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
}
open('shared-hero.js', 'w').write("  // ---- hero sprite sheet: 16 x 16 frames, one row per animation, facing right (" + m['design'] + ") ----\n  var HERO = " + json.dumps(cfg) + ";\n")
print('hero:', HERO_CHOICE, '| sheet', atlas.size, 'colours', len(pal))
