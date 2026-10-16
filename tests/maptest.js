// Menu, map, level scoring and saved progress.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e) + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.route('**/rest/v1/**', r => r.abort());           // built-in levels only
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(300);
  const shot = async (n) => { await p.waitForTimeout(150); await p.screenshot({ path: __dirname + '/' + n + '.png' }); };
  const V = () => p.evaluate(() => window.__climber.view());
  let v = await V(); console.log('boot scene', v.scene, 'levels', v.levels.map(l => l.length));
  await shot('map-1-menu');
  await p.keyboard.press('KeyC', { delay: 80 }); await p.waitForTimeout(200); v = await V(); console.log('after jump on menu', v.scene, JSON.stringify(v.sel));
  await shot('map-2-map');
  // a locked level cannot be started
  await p.keyboard.press('ArrowRight', { delay: 80 }); await p.waitForTimeout(100); await p.keyboard.press('KeyC', { delay: 80 }); await p.waitForTimeout(100);
  v = await V(); console.log('locked 1-2 stays on map:', v.scene === 'map', 'sel', v.sel.i);
  // beat 1-1 with the demo inputs
  v = await p.evaluate(() => { const G = window.__climber; G.manual(true); const r = G.levelProbe(); G.manual(false); return r; });
  console.log('1-1 result', JSON.stringify(v.result), 'time', v.time.toFixed(1), 'saved', JSON.stringify(v.prog));
  await shot('map-3-clear');
  for (const k of ['ArrowDown', 'ArrowDown', 'KeyC']) { await p.keyboard.press(k, { delay: 80 }); await p.waitForTimeout(120); }
  v = await V(); console.log('MAP button -> map', v.scene, 'sel', v.sel.i);
  await shot('map-4-progress');
  await p.keyboard.press('KeyC', { delay: 80 }); await p.waitForTimeout(300); v = await V(); console.log('start 1-2', v.scene, v.room, JSON.stringify(v.lvl));
  await p.keyboard.press('Escape', { delay: 80 }); await p.waitForTimeout(200); v = await V(); console.log('esc pauses:', v.pause.on);
  for (const k of ['ArrowDown', 'ArrowDown', 'KeyC']) { await p.keyboard.press(k, { delay: 80 }); await p.waitForTimeout(150); }
  v = await V(); console.log('pause, MAP -> ', v.scene);
  await p.reload(); await p.waitForTimeout(300); v = await V(); console.log('after reload saved', Object.keys(v.prog));
  // mouse: click MAP, then click level 1-2 twice
  const st = await p.locator('#stage').boundingBox(), at = (x, y) => p.mouse.click(st.x + x / 270 * st.width, st.y + y / 480 * st.height);
  await at(135, 224); await p.waitForTimeout(150); await at(135, 224); await p.waitForTimeout(150); v = await V(); console.log('click MAP ->', v.scene);
  const t2 = await p.evaluate(() => window.__climber.mapTile(1));
  await at(t2.x, t2.y); await p.waitForTimeout(100); await at(t2.x, t2.y); await p.waitForTimeout(200); v = await V(); console.log('click 1-2 twice ->', v.scene, v.room);
  // world 2 with everything unlocked
  await p.goto('file:///home/claude/climber-wide/index.html#unlock'); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(() => { const G = window.__climber; G.nav({ jump: true }); G.nav({ x: -1 }); G.nav({ x: -1 }); });
  for (let k = 0; k < 4; k++) v = await p.evaluate(() => window.__climber.nav({ x: 1 }));   // four tiles to a row: the fourth step runs off the side into world 2
  console.log('world switch sel', JSON.stringify(v.sel)); await shot('map-5-world2');
  await p.evaluate(() => window.__climber.startLevel(1, 4)); await p.waitForTimeout(700); await shot('map-6-ice');
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
