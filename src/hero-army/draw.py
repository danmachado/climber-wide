# Draws the army guy hero pack (Dan's armyguy.png, original art) as 16 px strips plus the manifest make-hero.py reads.
# Same method as hero-wolf/draw.py: every frame is POSED, not pasted.
#   - a hand-drawn head (his exact pixels) always sits on the vest (chin row on the row above it), so it cannot float
#   - the vest sits on the belt row (hip); the legs start on the row under it
#   - the far (back) arm is a line between joints (Pose.arm, 4 px, 5 reaching, two-tone, a shade darker than the near arm)
#   - the near arm holds the RIFLE: a hand-drawn part (shoulder, rifle, stock, hand) that stays level in every pose and
#     bounces a frame behind the body in the run (Broforce pattern: legs do the work, the gun stays level)
#   - on the wall the rifle is slung on his back and both hands grip; wall_aim turns him round with the gun out
#   - the aim twins (`_aim`) raise the rifle to the shoulder and bring the far hand onto the foregrip (two-handed)
#   - layered: far arm, far leg, vest, near leg, head, near arm and rifle; then the seam pass (no outline outside)
# The bandana tails are NOT here: the game hangs two chains from the knot pixel `k` (see template.html).
# Check:  python3 audit.py      Previews: python3 preview.py      Run: python3 draw.py  then in src/: make-hero.py, build.js
import json, os
from PIL import Image, ImageDraw

C = {
    'o': '#0D0F18',                                   # outline (removed on the outside, seams inside take a material shade)
    'D': '#45283C',                                   # hair
    'B': '#AC3232', 'k': '#8E2A2A',                   # bandana, the knot the tails hang from
    's': '#EEC39A', 'S': '#D9A066', 'T': '#B8824C',   # skin, skin shadow, far arm shadow
    'v': '#323C39', 'h': '#524B24', 'H': '#4B692F',   # vest dark, vest olive, vest green
    'Q': '#639BFF', 'P': '#5B6EE1', 'p': '#3D4A9C',   # pants lit, pants, far leg
    'c': '#663931', 'C': '#8F563B',                   # boot, boot lit
    'g': '#000000', 'G': '#222034',                   # rifle, rifle lit
    '1': '#2A1626', '2': '#A0683A', '3': '#1F2418', '4': '#2A3470', '5': '#3D2018', '6': '#6E1E1E', '7': '#0B0B14',   # seams
}
NAMES = {
    'o': 'Outline', 'D': 'Hair', 'B': 'Bandana', 'k': 'Bandana knot', 's': 'Skin', 'S': 'Skin shadow', 'T': 'Far arm shadow',
    'v': 'Vest dark', 'h': 'Vest olive', 'H': 'Vest green', 'Q': 'Pants lit', 'P': 'Pants', 'p': 'Far leg',
    'c': 'Boot', 'C': 'Boot lit', 'g': 'Rifle', 'G': 'Rifle lit',
    '1': 'Hair line', '2': 'Skin line', '3': 'Vest line', '4': 'Pants line', '5': 'Boot line', '6': 'Band line', '7': 'Rifle line',
}

def G(s): return [r for r in s.strip('\n').split('\n')]

# ---- head (facing right), 8 x 7, his pixels: the knot `k` at the back of the band, the chin is the last row ----
HEAD = {
    'normal': G("""
..DDDDD.
.DDDDDDD
kDBDDBBD
.BBBBBB.
.DDDssS.
DDSssDD.
DDDssss.
"""),
    'down': G("""
..DDDDD.
.DDDDDDD
kDBDDBBD
.BBBBBB.
.DDDDsS.
DDSssDD.
DDDssss.
"""),
    'up': G("""
..DDDDD.
.DDDDDDD
kDBDDBBD
.BBBBBB.
.DDDsss.
DDSsssD.
DDDsssss
"""),
}
HEAD_H = 7
# ---- vest, 6 wide (frame cols 5..10 at tx 5). Skin V at the chest. The belt is the last row and sits on the hips. ----
VEST = {
    'mid': G("""
vhSSsv
HHvhHh
hHHvhH
hhHvhH
hhhhvH
"""),
    'tall': G("""
vhSSsv
HHvhHh
HHvhHh
hHHvhH
hhHvhH
hhhhvH
"""),
    'short': G("""
vhSSsv
HHvhHh
hHHvhH
hhhhvH
"""),
    'squash': G("""
vhSSsvH
hHHvhHH
hhhhvHH
"""),
    'flat': G("""
vhSSsvHH
hhhhvHHH
"""),
}

