// Controller setup and settings with awkward hardware: d-pad on one device, buttons on a second, Start arriving as a key.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.addInitScript(() => {
    const mk = (index, nb, na) => ({ index, id: '8BitDo Pro 2 (test)', mapping: '', buttons: Array.from({ length: nb }, () => ({ pressed: false, value: 0 })), axes: Array(na).fill(0) });
    window.__pads = [mk(0, 0, 4), mk(1, 16, 0)];
    navigator.getGamepads = () => window.__pads;
  });
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(600);
  const B = (i, v) => `window.__pads[1].buttons[${i}] = { pressed: ${v}, value: ${v ? 1 : 0} }`;
  const A = (i, v) => `window.__pads[0].axes[${i}] = ${v}`;
  const press = async (on, off, gap) => { await p.waitForTimeout(gap || 420); await p.evaluate(on); await p.waitForTimeout(140); await p.evaluate(off); };
  const tap = (i, gap) => press(B(i, true), B(i, false), gap);
  const V = () => p.evaluate(() => window.__climber.view());
  await p.waitForTimeout(300); await p.screenshot({ path: __dirname + '/pad-1-setup.png' });
  // setup: bottom, (bottom again: refused), right, left, top, L, R, ZL, ZR, d-pad x4, Start as a key
  await tap(1); await tap(1); await tap(2); await tap(0); await tap(3); await tap(4); await tap(5); await tap(6); await tap(7);
  await press(A(1, -1), A(1, 0)); await press(A(1, 1), A(1, 0)); await press(A(0, -1), A(0, 0)); await press(A(0, 1), A(0, 0));
  await p.waitForTimeout(420); await p.keyboard.down('Enter'); await p.waitForTimeout(140); await p.keyboard.up('Enter'); await p.waitForTimeout(400);
  let cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('climberwide.pad.v2')));
  const c = cfg && cfg['8BitDo Pro 2 (test)'];
  console.log('layout learned:', c ? Object.keys(c.layout).length + ' buttons, bottom=' + JSON.stringify(c.layout.fb) + ' start=' + JSON.stringify(c.layout.start) : 'NONE');
  console.log('default jobs:', c && JSON.stringify(c.act));
  // menu: down twice to SETTINGS, select with the bottom button
  await press(A(1, 1), A(1, 0), 200); await press(A(1, 1), A(1, 0), 200); await tap(1, 200); await p.waitForTimeout(250);
  let v = await V(); console.log('settings opened:', v.scene);
  await tap(1, 250); await p.waitForTimeout(250); v = await V(); console.log('controls page opened:', v.set.page);   // the list starts on CONTROLS
  await p.evaluate(B(3, true)); await p.waitForTimeout(200); await p.screenshot({ path: __dirname + '/pad-2-settings.png' }); await p.evaluate(B(3, false));
  // CHANGE DASH (row 1) -> press the top button
  await press(A(1, 1), A(1, 0), 250); await tap(1, 250); await p.waitForTimeout(300); await p.screenshot({ path: __dirname + '/pad-3-listen.png' });
  await tap(3, 300); await p.waitForTimeout(500);
  cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('climberwide.pad.v2'))['8BitDo Pro 2 (test)'].act); console.log('top button now:', cfg.ft);
  // CHANGE DASH again -> press the only jump button: must be refused
  await tap(1, 300); await tap(1, 400); await p.waitForTimeout(500);
  cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('climberwide.pad.v2'))['8BitDo Pro 2 (test)'].act); console.log('bottom button still:', cfg.fb);
  // play: Start as a key leaves a level; dash on the top button costs stamina
  await p.evaluate(() => window.__climber.startLevel(0, 0)); await p.waitForTimeout(900);
  await p.evaluate(B(1, true)); await p.waitForTimeout(120); const st = await p.evaluate(() => window.__climber.state()); await p.evaluate(B(1, false));
  await tap(3, 150); await p.waitForTimeout(60); const st2 = await p.evaluate(() => window.__climber.state());
  console.log('jump works:', !st.ground, '| dash on the top button used stamina:', st2.stamina < 110);
  await p.keyboard.press('Enter', { delay: 100 }); await p.waitForTimeout(250); v = await V(); console.log('Start pauses:', v.scene, v.pause.on);
  await p.keyboard.press('Enter', { delay: 100 }); await p.waitForTimeout(250); v = await V(); console.log('Start again resumes:', !v.pause.on);
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
