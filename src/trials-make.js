// Trial rooms: hand-made rooms that each lean on one move. Three are LESSONS (`grants`: Handhold teaches the wall climb,
// Dash Only the dash, Kickback the super jump; a lesson lends its move while you are inside and must be cleared to go
// on, see build.js) and three are optional skill rooms (Pinpoint, Freefall, Cascade). Redrawn Oct 2026 for the wide
// screen, 48 x 27 tiles (they were 27 x 48 for the frame). Writes src/trials/<id>.json (level format 1) and
// tests/trial-routes.json (the waypoints the solver in tests/trials.js steers through).
// Each room's `moves` are the moves the player has when it opens: its recorded run is made with only those, and for a
// lesson tests/trials.js also proves it cannot be beaten without the move it teaches (even with all the others).
// Run: node src/trials-make.js [id] to also print maps.
var fs = require('fs'), d = __dirname;
var COLS = 48, ROWS = 27, T = 10;
var LEGEND = { '.': 'empty', '#': 'solid', '^': 'spike_up', 'v': 'spike_down', '<': 'spike_left', '>': 'spike_right',
  'S': 'start', 'E': 'exit', 'o': 'dash_refill', 'C': 'crumble', 'G': 'gem', 'b': 'backdrop', 'I': 'ice' };
// Tiles each room's recorded run touches (tests/trialkeep.js writes this). The texture pass keeps clear of them.
var KEEP = {}; try { KEEP = JSON.parse(fs.readFileSync(d + '/trial-keep.json', 'utf8')); } catch (e) {}