def blank(): return [['.'] * 16 for _ in range(16)]
def put(fr, part, x, y):
    for r, row in enumerate(part):
        for c, ch in enumerate(row):
            if ch != '.' and 0 <= y + r < 16 and 0 <= x + c < 16: fr[y + r][x + c] = ch
def line(a, b):
    (x0, y0), (x1, y1) = a, b
    dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; err = dx + dy; pts = []
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1: return pts
        e2 = 2 * err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy
def path(pts):
    out = []
    for i in range(len(pts) - 1):
        for p in line(pts[i], pts[i + 1]):
            if p not in out: out.append(p)
    return out or list(pts)

class Frame(list): arms = None
ARM_LEN, ARM_REACH = 4, 5
class Pose:
    def __init__(self): self.fr = blank(); self.mask = {}; self.arm_lengths = []
    def px(self, x, y, ch, who=None):
        if 0 <= x < 16 and 0 <= y < 16:
            self.fr[y][x] = ch
            if who: self.mask[(x, y)] = who
            else: self.mask.pop((x, y), None)
    def limb(self, pts, cols, who, thick=1, sep=None):
        cells = []
        for x, y in path(pts):
            cells.append((x, y, cols[0]))
            if thick == 2: cells.append((x + 1, y, cols[1]))
        mine = {(x, y) for x, y, _ in cells}
        if sep:
            for x, y in mine:
                for ax, ay in ((x - 1, y), (x, y - 1), (x, y + 1)):
                    if (ax, ay) not in mine and self.mask.get((ax, ay)) == sep: self.px(ax, ay, 'o', None)
        for x, y, ch in cells: self.px(x, y, ch, who)
    def arm(self, pts, near):
        # The same arm in every pose: 4 px shoulder to hand, 5 reaching; two-pixel shaded upper arm, one-pixel forearm,
        # a lit hand. The far arm is a shade darker all over (S lit, T shadow). See hero-wolf/draw.py for the full note.
        pix = path(pts)
        want = ARM_REACH if len(pix) > ARM_LEN else ARM_LEN
        pix = pix[:want]
        while len(pix) < want:
            (x0, y0), (x1, y1) = pix[-2] if len(pix) > 1 else (pix[-1][0], pix[-1][1] - 1), pix[-1]
            dx, dy = x1 - x0, y1 - y0
            step = (0, (dy > 0) - (dy < 0)) if abs(dy) >= abs(dx) else ((dx > 0) - (dx < 0), 0)
            pix.append((x1 + step[0], y1 + step[1]))
        self.arm_lengths.append(len(pix))
        lit, shade = ('s', 'S') if near else ('S', 'T')
        who = 'na' if near else 'fa'; cells = {}
        for i, (x, y) in enumerate(pix):
            if (x, y) in cells and cells[(x, y)] == lit: continue
            nx, ny = pix[min(i + 1, len(pix) - 1)]; px_, py_ = pix[max(i - 1, 0)]
            upright = abs(ny - py_) >= abs(nx - px_)
            thick = i < 2
            ox = x + 1 if x >= 7.5 else x - 1
            cells[(x, y)] = shade if thick and upright and ox > x else lit
            if not thick: continue
            if upright:
                if ox > x: cells[(ox, y)] = lit
                else: cells.setdefault((ox, y), shade)
            else: cells.setdefault((x, y + 1), shade)
        cells[pix[-1]] = lit
        for (x, y), ch in cells.items(): self.px(x, y, ch, who)
        if near: self.hand = pix[-1]
    def rifle(self, tx, ty, gy, gx=0, hand=True, shoulder=True):
        # The near arm and the rifle, his pixels: shoulder at the vest's front top corner, the arm drops behind the
        # rifle, the rifle lies level across the chest (8 long, 2 deep, lit top edge and dark underside, a pale front
        # pixel at the muzzle), the stock drops a row behind, and the hand shows under the front of the barrel.
        sx = tx + 6
        if shoulder:
            self.px(sx, ty, 'S', 'na')
            for y in range(ty + 1, gy): self.px(sx, y, 'S', 'na')                  # upper arm down to the rifle
        x0 = tx + 1 + gx
        for i, ch in enumerate('GgggggGg'): self.px(x0 + i, gy, ch, 'gun')
        for i, ch in enumerate('gGGGGGGg'): self.px(x0 + i, gy + 1, ch, 'gun')
        self.px(x0, gy + 2, 'g', 'gun'); self.px(x0 + 1, gy + 2, 'G', 'gun')       # the stock
        if hand: self.px(x0 + 5, gy + 2, 'S', 'na'); self.px(x0 + 6, gy + 2, 's', 'na')
        self.arm_lengths.append(4)
    def slung(self, tx, ty):
        # The rifle on his back (wall poses): a short diagonal of barrel behind the far shoulder, lit along its top.
        for i, (dx, dy) in enumerate(((-2, 1), (-3, 2), (-4, 3), (-5, 4))):
            self.px(tx + dx, ty + dy, 'g', 'gun'); self.px(tx + dx + 1, ty + dy, 'G', 'gun')
    def boot(self, x, y, near, kind='flat', toe=1, leg=None):
        # Flat boots, his pixels: one row, two wide, heel dark and toe lit on the near foot. Snapped under the leg.
        who = 'nl' if near else 'fl'
        if leg:
            lx = leg[-1][0]; x = lx + max(-1, min(1, x - lx))
        for cx in (x, x + 1):
            self.px(cx, y, 'C' if near and cx == x + 1 else 'c', who)

