// Prints a run frame by frame in short form, to see how a room was beaten.
// Run: node tests/trialtrace.js <room id> <run json file> [move switched off, as in trials.js]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage(); await p.goto('file:///home/claude/climber-wide/index.html');
  const room = JSON.parse(fs.readFileSync('/home/claude/climber-wide/src/trials/' + process.argv[2] + '.json', 'utf8'));
  const rec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), without = process.argv[4] || '';
  const out = await p.evaluate(([room, rec, without]) => {
    const G = window.__climber; G.manual(true); G.load(room);
    const M = { super: { superH: 162.5, hyperH: 162.5 }, bounce: { bounceV: -131.25, bounceH: 162.5, bounceVarTime: 0.2 } }; without.split(',').forEach(m => { for (const k in (M[m] || {})) G.tune(k, M[m][k]); });
    const dec = c => ({ x: c % 3 - 1, y: ((c / 3) | 0) % 3 - 1, jump: ((c / 9) | 0) % 2 === 1, dash: ((c / 18) | 0) % 2 === 1, grab: ((c / 36) | 0) % 2 === 1 });
    const lines = []; let prev = '';
    rec.forEach((c, i) => { const q = dec(c), s = G.step(q, 1);
      const tag = s.state + (s.ground ? 'G' : '');
      if (tag !== prev || i % 15 === 0) lines.push(i + ' ' + tag + ' tile ' + ((s.x + 4) / 10).toFixed(1) + ',' + ((s.y + 10) / 10).toFixed(1) + ' v ' + s.vx + ',' + s.vy + ' st ' + s.stamina + ' in ' + q.x + ',' + q.y + (q.jump ? 'J' : '') + (q.dash ? 'D' : '') + (q.grab ? 'G' : ''));
      prev = tag; });
    return lines.join('\n');
  }, [room, rec, without]);
  console.log(out); await b.close();
})();