// ---- texture: the layouts are drawn as clean boxes; this pass makes them read as rock ----
// Everything it does stays a set distance from every tile the recorded run touches, so the run plays the same.
//  rag:     the frame and big masses grow lumpy outcrops into dead air (low-frequency noise, so lumps not specks)
//  fillet:  inner corners where a wall meets a floor or a ceiling fill in, one or two steps, so joins look worn round
//  pocket:  deep inside thick rock, hollows open onto the backdrop (sealed in, nothing can reach them)
//  back:    ragged panels of dim back wall in the open air, clinging to the rock, for depth (scenery only)
// opts: { rag: depth in tiles (0 = off), clear: tiles kept from the run, back: amount 0..1, pockets: bool }
function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hashStr(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function noise2(seed, scale) {              // smooth value noise on a coarse lattice, 0..1
  var R = rng(seed), lat = {};
  function v(i, j) { var k = i + ',' + j; if (lat[k] === undefined) lat[k] = R(); return lat[k]; }
  function sm(t) { return t * t * (3 - 2 * t); }
  return function (c, r) {
    var x = c / scale, y = r / scale, i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
    var a = v(i, j) + (v(i + 1, j) - v(i, j)) * fx, b = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}
function texture(g, id, o) {
  o = o || {};
  var rows = g.length, cols = g[0].length, seed = hashStr(id), c, r, k;
  var keepList = KEEP[id] || null, clear = o.clear === undefined ? 2 : o.clear;
  var near = [];                              // Chebyshev distance (tiles) to the nearest tile the run touches
  for (r = 0; r < rows; r++) { near.push([]); for (c = 0; c < cols; c++) near[r].push(keepList ? 99 : 0); }
  if (keepList) keepList.forEach(function (n) {
    var kr = Math.floor(n / 100), kc = n % 100;
    for (var rr = Math.max(0, kr - 4); rr <= Math.min(rows - 1, kr + 4); rr++) for (var cc = Math.max(0, kc - 4); cc <= Math.min(cols - 1, kc + 4); cc++)
      near[rr][cc] = Math.min(near[rr][cc], Math.max(Math.abs(rr - kr), Math.abs(cc - kc)));
  });
  function at(c, r) { return r < 0 || r >= rows || c < 0 || c >= cols ? '#' : g[r][c]; }
  function solid(c, r) { var t = at(c, r); return t === '#'; }
  function special(c, r) { var t = at(c, r); return t !== '.' && t !== '#' && t !== 'b'; }
  function nearSpecial(c, r) { for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) if (special(c + dc, r + dr)) return true; return false; }
  function open(c, r, m) { return at(c, r) === '.' && near[r][c] >= m && !nearSpecial(c, r); }
  var added = 0;
  // air over a spike or flame floor is a pit: rock there would be a new place to stand
  function overPit(c, r) { for (var rr = r + 1; rr < rows; rr++) { var t = g[rr][c]; if (t === '^' || t === 'F') return true; if (t !== '.' && t !== 'b') return false; } return false; }
  // rag: outcrops grow from rock that is at least two tiles thick, into dead air
  if (o.rag && keepList) {
    var N = noise2(seed, 3.2), N2 = noise2(seed + 7, 1.6);
    for (k = 1; k <= o.rag; k++) {
      var grow = [];
      for (r = 1; r < rows - 1; r++) for (c = 1; c < cols - 1; c++) {
        if (!open(c, r, clear)) continue;
        var from = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].filter(function (q) { return solid(q[0], q[1]); });
        if (!from.length) continue;
        var thick = from.some(function (q) { var dc = q[0] - c, dr = q[1] - r; return solid(q[0] + dc, q[1] + dr) && solid(q[0] + dc * 2, q[1] + dr * 2); });
        var under = solid(c, r - 1);               // hanging under a shelf or plate: lumps of rock, like it has weathered
        if (!thick && !under && k === 1) continue;
        // anything else makes a new ledge top: well away from the route it can stay bare; nearer, or over a pit,
        // it gets a crown of spikes so it is never a new place to stand
        var crown = !under && (near[r][c] < 4 || overPit(c, r));
        if (crown && (o.crown === false || k > 1 || near[r][c] < 3 || at(c, r - 1) !== '.' || near[r - 1][c] < clear || nearSpecial(c, r - 1))) continue;
        if (0.65 * N(c, r) + 0.35 * N2(c, r) > 0.42 + k * 0.08) grow.push([c, r]);
      }
      grow.forEach(function (q) { g[q[1]][q[0]] = '#'; added++; });
      grow.forEach(function (q) { var c = q[0], r = q[1]; if (at(c, r - 1) === '.' && (near[r][c] < 4 || overPit(c, r))) g[r - 1][c] = '^'; });
    }
    // no lone specks: a grown tile with one solid neighbour or none goes back to air
    for (r = 1; r < rows - 1; r++) for (c = 1; c < cols - 1; c++) if (g[r][c] === '#' && near[r][c] >= clear) {
      var n4 = (solid(c - 1, r) ? 1 : 0) + (solid(c + 1, r) ? 1 : 0) + (solid(c, r - 1) ? 1 : 0) + (solid(c, r + 1) ? 1 : 0);
      if (n4 <= 1 && !special(c, r)) { var orig = o.base && o.base[r][c]; if (orig === '.') { g[r][c] = '.'; added--; } }
    }
  }
  // rounding: the outer corners of thick rock wear away, one or two steps
  if (o.round !== false && keepList) {
    for (k = 0; k < 2; k++) {
      var cut = [];
      for (r = 1; r < rows - 1; r++) for (c = 1; c < cols - 1; c++) {
        if (g[r][c] !== '#' || near[r][c] < clear || nearSpecial(c, r)) continue;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
          var dx = q[0], dy = q[1];
          if (at(c + dx, r) !== '.' || at(c, r + dy) !== '.') return;                 // open on both sides of this corner
          if (!solid(c - dx, r) || !solid(c, r - dy) || !solid(c - dx, r - dy) || !solid(c - 2 * dx, r) || !solid(c, r - 2 * dy)) return;   // and thick behind it
          if (rng(seed + c * 131 + r * 17 + k)() < (k ? 0.5 : 0.8)) cut.push([c, r]);
        });
      }
      cut.forEach(function (q) { g[q[1]][q[0]] = '.'; });
    }
  }
  // fillets: an inner corner (rock below or above, and rock beside) fills in, then once more a step out
  if (o.fillet !== false && keepList) {
    for (k = 0; k < 2; k++) {
      var fill = [];
      for (r = 1; r < rows - 1; r++) for (c = 1; c < cols - 1; c++) {
        if (!open(c, r, Math.max(2, clear - 1)) || overPit(c, r)) continue;
        var vert = solid(c, r + 1) || solid(c, r - 1), side = solid(c - 1, r) || solid(c + 1, r);
        if (vert && side && rng(seed + r * 31 + c * 7 + k)() < (k ? 0.45 : 0.85)) fill.push([c, r]);
      }
      fill.forEach(function (q) { g[q[1]][q[0]] = '#'; added++; });
    }
  }
  // pockets: hollows deep inside thick rock
  if (o.pockets !== false) {
    var P = noise2(seed + 3, 2.5), hollow = [];
    for (r = 2; r < rows - 2; r++) for (c = 2; c < cols - 2; c++) {
      var deep = true;
      for (var dr = -2; dr <= 2 && deep; dr++) for (var dc = -2; dc <= 2; dc++) if (!solid(c + dc, r + dr)) { deep = false; break; }
      if (deep && P(c, r) > 0.64) hollow.push([c, r]);
    }
    hollow.forEach(function (q) { g[q[1]][q[0]] = 'b'; });
  }
  // backdrop: ragged panels of back wall clinging to the rock
  var amt = o.back === undefined ? 0.5 : o.back;
  if (amt > 0) {
    var B = noise2(seed + 11, 4.5), B2 = noise2(seed + 13, 1.8);
    var dist = [];                            // distance in tiles to the nearest rock, capped
    for (r = 0; r < rows; r++) { dist.push([]); for (c = 0; c < cols; c++) dist[r].push(solid(c, r) ? 0 : 9); }
    for (var pass = 0; pass < 8; pass++) for (r = 1; r < rows - 1; r++) for (c = 1; c < cols - 1; c++)
      dist[r][c] = Math.min(dist[r][c], dist[r - 1][c] + 1, dist[r + 1][c] + 1, dist[r][c - 1] + 1, dist[r][c + 1] + 1);
    for (r = 1; r < rows - 1; r++) for (c = 1; c < cols - 1; c++) {
      if (g[r][c] !== '.') continue;
      var v = 0.7 * B(c, r) + 0.3 * B2(c, r) + amt * 0.5 - dist[r][c] * 0.07;
      if (v > 0.62) g[r][c] = 'b';
    }
  }
  return added;
}