def selout(fr):
    bands = [y for y in range(16) for x in range(16) if fr[y][x] == 'B']
    below = (min(bands) + 5) if bands else 0
    swap = []
    for y in range(below, 16):
        for x in range(16):
            if fr[y][x] != 'o': continue
            nb = [fr[ay][ax] if 0 <= ax < 16 and 0 <= ay < 16 else '.' for ax, ay in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))]
            if '.' in nb: continue
            if any(n in 'sST' for n in nb) and any(n in 'vhH' for n in nb): swap.append((x, y))
    for x, y in swap: fr[y][x] = 'T'
    return fr
OUTLINE = os.environ.get('HERO_OUTLINE', 'none')
LINE_OF = [('D', '1'), ('sST', '2'), ('vhH', '3'), ('pPQ', '4'), ('cC', '5'), ('Bk', '6'), ('gG', '7')]
def line_for(nb):
    for mats, ch in LINE_OF:
        if any(n in mats for n in nb): return ch
    return 'o'
def recolor_lines(fr):
    if OUTLINE == 'black': return fr
    out = [row[:] for row in fr]
    for y in range(16):
        for x in range(16):
            if fr[y][x] != 'o': continue
            nb4 = [fr[ay][ax] if 0 <= ax < 16 and 0 <= ay < 16 else '.' for ax, ay in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))]
            if OUTLINE == 'none' and '.' in nb4: out[y][x] = '.'; continue
            order = [fr[y + 1][x] if y < 15 else '.', fr[y][x + 1] if x < 15 else '.', fr[y][x - 1] if x > 0 else '.', fr[y - 1][x] if y > 0 else '.']
            out[y][x] = line_for([n for n in order if n not in '.o'])
    return out
def outline(fr):
    add = []
    for y in range(16):
        for x in range(16):
            if fr[y][x] != '.': continue
            for ax, ay in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= ax < 16 and 0 <= ay < 16 and fr[ay][ax] not in '.ok': add.append((x, y)); break
    for x, y in add: fr[y][x] = 'o'
    return recolor_lines(selout(fr))

