// Every recorded demo must reach the exit, and the idle demo must move on from level to level.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/rest/v1/**', r => r.abort());
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const G = window.__climber; G.manual(true); return G.demoAll(); });
  const bad = Object.entries(r).filter(([k, v]) => !v.startsWith('won'));
  console.log(JSON.stringify(r)); console.log('recordings', Object.keys(r).length, 'not won', bad.length);
  // looping: run the demo for a while and list the levels it visits
  const seen = await p.evaluate(() => { const G = window.__climber; G.demoStart(); const s = []; for (let i = 0; i < 9000; i++) { G.demoStep(1); const n = G.view().room; if (s[s.length - 1] !== n) s.push(n); } return s; });
  console.log('loop visits', seen.join(' > '), 'errors', JSON.stringify(errs));
  await b.close();
})();