function Room(id, name, world, difficulty, opt) {
  opt = opt || {};
  var g = [], r;
  for (r = 0; r < ROWS; r++) g.push(new Array(COLS + 1).join('.').split(''));
  var api = {
    g: g, wp: [], needs: [],
    fill: function (c0, c1, r0, r1, ch) { for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) g[r][c] = ch; return api; },
    put: function (c, r, ch) { g[r][c] = ch; return api; },
    shell: function () { api.fill(0, COLS - 1, 0, 0, '#').fill(0, 0, 0, ROWS - 1, '#').fill(COLS - 1, COLS - 1, 0, ROWS - 1, '#').fill(0, COLS - 1, ROWS - 2, ROWS - 1, '#'); return api; },
    // a waypoint in tiles: the hero's feet must pass through columns c0..c1, rows r0..r1 (stand = on the ground there)
    via: function (c0, r0, c1, r1, stand) { var w = [c0 * T, r0 * T, (c1 + 1) * T, (r1 + 1) * T]; if (stand) w.push('g'); api.wp.push(w); return api; },
    tex: { rag: 2 },
    done: function () {
      if (api.tex) { api.tex.base = g.map(function (row) { return row.slice(); }); texture(g, id, api.tex); }
      var room = { format: 1, id: id, name: name, difficulty: difficulty, world: world, trial: true,
        grid: { cols: COLS, rows: ROWS, tile: T }, legend: LEGEND, tiles: g.map(function (row) { return row.join(''); }), entities: [] };
      if (opt.grants) { room.grants = opt.grants; room.lesson = opt.lesson || 4; }   // a lesson: teaches this move, sits at this slot of its world
      room.moves = opt.moves || { grab: true, dash: true, 'super': true };
      return { room: room,
        route: { wp: api.wp, needs: api.needs, moves: room.moves } };
    }
  };
  return api;
}

var rooms = [];
var ALL = { grab: true, dash: true, 'super': true };

// LESSON 1 (Brickyard, teaches the wall climb): two walls from the floor to far above a jump. The first is ten rows, a
// climb and a mantle. The second is twenty, more than a full meter of climbing, so halfway up a floating ledge stands a
// tile off the face: climb to it, step off onto it (standing refills the meter), jump back to the face and finish. Nothing
// but a climb gets over either wall (a jump, a dash and a wall bounce all fall far short).
(function () {
  var R = Room('trial-handhold', 'Handhold', 1, 2, { grants: 'grab', moves: { grab: true, dash: false, 'super': false } }).shell();
  R.tex = { rag: 2, back: 0.35 };
  R.put(2, 24, 'S');
  R.fill(12, 13, 15, 24, '#');                            // wall one, ten rows
  R.fill(26, 27, 5, 24, '#');                             // wall two, twenty rows, the exit on top
  R.fill(23, 24, 17, 17, '#');                            // the rest ledge, beside the climbing column (col 25) so the climb passes it
  R.fill(26, 27, 3, 4, 'E');
  R.via(12, 14, 13, 14, true).via(23, 16, 24, 16, true).via(26, 4, 27, 4, true);
  R.needs = ['grab,bounce'];   // a wall bounce off a face can stand in for part of a climb, so the check takes both away
  rooms.push(R.done());
})();