def pose(hip=12, tx=5, torso='mid', head='normal', hdx=0, near_leg=None, far_leg=None, near_boot=None, far_boot=None,
         far_arm=None, near_arm=None, hips=True, shift=0, gun='level', gdy=0, gx=0, far_front=False):
    """hip: the belt row. tx: vest column. Legs and arms are joint lists in frame coords. The head is placed so its
    chin row is the row above the vest. gun: 'level' (held, gdy rows off its rest, gx columns forward), 'raised' (to the
    shoulder, firing), 'back' (slung, both hands free; near_arm is then a joint list) or None. far_front: the far arm
    is drawn in front of the vest (on the foregrip)."""
    P = Pose(); t = VEST[torso]; ty = hip - len(t) + 1
    if far_arm and not far_front: P.arm(far_arm, False)
    if gun == 'back': P.slung(tx, ty)
    if far_leg: P.limb(far_leg, 'pP', 'fl', 2)
    if far_boot: P.boot(*far_boot[:2], False, *far_boot[2:], leg=far_leg)
    put(P.fr, t, tx, ty)
    for x in range(16):
        for y in range(ty, hip + 1): P.mask.pop((x, y), None)
    if hips and near_leg and far_leg:
        xs = [near_leg[0][0], near_leg[0][0] + 1, far_leg[0][0], far_leg[0][0] + 1]
        for x in range(min(xs), max(xs) + 1): P.px(x, hip + 1, 'p', 'hip')
    if near_leg: P.limb(near_leg, 'PQ', 'nl', 2, sep='fl')
    if near_boot: P.boot(*near_boot[:2], True, *near_boot[2:], leg=near_leg)
    put(P.fr, HEAD[head], tx - 1 + hdx, ty - HEAD_H)
    if far_arm and far_front: P.arm(far_arm, False)
    if gun == 'level': P.rifle(tx, ty, min(ty + 2 + gdy, 13), gx)
    elif gun == 'raised': P.rifle(tx, ty, ty + 1, gx)
    elif gun == 'back' and near_arm: P.arm(near_arm, True)
    elif gun is None and near_arm: P.arm(near_arm, True)
    fr = outline(P.fr)
    if shift: fr = [(['.'] * shift + row)[:16] if shift > 0 else (row[-shift:] + ['.'] * -shift) for row in fr]
    fr = Frame(fr); fr.arms = P.arm_lengths
    return fr

# ---------------------------------------------------------------- idle: breathing
LEGS_STAND = dict(far_leg=[(5, 13), (5, 14)], far_boot=(5, 15), near_leg=[(9, 13), (9, 14)], near_boot=(9, 15))
LEGS_GIVE = dict(far_leg=[(5, 14)], far_boot=(4, 15), near_leg=[(9, 14)], near_boot=(9, 15))
def hang(top, k=0): return [(4, top), (4, top + 1), (4 - k, top + 2)]                 # the far arm hanging, k: drifts back
def stand(state=0, head='normal', far_arm=None, gun='level', gdy=0, far_front=False):
    if state == 1:   # in: chest up, the shoulders and the rifle ride up with it, the far hand drifts out
        return pose(hip=12, torso='tall', head=head, **LEGS_STAND, far_arm=far_arm or hang(7, 1), gun=gun, gdy=gdy, far_front=far_front)
    if state == 2:   # out: knees give, everything settles a pixel
        return pose(hip=13, torso='mid', head=head, **LEGS_GIVE, far_arm=far_arm or hang(9), gun=gun, gdy=gdy, far_front=far_front)
    return pose(hip=12, torso='mid', head=head, **LEGS_STAND, far_arm=far_arm or hang(8), gun=gun, gdy=gdy, far_front=far_front)

# idle one-shots, played by the game after a few seconds still
SHADE = [(4, 7), (5, 6), (6, 5), (7, 4), (8, 4)]                                    # far hand up to the brow (in front), looking up the climb
def tie(k):                                                              # far hand back at the knot, tugging the bandana
    return stand(1, far_arm=[(4, 7), (3, 6), (3, 4 - k)])
def flex(k, state=0):                                                    # checks the rifle: hitches it up, the far arm swings back
    return stand(state, gdy=-k, far_arm=hang(8 if state == 0 else 7, 1 + k))

