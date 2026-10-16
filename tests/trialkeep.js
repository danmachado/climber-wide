// Writes src/trial-keep.json: for each trial room, every tile the hero's box touches on its recorded run.
// src/trials-make.js keeps its texture pass (ragged walls, fillets, hanging rock) at least two tiles clear of
// these, so the recorded run plays exactly the same after texturing. Run after a trial's run changes:
// NODE_PATH=/opt/npm-tools/node_modules node tests/trialkeep.js, then node src/trials-make.js.
const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/home/claude/climber-wide';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage();
  await p.goto('file://' + ROOT + '/index.html');
  const runs = JSON.parse(fs.readFileSync(ROOT + '/src/trial-runs.json', 'utf8')), out = {};
  for (const f of fs.readdirSync(ROOT + '/src/trials').filter(f => f.endsWith('.json')).sort()) {
    const room = JSON.parse(fs.readFileSync(ROOT + '/src/trials/' + f, 'utf8'));
    if (!runs[room.id]) continue;
    out[room.id] = await p.evaluate(([room, rec]) => {
      const G = window.__climber; G.manual(true); G.load(room);
      const dec = c => ({ x: c % 3 - 1, y: ((c / 3) | 0) % 3 - 1, jump: ((c / 9) | 0) % 2 === 1, dash: ((c / 18) | 0) % 2 === 1, grab: ((c / 36) | 0) % 2 === 1 });
      const hit = {};
      for (const c of rec) {
        const s = G.step(dec(c), 1);
        for (let r = (s.y / 10) | 0; r <= ((s.y + 9) / 10 | 0); r++) for (let k = (s.x / 10) | 0; k <= ((s.x + 7) / 10 | 0); k++) hit[r * 100 + k] = 1;
        if (s.won) break;
      }
      return Object.keys(hit).map(Number).sort((a, b) => a - b);
    }, [room, runs[room.id]]);
  }
  fs.writeFileSync(ROOT + '/src/trial-keep.json', JSON.stringify(out));
  console.log(Object.keys(out).map(k => k + ' ' + out[k].length + ' tiles').join('\n'));
  await b.close();
})();
