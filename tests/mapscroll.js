// The map with 50 levels in a world: every tile can be reached with the arrows and the view keeps the chosen one in sight.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html#unlock'); await p.waitForTimeout(700);
  await p.evaluate(() => window.__climber.padLevels(0, 50));
  await p.evaluate(() => window.__climber.nav({ jump: true }));
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const seen = new Set(); let v, off = [];
  const check = async () => { v = await p.evaluate(() => window.__climber.view().sel); const t = await p.evaluate(i => window.__climber.mapTile(i), v.i); seen.add(v.i); if (t.y < 100 || t.y > 400) off.push(v.i + '@' + Math.round(t.y)); };
  await check();
  for (let r = 0; r < 14; r++) { for (let k = 0; k < 3; k++) { await nav({ x: r % 2 ? -1 : 1 }); await check(); } await nav({ y: -1 }); await check(); }
  ok(seen.size === 50, 'walked the snake through ' + seen.size + ' of 50 tiles');
  ok(!off.length, 'the chosen tile always in view' + (off.length ? ' (off: ' + off.join(' ') + ')' : ''));
  for (let k = 0; k < 15; k++) await nav({ y: 1 }); v = await p.evaluate(() => window.__climber.view().sel);
  const t0 = await p.evaluate(i => window.__climber.mapTile(i), v.i);
  ok(v.i < 4 && t0.y < 400, 'down all the way returns to the bottom row (tile ' + (v.i + 1) + ')');
  await nav({ jump: true }); const s = await p.evaluate(() => window.__climber.view()); ok(s.scene === 'play', 'jump plays the chosen level');
  console.log('errors', JSON.stringify(errs)); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); await b.close();
})();