# ---------------------------------------------------------------- air (gun level throughout)
JUMP = [
    pose(hip=11, torso='mid', far_leg=[(5, 12), (5, 14)], far_boot=(5, 15, 'toe'), near_leg=[(8, 12), (8, 14)], near_boot=(8, 15, 'toe'),
         far_arm=[(4, 7), (3, 5), (3, 3)]),                                                                          # take-off: long, far arm thrown up
    pose(hip=11, torso='mid', far_leg=[(5, 12), (6, 13)], far_boot=(5, 14, 'toe'), near_leg=[(8, 12), (10, 13)], near_boot=(9, 14),
         far_arm=[(4, 7), (3, 6), (3, 4)]),                                                                          # rising: knees come up
]
FALL = [
    pose(hip=12, torso='short', far_leg=[(5, 13), (6, 14)], far_boot=(5, 15, 'toe'), near_leg=[(8, 13), (10, 14)], near_boot=(10, 15),
         far_arm=[(4, 9), (2, 9), (1, 8)]),                                                                          # apex: floaty, far arm out, knees up
    pose(hip=12, torso='mid', far_leg=[(5, 13), (5, 14)], far_boot=(4, 15, 'toe'), near_leg=[(8, 13), (8, 14)], near_boot=(8, 15, 'toe'),
         far_arm=[(4, 8), (3, 6), (3, 4)]),                                                                          # dropping: far arm up, legs hang
    pose(hip=12, torso='mid', far_leg=[(5, 13), (4, 14)], far_boot=(3, 15, 'toe'), near_leg=[(8, 13), (9, 14)], near_boot=(9, 15, 'toe'),
         far_arm=[(4, 8), (2, 7), (2, 5)]),                                                                          # dropping: legs scissor, arm flaps
]
LAND = [
    pose(hip=14, torso='squash', head='down', far_leg=[(4, 15)], near_leg=[(9, 15)], far_boot=(3, 15), near_boot=(10, 15), hips=False,
         far_arm=[(4, 12), (2, 13), (1, 13)], gdy=-2),                                                               # impact: flattened, rifle thrown up
    pose(hip=13, torso='short', head='down', **LEGS_GIVE, far_arm=[(4, 10), (3, 11)], gdy=-1),                      # coming up
    stand(1),                                                                                                       # a little overshoot
]
HURT = pose(hip=13, torso='squash', head='down', far_leg=[(4, 14)], far_boot=(2, 15), near_leg=[(9, 14)], near_boot=(11, 15),
            far_arm=[(4, 11), (2, 9), (1, 8)], gdy=-1)
DUCK = pose(hip=13, torso='short', head='down', far_leg=[(4, 14)], near_leg=[(9, 14)], far_boot=(3, 15), near_boot=(10, 15),
            far_arm=[(4, 10), (4, 12)])                                                                             # squat, rifle low
LOOKUP = stand(1, 'up')
SKID = pose(hip=13, tx=5, torso='short', hdx=1, far_leg=[(5, 14)], far_boot=(4, 15), near_leg=[(8, 14)], near_boot=(7, 15),
            far_arm=[(4, 10), (2, 9), (1, 8)], gx=1)                                                                 # leaning back, heels dug in, rifle out front

# ---------------------------------------------------------------- dashes: a coil, then the body thrown along the dash
COIL = pose(hip=13, torso='short', head='down', far_leg=[(5, 14)], far_boot=(3, 15), near_leg=[(9, 14)], near_boot=(9, 15),
            far_arm=[(4, 10), (2, 11)])
DASH_SIDE = pose(hip=13, tx=5, torso='flat', hdx=3, far_leg=[(6, 14), (3, 15)], far_boot=(2, 15, 'toe', -1), near_leg=[(7, 14), (4, 14)], near_boot=(2, 14, 'toe', -1),
                 far_arm=[(4, 12), (2, 12)], gx=2, gdy=-2)
DASH_UP = pose(hip=13, torso='tall', far_leg=[(5, 14)], far_boot=(5, 15, 'toe'), near_leg=[(8, 14)], near_boot=(8, 15, 'toe'),
               far_arm=[(4, 8), (3, 6), (3, 4)])
DASH_DOWN = pose(hip=12, torso='mid', head='down', far_leg=[(4, 13), (3, 14)], far_boot=(2, 15, 'flat', -1), near_leg=[(9, 13), (10, 14)], near_boot=(11, 15),
                 far_arm=[(4, 8), (2, 7), (1, 6)], gdy=1)
DASH_DIAG_UP = pose(hip=12, tx=5, torso='mid', hdx=2, far_leg=[(6, 13), (4, 14)], far_boot=(3, 15, 'toe'), near_leg=[(8, 13), (7, 14)], near_boot=(6, 15, 'toe'),
                    far_arm=[(4, 9), (2, 10), (1, 11)], gdy=-1, gx=1)
DASH_DIAG_DOWN = pose(hip=12, tx=5, torso='short', head='down', hdx=2, far_leg=[(5, 13), (6, 14)], far_boot=(6, 15), near_leg=[(8, 13), (10, 14)], near_boot=(11, 15),
                      far_arm=[(4, 9), (2, 8), (1, 7)], gdy=1, gx=1)

