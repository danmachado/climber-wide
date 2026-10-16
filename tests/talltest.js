// Tall rooms: the camera follows the hero up a two-screen level; springs and the gem work; the builder can change height.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html#unlock'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const G = window.__climber; G.manual(true);
    G.startLevel(0, 8);                                     // 1-9, The Long Way (two screens)
    const v0 = G.view(), s0 = G.state();
    const w = document.getElementById('world');
    const h0 = w.style.height, t0 = w.style.transform;
    // play the recorded demo for this level to climb it
    const r = { room: v0.room, startY: s0.y, camStart: s0.cam, worldHeight: h0, transformStart: t0 };
    G.demoStart(); // picks a random one; instead replay by stepping with our own inputs is complex, so use the recording directly
    return r;
  });
  console.log('start', JSON.stringify(r));
  // replay the level's own recording through the demo machinery, then check the camera moved
  const after = await p.evaluate(() => {
    const G = window.__climber; const out = G.demoAll(); // plays every recording; the tall ones scroll
    return out['The Long Way'];
  });
  console.log('recording on the tall level:', after);
  const mid = await p.evaluate(() => { const G = window.__climber; G.startLevel(0, 8); G.step({ x: 0, y: 0 }, 1); const s = G.state(); return { y: s.y, cam: s.cam }; });
  await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(400);
  const shown = await p.evaluate(() => document.getElementById('world').style.transform);
  console.log('spawn near the bottom: y', mid.y, 'cam', mid.cam, '| world slid:', shown);
  await p.screenshot({ path: __dirname + '/tall-1.png' });
  // springs and gem on a hand-made room
  const sg = await p.evaluate(() => {
    const G = window.__climber; G.manual(true);
    const rows = []; for (let r = 0; r < 48; r++) { let s = ''; for (let c = 0; c < 27; c++) s += (r === 0 || r >= 46 || c === 0 || c === 26) ? '#' : '.'; rows.push(s); }
    const set = (r, c, ch) => rows[r] = rows[r].substring(0, c) + ch + rows[r].substring(c + 1);
    set(45, 3, 'S'); set(45, 10, 'u'); set(38, 10, 'G'); set(4, 22, 'E');
    G.load({ format: 1, id: 't', name: 'Springs', difficulty: 1, grid: { cols: 27, rows: 48, tile: 10 }, tiles: rows, entities: [] });
    const I = (o) => Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o);
    for (let i = 0; i < 40; i++) G.step(I({}), 1);
    let s, top = 999; for (let i = 0; i < 70; i++) { s = G.step(I({ x: 1 }), 1); if (s.x >= 100) break; }
    for (let i = 0; i < 60; i++) { s = G.step(I({ jump: true }), 1); top = Math.min(top, s.y); }
    const gemAfterBounce = s.gem; for (let i = 0; i < 70; i++) s = G.step(I({ x: 1 }), 1);
    return { highest: top, floorY: 450, gemFollowing: gemAfterBounce, gemBanked: s.gem && s.ground };
  });
  console.log('spring: rose', 450 - sg.highest, 'px (about', Math.round((450 - sg.highest) / 10), 'tiles) | gem picked up in the air:', sg.gemFollowing, '| banked on landing:', sg.gemBanked);
  // builder: height toggle
  const p2 = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  await p2.goto('file:///home/claude/climber-wide/builder/index.html'); await p2.waitForTimeout(300);
  await p2.selectOption('#rows', '96'); await p2.waitForTimeout(200);
  const bt = await p2.evaluate(() => { const t = JSON.parse(localStorage.getItem('climber.builder.draft.v1')).tiles; return [t.length, t[0], t[48], t[95]]; });
  console.log('builder 2 screens: rows', bt[0], '| top border', bt[1].slice(0, 6), '| old top now open', bt[2].slice(0, 6), '| bottom', bt[3].slice(0, 6));
  await p2.evaluate(() => document.getElementById('g-go').click()); await p2.waitForTimeout(200);
  console.log('auto-built tall room rows:', await p2.evaluate(() => JSON.parse(localStorage.getItem('climber.builder.draft.v1')).tiles.length), '|', await p2.locator('#status').innerText());
  await p2.screenshot({ path: __dirname + '/tall-2.png' });
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
