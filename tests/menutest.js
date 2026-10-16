// Main menu: MAP and ENDLESS as big buttons, settings, reload and exit as a row of icons; arrows move between them.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(700);
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  let v = await nav({}); ok(v.scene === 'menu' && v.sel.menu === 0, 'starts on MAP');
  v = await nav({ y: -1 }); ok(v.sel.menu === 0, 'up from MAP stays');
  v = await nav({ y: 1 }); ok(v.sel.menu === 1, 'down: ENDLESS');
  v = await nav({ y: 1 }); ok(v.sel.menu === 2, 'down again: the settings icon');
  v = await nav({ x: 1 }); ok(v.sel.menu === 3, 'right: reload');
  v = await nav({ x: 1 }); ok(v.sel.menu === 4, 'right: exit');
  v = await nav({ x: 1 }); ok(v.sel.menu === 4, 'right at the end stays');
  v = await nav({ y: 1 }); ok(v.sel.menu === 4, 'down from the icons stays');
  v = await nav({ y: -1 }); ok(v.sel.menu === 1, 'up from an icon: ENDLESS');
  v = await nav({ x: 1 }); ok(v.sel.menu === 1, 'left and right do nothing on a big button');
  v = await nav({ y: 1 }); v = await nav({ jump: true }); ok(v.scene === 'settings', 'the settings icon opens settings');
  v = await nav({ back: true }); ok(v.scene === 'menu', 'back to the menu');
  // mouse: click the settings icon (first click asks for fullscreen)
  const st = await p.locator('#stage').boundingBox(), at = (x, y) => p.mouse.click(st.x + x / 270 * st.width, st.y + y / 480 * st.height);
  await at(85, 344); await p.waitForTimeout(150); await at(85, 344); await p.waitForTimeout(200);
  v = await p.evaluate(() => window.__climber.view()); ok(v.scene === 'settings', 'clicking the gear opens settings');
  await nav({ back: true }); await p.waitForTimeout(150);   // let the menu redraw first: clicks hit what is on screen
  await at(135, 280); await p.waitForTimeout(600); v = await p.evaluate(() => window.__climber.view());
  ok(v.scene === 'play' && v.mode === 'endless', 'clicking ENDLESS starts endless');
  console.log('errors', JSON.stringify(errs)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); await b.close();
})();