# ---------------------------------------------------------------- on the wall (the wall is to the right, from column 12)
# rifle slung on the back, both hands grip the wall face at column 11, the feet push on it, near and far limbs climb in turn.
def wall(dy, near_hand, far_hand, near_foot, far_foot, torso='mid', tx=4):
    hip = 12 + dy; top = hip - len(VEST[torso]) + 1
    return pose(hip=hip, tx=tx, torso=torso, gun='back',
                far_arm=[(8, top), (10, top + 1), (11, far_hand)], near_arm=[(9, top), (10, top - 1), (11, top - 2), (11, near_hand), (12, near_hand)],
                far_leg=[(5, hip + 1), (8, far_foot - 1)], far_boot=(10, far_foot, 'toe'), near_leg=[(6, hip + 1), (8, near_foot - 1)], near_boot=(10, near_foot, 'toe'))
CLIMB = [
    wall(0, 3, 9, 15, 13),
    wall(-1, 4, 8, 14, 14),
    wall(0, 9, 3, 13, 15),
    wall(-1, 8, 4, 14, 14),
]
HOLD = [wall(0, 5, 9, 15, 14), wall(0, 5, 9, 15, 14, torso='tall')]
def slide(k):
    hip = 12; top = hip - 4
    return pose(hip=hip, tx=3, torso='mid', gun='back', far_arm=[(6, top + 1), (9, top + 1), (11, top + 1 + k)], near_arm=[(8, top), (10, top + 1), (12, top + 1 - k)],
                far_leg=[(5, 13), (8, 14)], far_boot=(10, 14, 'toe'), near_leg=[(6, 13), (8, 15)], near_boot=(10, 15, 'toe'))

# ---------------------------------------------------------------- aiming: the rifle up at the shoulder, the far hand on the foregrip
def GRIP(top): return [(4, top), (5, top + 1), (6, top + 2), (7, top + 3)]           # far hand under the barrel at the foregrip
def stand_aim(state=0, head='normal'):
    top = {0: 8, 1: 7, 2: 9}[state]
    return stand(state, head, far_arm=GRIP(top), gun='raised', far_front=True)
JUMP_AIM = [
    pose(hip=11, torso='mid', far_leg=[(5, 12), (5, 14)], far_boot=(5, 15, 'toe'), near_leg=[(8, 12), (8, 14)], near_boot=(8, 15, 'toe'),
         far_arm=GRIP(7), gun='raised', far_front=True),
    pose(hip=11, torso='mid', far_leg=[(5, 12), (6, 13)], far_boot=(5, 14, 'toe'), near_leg=[(8, 12), (10, 13)], near_boot=(9, 14),
         far_arm=GRIP(7), gun='raised', far_front=True),
]
FALL_AIM = [
    pose(hip=12, torso='short', far_leg=[(5, 13), (6, 14)], far_boot=(5, 15, 'toe'), near_leg=[(8, 13), (10, 14)], near_boot=(10, 15),
         far_arm=GRIP(9), gun='raised', far_front=True),
    pose(hip=12, torso='mid', far_leg=[(5, 13), (5, 14)], far_boot=(4, 15, 'toe'), near_leg=[(8, 13), (8, 14)], near_boot=(8, 15, 'toe'),
         far_arm=GRIP(8), gun='raised', far_front=True),
    pose(hip=12, torso='mid', far_leg=[(5, 13), (4, 14)], far_boot=(3, 15, 'toe'), near_leg=[(8, 13), (9, 14)], near_boot=(9, 15, 'toe'),
         far_arm=GRIP(8), gun='raised', far_front=True),
]
# On a wall, shooting: back to the wall (the wall is to the LEFT, columns 0 to 3), the far hand reaching up behind to
# grip it at column 3, boots braced, the rifle out level away from the wall.
def wall_aim(k):
    return pose(hip=12, tx=5, torso='mid' if k == 0 else 'tall', far_arm=[(4, 8 - k), (3, 6 - k), (3, 4 - k)], gun='raised',
                far_leg=[(5, 13), (4, 14)], far_boot=(3, 15, 'toe', -1), near_leg=[(8, 13), (9, 14)], near_boot=(9, 15))
WALL_AIM = [wall_aim(0), wall_aim(1)]

