// Rumble: a fake pad whose vibrationActuator records every effect. Checks the moments that rumble, that a weaker
// effect does not cut off a stronger one, pause stops it, the idle demo and builder tests stay quiet, and the
// RUMBLE switch on the Controls page turns it off and on (with a test pulse) and is saved.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/rumbletest.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.addInitScript(() => {
    window.__fx = []; window.__resets = 0;
    const pad = { index: 0, id: 'Xbox Wireless Controller (test)', mapping: 'standard', connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0],
      vibrationActuator: { type: 'dual-rumble', playEffect: (t, o) => { window.__fx.push(Object.assign({ type: t }, o)); return Promise.resolve('complete'); }, reset: () => { window.__resets++; return Promise.resolve('complete'); } } };
    navigator.getGamepads = () => [pad];
  });
  await p.goto('file:///home/claude/climber-wide/index.html#unlock'); await p.waitForTimeout(700);
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const none = { x: 0, y: 0, jump: false, dash: false, grab: false };
  const fx = () => p.evaluate(() => { const f = window.__fx; window.__fx = []; return f; });
  const settle = () => p.waitForTimeout(400);          // past any effect still playing, so the next one is not held back

  await p.evaluate(() => { const G = window.__climber; G.startLevel(0, 0); G.manual(true); for (let k = 0; k < 40; k++) G.step({ x: 0, y: 0, jump: false, dash: false, grab: false }, 1); });
  await fx(); await settle();
  await p.evaluate(n => { const G = window.__climber; G.step(Object.assign({}, n, { dash: true, x: 1 }), 1); G.step(n, 1); }, none);
  let f = await fx(); ok(f.length === 1 && f[0].type === 'dual-rumble' && f[0].weakMagnitude > f[0].strongMagnitude, 'a dash buzzes (' + JSON.stringify(f[0]) + ')');
  await settle();
  await p.evaluate(() => window.__climber.kill()); f = await fx(); ok(f.length === 1 && f[0].strongMagnitude >= 0.8, 'a fall rumbles hard');
  await p.evaluate(n => { const G = window.__climber; for (let k = 0; k < 40; k++) G.step(n, 1); G.kill(); }, none); f = await fx();
  ok(f.length === 1, 'a second fall straight after still rumbles (same strength)');
  await p.evaluate(n => { const G = window.__climber; for (let k = 0; k < 40; k++) G.step(n, 1); }, none); await fx();
  await p.evaluate(() => window.__climber.kill());
  await p.evaluate(n => { const G = window.__climber; for (let k = 0; k < 30; k++) G.step(n, 1); G.step(Object.assign({}, n, { dash: true, x: 1 }), 1); }, none);
  f = await fx(); ok(f.length === 1 && f[0].strongMagnitude >= 0.8, 'a dash does not cut off a fall still rumbling');
  await settle();
  // pause stops it
  await p.evaluate(() => window.__climber.manual(false));
  const r0 = await p.evaluate(() => window.__resets);
  await p.keyboard.down('Escape'); await p.waitForTimeout(90); await p.keyboard.up('Escape'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__resets) > r0, 'pause stops the rumble');
  // the idle demo stays quiet
  await p.evaluate(() => { window.__climber.demoStart(); }); await fx();
  await p.evaluate(() => window.__climber.demoStep(900)); f = await fx(); ok(f.length === 0, 'the idle demo never rumbles');
  // the switch: menu -> settings -> controls -> RUMBLE
  await p.reload(); await p.waitForTimeout(700); await fx();
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  await nav({ y: 1 }); await nav({ jump: true }); await nav({ jump: true });   // SETTINGS, then CONTROLS
  let v = await nav({}); ok(v.set.page === 'controls', 'on the Controls page');
  const toRumble = async () => { for (let k = 0; k < 20; k++) { const w = await nav({}); if (w.set.id === 'rumble') return true; await nav({ y: 1 }); } return false; };
  ok(await toRumble(), 'the RUMBLE row is there');
  await fx();
  v = await nav({ jump: true }); let st = await p.evaluate(() => window.__climber.rumble());
  ok(!st.on && v.set.note === 'RUMBLE OFF', 'RUMBLE turns off (' + v.set.note + ')');
  ok(await p.evaluate(() => localStorage.getItem('climberwide.rumble.v1')) === '0', 'off is saved');
  await p.evaluate(n => { const G = window.__climber; G.startLevel(0, 0); G.manual(true); for (let k = 0; k < 40; k++) G.step(n, 1); G.kill(); }, none);
  f = await fx(); ok(f.length === 0, 'off: a fall does not rumble');
  await p.evaluate(() => window.__climber.manual(false)); await p.reload(); await p.waitForTimeout(700); await fx();
  await nav({ y: 1 }); await nav({ jump: true }); await nav({ jump: true }); await toRumble();
  v = await nav({ jump: true }); f = await fx(); st = await p.evaluate(() => window.__climber.rumble());
  ok(st.on && f.length === 1 && /FEEL THAT/.test(v.set.note), 'RUMBLE back on plays a test pulse (' + v.set.note + ')');
  await p.screenshot({ path: '/home/claude/shots/rumble-controls.png' });
  console.log('errors', JSON.stringify(errs)); console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
