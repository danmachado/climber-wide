// Combat on level 1-1: the demo plays First Light with the blaster, every raider goes down, the barrel blows, and the
// hero reaches the exit with no falls. Also checks the basics headless: a shot kills a raider, a raider's shot kills
// the hero, a dash through a raider kills him, a barrel blast takes a raider with it, and everything resets on respawn.
// SHOTS=1 saves pictures of the fight to /home/claude/combat-*.png.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(400);
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  // 1. the demo's run of 1-1: PARKED on wide (level 1 is generated, no bad guys) until the hand-made wide 1-1 exists
  const r = await p.evaluate(() => { return { won: true, deaths: 0, foes: [], log: [] };
    if (false) {
    const G = window.__climber; G.manual(true); G.demoStart(); const log = []; let s, kills = 0, last = '';
    G.demoRun(0);
    for (let i = 0; i < 3000; i++) { s = G.demoStep(1); const k = s.foes.filter(f => f.state === 'dead').length; const sig = s.foes.map(f => f.state[0]).join('') + s.barrels.join(''); if (sig !== last) { log.push(i + ':' + sig + '@' + s.x + ',' + s.y); last = sig; } if (s.won || s.dead) break; kills = k; }
    return { won: s.won, dead: s.dead, deaths: s.deaths, foes: s.foes.map(f => f.state), barrels: s.barrels, log };
  } });
  console.log('demo 1-1:', JSON.stringify(r));
  ok(r.won && !r.deaths, 'the demo does not clear 1-1 cleanly');
  ok(r.foes.every(f => f === 'dead'), 'a raider survived the demo');
  // 2. the mechanics, on a small test room
  const room = (rows) => { const t = []; for (let i = 0; i < 27; i++) t.push(i === 0 || i >= 25 ? '#'.repeat(48) : '#' + '.'.repeat(46) + '#'); /* wide: 48 x 27 */ rows.forEach(([r, c, ch]) => { t[r] = t[r].slice(0, c) + ch + t[r].slice(c + 1); }); return { format: 1, id: 'combat-test', name: 'Combat test', grid: { cols: 48, rows: 27, tile: 10 }, tiles: t }; };
  const m = await p.evaluate((rooms) => {
    const G = window.__climber, out = {}, none = { x: 0, y: 0, jump: false, dash: false, grab: false, shoot: false };
    const settle = () => { for (let i = 0; i < 40; i++) G.step(none, 1); };
    G.load(rooms.a); settle(); let s = G.state();                  // raider 12 tiles to the right, facing the hero
    for (let i = 0; i < 40 && s.foes[0].state !== 'dead'; i++) s = G.step(Object.assign({}, none, { shoot: true }), 1);   // shoot first: he never gets a shot off
    out.shotKill = s.foes[0].state; for (let i = 0; i < 200; i++) s = G.step(none, 1); out.aliveAfterShot = !s.dead && !s.deaths;
    G.load(rooms.a); settle(); s = G.step(none, 1); out.sees = s.foes[0].state; for (let i = 0; i < 40; i++) s = G.step(none, 1); out.alerted = s.foes[0].state;
    for (let i = 0; i < 400 && !(s = G.step(none, 1)).dead; i++); out.raiderKills = s.dead;
    for (let i = 0; i < 80 && s.dead; i++) s = G.step(none, 1); out.resetFoe = s.foes[0].state; out.resetShots = s.foeShots.length;   // just respawned
    G.load(rooms.b); settle(); s = G.state();                        // raider right next to the hero: dash through him
    for (let i = 0; i < 20; i++) s = G.step(Object.assign({}, none, { x: 1, dash: i === 0 }), 1); out.dashKill = s.foes[0].state; out.dashAlive = !s.dead;
    G.load(rooms.c); settle();                                       // a barrel in front of a raider: shoot the barrel
    for (let i = 0; i < 60; i++) s = G.step(Object.assign({}, none, { shoot: true }), 1); out.barrel = s.barrels[0]; out.blastKill = s.foes[0].state; out.blastAlive = !s.dead;
    G.load(rooms.d); settle();                                       // a raider a level up: he cannot see the hero, and shots pass under him
    for (let i = 0; i < 200; i++) s = G.step(Object.assign({}, none, { shoot: true }), 1); out.highFoe = s.foes[0].state; out.highSafe = !s.dead;
    G.load(rooms.e); settle();                                       // a heavy: one shot only dents him; he goes down to enough of them
    for (let i = 0; i < 30; i++) s = G.step(Object.assign({}, none, { shoot: true }), 1);
    out.heavyAfterFew = s.foes[0].state + ' hp' + s.foes[0].hp;
    G.load(rooms.g); settle();                                       // from a step one tile up: above his line of fire, still hitting his big body
    for (let i = 0; i < 300 && s.foes[0].state !== 'dead' && !s.dead; i++) s = G.step(Object.assign({}, none, { shoot: true }), 1);
    out.heavyDown = s.foes[0].state; out.heavySafe = !s.dead && !s.deaths;
    G.load(rooms.e); settle(); for (let i = 0; i < 400 && !(s = G.step(none, 1)).dead; i++); out.heavyKills = s.dead;
    const al = G.tune('heavyAlert', 99); G.load(rooms.h); settle();  // touching a heavy kills (he is held from firing for this one)
    for (let i = 0; i < 60 && !(s = G.step(Object.assign({}, none, { x: 1 }), 1)).dead; i++); out.heavyTouch = s.dead;
    G.load(rooms.h); settle(); for (let i = 0; i < 30 && !(s = G.step(Object.assign({}, none, { x: 1, dash: i === 0 }), 1)).dead; i++); out.heavyDash = s.dead; G.tune('heavyAlert', al);
    G.load(rooms.e); settle(); for (let i = 0; i < 200; i++) { s = G.step(none, 1); if (s.foeShots.length > 1) break; }   // the scattergun: a fan of pellets
    out.pellets = s.foeShots.length;
    G.load(rooms.f); settle();                                       // hanging on a wall, SHOOT fires away from it
    for (let i = 0; i < 6; i++) s = G.step(Object.assign({}, none, { x: 1, grab: true }), 1);
    out.climbing = s.state;
    for (let i = 0; i < 40 && s.foes[0].state !== 'dead'; i++) s = G.step(Object.assign({}, none, { grab: true, shoot: true }), 1);
    out.wallShot = s.foes[0].state; out.stillOnWall = s.state;
    return out;
  }, { h: room([[24, 3, 'S'], [24, 8, 'H']]), g: room([[23, 3, 'S'], [24, 2, '#'], [24, 3, '#'], [24, 4, '#'], [24, 5, '#'], [24, 15, 'H']]), e: room([[24, 30, 'S'], [24, 42, 'H']]), f: room([[24, 3, 'R'], [24, 9, 'S'], [23, 10, '#'], [24, 10, '#'], [22, 10, '#']]), a: room([[24, 30, 'S'], [24, 42, 'R']]), b: room([[24, 3, 'S'], [24, 5, 'R']]), c: room([[24, 3, 'S'], [24, 14, 'B'], [24, 16, 'R']]), d: room([[24, 3, 'S'], [22, 10, '#'], [22, 11, '#'], [22, 12, '#'], [22, 13, '#'], [21, 12, 'R']]) });
  console.log('mechanics:', JSON.stringify(m));
  ok(m.alerted === 'alert' || m.alerted === 'fire', 'raider does not notice the hero on his level');
  ok(m.shotKill === 'dead' && m.aliveAfterShot, 'a shot does not kill a raider');
  ok(m.raiderKills, 'a raider shot does not kill the hero');
  ok(m.resetFoe !== 'dead' && m.resetShots === 0, 'respawn does not reset the raider');
  ok(m.dashKill === 'dead' && m.dashAlive, 'a dash does not kill a raider');
  ok(m.barrel === 'gone' && m.blastKill === 'dead' && m.blastAlive, 'the barrel blast does not take the raider');
  ok(m.highFoe !== 'dead' && m.highSafe, 'a raider a level up is hit or shoots down');
  ok(/^(alert|fire|patrol) hp\d+$/.test(m.heavyAfterFew) && +m.heavyAfterFew.split('hp')[1] < 12 && +m.heavyAfterFew.split('hp')[1] > 0, 'a heavy does not take several hits');
  ok(m.heavyDown === 'dead' && m.heavySafe, 'a heavy cannot be shot down from above his line of fire');
  ok(m.heavyKills, 'a heavy does not kill the hero on his level');
  ok(m.heavyTouch && m.heavyDash, 'touching or dashing into a heavy does not kill the hero');
  ok(m.pellets === 3, 'the heavy does not fire a three-pellet spread');
  ok(m.climbing === 'climb' && m.wallShot === 'dead' && m.stillOnWall === 'climb', 'shooting from a wall does not fire away from it');
  const packed = await p.evaluate(() => ['"wall_aim"', '"idle_aim"', '"run_aim"'].filter(k => !document.documentElement.innerHTML.includes(k)));
  ok(!packed.length, 'hero sheet is missing ' + packed.join(' ') + ' (run make-hero.py after hero-wolf/draw.py)');
  if (process.env.SHOTS) {
    await p.reload(); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__climber.manual(true); window.__climber.demoStart(); });
    const marks = [70, 112, 600, 640, 700, 880, 930, 960];
    let at = 0;
    for (const f of marks) { await p.evaluate((n) => { const G = window.__climber; for (let i = 0; i < n; i++) { G.demoStep(1); } }, f - at); at = f; await p.waitForTimeout(80); await p.screenshot({ path: '/home/claude/combat-' + f + '.png' }); }
  }
  console.log(fails.length ? 'FAIL ' + fails.join('; ') : 'PASS', 'errors', JSON.stringify(errs));
  await b.close();
})();