# ---------------------------------------------------------------- run: eight side-on frames, the rifle bounces a frame behind the body
def LG(row, s): return (row, G(s))
RUN_LEGS = [   # per phase: hip (belt) row, lead leg, trail leg. L pants, K boot.
    (12, LG(13, """
.......LL.......
.........LL.....
..........KK....
"""), LG(13, """
.....LL.........
....LL..........
...KK...........
""")),                                                                   # contact: lead heel down, trail toe behind
    (13, LG(14, """
.......LLL......
.........KK.....
"""), LG(13, """
....KK..........
.....LL.........
""")),                                                                   # down: weight on the lead, trail foot kicks up
    (12, LG(13, """
......LL........
......LL........
......KK........
"""), LG(13, """
........LL......
.........KK.....
""")),                                                                   # pass: trail knee swings through
    (11, LG(12, """
......LL........
.....LL.........
....LL..........
...KK...........
"""), LG(12, """
.......LL.......
.........LL.....
..........KK....
""")),                                                                   # up: lead pushes off the toe, trail reaches
]
LEG_DX = 1                                                               # the stride grids sit one column left of his body
ARM_DY = [-1, 0, 1, 0]                                                   # rifle and far arm: a frame behind the bob
def leg_grid(P, lg, near):
    row, rows = lg; cells = []
    for r, s in enumerate(rows):
        for x, ch in enumerate(s):
            if ch == 'L': cells.append((x + LEG_DX, row + r, 'Q' if near else 'P'))
            elif ch == 'K': cells.append((x + LEG_DX, row + r, 'C' if near else 'c'))
    mine = {(x, y) for x, y, _ in cells}
    if near:
        for x, y in mine:
            for ax, ay in ((x - 1, y), (x, y - 1), (x, y + 1)):
                if (ax, ay) not in mine and P.mask.get((ax, ay)) == 'fl': P.px(ax, ay, 'o')
        cells = [(x, y, 'P' if ch == 'Q' and (x - 1, y) not in mine else ('c' if ch == 'C' and (x - 1, y) not in mine else ch)) for x, y, ch in cells]
    for x, y, ch in cells: P.px(x, y, ch, 'nl' if near else 'fl')

def run_frame(k, aim=False):
    ph = k % 4; near_leads = k < 4
    hip, lead, trail = RUN_LEGS[ph]
    near, far = (lead, trail) if near_leads else (trail, lead)
    P = Pose(); t = VEST['mid']; ty = hip - len(t) + 1; tx = 5; ady = ARM_DY[ph]
    if aim: pass
    else: P.arm([(4, ty), (4 - (ady < 0), ty + 1), (4 + (ady > 0), ty + 2), (4 + (ady > 0), ty + 3)], False)   # the far arm swings a touch with the bounce
    leg_grid(P, far, False)
    put(P.fr, t, tx, ty)
    for x in range(16):
        for y in range(ty, hip + 1): P.mask.pop((x, y), None)
    leg_grid(P, near, True)
    put(P.fr, HEAD['normal'], tx, ty - HEAD_H)                                       # head a column forward: the lean
    if aim: P.arm(GRIP(ty), False); P.rifle(tx, ty, ty + 1)
    else: P.rifle(tx, ty, ty + 2 + ady)
    fr = Frame(outline(P.fr)); fr.arms = P.arm_lengths
    return fr

def exit_frames():
    a = run_frame(0); b = run_frame(1)
    r2 = run_frame(2); c = Frame([(['.'] * 3 + row)[:16] for row in r2]); c.arms = r2.arms
    return [a, b, c, blank()]

