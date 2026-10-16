// Pause: Esc (Start on a pad) in a level opens the pause menu, the game holds still, and each button does its job.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html#unlock'); await p.waitForTimeout(700);
  const V = () => p.evaluate(() => window.__climber.view());
  const S = () => p.evaluate(() => window.__climber.state());
  const key = async (k, wait) => { await p.keyboard.down(k); await p.waitForTimeout(90); await p.keyboard.up(k); await p.waitForTimeout(wait || 200); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const start = async (w, i) => { await p.evaluate(([w, i]) => window.__climber.startLevel(w, i), [w, i]); await p.waitForTimeout(1200); };

  await start(0, 1);
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(300); await p.keyboard.up('ArrowRight');
  await key('Escape');
  let v = await V(); ok(v.scene === 'play' && v.pause.on, 'Esc in a level opens the pause menu');
  const t0 = v.time, s0 = await S(); await p.waitForTimeout(800); v = await V(); const s1 = await S();
  ok(v.time === t0 && s0.x === s1.x && s0.y === s1.y, 'paused: clock and hero hold still (' + t0.toFixed(2) + ')');
  await p.screenshot({ path: __dirname + '/pause-1.png' });
  await key('Escape'); v = await V(); ok(!v.pause.on && v.scene === 'play', 'Esc again resumes');
  await p.waitForTimeout(400); v = await V(); ok(v.time > t0, 'clock runs again after resume');
  // RESUME with jump must not make the hero jump
  await key('Escape'); const g0 = await S(); await key('KeyC', 300); v = await V(); const g1 = await S();
  ok(!v.pause.on && g1.ground === g0.ground, 'RESUME with jump goes back in without a jump');
  // RESTART
  await p.waitForTimeout(500); await key('Escape'); await key('ArrowDown'); v = await V(); ok(v.pause.pick === 1, 'down picks RESTART');
  await p.screenshot({ path: __dirname + '/pause-2.png' });
  await key('KeyC', 300); v = await V(); ok(!v.pause.on && v.scene === 'play' && v.time < 0.5 && v.lvl.i === 1, 'RESTART starts the level over (time ' + v.time.toFixed(2) + ')');
  // MAP
  await key('Escape'); await key('ArrowDown'); await key('ArrowDown'); await key('KeyC', 300); v = await V();
  ok(v.scene === 'map' && v.sel.i === 1 && !v.pause.on, 'MAP goes to the map on this level');
  // MAIN MENU (up wraps from RESUME to MAIN MENU)
  await start(0, 1); await key('Escape'); await key('ArrowUp'); await key('KeyC', 300); v = await V();
  ok(v.scene === 'menu' && !v.pause.on, 'MAIN MENU goes to the menu');
  // mouse: click MAIN MENU on the panel (fullscreen takes the first click)
  await start(0, 1); await key('Escape');
  const bx = await p.evaluate(() => { const c = document.getElementById('stage').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
  for (let k = 0; k < 2; k++) { await p.mouse.click(bx.x + (240 + 162) / 480 * bx.w, bx.y + (48 + 94 + 13) / 270 * bx.h); await p.waitForTimeout(200); }
  v = await V(); ok(v.scene === 'menu', 'clicking MAIN MENU works');
  await p.screenshot({ path: __dirname + '/pause-3.png' });
  console.log('errors', JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
