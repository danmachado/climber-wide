# Quality test for the army guy pack (adapted from hero-wolf/audit.py: his chin is one row deeper below the band, the vest
# is drawn three-quarter so it is wider than a side-on shirt, and the arms bounce with the rifle instead of swinging). Reads what the game ships (the hero-*.png strips and the manifest), not draw.py,
# and fails if any frame breaks the rules below. Run after draw.py:   python3 audit.py      (exit code 1 on failure)
#
#   one piece      every frame is a single connected sprite: no floating head, no loose legs or hands
#   no gaps        no empty row or column inside the sprite (the "gap between the head and the body")
#   knot           every frame has the bandana knot (the game hangs the tails from it), behind the face
#   facing         the nose is the front-most pixel of the face, the knot is behind it (sheet faces right)
#   feet           grounded animations keep a boot on the bottom row in every frame
#   idle alive     the idle moves the body, not just the head: chest, shoulders, arms and legs change, and the head
#                  always moves with the torso (same offset), never on its own
#   run cycle      the two boots swap front and back (a real stride), the rifle and hand bounce with the stride,
#                  the body bobs, and no two frames in a row are the same
#   squash/stretch landing and spawn start shorter than standing, take-off is taller or the same
#   arm length     every arm is 4 pixels shoulder to hand, 5 when reaching (from the manifest's per-frame arm lengths)
#   arms           arms are shaded limbs, not one-pixel lines: in the idle every arm shows a lit and a shadow tone and
#                  is two pixels thick somewhere (the upper arm)
#   feet           boots are tall and narrow: no boot is more than 2 px wide on any row (no skateboard feet)
#   wall           on the wall animations the hands reach the wall face and the climb alternates hands
import json, os, sys
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))
m = json.load(open('hero-animation-manifest.json'))
rev = {tuple(int(v['hex'][i:i + 2], 16) for i in (1, 3, 5)): k for k, v in m['palette'].items()}
FR = {}
for a in m['animations']:
    im = Image.open('hero-%s.png' % a['name']).convert('RGBA')
    frames = []
    for f in range(a['frameCount']):
        g = [['.'] * 16 for _ in range(16)]
        for y in range(16):
            for x in range(16):
                p = im.getpixel((f * 16 + x, y))
                if p[3]: g[y][x] = rev.get(p[:3], '?')
        frames.append(g)
    FR[a['name']] = frames

fails, notes = [], []
def bad(anim, msg): fails.append('%-15s %s' % (anim, msg))
def ok(anim, msg): notes.append('%-15s %s' % (anim, msg))
def cells(g, chars=None): return [(x, y) for y in range(16) for x in range(16) if g[y][x] != '.' and (chars is None or g[y][x] in chars)]
def is_blank(g): return not cells(g)
def pieces(g):
    pts = set(cells(g)); seen = set(); n = 0
    for p in pts:
        if p in seen: continue
        n += 1; st = [p]; seen.add(p)
        while st:
            x, y = st.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in pts and q not in seen: seen.add(q); st.append(q)
    return n
def band_row(g):
    rows = [y for x, y in cells(g, 'B')]; return min(rows) if rows else None
CHIN = 4                                            # rows from the band row down to the chin
def body(g):                                        # everything under the chin
    b = band_row(g); return [(x, y, g[y][x]) for x, y in cells(g) if y > b + CHIN]
def head_sig(g):                                    # the head's pixels, relative to its band row
    b = band_row(g); return frozenset((x, y - b, g[y][x]) for x, y in cells(g) if b - 4 <= y <= b + 3 and g[y][x] in 'dDbBk')

