// Trial rooms: hand-made rooms built around one move each (src/trials/*.json).
// For each room this replays its recorded run (src/trial-runs.json) in the real game and checks it reaches the exit.
// SOLVE=1 (or a missing or broken recording) runs a beam search over inputs through the room's waypoints
// (tests/trial-routes.json) and saves the run it finds. NEED=1 also searches each room with its signature move
// taken away (no dash, no grab) and expects that search to fail, to show the move is really needed.
// ONLY=name limits it to one room. Run: NODE_PATH=/opt/npm-tools/node_modules node tests/trials.js
const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/home/claude/climber-wide';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'log') console.log('  ' + m.text()); });
  await p.goto('file://' + ROOT + '/index.html');
  await p.addScriptTag({ content: SOLVER });
  if (process.env.LOG) await p.evaluate(() => { window.__log = 1; });
  const routes = JSON.parse(fs.readFileSync(ROOT + '/tests/trial-routes.json', 'utf8'));
  const runsPath = ROOT + '/src/trial-runs.json';
  let runs = {}; try { runs = JSON.parse(fs.readFileSync(runsPath, 'utf8')); } catch (e) {}
  const files = fs.readdirSync(ROOT + '/src/trials').filter(f => f.endsWith('.json')).sort();
  let fails = 0;
  for (const f of files) {
    const room = JSON.parse(fs.readFileSync(ROOT + '/src/trials/' + f, 'utf8'));
    if (process.env.ONLY && room.id !== process.env.ONLY && room.name !== process.env.ONLY) continue;
    const route = routes[room.id];
    if (!route) { console.log(room.name + ': no route'); fails++; continue; }
    let res = await p.evaluate(([room, rec]) => replay(room, rec), [room, runs[room.id] || null]);
    if (!res.won || process.env.SOLVE) {
      const t0 = Date.now();
      const s = await p.evaluate(([room, route]) => solve(room, route, { log: !!window.__log }), [room, route]);
      console.log(room.name + ': search ' + (s.won ? 'won in ' + s.rec.length + ' frames' : 'FAILED, best waypoint ' + s.best + ' of ' + route.wp.length + ' at ' + s.at) + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
      if (s.won) { try { runs = Object.assign(JSON.parse(fs.readFileSync(runsPath, 'utf8')), runs); } catch (e) {} runs[room.id] = s.rec; fs.writeFileSync(runsPath, JSON.stringify(runs)); }
      res = await p.evaluate(([room, rec]) => replay(room, rec), [room, runs[room.id] || null]);
    }
    console.log(room.name + ': ' + (res.won ? 'replay reaches the exit in ' + (res.frames / 60).toFixed(1) + 's, dashes ' + res.dashes + ', climb frames ' + res.climb + ', wall jumps ' + res.wj : 'replay FAILED ' + res.why));
    if (!res.won) fails++;
    if (process.env.NEED && route.needs) {
      for (const need of route.needs) {
        // 'dash' means the room must not be beatable without a dash; '+dash' means it must still be beatable without one
        const t0 = Date.now(), want = need[0] === '+', n = need.replace('+', '');
        const s = await p.evaluate(([room, route, n, want]) => solve(room, route, { without: n, beam: want ? 900 : 600 }), [room, route, n, want]);
        console.log('  without ' + n + ': ' + (s.won ? 'beaten' : 'not beatable, stuck at waypoint ' + s.best + ' of ' + route.wp.length) + (s.won === want ? ' (as intended)' : ' (NOT AS INTENDED)') + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
        if (s.won !== want) fails++;
        if (s.won && process.env.KEEP) fs.writeFileSync(process.env.KEEP + '/' + room.id + '-without-' + n + '.json', JSON.stringify(s.rec));
      }
    }
  }
  if (errs.length) { console.log('page errors:', errs.slice(0, 3)); fails++; }
  console.log(fails ? fails + ' FAILED' : 'all trial rooms pass');
  await b.close();
  process.exit(fails ? 1 : 0);
})();

