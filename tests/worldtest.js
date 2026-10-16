// The builder shows and auto-builds only the pieces of the room's world.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/builder/index.html'); await p.waitForTimeout(400);
  const pal = () => p.evaluate(() => [...document.querySelectorAll('#palette button')].map(b => b.dataset.ch).join(''));
  const chips = () => p.evaluate(() => [...document.querySelectorAll('#g-els button')].filter(b => !b.hidden).map(b => b.dataset.v).join(' '));
  const count = (ch) => p.evaluate((ch) => JSON.parse(localStorage.getItem('climberwide.builder.draft.v1')).tiles.join('').split(ch).length - 1, ch);
  console.log('world 1 palette:', await pal(), '| auto pieces:', await chips());
  let ice = 0; for (let i = 0; i < 6; i++) { await p.evaluate(() => document.getElementById('g-go').click()); ice += await count('I'); }
  console.log('six world 1 auto rooms, ice tiles:', ice);
  await p.selectOption('#world', '2'); await p.waitForTimeout(100);
  console.log('world 2 palette:', await pal(), '| auto pieces:', await chips(), '| heading:', await p.evaluate(() => document.querySelector('#palette h2').textContent));
  ice = 0; for (let i = 0; i < 6; i++) { await p.evaluate(() => document.getElementById('g-go').click()); ice += await count('I'); }
  console.log('six world 2 auto rooms, ice tiles:', ice, '| world saved:', await p.evaluate(() => JSON.parse(localStorage.getItem('climberwide.builder.draft.v1')).world));
  await p.screenshot({ path: __dirname + '/world-2.png' });
  await p.selectOption('#world', '1'); await p.waitForTimeout(100);
  console.log('back to world 1 with an ice room, note:', await p.evaluate(() => [...document.querySelectorAll('#checks li')].map(l => l.textContent).filter(t => t.startsWith('NOTE')).join('')));
  await p.check('#allp'); console.log('show all:', await pal(), 'errors', JSON.stringify(errs));
  await b.close();
})();
