// Pictures of the main menu over each world's scene and with each button chosen (for review, not a check).
// THEME=gb|bw for the fast themes. Writes /home/claude/shots/menu-*.png.
// Run: NODE_PATH=/opt/npm-tools/node_modules node tests/menushots.js
const { chromium } = require('playwright');
const theme = process.env.THEME || '', OUT = '/home/claude/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html#unlock');
  await p.evaluate(t => localStorage.setItem('climberwide.theme.v1', t), theme);
  await p.reload(); await p.waitForTimeout(800);
  const tag = theme ? theme + '-' : '';
  for (let w = 0; w < 5; w++) {
    const ms = await p.evaluate(w => { const v = window.__climber.view(); v.sel.w = w; v.sel.menu = w % 5; const a = performance.now(); return a; }, w);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/menu-${tag}w${w + 1}.png` });
  }
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
