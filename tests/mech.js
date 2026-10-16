const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html'); await p.waitForTimeout(300);
  const out = await p.evaluate(() => {
    const G = window.__climber; G.manual(true);
    const mk = (edits) => { const g = []; for (let r = 0; r < 27; r++) { g.push([]); for (let c = 0; c < 48; c++) g[r].push((r === 0 || r >= 25 || c === 0 || c === 47) ? '#' : '.'); }   // wide rooms: 48 x 27, the floor at row 25
      for (const [c0, c1, r0, r1, ch] of edits) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch;
      return { format: 1, id: 't', name: 'Test', difficulty: 1, grid: { cols: 48, rows: 27, tile: 10 }, tiles: g.map(x => x.join('')), entities: [] }; };
    const I = (o) => Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o);
    const go = (o, n) => G.step(I(o), n);
    const res = {};
    // A: sliding to a stop on brick vs ice
    for (const kind of ['#', 'I']) { G.load(mk([[3, 3, 24, 24, 'S'], [8, 25, 25, 25, kind]])); go({}, 40); let s; do { s = go({ x: 1 }, 1); } while (s.x < 120); const x0 = s.x; s = go({}, 90); res['A stop distance on ' + (kind === '#' ? 'brick' : 'ice')] = s.x - x0; }
    // B: grabbing a brick wall vs an ice wall
    for (const kind of ['#', 'I']) { G.load(mk([[3, 3, 24, 24, 'S'], [8, 9, 17, 24, kind]])); go({}, 40); go({ x: 1 }, 40); go({ x: 1, jump: true }, 20); const s = go({ x: 1, y: -1, grab: true }, 30); res['B can climb ' + (kind === '#' ? 'brick' : 'ice')] = s.state === 'climb'; }
    // C: crumbling floor over a pit
    G.load(mk([[3, 3, 24, 24, 'S'], [8, 12, 25, 26, '.'], [8, 12, 25, 25, 'C']])); go({}, 40); let s; do { s = go({ x: 1 }, 1); } while (s.x < 90);
    const a = go({}, 15), c2 = go({}, 30), c3 = go({}, 60);
    res['C on crumble after 0.25s'] = a.ground; res['C falling after 0.75s'] = !c2.ground && c2.y > a.y; res['C died in pit'] = c3.deaths === 1 || go({}, 60).deaths === 1;
    const again = go({}, 80); res['C block back after respawn'] = (() => { let t; do { t = go({ x: 1 }, 1); } while (t.x < 85 && !t.dead); return t.ground && t.y === 240; })();
    // D: riding a platform sideways
    G.load(mk([[5, 7, 22, 22, '='], [8, 15, 22, 22, '-'], [6, 6, 21, 21, 'S']])); const d0 = go({}, 40), d1 = go({}, 100);
    res['D carried sideways px'] = d1.x - d0.x; res['D still standing on it'] = d1.ground && d1.y === 210;
    // E: riding a platform up
    G.load(mk([[5, 7, 23, 23, '='], [5, 5, 15, 22, '|'], [6, 6, 22, 22, 'S']])); const e0 = go({}, 40), e1 = go({}, 100);
    res['E carried up px'] = e0.y - e1.y; res['E still standing'] = e1.ground;
    // F: squashed against a ceiling
    G.load(mk([[5, 7, 23, 23, '='], [5, 5, 20, 22, '|'], [5, 7, 19, 19, '#'], [6, 6, 22, 22, 'S']])); const f1 = go({}, 160);
    res['F squashed under ceiling'] = f1.deaths >= 1;
    // G: a jump off a moving platform keeps its speed
    G.load(mk([[5, 7, 22, 22, '='], [8, 20, 22, 22, '-'], [6, 6, 21, 21, 'S']])); go({}, 60); const g1 = go({ jump: true }, 1); res['G jump inherits platform speed'] = g1.vx;
    return res;
  });
  console.log(JSON.stringify(out, null, 1), 'errors', JSON.stringify(errs));
  await b.close();
})();