// LESSON 2 (Icehouse, teaches the dash): stepping stones over spikes, every gap one step past a jump (six tiles one row up,
// seven on the level), so each hop is a jump and a dash. The stones are three wide to land on.
(function () {
  var R = Room('trial-dashonly', 'Dash Only', 2, 2, { grants: 'dash', moves: { grab: true, dash: true, 'super': false } }).shell();
  R.tex = { rag: 2, back: 0.35 };
  R.fill(5, 46, 24, 24, '^');                             // the whole floor is spikes
  R.fill(1, 4, 19, 24, '#').put(2, 18, 'S');              // the start ledge
  R.fill(12, 14, 19, 24, '#');                            // gap 7, level
  R.fill(21, 23, 18, 24, '#');                            // gap 6, one up
  R.fill(31, 33, 18, 24, '#');                            // gap 7, level
  R.fill(40, 46, 17, 24, '#');                            // gap 6, one up: the exit ledge
  R.fill(45, 46, 15, 16, 'E');
  R.via(12, 18, 14, 18, true).via(21, 17, 23, 17, true).via(31, 17, 33, 17, true).via(40, 16, 44, 16, true);
  R.needs = ['dash'];
  rooms.push(R.done());
})();

// LESSON 3 (Furnace, teaches the super jump): two pits no walk, jump or dash crosses. The first is thirteen tiles under a
// spiked ceiling, only a hyper clears it (dash along the ground, jump while holding down: long and low); the second is twelve
// tiles in the open, a super (dash along the ground, jump: long and high) carries over it.
(function () {
  var R = Room('trial-kickback', 'Kickback', 3, 3, { grants: 'super', moves: ALL }).shell();
  R.tex = { rag: 2, back: 0.35 };
  R.fill(1, 6, 19, 24, '#').put(2, 18, 'S');              // the start ledge
  R.fill(7, 19, 24, 24, '^');                             // pit one, thirteen wide
  R.fill(7, 19, 14, 14, '#').fill(7, 19, 15, 15, 'v').fill(7, 19, 13, 13, '^');   // its low ceiling, spiked both sides
  R.fill(20, 31, 19, 24, '#');                            // the middle ledge, long enough to stop on after a hyper
  R.fill(32, 43, 24, 24, '^');                            // pit two, twelve wide
  R.fill(44, 46, 19, 24, '#').fill(45, 46, 17, 18, 'E');  // the far ledge
  R.via(20, 18, 31, 18, true).via(44, 18, 44, 18, true);
  R.needs = ['super'];
  rooms.push(R.done());
})();

// Pinpoint (Brickyard, optional): one-tile posts over spikes, under a spiked ceiling just high enough for a short hop.
// A full jump is death, so every hop is a tap.
(function () {
  var R = Room('trial-pinpoint', 'Pinpoint', 1, 3, { moves: { grab: true, dash: false, 'super': false } }).shell();
  R.tex = { rag: 2, back: 0.3 };
  R.fill(1, 46, 24, 24, '^');
  R.fill(1, 2, 20, 24, '#').put(1, 19, 'S');              // the start
  var posts = [6, 10, 14, 18, 22, 26, 30, 34, 38];
  posts.forEach(function (c) { R.fill(c, c, 20, 24, '#'); });
  R.fill(3, 42, 16, 16, '#').fill(3, 42, 17, 17, 'v');    // the ceiling, two clear rows over the posts
  R.fill(42, 46, 20, 24, '#').fill(44, 45, 18, 19, 'E');  // the exit ledge
  var w = posts.map(function (c) { return [c, 19]; });
  w.forEach(function (q) { R.via(q[0], 19, q[0], 19, true); });
  R.via(43, 19, 46, 19, true);
  R.needs = [];
  rooms.push(R.done());
})();

