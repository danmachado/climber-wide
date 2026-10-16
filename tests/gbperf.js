// Repaint cost per theme: screen pieces copied per second (chunkCopies) standing still and running, and room build time.
// Headless, so a guide to what changes, not the frame's numbers. Run: NODE_PATH=/opt/npm-tools/node_modules node tests/gbperf.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const rows = {};
  for (const theme of ['original', 'gb']) {
    const p = await b.newPage({ viewport: { width: 540, height: 960 } });
    await p.route('**/rest/v1/**', r => r.abort());
    await p.goto('file:///home/claude/climber-wide/index.html#unlock');
    await p.evaluate(t => localStorage.setItem('climber.theme.v1', t), theme); await p.reload(); await p.waitForTimeout(800);
    for (const [w, i] of [[0, 2], [1, 3], [2, 7], [3, 6], [4, 4], [4, 8]]) {
      const load = await p.evaluate(([w, i]) => { const G = window.__climber, t0 = performance.now(); G.startLevel(w, i); return Math.round(performance.now() - t0); }, [w, i]);
      await p.waitForTimeout(3500);   // past the spawn and the first idle breaths
      const c0 = await p.evaluate(() => window.__climber.city().chunks); await p.waitForTimeout(3000);
      const idle = Math.round((await p.evaluate(() => window.__climber.city().chunks) - c0) / 3);
      await p.keyboard.down('ArrowRight'); const c1 = await p.evaluate(() => window.__climber.city().chunks); await p.waitForTimeout(1000);
      const run = Math.round((await p.evaluate(() => window.__climber.city().chunks) - c1)); await p.keyboard.up('ArrowRight');
      const k = (w + 1) + '-' + (i + 1); rows[k] = rows[k] || {}; rows[k][theme] = { load, idle, run };
    }
    await p.close();
  }
  console.log('level   build ms (orig/gb)   idle copies/s (orig/gb)   running copies/s (orig/gb)');
  for (const k in rows) { const o = rows[k].original, g = rows[k].gb; console.log(k.padEnd(8), (o.load + '/' + g.load).padEnd(20), (o.idle + '/' + g.idle).padEnd(25), o.run + '/' + g.run); }
  await b.close();
})();
