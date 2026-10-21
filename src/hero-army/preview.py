# GIF previews of the pack, every animation at its real speed (static poses at 4 fps), 8x, with the bandana tails
# drawn the way the game draws them (a port of stepChain in template.html with a stand-in velocity per animation).
# Writes gif/<name>.gif per animation and showcase.gif (every animation in turn, labelled).
# Run:  python3 preview.py   (after draw.py)
import json, math, os
from PIL import Image, ImageDraw
os.chdir(os.path.dirname(os.path.abspath(__file__)))
m = json.load(open('hero-animation-manifest.json'))
Z = 8; OX, OY = 6, 3; CW, CH = 16 + OX + 2, 16 + OY + 1           # canvas: room for the tails behind and the hair above
RED, RED2, HAIR = (0xAC, 0x32, 0x32), (0xC8, 0x40, 0x40), (0x45, 0x28, 0x3C)
BG = (48, 50, 62)

def motion(name, f):   # (speed, up): a stand-in for the hero's velocity in each animation
    if name in ('run', 'run_aim', 'exit'): return 0.9, 0
    if name.startswith('dash'): return (0, 0) if f == 0 else (1.0, 0)
    if name in ('fall', 'fall_aim'): return 0.2, 0.6
    if name in ('jump_up', 'jump_up_aim'): return 0.3, 0
    if name == 'wall_slide': return 0, 0.4
    if name == 'land' or name == 'spawn': return 0, 0.3 if f == 0 else 0
    return 0, 0

class Tail:
    def __init__(self, n, ph, droop, back): self.n = n; self.ph = ph; self.droop = droop; self.back = back; self.nodes = []
    def step(self, ax, ay, facing, t, speed, up):
        if len(self.nodes) != self.n or abs(self.nodes[0][0] - ax) > 24: self.nodes = [[ax - facing * i, ay + i, 0] for i in range(self.n)]
        px, py = ax, ay
        for i, nd in enumerate(self.nodes):
            tx = px - facing * (self.back + speed * 0.7); ty = py + (self.droop if i else 0.3) - speed * 0.9 - up * 1.6
            nd[0] += (tx - nd[0]) / 2; nd[1] += (ty - nd[1]) / 2
            ddx, ddy = nd[0] - px, nd[1] - py; dd = math.hypot(ddx, ddy)
            if dd > 1.5: nd[0] = px + ddx / dd * 1.5; nd[1] = py + ddy / dd * 1.5
            nd[2] = math.sin(t * (3.5 + speed * 7) + i * 1.15 + self.ph) * (0.15 + i * 0.25) * (0.7 + speed)
            px, py = nd[0], nd[1]
    def draw(self, d, ax, ay, col):
        px, py = ax, ay
        for nd in self.nodes:
            qx, qy = nd[0], nd[1] + nd[2]
            steps = max(1, math.ceil(max(abs(qx - px), abs(qy - py))))
            for k in range(steps + 1):
                x = round(px + (qx - px) * k / steps); y = round(py + (qy - py) * k / steps)
                d.point((x, y), fill=col)
            px, py = qx, qy

def frames_of(a):
    im = Image.open('hero-%s.png' % a['name']).convert('RGBA')
    return [im.crop((f * 16, 0, f * 16 + 16, 16)) for f in range(a['frameCount'])]

def render(a, loops=2):
    """Returns (list of PIL frames at 1x on the canvas, ms per frame)."""
    fps = a['fps'] or 4; ms = round(1000 / fps); ticks = max(1, round(60 / fps))
    frs = frames_of(a); n = len(frs)
    ta, tb, th = Tail(5, 0, 0.7, 1.2), Tail(5, 2.6, 1.0, 0.8), Tail(3, 1.3, 0.5, 0.9)
    out = []; t = 0
    order = list(range(n)) * loops
    if a.get('loopFrom') is not None and loops > 1: order = list(range(n)) + list(range(a['loopFrom'], n)) * loops
    for f in order:
        an = a['anchors'][f]
        for _ in range(ticks):
            t += 1 / 60
            if an:
                ax, ay = an[0] + OX, an[1] + OY; sp, up = motion(a['name'], f)
                ta.step(ax, ay, 1, t, sp, up); tb.step(ax, ay + 1, 1, t, sp, up); th.step(ax + 1, ay - 2, 1, t, sp, up)
        c = Image.new('RGB', (CW, CH), BG); d = ImageDraw.Draw(c)
        if an:
            th.draw(d, ax + 1, ay - 2, HAIR); tb.draw(d, ax, ay + 1, RED); ta.draw(d, ax, ay, RED)
            d.point((round(ta.nodes[0][0]), round(ta.nodes[0][1] + ta.nodes[0][2])), fill=RED2)
        c.paste(frs[f], (OX, OY), frs[f])
        out.append(c)
    return out, ms

def big(c, label=None):
    im = c.resize((CW * Z, CH * Z), Image.NEAREST)
    if label:
        band = Image.new('RGB', (CW * Z, 14), (20, 22, 30)); ImageDraw.Draw(band).text((4, 1), label, fill=(255, 183, 74))
        full = Image.new('RGB', (CW * Z, CH * Z + 14), BG); full.paste(band, (0, 0)); full.paste(im, (0, 14)); im = full
    return im.convert('P', palette=Image.ADAPTIVE, colors=64)

os.makedirs('gif', exist_ok=True)
show, durs = [], []
for a in m['animations']:
    fr, ms = render(a, loops=2)
    g = [big(c) for c in fr[len(fr) // 2:]] if a['loop'] else [big(c) for c in fr[:len(fr) // 2]]   # loops: the settled second pass; one-shots: the first
    if a['fps'] == 0: g = [big(c) for c in fr[:a['frameCount']]]
    g[0].save('gif/%s.gif' % a['name'], save_all=True, append_images=g[1:], duration=ms, loop=0)
    label = '%s  %d fps' % (a['name'], a['fps']) if a['fps'] else a['name']
    reps = max(1, round(2000 / (ms * len(fr))))                                  # about two seconds of each in the showcase
    for _ in range(reps):
        for c in fr: show.append(big(c, label)); durs.append(ms)
show[0].save('showcase.gif', save_all=True, append_images=show[1:], duration=durs, loop=0)
print('wrote', len(m['animations']), 'gifs and showcase.gif (%d frames)' % len(show))