// Runs inside the page.
const SOLVER = `
var G = window.__climber;
function dec(c) { return { x: c % 3 - 1, y: ((c / 3) | 0) % 3 - 1, jump: ((c / 9) | 0) % 2 === 1, dash: ((c / 18) | 0) % 2 === 1, grab: ((c / 36) | 0) % 2 === 1 }; }
function enc(q) { return (q.x + 1) + 3 * (q.y + 1) + (q.jump ? 9 : 0) + (q.dash ? 18 : 0) + (q.grab ? 36 : 0); }
// Standing with part of the hero over a spike tile is only safe because spike boxes are a pixel short of their
// tile; no person plays that, so the search treats it as a fall and a replay that does it fails. The ground flag
// is worked out at the start of a frame, so the position to test is the one before that frame's move.
function edgy(room, s, before) {
  if (!s.ground) return false;
  var r = ((before.y + 9) / 10) | 0, c0 = (before.x / 10) | 0, c1 = ((before.x + 7) / 10) | 0, row = room.tiles[r] || '';
  for (var c = c0; c <= c1; c++) if ('^F'.indexOf(row.charAt(c)) >= 0) return true;
  return false;
}
function replay(room, rec) {
  G.manual(true); G.load(room);
  if (!rec) return { won: false, why: 'no recording' };
  var s, dashes = 0, climb = 0, wj = 0, prev = G.state();
  for (var i = 0; i < rec.length; i++) {
    s = G.step(dec(rec[i]), 1);
    if (edgy(room, s, prev)) return { won: false, why: 'stands on a pixel edge beside spikes at frame ' + i + ' (' + prev.x + ',' + prev.y + ')' };
    if (s.state === 'dash' && prev.state !== 'dash') dashes++;
    if (s.state === 'climb') climb++;
    if (prev.state !== 'climb' && !prev.ground && s.vy < -100 && prev.vy > -100 && s.state === 'normal' && Math.abs(s.vx) >= 150) wj++;
    if (s.won) return { won: true, frames: i + 1, dashes: dashes, climb: climb, wj: wj };
    if (s.dead) return { won: false, why: 'died at frame ' + i + ' (' + s.x + ',' + s.y + ')' };
    prev = s;
  }
  return { won: false, why: 'ran out at ' + s.x + ',' + s.y };
}
// Beam search. route.wp is a list of [x0,y0,x1,y1] boxes in pixels the hero's feet must pass through in order
// (an optional 5th entry 'g' means standing there). Each node holds a full game snapshot.
function solve(room, route, o) {
  G.manual(true); G.load(room);
  var CH = 3, B = o.beam || route.beam || 900, MAXD = route.depth || 500;
  var acts = [];
  [-1, 0, 1].forEach(function (x) { acts.push({ x: x, y: 0 }); acts.push({ x: x, y: 0, jump: 1 }); acts.push({ x: x, y: 1, jump: 1 }); });
  [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]].forEach(function (d) { acts.push({ x: d[0], y: d[1], dash: 1 }); acts.push({ x: d[0], y: d[1], dash: 1, jump: 1 }); });
  [-1, 1].forEach(function (x) { [-1, 0, 1].forEach(function (y) { acts.push({ x: x, y: y, grab: 1 }); }); acts.push({ x: x, y: -1, grab: 1, jump: 1 }); acts.push({ x: -x, y: 0, grab: 1, jump: 1 }); acts.push({ x: 0, y: 0, grab: 1, jump: 1 }); });
  var off = (o.without || '').split(',');
  if (off.indexOf('dash') >= 0) acts = acts.filter(function (a) { return !a.dash; });
  if (off.indexOf('grab') >= 0) acts = acts.filter(function (a) { return !a.grab; });
  // switching off a move that is not one button: a super or hyper becomes a plain jump, a wall bounce a wall jump
  var MOVES = { super: { superH: 162.5, hyperH: 162.5 }, bounce: { bounceV: -131.25, bounceH: 162.5, bounceVarTime: 0.2 } }, TUNE = {}, old = {};
  off.forEach(function (m) { Object.assign(TUNE, MOVES[m] || {}); });
  for (var tk in TUNE) old[tk] = G.tune(tk, TUNE[tk]);
  try { return search(); } finally { for (tk in old) G.tune(tk, old[tk]); }
  function search() {
  acts = acts.map(function (a) { return enc({ x: a.x, y: a.y, jump: !!a.jump, dash: !!a.dash, grab: !!a.grab }); });
  for (var i = 0; i < 20; i++) G.step(dec(0 + 4), 1);
  var wp = route.wp;
  function inBox(s, w) { var fx = s.x + 4, fy = s.y + 10; return fx >= w[0] && fx <= w[2] && fy >= w[1] && fy <= w[3] && (w[4] !== 'g' || s.ground); }
  function dist(s, w) { var fx = s.x + 4, fy = s.y + 10, dx = fx < w[0] ? w[0] - fx : fx > w[2] ? fx - w[2] : 0, dy = fy < w[1] ? w[1] - fy : fy > w[3] ? fy - w[3] : 0; return Math.sqrt(dx * dx + dy * dy); }
  var root ={ snap: G.snap(), st: G.state(), rec: [], wp: 0, h: 0 }, beam = [root], best = 0, at = '';
  var start = []; for (i = 0; i < 20; i++) start.push(4);
  for (var depth = 0; depth < MAXD; depth++) {
    var next = [], seen = {};
    for (var bi = 0; bi < beam.length; bi++) {
      var nd = beam[bi];
      for (var ai = 0; ai < acts.length; ai++) {
        G.restore(nd.snap);
        var a = acts[ai], s, dead = false, k = nd.wp, rec = [], before = nd.st;
        for (var f = 0; f < CH; f++) {
          s = G.step(dec(a), 1); rec.push(a);
          if (s.dead || edgy(room, s, before)) { dead = true; break; }
          before = s;
          if (s.won) { return { won: true, rec: start.concat(nd.rec, rec) }; }
          while (k < wp.length && inBox(s, wp[k])) k++;
        }
        if (dead) continue;
        var key = k + ':' + s.x + ',' + s.y + ':' + Math.round(s.vx / 15) + ',' + Math.round(s.vy / 15) + ':' + s.state + s.dashes + (s.ground ? 'g' : '') + ((s.stamina / 12) | 0);
        if (seen[key]) continue; seen[key] = 1;
        var h = -k * 100000 + (k < wp.length ? dist(s, wp[k]) * 10 : 0) - s.stamina * 0.05;
        next.push({ snap: G.snap(), st: s, rec: nd.rec.concat(rec), wp: k, h: h + Math.random() * 3 });
      }
    }
    if (!next.length) break;
    next.sort(function (a, b) { return a.h - b.h; });
    beam = next.slice(0, B);
    if (beam[0].wp > best) { best = beam[0].wp; }
    var b0 = beam[0]; G.restore(b0.snap); var s0 = G.state(); at = s0.x + ',' + s0.y;
    if (o.log && depth % 10 === 0) console.log(depth + ' wp' + b0.wp + ' ' + at + ' ' + beam.length);
  }
  return { won: false, best: best, at: at };
  }
}
`;
module.exports = { SOLVER };
