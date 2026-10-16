const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html');
  // play the first room with the demo script's inputs but as a normal run, so the exit chains to room 2
  const r = await p.evaluate(() => {
    const G = window.__climber; G.manual(true); G.reset();
    return G.chainProbe();
  });
  console.log(JSON.stringify(r), 'errors', JSON.stringify(errs));
  await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(600);
  await p.screenshot({ path: 'chain.png' });
  await b.close();
})();
