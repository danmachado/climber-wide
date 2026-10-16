// Wall moves: slide ramp, neutral jump, wall bounce, climb-jump stamina refund, super and hyper, the mantle onto a one-tile post.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(300);
  const out = await p.evaluate(() => {
    const G = window.__climber; G.manual(true);
    const rows = []; for (let r = 0; r < 48; r++) { let s = ''; for (let c = 0; c < 27; c++) s += (r === 0 || r >= 46 || c === 0 || c === 26) ? '#' : (c === 13 && r >= 20 ? '#' : '.'); rows.push(s); }
    rows[45] = rows[45].substring(0, 8) + 'S' + rows[45].substring(9); rows[4] = rows[4].substring(0, 24) + 'E' + rows[4].substring(25);
    const room = { format: 1, id: 't', name: 'Moves', difficulty: 1, grid: { cols: 27, rows: 48, tile: 10 }, tiles: rows, entities: [] };
    const I = (o) => Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o);
    const fresh = () => { G.load(room); for (let i = 0; i < 40; i++) G.step(I({}), 1); for (let i = 0; i < 60; i++) G.step(I({ x: 1 }), 1); return G.state(); };   // run up against the wall at col 13
    const hung = () => { let s = fresh(); for (let i = 0; i < 40; i++) s = G.step(I({ x: 1, y: -1, grab: true }), 1); for (let i = 0; i < 3; i++) s = G.step(I({ x: 1 }), 1); return s; };   // climb a bit, let go, falling beside the wall
    const R = {};
    // 1 slide ramp: climb up the wall, let go while pushing into it, watch the fall speed
    let s = fresh(); for (let i = 0; i < 90; i++) s = G.step(I({ x: 1, y: -1, grab: true }), 1);
    const vys = []; for (let i = 0; i < 80; i++) { s = G.step(I({ x: 1 }), 1); if (i === 5 || i === 30 || i === 75) vys.push(Math.round(s.vy)); }
    R.slide = vys;
    // 2 neutral jump: jump with nothing held, then push back toward the wall at once
    s = hung(); s = G.step(I({ jump: true }), 1); const x0 = s.x; for (let i = 0; i < 14; i++) s = G.step(I({ x: 1 }), 1);
    R.neutral = { awayAtFirst: s.vx < 0 || s.x < x0, backTowardWall: s.vx > 0 };
    s = hung(); s = G.step(I({ x: -1, jump: true }), 1); for (let i = 0; i < 14; i++) s = G.step(I({ x: 1 }), 1);
    R.directional = { stillPushedAway: s.vx < 0 };
    // 3 wall bounce: dash straight up beside the wall, press jump a few frames in
    s = fresh(); s = G.step(I({ y: -1, dash: true }), 1); for (let i = 0; i < 4; i++) s = G.step(I({ y: -1 }), 1); s = G.step(I({ jump: true }), 1);
    R.bounce = { vx: Math.round(s.vx), vy: Math.round(s.vy) };
    // 4 climb jump refund: grab, jump straight up, push away within the window
    s = fresh(); for (let i = 0; i < 5; i++) s = G.step(I({ x: 1, grab: true }), 1); const st0 = s.stamina;
    s = G.step(I({ grab: true, jump: true }), 1); const st1 = s.stamina; for (let i = 0; i < 3; i++) s = G.step(I({ x: -1 }), 1);
    R.refund = { before: st0, afterJump: st1, afterPushAway: s.stamina, vx: Math.round(s.vx) };
    // 5 super and hyper: dash sideways on the ground, press jump a few frames in (holding down makes it a hyper)
    s = fresh(); for (let i = 0; i < 30; i++) s = G.step(I({ x: -1 }), 1); s = G.step(I({ x: 1, dash: true }), 1); for (let i = 0; i < 5; i++) s = G.step(I({ x: 1 }), 1); s = G.step(I({ x: 1, jump: true }), 1);
    R.superDash = { vx: Math.round(s.vx), vy: Math.round(s.vy) };
    s = fresh(); for (let i = 0; i < 30; i++) s = G.step(I({ x: -1 }), 1); s = G.step(I({ x: 1, dash: true }), 1); for (let i = 0; i < 5; i++) s = G.step(I({ x: 1, y: 1 }), 1); s = G.step(I({ x: 1, y: 1, jump: true }), 1);
    R.hyper = { vx: Math.round(s.vx), vy: Math.round(s.vy) };
    // 6 mantle: climb a one-tile post from either side holding up and toward it; the hero pulls up and stands on the post
    R.mantle = [1, -1].map(dir => {
      const rows = []; for (let r = 0; r < 48; r++) { let t = ''; for (let c = 0; c < 27; c++) t += (r === 0 || r >= 46 || c === 0 || c === 26) ? '#' : (c === 13 && r >= 38 ? '#' : '.'); rows.push(t); }
      const sc = dir > 0 ? 6 : 20; rows[45] = rows[45].substring(0, sc) + 'S' + rows[45].substring(sc + 1); rows[4] = rows[4].substring(0, 24) + 'E' + rows[4].substring(25);
      G.load(Object.assign({}, room, { tiles: rows })); let m;
      for (let i = 0; i < 40; i++) G.step(I({}), 1); for (let i = 0; i < 80; i++) G.step(I({ x: dir }), 1);
      for (let i = 0; i < 200; i++) { m = G.step(I({ x: dir, y: -1, grab: true }), 1); if (m.ground && m.y < 380) break; }
      for (let i = 0; i < 10; i++) m = G.step(I({}), 1);
      return { x: m.x, y: m.y, ground: m.ground, dead: m.dead };
    });
    return R;
  });
  console.log(JSON.stringify(out));
  const ok = out.slide[0] < 40 && out.slide[1] > 60 && out.neutral.backTowardWall && out.directional.stillPushedAway && out.bounce.vy <= -190 && out.bounce.vx <= -200 && out.refund.afterJump < out.refund.before && out.refund.afterPushAway >= out.refund.before - 1 && out.superDash.vx >= 300 && out.superDash.vy <= -120 && out.hyper.vx >= 380 && out.hyper.vy > out.superDash.vy && out.mantle.every(m => m.ground && !m.dead && m.y === 370 && m.x >= 130 && m.x <= 132);
  console.log('all good:', ok, 'errors', JSON.stringify(errs));
  await b.close();
})();