# ---- every frame ----
for name, frames in FR.items():
    for i, g in enumerate(frames):
        if is_blank(g):
            if not (name == 'exit' and i == len(frames) - 1): bad(name, 'frame %d is blank' % i)
            continue
        if '?' in sum(g, []): bad(name, 'frame %d has a colour that is not in the palette' % i)
        n = pieces(g)
        if n != 1: bad(name, 'frame %d is in %d pieces (something is floating)' % (i, n))
        ys = sorted({y for x, y in cells(g)}); xs = sorted({x for x, y in cells(g)})
        gy = [y for y in range(ys[0], ys[-1] + 1) if y not in ys]; gx = [x for x in range(xs[0], xs[-1] + 1) if x not in xs]
        if gy: bad(name, 'frame %d has an empty row inside the sprite at %s' % (i, gy))
        if gx: bad(name, 'frame %d has an empty column inside the sprite at %s' % (i, gx))
        ks = cells(g, 'k')
        if band_row(g) is None: bad(name, 'frame %d has no head band' % i); continue
        if not ks: bad(name, 'frame %d has no bandana knot (the tails would vanish)' % i); continue
        b = band_row(g)
        face = [(x, y) for x, y in cells(g, 'sS') if b < y <= b + CHIN]
        if face:
            front = max(x for x, y in face)
            if min(x for x, y in ks) >= front: bad(name, 'frame %d faces the wrong way (knot is not behind the face)' % i)

# ---- feet on the ground ----
GROUNDED = ['idle', 'idle_look', 'idle_tie', 'idle_flex', 'run', 'idle_aim', 'run_aim', 'land', 'skid', 'duck', 'look_up', 'spawn', 'hurt']           # (on the wall the feet hang wherever the wall is)
for name in GROUNDED:
    for i, g in enumerate(FR[name]):
        if not is_blank(g) and not [x for x, y in cells(g, 'cC') if y == 15]: bad(name, 'frame %d: no boot on the ground row (feet float)' % i)

# ---- arm length: the same limb in every pose ----
for a in m['animations']:
    for i, lens in enumerate(a.get('arms') or []):
        if lens is None:
            if not is_blank(FR[a['name']][i]): bad(a['name'], 'frame %d: no arm lengths recorded' % i)
            continue
        for n in lens:
            if n not in (4, 5): bad(a['name'], 'frame %d: an arm is %d px long (should be 4, or 5 reaching)' % (i, n))
if not any('px long' in f for f in fails): ok('arms', 'every arm 4 px, or 5 reaching')

# ---- arms: shaded and with some thickness ----
for i, g in enumerate(FR['idle']):
    sk = [(x, y, c) for x, y, c in body(g) if c in 'sST']
    for side, xs in (('near', range(10, 16)), ('far', range(0, 6))):
        arm = [(x, y, c) for x, y, c in sk if x in xs]
        tones = {c for x, y, c in arm}; rows = {}
        for x, y, c in arm: rows.setdefault(y, []).append(x)
        if len(tones) < 2: bad('idle', 'frame %d: the %s arm is one flat tone (no shading)' % (i, side))
        if not any(len(v) >= 2 for v in rows.values()): bad('idle', 'frame %d: the %s arm is a one-pixel line' % (i, side))

# ---- boots: tall and narrow, never a long flat slab ----
for name, frames in FR.items():
    for i, g in enumerate(frames):
        for y in range(16):
            for colours in ('C', 'c'):                     # near boot and far boot counted apart, so two feet side by side still pass
                run = 0
                for x in range(17):
                    if x < 16 and g[y][x] in colours: run += 1
                    else:
                        if run > 2: bad(name, 'frame %d: a boot %d px wide on row %d (feet should be 2 wide)' % (i, run, y))
                        run = 0

# ---- head always rides on the torso ----
for name, frames in FR.items():
    for i, g in enumerate(frames):
        if is_blank(g): continue
        b = band_row(g); shirt = [y for x, y in cells(g, 'vhH')]
        if b is None or not shirt: continue
        torso_top = min(shirt)
        if torso_top != b + CHIN + 1: bad(name, 'frame %d: head is not sitting on the torso (chin row %d, torso starts %d)' % (i, b + CHIN, torso_top))

