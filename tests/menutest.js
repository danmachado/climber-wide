// Main menu (wide): START as the big button (it opens the map), settings and reload as a row of icons; arrows move between them.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(700);
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  let v = await nav({}); ok(v.scene === 'menu' && v.sel.menu === 0, 'starts on START');
  v = await nav({ y: -1 }); ok(v.sel.menu === 0, 'up from START stays');
  v = await nav({ x: 1 }); ok(v.sel.menu === 0, 'right from START stays (one big button)');
  v = await nav({ y: 1 }); ok(v.sel.menu === 1, 'down: the settings icon');
  v = await nav({ x: 1 }); ok(v.sel.menu === 2, 'right: reload');
  v = await nav({ x: 1 }); ok(v.sel.menu === 2, 'right at the end stays');
  v = await nav({ y: 1 }); ok(v.sel.menu === 2, 'down from the icons stays');
  v = await nav({ y: -1 }); ok(v.sel.menu === 0, 'up from an icon: START');
  v = await nav({ y: 1 }); v = await nav({ jump: true }); ok(v.scene === 'settings', 'the settings icon opens settings');
  v = await nav({ back: true }); ok(v.scene === 'menu', 'back to the menu');
  // mouse: click the settings icon (first click asks for fullscreen)
  const st = await p.locator('#stage').boundingBox(), at = (x, y) => p.mouse.click(st.x + x / 480 * st.width, st.y + y / 270 * st.height);
  await at(210, 160); await p.waitForTimeout(150); await at(210, 160); await p.waitForTimeout(200);
  v = await p.evaluate(() => window.__climber.view()); ok(v.scene === 'settings', 'clicking the gear opens settings');
  await nav({ back: true }); await p.waitForTimeout(150);   // let the menu redraw first: clicks hit what is on screen
  await at(240, 110); await p.waitForTimeout(600); v = await p.evaluate(() => window.__climber.view());
  ok(v.scene === 'map', 'clicking START opens the map');
  console.log('errors', JSON.stringify(errs)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); await b.close();
})();
