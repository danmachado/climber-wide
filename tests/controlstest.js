// Settings, Controls with a standard pad: callouts, the action list, giving a button a job and taking one off.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.addInitScript(() => {
    window.__pads = [{ index: 0, id: decodeURIComponent(location.hash.slice(1)) || 'Xbox Wireless Controller', mapping: 'standard', connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
    navigator.getGamepads = () => window.__pads;
  });
  const id = process.env.PAD || 'Xbox Wireless Controller';
  await p.goto('file:///home/claude/climber-wide/index.html#' + encodeURIComponent(id)); await p.waitForTimeout(700);
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  const Bt = (i, v) => p.evaluate(([i, v]) => { window.__pads[0].buttons[i] = { pressed: v, value: v ? 1 : 0 }; }, [i, v]);
  const tap = async i => { await Bt(i, true); await p.waitForTimeout(150); await Bt(i, false); await p.waitForTimeout(250); };
  const act = () => p.evaluate(() => { const c = JSON.parse(localStorage.getItem('climber.pad.v2') || '{}'); const k = Object.keys(c)[0]; return k ? c[k].act : null; });
  const tag = process.env.PAD ? 'nin-' : '';
  const shot = async n => { await p.waitForTimeout(150); await p.screenshot({ path: __dirname + '/ctl-' + tag + n + '.png' }); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  await nav({ y: 1 }); await nav({ y: 1 }); await nav({ jump: true }); let v = await nav({ jump: true });
  ok(v.set.page === 'controls', 'controls page open');
  await shot('1-jump');
  v = await nav({ y: 1 }); await shot('2-dash');
  // DASH: listen, then press the top button (3): it becomes dash
  await p.evaluate(() => window.__climber.nav({ jump: true })); await p.waitForTimeout(300); await shot('3-listen');
  await tap(3); await p.waitForTimeout(300);
  let a = await act(); ok(a && a.ft === 'dash', 'top button given DASH (' + JSON.stringify(a) + ')');
  v = await p.evaluate(() => window.__climber.view()); console.log('     note:', v.set.note);
  // DASH again, press the top button again: taken off
  await p.waitForTimeout(400); await p.evaluate(() => window.__climber.nav({ jump: true })); await p.waitForTimeout(300); await tap(3); await p.waitForTimeout(300);
  a = await act(); ok(a && !a.ft, 'pressing it again takes it off (' + JSON.stringify(a) + ')');
  // JUMP: press bottom (its only button): refused
  await nav({ y: -1 }); await p.waitForTimeout(400); await p.evaluate(() => window.__climber.nav({ jump: true })); await p.waitForTimeout(300); await tap(0); await p.waitForTimeout(300);
  a = await act(); v = await p.evaluate(() => window.__climber.view()); ok(a.fb === 'jump', 'last jump button kept: ' + v.set.note);
  // hold a shoulder to see it light up
  await Bt(4, true); await p.waitForTimeout(300); await shot('4-holding'); await Bt(4, false);
  // in play, the moved dash still works: the left face button (2) dashes
  console.log('errors', JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