# ---- idle: the body breathes ----
idle = FR['idle']
bodies = {frozenset(body(g)) for g in idle}
torso_h = {max(y for x, y in cells(g, 'vhH')) - min(y for x, y in cells(g, 'vhH')) for g in idle}
arms = {frozenset((x, y) for x, y, c in body(g) if c in 'sS') for g in idle}
feet = {frozenset(cells(g, 'pPQ')) for g in idle}
if len(bodies) < 3: bad('idle', 'the body below the head only has %d different poses (needs 3+)' % len(bodies))
if len(torso_h) < 2: bad('idle', 'the torso never changes height (no breathing)')
if len(arms) < 2: bad('idle', 'the arms never move')
if len(feet) < 2: bad('idle', 'the legs never move (no knee give)')
if not fails or all(not f.startswith('idle ') for f in fails):
    ok('idle', '%d body poses, torso heights %s, %d arm poses, %d leg poses' % (len(bodies), sorted(torso_h), len(arms), len(feet)))

# ---- run: a real cycle ----
run = FR['run']
def centre(pts): return sum(x for x, y in pts) / len(pts) if pts else None
nb = [centre(cells(g, 'C')) for g in run]; fb = [centre([(x, y) for x, y in cells(g, 'c') if (x, y) not in cells(g, 'C')]) for g in run]
d = [n - f for n, f in zip(nb, fb) if n is not None and f is not None]
if not (max(d) >= 3 and min(d) <= -3): bad('run', 'the boots do not swap front and back (near minus far boot x: %s)' % [round(v, 1) for v in d])
belts = [band_row(g) for g in run]
if len(set(belts)) < 2: bad('run', 'the body does not bob')
for i in range(len(run)):
    if run[i] == run[(i + 1) % len(run)]: bad('run', 'frames %d and %d are the same' % (i, (i + 1) % len(run)))
hand_y = [[y for x, y, c in body(g) if c == 's' and x >= 11] for g in run]                 # the lit hand under the barrel
hand_y = [min(v) if v else None for v in hand_y]
if None in hand_y or max(hand_y) - min(hand_y) < 1: bad('run', 'the rifle hand does not bounce (y %s)' % hand_y)
widths = [len({x for x, y in cells(g, 'vhH')}) for g in run]
if max(widths) > 6: bad('run', 'the vest is wider than standing (%d wide)' % max(widths))
if not any(f.startswith('run ') for f in fails):
    ok('run', 'boots swap (near-far %s), bob rows %s, rifle hand bounces %d px' % ([round(v) for v in d], sorted(set(belts)), max(hand_y) - min(hand_y)))

# ---- squash and stretch ----
def height(g): ys = [y for x, y in cells(g)]; return max(ys) - min(ys) + 1
stand_h = height(idle[0])
for name, i, rule in [('land', 0, 'lt'), ('spawn', 0, 'lt'), ('jump_up', 0, 'ge'), ('duck', 0, 'lt')]:
    h = height(FR[name][i])
    if (rule == 'lt' and h >= stand_h) or (rule == 'ge' and h < stand_h): bad(name, 'frame %d is %d tall against %d standing (squash/stretch missing)' % (i, h, stand_h))
ok('squash', 'standing %d, land %d, duck %d, take-off %d' % (stand_h, height(FR['land'][0]), height(FR['duck'][0]), height(FR['jump_up'][0])))

# ---- wall ----
for name in ('wall_hold', 'climb', 'wall_slide'):
    for i, g in enumerate(FR[name]):
        hands = [x for x, y in cells(g, 'sS')]
        if not hands or max(hands) < 11: bad(name, 'frame %d: no hand on the wall face' % i)
hs = [frozenset((x, y) for x, y in cells(g, 'sS') if x >= 10) for g in FR['climb']]
if len(set(hs)) < 3: bad('climb', 'the hands do not change grip')

# ---- each animation has motion ----
for name, frames in FR.items():
    if len(frames) > 1 and len({str(f) for f in frames}) < 2: bad(name, 'all frames are the same')

for n in notes: print('ok    ', n)
for f in fails: print('FAIL  ', f)
print('%d animations, %d frames: %s' % (len(FR), sum(len(v) for v in FR.values()), 'PASS' if not fails else '%d problems' % len(fails)))
sys.exit(1 if fails else 0)
