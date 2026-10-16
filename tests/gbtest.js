// GAME BOY and BLACK AND WHITE themes: every level (all worlds, trials included) shows only that theme's colours while it plays, with the hero
// moving, dashing and dying, hazards running and Neon Row's city life on.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/gbtest.js   (THEME=gb, bw or both; both by default)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  const ALLOWED = { gb: '140,173,40|108,148,33|48,98,48|24,52,30', bw: '24,24,24|46,46,50|92,92,100|233,234,254' };
  for (const theme of (process.env.THEME ? [process.env.THEME] : ['gb', 'bw'])) {
  await p.goto('file:///home/claude/climber-wide/index.html#unlock');
  await p.evaluate(t => localStorage.setItem('climberwide.theme.v1', t), theme); await p.reload(); await p.waitForTimeout(800);
  const greens = ALLOWED[theme];
  const counts = await p.evaluate(() => window.__climber.view().levels.map(l => l.length));
  for (let w = 0; w < counts.length; w++) for (let i = 0; i < counts[w]; i++) {
    const r = await p.evaluate(async ([w, i]) => {
      const G = window.__climber; G.startLevel(w, i); G.manual(true);
      const I = (o) => Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o);
      for (let k = 0; k < 120; k++) G.step(I({ x: k < 60 ? 1 : -1, jump: k % 30 === 0, dash: k === 20 || k === 70 }), 1);
      G.manual(false); await new Promise(res => setTimeout(res, 350)); G.kill(); await new Promise(res => setTimeout(res, 120));
      const seen = {};
      for (const c of document.querySelectorAll('#world canvas')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let j = 0; j < d.length; j += 4) seen[d[j] + ',' + d[j + 1] + ',' + d[j + 2]] = 1; }
      return { name: G.view().room, cols: Object.keys(seen) };
    }, [w, i]);
    const bad = r.cols.filter(c => greens.indexOf(c) < 0);
    ok(!bad.length, theme + ' ' + (w + 1) + '-' + (i + 1) + ' ' + r.name + ': ' + r.cols.length + ' shades' + (bad.length ? ' (off palette: ' + bad.slice(0, 5).join(' ') + ')' : ''));
  }
  }
  console.log('errors', JSON.stringify(errs));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
