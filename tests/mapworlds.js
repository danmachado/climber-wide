// The map's world switch: the right trigger goes to the next world, the left one back; Q and E do the same on a keyboard.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.addInitScript(() => { window.__pads = [{ index: 0, id: 'Xbox Wireless Controller', mapping: 'standard', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }]; navigator.getGamepads = () => window.__pads; });
  await p.goto('file:///home/claude/climber-wide/index.html#unlock'); await p.waitForTimeout(700);
  const V = () => p.evaluate(() => window.__climber.view());
  const tap = async i => { await p.evaluate(i => { window.__pads[0].buttons[i] = { pressed: true, value: 1 }; }, i); await p.waitForTimeout(120); await p.evaluate(i => { window.__pads[0].buttons[i] = { pressed: false, value: 0 }; }, i); await p.waitForTimeout(120); };
  const key = async k => { await p.keyboard.down(k); await p.waitForTimeout(100); await p.keyboard.up(k); await p.waitForTimeout(120); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  await tap(0); let v = await V(); ok(v.scene === 'map' && v.sel.w === 0, 'jump on the menu opens the map in world 1');
  await tap(7); v = await V(); ok(v.sel.w === 1, 'right trigger: world 2');
  await tap(7); await tap(7); v = await V(); ok(v.sel.w === 3, 'two more: world 4');
  await p.screenshot({ path: __dirname + '/mapworlds.png' });
  await tap(7); await tap(7); v = await V(); ok(v.sel.w === 4, 'stops at the last world (' + (v.sel.w + 1) + ')');
  await tap(6); v = await V(); ok(v.sel.w === 3, 'left trigger: back one');
  await key('KeyQ'); v = await V(); ok(v.sel.w === 2, 'Q: back one');
  await key('KeyE'); v = await V(); ok(v.sel.w === 3, 'E: forward one');
  await tap(0); await p.waitForTimeout(300); v = await V(); ok(v.scene === 'play' && v.lvl.w === 3, 'jump plays in the world it landed on');
  console.log('errors', JSON.stringify(errs)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); await b.close();
})();