ANIMS = [
    ('idle', 6, True, [stand(0), stand(0), stand(1), stand(1), stand(1, 'up'), stand(0), stand(2), stand(2)]),
    ('run', 14, True, [run_frame(k) for k in range(8)]),
    ('idle_look', 4, False, [stand(1, 'up'), stand(1, 'up', far_arm=SHADE, far_front=True), stand(1, 'up', far_arm=SHADE, far_front=True), stand(1, 'up', far_arm=SHADE, far_front=True), stand(1, 'up'), stand(0)]),
    ('idle_tie', 6, False, [stand(1), tie(0), tie(1), tie(0), tie(1), stand(1), stand(0)]),
    ('idle_flex', 8, False, [stand(0), flex(0), flex(1), flex(0, 1), flex(1, 1), flex(0), stand(0)]),
    ('jump_up', 12, False, JUMP),
    ('fall', 8, 1, FALL),
    ('land', 18, False, LAND),
    ('dash_side', 0, False, [COIL, DASH_SIDE]),
    ('dash_up', 0, False, [COIL, DASH_UP]),
    ('dash_down', 0, False, [COIL, DASH_DOWN]),
    ('dash_diag_up', 0, False, [COIL, DASH_DIAG_UP]),
    ('dash_diag_down', 0, False, [COIL, DASH_DIAG_DOWN]),
    ('wall_hold', 3, True, HOLD),
    ('climb', 8, True, CLIMB),
    ('wall_slide', 10, True, [slide(0), slide(1)]),
    ('hurt', 0, False, [HURT]),
    ('duck', 0, False, [DUCK]),
    ('look_up', 0, False, [LOOKUP]),
    ('skid', 0, False, [SKID]),
    ('spawn', 12, False, [LAND[0], LAND[1], JUMP[0], stand(1), stand(0)]),
    ('exit', 10, False, exit_frames()),
    ('idle_aim', 6, True, [stand_aim(0), stand_aim(0), stand_aim(1), stand_aim(1), stand_aim(1, 'up'), stand_aim(0), stand_aim(2), stand_aim(2)]),
    ('run_aim', 14, True, [run_frame(k, True) for k in range(8)]),
    ('jump_up_aim', 12, False, JUMP_AIM),
    ('fall_aim', 8, 1, FALL_AIM),
    ('wall_aim', 3, True, WALL_AIM),
]

def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def write(anims=None):
    anims = anims or ANIMS
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    manifest = {'design': 'Army guy: red bandana, olive vest, blue pants, rifle held level (tails simulated in the game)', 'dashIndicator': {'feature': 'Bandana', 'hex': C['B']},
                'palette': {k: {'name': NAMES[k], 'hex': C[k]} for k in C}, 'animations': []}
    for name, fps, loop, frames in anims:
        im = Image.new('RGBA', (16 * len(frames), 16), (0, 0, 0, 0))
        for i, fr in enumerate(frames):
            for y in range(16):
                for x in range(16):
                    ch = fr[y][x]
                    if ch != '.': im.putpixel((i * 16 + x, y), hexrgb(C[ch]))
        im.save('hero-%s.png' % name)
        anchors = []
        for fr in frames:
            ks = [(x, y) for y in range(16) for x in range(16) if fr[y][x] == 'k']
            anchors.append([min(x for x, y in ks), round(sum(y for x, y in ks) / len(ks), 1)] if ks else None)
        muzzles = []
        for fr in frames:
            gs = [(x, y) for y in range(16) for x in range(16) if fr[y][x] in 'gG']
            muzzles.append([max(x for x, y in gs), [y for x, y in gs if x == max(x for x, y in gs)][0]] if gs else None)
        row = {'name': name, 'frameCount': len(frames), 'fps': fps, 'loop': loop is True, 'anchors': anchors,
               'arms': [getattr(fr, 'arms', None) for fr in frames]}
        if name.endswith('_aim'): row['muzzles'] = muzzles
        if loop is not True and loop is not False: row['loopFrom'] = loop
        manifest['animations'].append(row)
    json.dump(manifest, open('hero-animation-manifest.json', 'w'), indent=1)
    Z = 8; W = 16 * Z * 8 + 120; H = len(anims) * (16 * Z + 14) + 20
    sheet = Image.new('RGB', (W, H), (10, 13, 28)); d = ImageDraw.Draw(sheet)
    for r, (name, fps, loop, frames) in enumerate(anims):
        y0 = 10 + r * (16 * Z + 14); d.text((6, y0 + 4), name, fill=(255, 183, 74))
        for i, fr in enumerate(frames):
            x0 = 110 + i * 16 * Z
            d.rectangle([x0, y0 + 16 * Z - 1, x0 + 16 * Z - 1, y0 + 16 * Z + 2], fill=(74, 90, 208))
            for y in range(16):
                for x in range(16):
                    ch = fr[y][x]
                    if ch != '.': d.rectangle([x0 + x * Z, y0 + y * Z, x0 + x * Z + Z - 1, y0 + y * Z + Z - 1], fill=hexrgb(C[ch])[:3])
    sheet.save('sheet.png')
    print('pack written:', len(anims), 'animations')

if __name__ == '__main__': write()
