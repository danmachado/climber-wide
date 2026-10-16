const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/builder/index.html');
  const box = await p.locator('#grid').boundingBox();
  const cell = box.width / 27;
  const at = (c, r) => [box.x + (c + 0.5) * cell, box.y + (r + 0.5) * cell];
  // paint a short wall, then a shift-drag box of spikes, then undo the spikes
  await p.mouse.move(...at(3, 40)); await p.mouse.down(); await p.mouse.move(...at(6, 40)); await p.mouse.up();
  await p.keyboard.press('3');
  await p.keyboard.down('Shift'); await p.mouse.move(...at(3, 42)); await p.mouse.down(); await p.mouse.move(...at(5, 43)); await p.mouse.up(); await p.keyboard.up('Shift');
  const row = async (r) => p.evaluate((r) => JSON.parse(localStorage.getItem('climber.builder.draft.v1')).tiles[r], r);
  console.log('row40', await row(40), '| row42', await row(42));
  await p.keyboard.press('Control+z');
  console.log('after undo row42', await row(42));
  await p.keyboard.press('Control+z');
  console.log('checks:', (await p.locator('#checks').innerText()).replace(/\n/g, ' '));
  await p.screenshot({ path: 'builder.png' });
  // play test: the real game gets the room, the demo script beats it, the builder hears about it
  await p.click('#play');
  await p.waitForTimeout(1200);
  const fr = p.frames().find(f => f.url().endsWith('/climber/index.html'));
  console.log('game frame loaded:', !!fr, fr ? await fr.evaluate(() => ({ s: window.__climber.state().x })) : '');
  console.log('demo in frame:', JSON.stringify(await fr.evaluate(() => { window.__climber.manual(true); const r = window.__climber.demoRun(3000); window.__climber.manual(false); return r; })));
  await p.waitForTimeout(300);
  console.log('status:', await p.locator('#status').innerText());
  console.log('checks:', (await p.locator('#checks').innerText()).replace(/\n/g, ' '));
  await p.screenshot({ path: 'builder-play.png' });
  await p.click('#play');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export')]);
  console.log('export:', dl.suggestedFilename(), '| status:', await p.locator('#status').innerText(), '| errors', JSON.stringify(errs));
  await b.close();
})();
