// Pictures of the trial rooms with the recorded run drawn over them (for review, not a check).
// Writes /home/claude/trial-shots/<id>.png. Run: NODE_PATH=/opt/npm-tools/node_modules node tests/trialshots.js
const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/home/claude/climber-wide', OUT = '/home/claude/trial-shots';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto('file://' + ROOT + '/index.html');
  const runs = JSON.parse(fs.readFileSync(ROOT + '/src/trial-runs.json', 'utf8'));
  for (const f of fs.readdirSync(ROOT + '/src/trials').filter(f => f.endsWith('.json')).sort()) {
    const room = JSON.parse(fs.readFileSync(ROOT + '/src/trials/' + f, 'utf8'));
    const path = await p.evaluate(([room, rec]) => {
      const G = window.__climber; G.manual(true); G.load(room);
      const dec = c => ({ x: c % 3 - 1, y: ((c / 3) | 0) % 3 - 1, jump: ((c / 9) | 0) % 2 === 1, dash: ((c / 18) | 0) % 2 === 1, grab: ((c / 36) | 0) % 2 === 1 });
      const pts = [];
      for (const c of rec || []) { const s = G.step(dec(c), 1); pts.push([s.x + 4, s.y + 5, s.state === 'dash' ? 1 : s.state === 'climb' ? 2 : 0]); if (s.won) break; }
      G.load(room); for (let i = 0; i < 30; i++) G.step(dec(4), 1);
      return pts;
    }, [room, runs[room.id]]);
    await p.waitForTimeout(400);
    // draw the run on top: white for running and jumping, red for dashing, green for climbing
    await p.evaluate((pts) => {
      const r = document.getElementById('world').getBoundingClientRect(), k = r.width / 270;
      let o = document.getElementById('trail'); if (o) o.remove();
      o = document.createElement('canvas'); o.id = 'trail'; o.width = r.width; o.height = r.width / 270 * 480;
      Object.assign(o.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: (r.width / 270 * 480) + 'px', zIndex: 99, pointerEvents: 'none' });
      document.body.appendChild(o);
      const g = o.getContext('2d');
      for (let i = 1; i < pts.length; i++) {
        g.strokeStyle = ['rgba(255,255,255,0.85)', 'rgba(255,70,90,0.95)', 'rgba(90,255,140,0.95)'][pts[i][2]];
        g.lineWidth = 2.5; g.beginPath(); g.moveTo(pts[i - 1][0] * k, pts[i - 1][1] * k); g.lineTo(pts[i][0] * k, pts[i][1] * k); g.stroke();
      }
    }, path);
    await p.screenshot({ path: OUT + '/' + room.id + '.png' });
    console.log(room.name, path.length, 'frames');
  }
  await b.close();
})();
