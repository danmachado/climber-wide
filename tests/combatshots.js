// Pictures of the fight on 1-1 for review: the demo plays First Light with a real render after every step, and
// frames around each kill are saved (OUT, default /home/claude/combat) as PNGs; combat-gif.py makes GIFs from them.
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/home/claude/combat', fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  if (process.env.THEME) await p.addInitScript((t) => localStorage.setItem('climberwide.theme.v1', t), process.env.THEME);
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { const G = window.__climber; G.manual(true); G.demoRun(0); });
  const ranges = (process.env.RANGES || '40-130,400-520').split(',').map(r => r.split('-').map(Number));
  const last = Math.max(...ranges.map(r => r[1]));
  for (let f = 0; f <= last; f++) {
    await p.evaluate(() => new Promise(res => { window.__climber.demoStep(1); requestAnimationFrame(() => res()); }));
    if (ranges.some(([a, z]) => f >= a && f <= z) && f % 2 === 0) await p.screenshot({ path: OUT + '/f' + String(f).padStart(4, '0') + '.png' });
  }
  console.log('saved', fs.readdirSync(OUT).length, 'errors', JSON.stringify(errs));
  await b.close();
})();
