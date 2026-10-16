// Settings: a category list (CONTROLS, GRAPHICS, THEME, BACK), each opening its own page; back steps up one level at a time.
// THEME switches between ORIGINAL, GAME BOY and BLACK AND WHITE: it saves, reloads and comes back to the THEME page.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(700);
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  const shot = async n => { await p.waitForTimeout(120); await p.screenshot({ path: __dirname + '/set-' + n + '.png' }); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  let v = await nav({}); ok(v.scene === 'menu', 'starts on the menu');
  await nav({ y: 1 }); v = await nav({ y: 1 }); v = await nav({ jump: true });
  ok(v.scene === 'settings' && v.set.page === 'top' && v.set.row === 0, 'SETTINGS opens the category list');
  await shot('1-list');
  v = await nav({ jump: true }); ok(v.set.page === 'controls', 'CONTROLS opens the controls page');
  await shot('2-controls');
  v = await nav({ dash: true }); ok(v.set.page === 'top' && v.set.row === 0, 'back from controls returns to the list on CONTROLS');
  v = await nav({ y: 1 }); v = await nav({ jump: true }); ok(v.set.page === 'graphics', 'GRAPHICS opens the graphics page');
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('climberwide.shake.v1')));
  v = await nav({ y: 1 }); v = await nav({ jump: true });
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('climberwide.shake.v1')));
  ok(v.set.note.indexOf('SCREEN SHAKE') === 0 && before !== after, 'SHAKE toggles and saves (' + before + ' -> ' + after + ')');
  await shot('3-graphics');
  v = await nav({ jump: true }); ok(v.set.note === 'SCREEN SHAKE ON' || before === after, 'SHAKE toggles back');
  v = await nav({ y: -1 }); v = await nav({ y: -1 }); ok(v.set.row === 4, 'up from the top row wraps to BACK');
  v = await nav({ jump: true }); ok(v.set.page === 'top' && v.set.row === 1, 'BACK row returns to the list on GRAPHICS');
  v = await nav({ back: true }); ok(v.scene === 'menu', 'back from the list returns to the menu');
  // the mouse: click CONTROLS on the list
  v = await nav({ jump: true }); ok(v.scene === 'settings' && v.set.page === 'top', 'menu remembers SETTINGS');
  await p.waitForTimeout(150);
  const bx = await p.evaluate(() => { const c = document.getElementById('stage').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
  for (let k = 0; k < 2; k++) { await p.mouse.click(bx.x + 135 / 270 * bx.w, bx.y + 145 / 480 * bx.h); await p.waitForTimeout(150); }   // the first click asks for fullscreen
  v = await p.evaluate(() => window.__climber.view()); ok(v.set.page === 'controls', 'mouse click on CONTROLS opens it (page ' + v.set.page + ')');
  // THEME: ORIGINAL is in use, GAME BOY switches (a reload), and the page comes back with GAME BOY on
  v = await nav({ back: true }); v = await nav({ y: 1 }); v = await nav({ y: 1 }); v = await nav({ jump: true });
  ok(v.set.page === 'theme' && v.set.row === 0, 'THEME opens the theme page');
  v = await nav({ jump: true }); ok(v.set.note === 'ALREADY IN USE', 'ORIGINAL is the theme in use');
  await nav({ y: 1 }); await shot('4-theme');
  await Promise.all([p.waitForEvent('load'), nav({ jump: true })]); await p.waitForTimeout(800);
  v = await nav({}); let th = await p.evaluate(() => localStorage.getItem('climberwide.theme.v1'));
  ok(th === 'gb' && v.scene === 'settings' && v.set.page === 'theme' && v.set.row === 1 && v.set.note === 'GAME BOY ON', 'GAME BOY saves, reloads and returns to THEME (' + th + ', ' + v.set.page + ')');
  await shot('5-theme-gb');
  const greens = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(greens === 'rgb(24, 52, 30)', 'GAME BOY: the page around the game is the darkest green (' + greens + ')');
  await p.evaluate(() => window.__climber.startLevel(0, 0)); await p.waitForTimeout(600);
  const pal = await p.evaluate(() => { const cs = document.querySelectorAll('#world canvas'), seen = {}; for (const c of cs) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) seen[d[i] + ',' + d[i + 1] + ',' + d[i + 2]] = 1; } return Object.keys(seen); });
  ok(pal.length <= 4, 'GAME BOY: a level on screen uses only the four greens (' + pal.join(' ') + ')');
  await p.evaluate(() => { const G = window.__climber; G.nav({ back: true }); });
  await p.reload(); await p.waitForTimeout(700);
  await nav({ y: 1 }); await nav({ y: 1 }); await nav({ jump: true }); await nav({ y: 1 }); await nav({ jump: true }); await nav({ y: 1 }); v = await nav({ jump: true });
  ok(v.set.page === 'graphics' && v.set.note === 'OFF IN THIS THEME, FOR SPEED', 'GAME BOY: SHAKE stays off (' + v.set.note + ')');
  await shot('6-graphics-gb');
  // BLACK AND WHITE: the third row; black all round and only its four shades on screen
  await nav({ back: true }); await nav({ y: 1 }); await nav({ jump: true }); await nav({ y: 1 }); await nav({ y: 1 });
  await Promise.all([p.waitForEvent('load'), nav({ jump: true })]); await p.waitForTimeout(800);
  th = await p.evaluate(() => localStorage.getItem('climberwide.theme.v1')); v = await nav({});
  ok(th === 'bw' && v.set.page === 'theme' && v.set.row === 2 && v.set.note === 'BLACK AND WHITE ON', 'BLACK AND WHITE saves, reloads and returns to THEME (' + th + ')');
  await shot('7-theme-bw');
  ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(24, 24, 24)', 'BLACK AND WHITE: black around the game');
  await p.evaluate(() => window.__climber.startLevel(0, 0)); await p.waitForTimeout(600);
  const pal2 = await p.evaluate(() => { const cs = document.querySelectorAll('#world canvas'), seen = {}; for (const c of cs) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) seen[d[i] + ',' + d[i + 1] + ',' + d[i + 2]] = 1; } return Object.keys(seen); });
  ok(pal2.length <= 4 && pal2.every(c => '24,24,24|46,46,50|92,92,100|233,234,254'.indexOf(c) >= 0), 'BLACK AND WHITE: a level on screen uses only black, two greys and white (' + pal2.join(' ') + ')');
  await p.reload(); await p.waitForTimeout(700);
  await nav({ y: 1 }); await nav({ y: 1 }); await nav({ jump: true }); await nav({ y: 1 }); await nav({ y: 1 }); await nav({ jump: true });
  await Promise.all([p.waitForEvent('load'), nav({ jump: true })]); await p.waitForTimeout(800);
  th = await p.evaluate(() => localStorage.getItem('climberwide.theme.v1')); v = await nav({});
  ok(th === 'original' && v.set.page === 'theme' && v.set.note === 'ORIGINAL ON', 'ORIGINAL switches back (' + th + ')');
  console.log('errors', JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
