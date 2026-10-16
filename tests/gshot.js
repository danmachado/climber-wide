const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/builder/index.html');
  await p.click('#auto summary');
  await p.selectOption('#g-diff', '4'); await p.selectOption('#g-obs', '2');
  await p.click('#g-go'); console.log(await p.locator('#status').innerText());
  await p.screenshot({ path: '/home/claude/auto-build.png' });
  await p.click('#g-els button[data-v=spikes]'); await p.click('#g-els button[data-v=movers]'); await p.click('#g-styles button[data-v=dash]');
  await p.click('#g-go'); console.log(await p.locator('#status').innerText(), '| spikes select disabled:', await p.locator('#g-spikes').isDisabled());
  await p.click('#play'); await p.waitForTimeout(1500);
  const fr = p.frames().find(f => f.url().endsWith('/climber-wide/index.html'));
  console.log('play test loads generated room:', !!fr && (await fr.evaluate(() => window.__climber.state().movers.length)) >= 0, 'errors', JSON.stringify(errs));
  await b.close();
})();
