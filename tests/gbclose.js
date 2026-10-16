// Close-ups of the hero and HUD in one theme: dash ready, dash spent (mid-air after a dash), on the Temple wall.
const { chromium } = require('playwright');
const theme = process.env.THEME || 'gb', OUT = '/home/claude/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html#unlock');
  await p.evaluate(t => localStorage.setItem('climber.theme.v1', t), theme);
  await p.reload(); await p.waitForTimeout(800);
  const I = o => Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o);
  const go = async (w, i, seq, name) => {
    const st = await p.evaluate(([w, i, seq]) => { const G = window.__climber; G.startLevel(w, i); G.manual(true); let s;
      for (const [o, n] of seq) s = G.step(Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o), n); return s; }, [w, i, seq]);
    await p.evaluate(() => window.__climber.manual(false)); await p.waitForTimeout(600); await p.evaluate(() => window.__climber.manual(true));
    const k = 2, x = Math.max(0, Math.min(270 - 70, st.x - 30)), y = Math.max(0, Math.min(480 - 70, st.y - 40 - (st.cam || 0)));
    await p.screenshot({ path: OUT + '/' + theme + '-close-' + name + '.png', clip: { x: x * k, y: y * k, width: 140, height: 140 } });
    await p.screenshot({ path: OUT + '/' + theme + '-hud-' + name + '.png', clip: { x: 0, y: 0, width: 540, height: 64 } });
    return st;
  };
  console.log(await go(0, 0, [[{}, 40], [{ x: 1 }, 12]], 'ready'));
  console.log(await go(0, 0, [[{}, 40], [{ jump: true }, 6], [{ x: 1, dash: true }, 2], [{ x: 1 }, 10]], 'spent'));
  console.log(await go(3, 6, [[{}, 40], [{ x: -1 }, 20]], 'temple'));
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
