// Pictures of each world's background with parallax on (for review, not a check).
// For every world: two short levels and the tall level at its start and near its top (played by its recording).
// Also saves each parallax layer alone, and the camera at a few points of a tall climb, so depth can be judged.
// WORLDS=1,2,3 picks worlds (1-based). PARA=0 turns parallax off. Writes /home/claude/shots/bg-*.png.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/bgshots.js
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/home/claude/shots';
const worlds = (process.env.WORLDS || '1,2,3,4,5').split(',').map(Number);
const para = process.env.PARA !== '0';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html#unlock');
  await p.evaluate(on => { localStorage.setItem('climberwide.theme.v1', ''); localStorage.setItem('climberwide.para.v1', on ? '1' : '0'); }, para);
  await p.reload(); await p.waitForTimeout(800);
  const tag = para ? '' : '-flat';
  for (const w of worlds) {
    for (const i of [0, 1, 8]) {
      const t0 = Date.now();
      const ms = await p.evaluate(([w, i]) => { const G = window.__climber, a = performance.now(); G.startLevel(w - 1, i); const d = performance.now() - a; G.manual(true); for (let k = 0; k < 30; k++) G.step({ x: 0, y: 0, jump: false, dash: false, grab: false }, 1); return Math.round(d); }, [w, i]);
      await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(500);
      await p.screenshot({ path: `${OUT}/bg${tag}-w${w}-${i + 1}.png` });
      console.log(`w${w}-${i + 1} build ${ms} ms`);
    }
    // the tall level with the hero lifted into the top half (camera eases up there)
    for (const frac of [0.5, 0.15]) {
      await p.evaluate(([w, frac]) => { const G = window.__climber; G.startLevel(w - 1, 8); G.manual(true); window.__g = G.tune('gravity', 0); G.tune('maxFall', 0); const s = G.snap(); s.pl.y = Math.round(540 * frac); s.pl.vy = 0; G.restore(s); G.manual(false); }, [w, frac]);
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${OUT}/bg${tag}-w${w}-tall${Math.round(frac * 100)}.png` });
      await p.evaluate(() => { const G = window.__climber; G.tune('gravity', window.__g); G.tune('maxFall', window.__g * 160 / 900); });
    }
  }
  // layers alone: hide everything but one parallax canvas at a time, on a tall room
  if (para) for (const w of worlds) {
    await p.evaluate(w => { const G = window.__climber; G.startLevel(w - 1, 8); }, w);
    await p.waitForTimeout(400);
    const n = await p.evaluate(() => document.querySelectorAll('canvas.para').length);
    for (let k = 0; k < n; k++) {
      await p.evaluate(k => { const cs = document.querySelectorAll('canvas'); cs.forEach(c => { c.dataset.vis = c.style.visibility; }); const ps = document.querySelectorAll('canvas.para'); cs.forEach(c => { if (c !== ps[k]) c.style.visibility = 'hidden'; }); }, k);
      await p.screenshot({ path: `${OUT}/bg-w${w}-layer${k}.png` });
      await p.evaluate(() => document.querySelectorAll('canvas').forEach(c => { c.style.visibility = c.dataset.vis || ''; }));
    }
  }
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