// Freefall (Temple, optional): drop down a spiked shaft steering through the gaps of three spiked plates (no wall to
// grab, both walls are spiked), run under the spine over a spike patch, then wall-jump up a chimney whose walls are spiked
// in turn, and dash over the spikes on top to the exit.
(function () {
  var R = Room('trial-freefall', 'Freefall', 4, 4, { moves: ALL }).shell();
  R.tex = { rag: 2, back: 0.3 };
  R.fill(1, 5, 4, 5, '#').put(2, 3, 'S');                 // the start ledge
  R.fill(1, 3, 6, 24, '#');                               // the shaft's left wall
  R.fill(13, 14, 1, 20, '#');                             // the spine between the shaft and the chimney
  R.fill(4, 4, 7, 20, '>').fill(12, 12, 7, 20, '<');      // spikes down both walls of the shaft
  [[9, 'L'], [15, 'R'], [21, 'L']].forEach(function (p) {
    var r = p[0];
    if (p[1] === 'L') R.fill(5, 8, r, r, '#').fill(5, 8, r - 1, r - 1, '^');   // gap on the right (cols 9-11)
    else R.fill(8, 11, r, r, '#').fill(8, 11, r - 1, r - 1, '^');               // gap on the left (cols 5-7)
  });
  R.fill(5, 8, 24, 24, '^');                              // the floor under the first plates
  R.fill(12, 14, 24, 24, '^');                            // spikes between the shaft and the chimney
  R.fill(19, 33, 7, 24, '#');                             // the block the chimney climbs beside
  R.fill(15, 15, 10, 15, '>');                            // spiked stretch on the spine side of the chimney
  R.fill(18, 18, 17, 22, '<');                            // and on the block side, lower down
  R.fill(19, 24, 6, 6, '^');                              // spikes on the block top
  R.fill(25, 26, 5, 6, 'E');
  R.via(9, 10, 11, 12).via(5, 16, 7, 18).via(9, 22, 11, 24, true)
   .via(15, 23, 18, 24, true).via(15, 14, 18, 18).via(15, 8, 18, 12).via(25, 4, 26, 6);
  R.needs = [];
  rooms.push(R.done());
})();

// Cascade (Neon Row, optional): the exit is at the bottom. Three shelves, spiked wall to wall except one hole each; under
// every hole sits a one-tile post a little to the side, so you steer onto it as you fall, then jump and dash across the
// spikes to the next hole.
(function () {
  var R = Room('trial-cascade', 'Cascade', 5, 4, { moves: ALL }).shell();
  R.tex = { rag: 2, back: 0.3 };
  [[9, [16, 17, 18], 14, null], [15, [22, 23, 24], 20, 14], [21, [28, 29, 30], null, 20]].forEach(function (s) { /* placed below */ });
  R.fill(1, 46, 9, 9, '#').fill(1, 46, 8, 8, '^');        // shelf one
  R.fill(1, 46, 15, 15, '#').fill(1, 46, 14, 14, '^');    // shelf two
  R.fill(1, 46, 21, 21, '#').fill(1, 46, 20, 20, '^');    // shelf three
  R.fill(1, 7, 5, 8, '#').put(2, 4, 'S');                 // the start ledge, over shelf one
  [[9, 16, 18], [15, 22, 24], [21, 28, 30]].forEach(function (h) { R.fill(h[1], h[2], h[0] - 1, h[0], '.'); });   // the holes
  R.put(14, 14, '#');                                     // post under hole one, two tiles to its left
  R.put(20, 20, '#');                                     // post under hole two
  R.fill(1, 46, 24, 24, '^').fill(28, 30, 23, 24, 'E');   // the floor is spikes, except under the last hole, where the exit is
  R.fill(28, 30, 24, 24, 'E');
  R.via(16, 10, 18, 12).via(14, 13, 14, 13, true).via(22, 16, 24, 18).via(20, 19, 20, 19, true).via(28, 22, 30, 24);
  R.needs = ['dash'];
  rooms.push(R.done());
})();

if (require.main === module) {
  fs.mkdirSync(d + '/trials', { recursive: true });
  var routes = {};
  rooms.forEach(function (o) {
    fs.writeFileSync(d + '/trials/' + o.room.id + '.json', JSON.stringify(o.room, null, 1));
    routes[o.room.id] = o.route;
    if (!process.argv[2] || process.argv[2] === o.room.id) {
      console.log(o.room.name + ' (world ' + o.room.world + ')');
      console.log('    ' + '0123456789'.repeat(3).slice(0, COLS));
      o.room.tiles.forEach(function (t, i) { console.log((i < 10 ? ' ' : '') + i + '  ' + t); });
    }
  });
  fs.writeFileSync(d + '/../tests/trial-routes.json', JSON.stringify(routes, null, 1));
}
module.exports = rooms;
