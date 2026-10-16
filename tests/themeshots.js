// Pictures of every world, the menu, settings and the map in one theme (for review, not a check).
// THEME=gb or original. Writes /home/claude/shots/<theme>-<name>.png.
// Run: THEME=gb NODE_PATH=/opt/npm-tools/node_modules node tests/themeshots.js
const { chromium } = require('playwright');
const theme = process.env.THEME || 'gb', OUT = '/home/claude/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html#unlock');
  await p.evaluate(t => localStorage.setItem('climberwide.theme.v1', t), theme);
  await p.reload(); await p.waitForTimeout(800);
  const shot = n => p.screenshot({ path: OUT + '/' + theme + '-' + n + '.png' });
  await shot('menu');
  const picks = (process.env.LEVELS || '0:0,0:2,1:1,2:4,3:6,4:4,4:5,0:8,3:8').split(',');
  for (const pk of picks) {
    const [w, i] = pk.split(':').map(Number);
    await p.evaluate(([w, i]) => { const G = window.__climber; G.startLevel(w, i); G.manual(true); for (let k = 0; k < 40; k++) G.step({ x: 0, y: 0, jump: false, dash: false, grab: false }, 1); }, [w, i]);
    await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(700);
    await shot('w' + (w + 1) + '-' + (i + 1));
  }
  // a level in motion: a Furnace room stepped until its jets and fireballs are going, and a death
  await p.evaluate(() => { const G = window.__climber; G.startLevel(2, 7); G.manual(true); for (let k = 0; k < 150; k++) G.step({ x: 1, y: 0, jump: k % 40 === 0, dash: k === 60, grab: false }, 1); });
  await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(300); await shot('play-dash');
  await p.evaluate(() => { const G = window.__climber; G.startLevel(3, 6); G.manual(true); for (let k = 0; k < 90; k++) G.step({ x: 0, y: 0, jump: false, dash: false, grab: false }, 1); });
  await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(500); await shot('play-temple');
  // menus: pause, settings, the map (driven through the test hook's menu input)
  const nav = o => p.evaluate(o => window.__climber.nav(o), o);
  await p.keyboard.down('Escape'); await p.waitForTimeout(90); await p.keyboard.up('Escape'); await p.waitForTimeout(400); await shot('pause');
  await p.evaluate(() => window.__climber.nav({ back: true }));
  await p.reload(); await p.waitForTimeout(800);
  await nav({ y: 1 }); await nav({ y: 1 }); await nav({ jump: true }); await p.waitForTimeout(300); await shot('settings');
  await nav({ y: 1 }); await nav({ y: 1 }); await nav({ jump: true }); await p.waitForTimeout(300); await shot('settings-theme');
  await p.reload(); await p.waitForTimeout(800);
  await nav({ jump: true }); await p.waitForTimeout(400); await shot('map');
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
