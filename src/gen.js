  // ---- auto-builder: turns a few settings into a random room ----
  // Rooms are stacked floors. Each floor is crossed in one direction past a run of obstacles, and ends at a way
  // up to the next floor. Difficulty sets how big each hazard is and how little safe ground sits between them;
  // the obstacle and piece settings set how many there are and what they are made of.
  // A shaping pass then makes each room look less like a ladder: walls step in and out, ceilings hang down in
  // uneven lumps wherever the route does not need the headroom, and a dim backdrop layer adds depth.
  //
  // RULE: every level element the game supports must also be something this builder can place. When a new
  // element is added to the game, add it here (and to the auto-player in tests/gentest.js) in the same change.
  // Moves a level may ask the player for. A level built without a move must be beatable without it (tests/gentest.js plays it
  // with the others taken away). Absent means everything, which is what the builder and old settings get.
  function abilitiesOf(opts) { var a = opts.abilities || {}; return { grab: a.grab !== false, dash: a.dash !== false, 'super': a['super'] !== false }; }
  function generateRoom(opts, seed) {
    var layout = opts.layout || 'floors';
    if (layout === 'mixed') layout = ((seed >>> 3) % 2) ? 'islands' : 'floors';
    if (layout === 'islands') return generateIslands(opts, seed);
    return generateFloors(opts, seed);
  }
  // ---- island rooms: no full-width floors. Floating slabs at staggered heights, pillars to climb, chimneys to
  // bounce up. The route zigzags from island to island; each move is a hop, a climb or a chimney, and the plan
  // records which so the auto-player can follow it. ----
  function generateIslands(opts, seed) {
    // a route can box itself in near a wall; try a few variations and keep the first that climbs the whole room
    var best = null;
    for (var attempt = 0; attempt < 6; attempt++) {
      var out = generateIslandsOnce(opts, (seed + attempt * 7919) >>> 0);
      if (!best || out.top < best.top) best = out;
      if (out.top <= Math.round((opts.rows === SCREEN.tall ? SCREEN.tall : SCREEN.rows) / 4)) break;
    }
    best.room.id = 'auto-' + seed; best.room.name = 'Auto ' + seed;
    return best;
  }
  function generateIslandsOnce(opts, seed) {
    var COLS = SCREEN.cols, ROWS = opts.rows === SCREEN.tall ? SCREEN.tall : SCREEN.rows, R = COLS - 2, E = COLS - 1, D = Math.max(1, Math.min(5, opts.difficulty | 0)), s = seed >>> 0;
    var EL = opts.elements || { spikes: opts.spikes > 0, refills: !!opts.refills };
    var SP = EL.spikes ? Math.max(1, opts.spikes | 0) : 0;
    var WORLD = opts.world | 0, SHAPE = opts.shape !== false, CAN = abilitiesOf(opts);
    var OWN = { ice: 2, firepits: 3, fireballs: 3, jets: 3, lava: 3, lasers: 4, drones: 4, wires: 5, holos: 5 }, own;
    if (WORLD) for (own in OWN) if (EL[own] && OWN[own] !== WORLD) { EL = Object.assign({}, EL); EL[own] = false; }
    var HZ = SP > 0 ? SP : (EL.firepits ? 1 : 0);
    function rnd() { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
    function pick(w) { var k, sum = 0, r; for (k in w) sum += w[k]; if (sum <= 0) return null; r = rnd() * sum; for (k in w) { r -= w[k]; if (r < 0) return k; } return null; }
    var g = [], r, c, i;
    for (r = 0; r < ROWS; r++) { g.push([]); for (c = 0; c < COLS; c++) g[r].push((r === 0 || r >= ROWS - 2 || c === 0 || c === COLS - 1) ? '#' : '.'); }
    function set(x, y, ch) { if (x >= 1 && x <= R && y >= 1 && y <= ROWS - 3) g[y][x] = ch; }
    function fill(x0, x1, y0, y1, ch) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) set(xx, yy, ch); }
    function at(x, y) { return (x >= 0 && x <= E && y >= 0 && y < ROWS) ? g[y][x] : '#'; }
    var stats = { floors: 0, obstacles: 0, spikes: 0, ice: 0, crumble: 0, platforms: 0, zips: 0, fire: 0, fireballs: 0, springs: 0, gems: 0, keys: 0, jets: 0, lava: 0, lasers: 0, drones: 0, wires: 0, raiders: 0, barrels: 0, heavies: 0, holos: 0, islands: 0 };
    // Hops follow two fixed recipes the auto-player replays exactly: a full jump from the slab edge at run speed, or the
    // same with a sideways dash five frames in. REACH lists, per rise, the gaps each recipe was measured to land
    // (tests/reach.js against the real physics), so every hop the builder places is one the recipe clears.
    var REACH = { jump: { 0: { 4: 24, 5: 14, 6: 4 }, 1: { 3: 29, 4: 19, 5: 9 }, 2: { 2: 33, 3: 23, 4: 13, 5: 3 }, 3: { 1: 8, 2: 8, 3: 14, 4: 4 } },
                  dash: { 0: { 4: 42, 5: 32, 6: 22, 7: 12, 8: 2 }, 1: { 3: 39, 4: 29, 5: 19, 6: 9 } } };   // rise: { gap: where the feet land, px past the slab's near edge }
    var HOPS = [];                                                       // the pool this difficulty draws from: [rise, gap, recipe, narrowest slab that catches the landing]
    var rises = [[1, 2], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [2, 3]][D - 1], minGap = [3, 3, 4, 4, 5][D - 1];
    function pool(recipe, rr0, gmin) { var gl = REACH[recipe][rr0]; if (!gl) return; for (var gs in gl) { var gp = +gs, o = gl[gs]; if (gp >= gmin && o >= 2) HOPS.push([rr0, gp, recipe, Math.max(3, Math.ceil((o + 10) / 10)), o]); } }
    for (var hi = 0; hi < rises.length; hi++) pool('jump', rises[hi], minGap);
    if (D >= 3 && CAN.dash) { pool('dash', 1, 6); if (D >= 4) pool('dash', 0, 6); }
    var plan = [], islands = [];
    // need marks the cells the route must keep clear: standing room over every slab, the arc of every hop, the
    // face of every pillar, the column of every track. A new piece may only go where nothing is needed, and its
    // own needs must be empty, so no slab ever sits in the way of a jump. If nothing fits, the route ends early.
    var need = []; for (r = 0; r < ROWS; r++) { need.push([]); for (c = 0; c < COLS; c++) need[r].push(false); }
    var ignore = null;                                                   // a box whose needs a candidate may build over (the slab it leaves from)
    function freeCell(cx, cy, soft) { return cx >= 1 && cx <= R && cy >= 1 && cy <= ROWS - 3 && g[cy][cx] === '.' && (soft || !need[cy][cx] || (ignore && cx >= ignore[0] && cx <= ignore[1] && cy >= ignore[2] && cy <= ignore[3])); }
    function boxFree(x0, x1, y0, y1) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) if (xx < 1 || xx > R || yy < 1 || yy > ROWS - 3 || '.Gok'.indexOf(g[yy][xx]) < 0) return false; return true; }   // needs may overlap other needs and pickups, never a solid
    function fits(cand) {
      var j; for (j = 0; j < cand.tiles.length; j++) { var t = cand.tiles[j]; if (!freeCell(t[0], t[1], t[3])) return false; }
      for (j = 0; j < cand.needs.length; j++) { var n = cand.needs[j]; if (n[2] < 1 || !boxFree(n[0], n[1], n[2], n[3])) return false; }
      return true;
    }
    function commit(cand) {
      var j; for (j = 0; j < cand.tiles.length; j++) set(cand.tiles[j][0], cand.tiles[j][1], cand.tiles[j][2]);
      var yy, xx; if (cand.release) { var rl = cand.release; for (yy = rl[2]; yy <= rl[3]; yy++) for (xx = rl[0]; xx <= rl[1]; xx++) need[yy][xx] = false; }
      for (j = 0; j < cand.needs.length; j++) { var n = cand.needs[j]; for (yy = n[2]; yy <= n[3]; yy++) for (xx = n[0]; xx <= n[1]; xx++) need[yy][xx] = true; }
    }
    function slab(cand, sx0, sw, sy) { for (var xx = sx0; xx < sx0 + sw; xx++) cand.tiles.push([xx, sy, '#']); cand.needs.push([sx0, sx0 + sw - 1, sy - 4, sy - 1]); }   // a slab and the room to stand and jump on it
    function column(cand, cx, y0, y1) { for (var yy = y0; yy <= y1; yy++) cand.tiles.push([cx, yy, '#']); }
    // the floor is the first island (full width), so a fall always lands somewhere the route can restart from;
    // a two tile strip over it stays open so you can walk back under the slabs
    var dir = rnd() < 0.5 ? 1 : -1, x = 1, w = R, y = ROWS - 2;
    g[y - 1][dir > 0 ? 3 : R - 2] = 'S';
    islands.push({ x: x, w: w, y: y, move: 'start', dir: dir }); stats.islands++;
    for (c = 1; c <= R; c++) { need[ROWS - 3][c] = true; need[ROWS - 4][c] = true; }
    x = dir > 0 ? 1 : R - 9; w = 10;                        // the first hop leaves from the start side of the floor
    var k = 0, hopGaps = [];
    // each move is planned as a candidate (tiles, needs, island record), then placed only if it fits
    function planMove(move, d, hp) {
      var cand = { tiles: [], needs: [], isl: { move: move, dir: d } }, isl = cand.isl, nw, nx, ny;
      if (move === 'hop') {
        if (k === 0) hp = [3, 3, 'jump', 3, 14];                             // the first island: a plain jump up from the floor
        var rise = hp[0], gap = hp[1]; nw = ri(hp[3], 6);
        isl.recipe = hp[2]; isl.gap = gap; isl.rise = rise; isl.land = hp[3]; isl.o = hp[4];   // land: how many tiles from the near edge the landing can use; o: where the feet come down
        nx = d > 0 ? x + w + gap : x - gap - nw; ny = y - rise;
        if (nx < 1 || nx + nw - 1 > R) { nw = hp[3]; nx = d > 0 ? x + w + gap : x - gap - nw; }
        if (nx < 1 || nx + nw - 1 > R) return null;
        slab(cand, nx, nw, ny);
        var a0 = d > 0 ? x + w - 1 : nx + nw, a1 = d > 0 ? nx - 1 : x;   // the arc: from the take-off column across the gap
        if (k === 0) { a0 = d > 0 ? nx - gap - 1 : nx + nw; a1 = d > 0 ? nx - 1 : nx + nw + gap; }
        cand.needs.push([Math.max(1, a0), Math.min(R, a1), y - 5, y - 1]);   // the jump peaks three and a half rows over the take-off
        isl.gapCols = [Math.max(1, a0), Math.min(R, a1)];
      } else if (move === 'climb') {                       // a pillar flush with this island's edge: climb its face, the landing joins its top on the far side
        var ph = ri(5, 8); nw = ri(3, 5);
        var px = d > 0 ? x + w : x - 1;
        nx = d > 0 ? px + 1 : px - nw; ny = y - ph;
        if (px < 2 || px > R - 1 || nx < 1 || nx + nw - 1 > R) return null;
        column(cand, px, y - ph, y - 1); slab(cand, nx, nw, ny);
        cand.needs.push([px - d, px - d, y - ph - 4, y - 1]); cand.needs.push([px, px, y - ph - 4, y - ph - 1]);
        isl.pillar = px; isl.ph = ph; isl.side = d;
        nx = Math.min(nx, px); nw++;                       // the pillar top is part of the landing
      } else if (move === 'chimney') {                     // a stepped pillar: climb the first step, rest on it, climb the second, higher still
        var ph1 = ri(4, 6), ph2 = ri(4, 6); nw = ri(3, 5);
        var p1 = d > 0 ? x + w : x - 1, p2 = p1 + d, top2 = y - ph1 - ph2;
        nx = d > 0 ? p2 + 1 : p2 - nw; ny = top2;
        if (p1 < 2 || p1 > R - 1 || p2 < 2 || p2 > R - 1 || nx < 1 || nx + nw - 1 > R) return null;
        column(cand, p1, y - ph1, y - 1); column(cand, p2, top2, y - 1); slab(cand, nx, nw, ny);
        cand.needs.push([p1 - d, p1 - d, y - ph1 - 4, y - 1]); cand.needs.push([p1, p1, top2 - 4, y - ph1 - 1]); cand.needs.push([p2, p2, top2 - 4, top2 - 1]);
        isl.p1 = p1; isl.ph1 = ph1; isl.p2 = p2; isl.ph2 = ph2; isl.side = d; isl.mid = y - ph1;
        nx = Math.min(nx, p2); nw++;
      } else if (move === 'spring') {                      // a spring at this island's far end throws you six rows up; hold the direction and you drift onto the slab
        if (w <= islands[k].land || d !== (islands[k].from || islands[k].dir)) return null;   // the spring sits at the far end, past where you land
        var sxp = d > 0 ? x + w - 1 : x; nw = ri(4, 5);
        nx = d > 0 ? sxp + 4 : sxp - 3 - nw; ny = y - 6;
        if (nx < 1 || nx + nw - 1 > R) return null;
        cand.tiles.push([sxp, y - 1, 'u', true]); slab(cand, nx, nw, ny);
        cand.needs.push([Math.min(sxp, nx), Math.max(sxp, nx + nw - 1), y - 9, y - 2]);
        isl.spring = sxp;
      } else if (move === 'zip') {                         // a platform (or zip) at the island's end rides a track up; it stops a row above a slab one tile over, so you step off and drop onto it
        var tx = d > 0 ? x + w : x - 1, rise2 = ri(6, 9); nw = ri(3, 5);
        nx = d > 0 ? tx + 2 : tx - 1 - nw; ny = y - rise2;
        if (tx < 2 || tx > R - 1 || nx < 1 || nx + nw - 1 > R) return null;
        var zip = EL.zips && (!EL.movers || rnd() < 0.5);
        for (var yy = y - rise2 - 1; yy <= y - 1; yy++) cand.tiles.push([tx, yy, '|']);
        cand.tiles.push([tx, y, zip ? 'z' : '=']); slab(cand, nx, nw, ny);
        cand.needs.push([tx, tx, y - rise2 - 5, y - rise2 - 2]); cand.needs.push([tx + d, tx + d, y - rise2 - 5, y - rise2 - 1]); cand.needs.push([tx - d, tx - d, y - rise2 - 2, y - 1]);
        isl.track = tx; isl.zip = zip;
      } else if (move === 'shelf') {                       // the turn: a shelf over this slab's far part; stand at the near end, jump straight up, drift onto it, go back the other way
        var ad = islands[k].from || islands[k].dir, ld = islands[k].land || 3, stand = ad > 0 ? x + ld - 1 : x + w - ld, off = rnd() < 0.7 ? 1 : 2, rise3 = off === 1 ? 3 : 2;   // one tile off goes three rows up (the way back needs the height), two tiles off only two   // stand past the landing zone, so the shelf never sits in the arc that arrives here
        nw = ri(3, 5); if (ad > 0) nw = Math.min(nw, R - stand - off + 1); else nw = Math.min(nw, stand - off);   // as wide as the wall allows
        nx = ad > 0 ? stand + off : stand - off - nw + 1; ny = y - rise3;
        if (nw < 3 || nx < 1 || nx + nw - 1 > R) return null;
        ignore = [x, x + w - 1, y - 4, y - 1];
        slab(cand, nx, nw, ny);
        cand.needs.push([stand, stand, y - 5, y - 1]); cand.needs.push([Math.min(stand, nx), Math.max(stand, nx + nw - 1), ny - 4, y - 1]);   // the stand column and the drift across
        isl.stand = stand; isl.dir = -ad; isl.from = ad;
        cand.release = ad > 0 ? [stand + 1, x + w - 1, y - 4, y - 1] : [x, stand - 1, y - 4, y - 1];   // the slab's far part is never stood on again: its room is free for the way back
      } else return null;
      if (move !== 'shelf' && (d > 0 ? nx > R - 5 : nx + nw - 1 < 6)) return null;   // leave room past the landing for a shelf and the way back
      isl.x = nx; isl.w = nw; isl.y = ny; if (!isl.land) isl.land = 3;
      return cand;
    }
    var usedKey = false, usedGem = false;
    while (y > 9) {
      var cand = null, tries;
      for (tries = 0; tries < 40 && !cand; tries++) {
        var move = k === 0 ? 'hop' : pick({ hop: 6, climb: CAN.grab ? 3 : 0, chimney: CAN.grab && D >= 2 ? 2 : 0, spring: EL.springs !== false && islands[k].move !== 'shelf' ? 1.5 : 0, zip: EL.zips || EL.movers ? 1.5 : 0, shelf: islands[k].move === 'shelf' || islands[k].move === 'spring' ? 0 : (tries < 20 ? 1.5 : 4) });
        var d = tries < 20 ? dir : -dir;                  // after a few misses, try the other way
        ignore = null;
        if (move === 'hop') {                              // a hop tries every recipe in the pool, in a random order
          var pool = HOPS.slice(), hi2 = pool.length;
          while (hi2 > 0 && !cand) { var pi = ri(0, hi2 - 1), hp = pool[pi]; pool[pi] = pool[--hi2]; cand = planMove(move, d, hp); if (cand && !fits(cand)) cand = null; }
        } else { cand = planMove(move, d); if (cand && !fits(cand)) cand = null; }
      }
      if (!cand) break;
      var isl = cand.isl; commit(cand);
      var hzc = EL.firepits ? 'F' : '^', hzn = EL.firepits ? 'fire' : 'spikes', HZP = [0, 0.3, 0.5, 0.7, 0.9][D - 1];
      // hazards: a spike on the landing's near lip of a low hop that comes down well past it (clear it or fall), and
      // spikes on the far part of a slab under a shelf, where the route never walks
      if (HZ > 0 && k > 0 && isl.move === 'hop' && isl.rise <= 1 && isl.o >= (EL.firepits ? 18 : 14) && rnd() < HZP) { set(d > 0 ? isl.x : isl.x + isl.w - 1, isl.y - 1, hzc); isl.lip = true; stats[hzn]++; }
      if (HZ > 0 && isl.move === 'shelf' && rnd() < HZP) { var f0 = isl.from > 0 ? isl.stand + 2 : x, f1 = isl.from > 0 ? x + w - 1 : isl.stand - 2; for (c = f0; c <= f1; c++) if (at(c, y - 1) === '.') { set(c, y - 1, hzc); stats[hzn]++; } }
      // the slab left behind turns to ice or crumble when the route runs straight across it into the next hop
      var pv = islands[k];
      if (k > 0 && pv.move === 'hop' && isl.move === 'hop' && isl.dir === pv.dir && !pv.key) {
        var icy = EL.ice && rnd() < 0.5, crum = !icy && EL.crumble && w <= 4 && rnd() < 0.5;
        if (icy || crum) { for (c = x; c < x + w; c++) if (at(c, y) === '#') set(c, y, icy ? 'I' : 'C'); pv.run = true; pv[icy ? 'ice' : 'crumble'] = true; stats[icy ? 'ice' : 'crumble'] += w; }
      }
      if (isl.move === 'zip') { if (isl.zip) stats.zips++; else stats.platforms++; }
      if (isl.move === 'spring') stats.springs++;
      if (isl.move === 'hop' && k > 0) hopGaps.push(isl);
      if (EL.keys && !usedKey && k >= 2 && rnd() < 0.5) { set(isl.x + Math.floor(isl.w / 2), isl.y - 1, 'k'); isl.key = true; usedKey = true; stats.keys++; }
      if (EL.gems !== false && !usedGem && isl.move === 'hop' && k >= 2 && rnd() < 0.4) { set(isl.gapCols[d > 0 ? 1 : 0], Math.min(y, isl.y) - 4, 'G'); usedGem = true; stats.gems++; }
      else if (EL.refills && isl.move === 'hop' && k >= 2 && rnd() < 0.3) set(isl.gapCols[d > 0 ? 1 : 0], Math.min(y, isl.y) - 4, 'o');
      islands.push(isl); stats.islands++;
      x = isl.x; w = isl.w; y = isl.y; dir = isl.dir; k++;
      if (rnd() < 0.3) dir = -dir;                         // zigzag now and then
    }
    // the exit on the last island; a locked door in front of it when a key is out (only if the slab has room)
    var last = islands[islands.length - 1], prev = islands[islands.length - 2];
    if (last.key) {                                      // the key never sits on the exit slab: move it one slab back, or drop it
      set(last.x + Math.floor(last.w / 2), last.y - 1, '.'); last.key = false;
      if (islands.length > 3 && at(prev.x + Math.floor(prev.w / 2), prev.y - 1) === '.') { set(prev.x + Math.floor(prev.w / 2), prev.y - 1, 'k'); prev.key = true; } else stats.keys = 0;
    }
    var ex = x + (dir > 0 ? w - 2 : 0); fill(ex, ex + 1, y - 2, y - 1, 'E'); last.exitDir = dir;
    if (stats.keys) {
      if (w >= 5) { var dx0 = dir > 0 ? ex - 1 : ex + 2; set(dx0, y - 1, 'D'); set(dx0, y - 2, 'D'); }
      else { for (i = 0; i < islands.length; i++) if (islands[i].key) { set(islands[i].x + Math.floor(islands[i].w / 2), islands[i].y - 1, '.'); islands[i].key = false; } stats.keys = 0; }
    }
    // hazards live on the floor under the gaps: a miss costs a life instead of a walk back. The run-up strip to the
    // first hop stays clear. Lots means the whole floor beyond it.
    if (HZ > 0 && islands.length > 1) {
      var hz = EL.firepits ? 'F' : '^', f1 = islands[1], safe0 = f1.dir > 0 ? 1 : f1.x + f1.w + f1.gap - 1, safe1 = f1.dir > 0 ? f1.x - f1.gap : R;
      var frow = ROWS - 3;
      if (HZ >= 2 && D >= 2) { for (c = 1; c <= R; c++) if ((c < safe0 || c > safe1) && g[frow][c] === '.') { g[frow][c] = hz; stats[EL.firepits ? 'fire' : 'spikes']++; } }
      else if (D >= 2) for (i = 0; i < hopGaps.length; i++) { var hg = hopGaps[i]; if (rnd() < [0, 0.4, 0.6, 0.8, 1][D - 1]) for (c = hg.gapCols[0]; c <= hg.gapCols[1]; c++) if ((c < safe0 || c > safe1) && g[frow][c] === '.') { g[frow][c] = hz; stats[EL.firepits ? 'fire' : 'spikes']++; } }
    }
    if (EL.lava && ROWS >= SCREEN.tall) { for (var lc = 1; lc < COLS - 1; lc++) g[ROWS - 1][lc] = '~'; stats.lava = 1; }
    // shaping: the side walls bulge in where the route needs nothing, and a dim backdrop behind the slabs
    if (SHAPE) {
      for (r = 2; r < ROWS - 5; r++) {
        if (r % 7 < 4) { var lw = ri(1, 3); for (c = 1; c <= lw; c++) if (freeCell(c, r) && !need[r][c + 1]) set(c, r, '#'); else break; }
        if ((r + 3) % 7 < 4) { var rw = ri(1, 3); for (c = R; c > R - rw; c--) if (freeCell(c, r) && !need[r][c - 1]) set(c, r, '#'); else break; }
      }
      for (i = 1; i < islands.length; i++) { var q = islands[i]; var bh = ri(2, 5), bx = q.x + ri(0, Math.max(0, q.w - 3)), bw = ri(2, 3); for (r = q.y + 1; r <= q.y + bh; r++) for (c = bx; c < bx + bw; c++) if (at(c, r) === '.') set(c, r, 'b'); }
    }
    for (i = 0; i < islands.length; i++) plan.push(islands[i]);
    return {
      plan: { kind: 'islands', islands: islands }, stats: stats, top: y,
      room: { format: 1, id: 'auto-' + seed, name: 'Auto ' + seed, difficulty: D, world: WORLD || 1, grid: { cols: COLS, rows: ROWS, tile: 10 },
              tiles: g.map(function (row) { return row.join(''); }), entities: [], moves: opts.abilities ? abilitiesOf(opts) : undefined }
    };
  }
  function generateFloors(opts, seed) {
    var COLS = SCREEN.cols, ROWS = opts.rows === SCREEN.tall ? SCREEN.tall : SCREEN.rows, R = COLS - 2, E = COLS - 1, D = Math.max(1, Math.min(5, opts.difficulty | 0)), s = seed >>> 0;
    var EL = opts.elements || { spikes: opts.spikes > 0, refills: !!opts.refills };      // which pieces may be used
    var SP = EL.spikes ? Math.max(1, opts.spikes | 0) : 0;                               // 0 none, 1 some, 2 lots
    var styles = opts.styles && opts.styles.length ? opts.styles : (opts.style && opts.style !== 'mixed' ? [opts.style] : []);
    var SHAPE = opts.shape !== false;
    var WORLD = opts.world | 0, ICY = WORLD === 2 ? 4 : 1;                                // a world leans on its own pieces
    var CAN = abilitiesOf(opts);                                                           // the moves this level may ask for (wall climb: grab, dash, super jump)
    var OWN = { ice: 2, firepits: 3, fireballs: 3, jets: 3, lava: 3, lasers: 4, drones: 4, wires: 5, holos: 5 }, own;   // pieces that belong to one world
    if (WORLD) for (own in OWN) if (EL[own] && OWN[own] !== WORLD) { EL = Object.assign({}, EL); EL[own] = false; }
    var HZ = SP > 0 ? SP : (EL.firepits ? 1 : 0);                                        // floor hazards: spikes, or flames in the Furnace                                                    // organic shaping on by default
    function likes(st) { return styles.length && styles.length < 3 && styles.indexOf(st) >= 0; }
    function rnd() { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
    function rr(p) { return ri(p[0], p[1]); }
    function pick(w) { var k, sum = 0, r; for (k in w) sum += w[k]; if (sum <= 0) return null; r = rnd() * sum; for (k in w) { r -= w[k]; if (r < 0) return k; } return null; }
    var g = [], r, c;
    for (r = 0; r < ROWS; r++) { g.push([]); for (c = 0; c < COLS; c++) g[r].push((r === 0 || r >= ROWS - 2 || c === 0 || c === COLS - 1) ? '#' : '.'); }
    function col(t, d) { return d > 0 ? 1 + t : R - t; }
    function put(t, d, row, ch) { var x = col(t, d); if (x >= 1 && x <= R && row >= 1 && row <= ROWS - 3) g[row][x] = ch; }
    function box(t0, t1, r0, r1, d, ch) { for (var q = r0; q <= r1; q++) for (var t = t0; t <= t1; t++) put(t, d, q, ch); }
    function get(t, d, row) { var x = col(t, d); return (x >= 0 && x <= E && row >= 0 && row < ROWS) ? g[row][x] : '#'; }

    // what each difficulty means, from 1 Gentle to 5 Brutal
    var TUNE = {
      gap:    [[4, 5], [3, 4], [3, 4], [3, 3], [3, 3]][D - 1],            // safe ground between obstacles, in tiles
      spikeW: [[2, 2], [2, 3], [3, 4], [4, 5], [5, 6]][D - 1],            // spike patch you can clear with a jump
      wideW:  [null, [6, 7], [7, 8], [8, 9], [9, 10]][D - 1],             // spike gap that needs a jump and a dash
      crownW: [null, null, [2, 2], [2, 3], [3, 3]][D - 1],                // raised block with spikes on top
      wallH:  [[4, 4], [4, 4], [4, 5], [4, 5], [5, 5]][D - 1],            // wall to climb over
      iceL:   [[3, 4], [3, 4], [4, 5], [4, 6], [5, 6]][D - 1],            // ice you slide along before a hazard
      bridgeW: [[3, 4], [4, 5], [5, 6], [6, 7], [7, 8]][D - 1],           // crumbling bridge
      ferryW: [[8, 8], [8, 9], [9, 10], [10, 11], [11, 12]][D - 1]        // gap crossed on a moving platform
    };
    var target = [1, 2, 9][opts.obstacles];
    var plan = [], y = ROWS - 2, d = rnd() < 0.5 ? 1 : -1, Wprev = 0, prevType = '', off = 0, floor = 0;
    var stats = { floors: 0, obstacles: 0, spikes: 0, ice: 0, crumble: 0, platforms: 0, zips: 0, fire: 0, fireballs: 0, springs: 0, gems: 0, keys: 0, jets: 0, lava: 0, lasers: 0, drones: 0, wires: 0, raiders: 0, barrels: 0, heavies: 0, holos: 0 };
    function zipPick() { return EL.zips && (!EL.movers || rnd() < 0.5); }   // a platform spot becomes a zip mover
    var gemFloor = EL.gems !== false ? ri(0, 2) : -1;                                   // one gem, over a hazard on an early floor
    g[ROWS - 3][col(2, d)] = 'S';
    if (EL.lava && ROWS >= SCREEN.tall) { for (var lc = 1; lc < COLS - 1; lc++) g[ROWS - 1][lc] = '~'; stats.lava = 1; }   // rising lava starts under the first floor of a tall room

    while (true) {
      var maxHf = y - 8, top = maxHf < 6, headroom = top ? y - 1 : maxHf - 1;
      // the way up at the end of this floor
      var conn = null, sh = 0;
      if (!top) {
        conn = { type: pick({
          steps: [5, 3, 2, 1, 0.5][D - 1] * (likes('jump') ? 2 : 1),
          open: CAN.grab ? 2 * (likes('dash') || likes('climb') ? 2 : 1) : 0,
          curtain: CAN.grab && maxHf >= 7 ? [1, 2, 3, 4, 5][D - 1] * 0.8 * (likes('climb') ? 2 : 1) : 0,
          lift: EL.movers || EL.zips ? 3 : 0,
          spring: EL.springs !== false ? 2.5 : 0                       // bounce up through the opening
        }) };
        conn.W = conn.type === 'steps' ? 7 : (conn.type === 'lift' || conn.type === 'spring' ? 3 : (conn.type === 'curtain' ? ri(3, 5) : ri(3, 4)));
        // the far wall can step inward by a few tiles, so the room is not a plain box
        if (SHAPE && rnd() < 0.6) sh = ri(2, 6);
      }
      var s0 = floor === 0 ? 6 : off + Wprev + (prevType === 'open' || prevType === 'spring' ? 5 : 3);   // a flying arrival needs more room to land
      function zoneEnd(k) { var F = R - k; return top ? R - 7 : (conn.type === 'steps' ? F - 10 : (conn.type === 'lift' ? F - 8 : (conn.type === 'spring' ? F - 7 : (conn.type === 'curtain' ? F - conn.W - 4 : F - conn.W - 2)))); }
      while (sh > 0 && zoneEnd(sh) - s0 < 7) sh--;
      if (sh === 1) sh = 0;
      var F = R - sh, e0 = zoneEnd(sh);
      if (conn) conn.sh = sh;

      // obstacles along the floor
      var obs = [], cur = s0 + (D <= 2 ? ri(0, 1) : 0), minHf = 6, lastGap = 9, spiked = 0;
      while (obs.length < target) {
        var room = e0 - cur;
        var canWall = (top || (conn.type !== 'steps' && conn.type !== 'spring')) && headroom >= 7;   // these ways up fix the floor height, so no tall walls
        var canDrop = canWall && SP > 0 && D >= 4 && headroom >= 8;
        var gapBefore = obs.length ? lastGap : cur - s0 + 2;                              // clear tiles behind the next obstacle, where the hero can stand (he lands about two tiles short of s0)
        var w = {
          spikes: HZ > 0 && room >= 3 ? (likes('jump') ? 5 : 3) * (SP > 1 ? 2 : 1) : 0,
          wide: CAN.dash && HZ > 0 && TUNE.wideW && room >= TUNE.wideW[0] + 2 ? (likes('dash') ? 8 : 2) * (D >= 4 ? 1.5 : 1) : 0,
          crown: SP > 0 && TUNE.crownW && room >= TUNE.crownW[0] + 1 ? 2 : 0,
          block: room >= 3 ? (SP > 1 ? 0 : (SP === 1 ? 1 : 3)) * (likes('jump') ? 1.5 : 1) : 0,
          wall: CAN.grab && canWall && room >= 3 ? (likes('climb') ? 6 : 2) * (SP > 1 ? 0.3 : 1) : 0,
          wallspikes: CAN.grab && canDrop && room >= 5 ? (likes('climb') ? 6 : 2) : 0,
          icespikes: EL.ice && SP > 0 && room >= TUNE.iceL[0] + 3 ? 3 * ICY : 0,                    // slide in, jump the spikes at the end
          iceblock: EL.ice && SP < 2 && room >= TUNE.iceL[0] + 3 ? (SP ? 1 : 3) * ICY : 0,           // slide into a block to hop
          bridge: EL.crumble && floor > 0 && room >= 4 ? 3 : 0,                                // crumbling stretch of floor
          ferry: (EL.movers || EL.zips) && (HZ > 0 || floor > 0) && room >= TUNE.ferryW[0] + 1 ? 4 : 0,    // ride a platform across a gap
          fireball: (EL.fireballs || EL.wires) && room >= 2 && headroom >= 6 ? 4 : 0,        // time a run under a fireball (or a spark) on a track
          jet: (EL.jets || EL.lasers || EL.holos) && room >= 2 && headroom >= 6 ? 4 : 0,     // wait for a fire jet (or a laser, or a holo sign) to die down, then run past
          drone: EL.drones && room >= 2 && headroom >= 6 ? 4 : 0,                             // time a run under a patrol drone
          // combat (CLAUDE.md, Combat): a raider on his beat, a raider behind a barrel, or a heavy. The heavy wins any duel on
          // his level inside his pellets' range (about 14 tiles from his centre), so he only goes where the floor before him gives 17 clear tiles
          // to shoot from; the hero's shots carry 19.
          raider: EL.raiders && room - Math.max(0, (obs.length ? 5 : 6) - gapBefore) >= 4 ? 4 * (D >= 3 ? 1.5 : 1) : 0,
          nest: EL.raiders && EL.barrels && room - Math.max(0, (obs.length ? 5 : 6) - gapBefore) >= 6 ? 3 : 0,
          heavy: EL.heavies && headroom >= 5 && room - Math.max(0, 17 - gapBefore) >= 7 ? (D >= 3 ? 3 : 1.5) : 0
        };
        // "Some" spikes means every floor has at least one; "Lots" removed the harmless options above
        if (HZ === 1 && SP < 2 && !spiked && (w.spikes || w.wide || w.crown || w.wallspikes || w.icespikes)) { w.block = 0; w.wall = 0; w.iceblock = 0; }
        // a spiked block needs a run-up, so it gets extra clear ground in front or is swapped for plain spikes
        var runup = obs.length ? Math.max(0, 5 - lastGap) : (floor === 0 ? 0 : 2);
        if (room - runup < (TUNE.crownW ? TUNE.crownW[0] : 99) + 1) w.crown = 0;
        var type = pick(w);
        if (!type) break;
        if (type === 'crown') { cur += runup; room -= runup; }
        if (type === 'heavy') { var hr = Math.max(0, 17 - gapBefore); cur += hr; room -= hr; }   // 17 tiles of floor before a heavy: his pellets reach 14 from his centre and his beat brings him 3 nearer
        if (type === 'raider' || type === 'nest') { var aw = Math.max(0, (obs.length ? 5 : 6) - gapBefore); cur += aw; room -= aw; }   // a raider's beat is three tiles each way: two clear tiles to stand on before it, six from a landing (the hero arrives mid-jump and in sight)
        var o = { type: type, t0: cur }, after = rr(TUNE.gap);
        if (type === 'spikes') { o.w = Math.min(rr(TUNE.spikeW), room - 1, lastGap <= 3 ? 5 : 6); } // the last tile before the way up stays clear
        else if (type === 'wide') { o.w = Math.min(rr(TUNE.wideW), room - 2); after = Math.max(6, after); } // a dash carries you further, so more room to land
        else if (type === 'crown') { o.w = Math.min(rr(TUNE.crownW), room - 1); }
        else if (type === 'block') { o.w = 2; o.h = 2; }
        else if (type === 'icespikes') { o.L = Math.min(rr(TUNE.iceL), room - 3); o.sw = Math.min(rr(TUNE.spikeW), 4, room - o.L - 1); o.w = o.L + o.sw; }
        else if (type === 'iceblock') { o.L = Math.min(rr(TUNE.iceL), room - 3); o.w = o.L + 2; o.h = 2; }
        else if (type === 'bridge') { o.w = Math.min(rr(TUNE.bridgeW), room - 1); }
        else if (type === 'ferry') { o.w = Math.min(rr(TUNE.ferryW), room - 1); o.pl = D >= 4 ? 2 : 3; o.pit = HZ === 0; o.zip = zipPick(); after = Math.max(3, after); }
        else if (type === 'fireball') { o.w = 1; after = Math.max(3, after); }
        else if (type === 'jet') { o.w = 1; o.laser = !!EL.lasers; o.holo = !!EL.holos; after = Math.max(3, after); }
        else if (type === 'drone') { o.w = 4; after = Math.max(3, after); }
        else if (type === 'raider') { o.w = 1; after = Math.max(3, after); }
        else if (type === 'nest') { o.w = 3; after = Math.max(3, after); }                 // the raider stands at the near end, the barrel two tiles past him
        else if (type === 'heavy') { o.w = 3; after = Math.max(3, after); }                // three tiles across for his body, his feet on the middle one
        else if (type === 'wall') { o.w = 2; o.h = Math.min(rr(TUNE.wallH), headroom - 3); minHf = Math.max(minHf, o.h + 4); after = 5; }
        else { o.h = 4; o.sw = Math.min(D >= 5 ? ri(3, 4) : ri(2, 3), room - 3); o.w = 2 + o.sw; minHf = Math.max(minHf, 9); }
        if (type !== 'block' && type !== 'wall' && type !== 'iceblock' && type !== 'bridge' && type !== 'raider' && type !== 'nest' && type !== 'heavy' && !(type === 'ferry' && o.pit)) spiked++;
        // in the Furnace most floor hazards are flames
        if (EL.firepits && (type === 'spikes' || type === 'wide' || type === 'ferry')) o.fire = SP === 0 || rnd() < 0.75;
        obs.push(o);
        cur += o.w + after; lastGap = after;
      }

      // height of this floor
      var Hf = 0, yN = 0;
      if (!top) {
        if (conn.type === 'steps' || conn.type === 'spring') Hf = 6;
        else {
          var lo = Math.max(minHf, conn.type === 'curtain' ? 7 : 6), hi = Math.max(lo, Math.min(9, maxHf));
          if (conn.type === 'open' && likes('dash') && lo <= 7 && hi >= 7) Hf = 7;
          else if (SHAPE && rnd() < 0.55) Hf = hi;          // a tall floor now and then, so the ceiling has room to hang down
          else if (D >= 4) Hf = lo;                       // tight floors, so more of them fit
          else if (D <= 2) Hf = ri(Math.min(hi, Math.max(lo, 7)), hi);
          else Hf = ri(lo, hi);
        }
        yN = y - Hf;
      }

      // the stepped-in wall from the floor below carries on up this floor too, so walls step every two floors
      if (off > 0) box(0, off - 1, top ? 1 : yN + 1, y - 1, d, '#');

      // draw obstacles
      for (var i = 0; i < obs.length; i++) {
        var ob = obs[i], e = ob.t0 + ob.w - 1;
        if (ob.type === 'spikes' || ob.type === 'wide') {
          box(ob.t0, e, y - 1, y - 1, d, ob.fire ? 'F' : '^'); stats[ob.fire ? 'fire' : 'spikes'] += ob.w;
          if (gemFloor >= 0 && floor >= gemFloor && !stats.gems && ob.type === 'spikes') { put(ob.t0 + Math.floor(ob.w / 2), d, y - 4, 'G'); stats.gems++; }
          if (ob.type === 'wide' && EL.refills) put(ob.t0 + Math.floor(ob.w / 2), d, y - 4, 'o');
        } else if (ob.type === 'crown') {
          box(ob.t0, e, y - 1, y - 1, d, '#'); box(ob.t0, e, y - 2, y - 2, d, '^'); stats.spikes += ob.w;
        } else if (ob.type === 'wallspikes') {
          box(ob.t0, ob.t0 + 1, y - ob.h, y - 1, d, '#'); box(ob.t0 + 2, e, y - 1, y - 1, d, '^'); stats.spikes += ob.sw;
        } else if (ob.type === 'icespikes') {
          box(ob.t0, ob.t0 + ob.L - 1, y, y, d, 'I'); box(ob.t0 + ob.L, e, y - 1, y - 1, d, '^'); stats.spikes += ob.sw; stats.ice += ob.L;
        } else if (ob.type === 'iceblock') {
          box(ob.t0, ob.t0 + ob.L - 1, y, y, d, 'I'); box(ob.t0 + ob.L, e, y - 2, y - 1, d, '#'); stats.ice += ob.L;
        } else if (ob.type === 'bridge') {
          box(ob.t0, e, y, y, d, 'C'); stats.crumble += ob.w;
        } else if (ob.type === 'ferry') {
          if (ob.pit) box(ob.t0, e, y, y, d, '.'); else { box(ob.t0, e, y - 1, y - 1, d, ob.fire ? 'F' : '^'); stats[ob.fire ? 'fire' : 'spikes'] += ob.w; }
          box(ob.t0, e, y - 2, y - 2, d, '-'); box(ob.t0, ob.t0 + ob.pl - 1, y - 2, y - 2, d, ob.zip ? 'z' : '='); if (ob.zip) stats.zips++; else stats.platforms++;
        } else if (ob.type === 'fireball') {
          box(ob.t0, ob.t0, y - 5, y - 1, d, '|'); put(ob.t0, d, y - 5, EL.wires ? 'w' : '*'); if (EL.wires) stats.wires++; else stats.fireballs++;
        } else if (ob.type === 'jet') {
          put(ob.t0, d, y - 1, ob.holo ? '%' : ob.laser ? 'L' : 'J'); if (ob.holo) stats.holos++; else if (ob.laser) stats.lasers++; else stats.jets++;
        } else if (ob.type === 'drone') {                       // a track along the ceiling of the floor, the drone starts at one end
          box(ob.t0, ob.t0 + 3, y - 5, y - 5, d, '-'); put(ob.t0 + 3, d, y - 5, 'O'); stats.drones++;   // home (firing) end is the far side; you run under while it is away
        } else if (ob.type === 'raider') { put(ob.t0, d, y - 1, 'R'); stats.raiders++;
        } else if (ob.type === 'nest') { put(ob.t0, d, y - 1, 'R'); put(ob.t0 + 2, d, y - 1, 'B'); stats.raiders++; stats.barrels++;
        } else if (ob.type === 'heavy') { put(ob.t0 + 1, d, y - 1, 'H'); stats.heavies++;
        } else box(ob.t0, e, y - ob.h, y - 1, d, '#');
      }
      stats.floors++; stats.obstacles += obs.length;
      // a key on the landing strip of a middle floor, before the first obstacle; the door then guards the exit
      if (EL.keys && !top && floor >= 1 && !stats.keys && (rnd() < 0.5 || maxHf < 15)) { put(s0 - 2, d, y - 1, 'k'); stats.keys++; }

      // How much open air the route needs above the floor at each column. Anything above that is free to fill.
      var need = [], t;
      for (t = 0; t <= R - 1; t++) need.push(t < off ? 2 : (t < s0 + 1 ? 6 : 5));
      if (conn && conn.type === 'spring') for (t = Math.max(0, F - 6); t <= F - 1; t++) need[t] = Math.max(need[t], 6);
      for (i = 0; i < obs.length; i++) {
        var q = obs[i], n = q.type === 'wall' ? q.h + 3 : (q.type === 'wallspikes' ? q.h + 5 : (q.type === 'ferry' || q.type === 'crown' || q.type === 'fireball' || q.type === 'jet' || q.type === 'drone' || q.type === 'heavy' ? 6 : 5));
        for (t = Math.max(0, q.t0 - 3); t <= Math.min(R - 1, q.t0 + q.w + 2); t++) need[t] = Math.max(need[t], n);
      }

      if (top) {
        box(R - 4, R - 3, y - 2, y - 1, d, 'E');
        if (stats.keys) box(R - 6, R - 6, y - 2, y - 1, d, 'D');     // the door stands in front of the exit
        if (SHAPE) {                                     // the space above the last floor becomes a lumpy mass of rock
          var lump = ri(0, 2);
          for (t = 0; t <= R - 1; t++) {
            lump = Math.max(0, Math.min(3, lump + ri(-1, 1)));
            var keep = Math.max(need[t], t >= R - 7 ? 6 : 5) + 1 + lump;
            if (y - 1 - keep >= 1) box(t, t, 1, y - 1 - keep, d, '#');
          }
        }
        backdrop(1, y - 1, 0, R - 1);
        plan.push({ y: y, d: d, obs: obs, conn: null });
        break;
      }

      // next floor slab, with an opening by the far wall
      box(0, F - conn.W - 1, yN, yN, d, '#');
      if (sh > 0) box(F, R - 1, yN, y - 1, d, '#');           // the stepped-in wall, solid from this floor up to the next
      if (conn.type === 'curtain') {
        box(F - conn.W - 2, F - conn.W - 1, yN + 1, y - 3, d, '#');
        var spikeWall = (SP > 0 && D >= 3) || (SP > 1 && D >= 2);
        if (EL.ice && D >= 2 && (!spikeWall || rnd() < 0.5)) {   // an ice outer wall cannot be climbed either
          for (var qq = yN + 1; qq <= y - 3; qq++) { g[qq][col(F, d)] = 'I'; stats.ice++; }
        } else if (spikeWall) {
          var r1 = D >= 4 ? y - 5 : Math.min(y - 5, yN + 3);
          if (r1 >= yN + 2) { box(F - 1, F - 1, yN + 2, r1, d, d > 0 ? '<' : '>'); stats.spikes += r1 - yN - 1; }
        }
      } else if (conn.type === 'steps') {
        box(F - 3, F - 1, y - 2, y - 1, d, '#');
        conn.crumble = !!EL.crumble && D >= 2;                   // the floating step gives way if you linger
        box(F - 7, F - 5, y - 4, y - 4, d, conn.crumble ? 'C' : '#'); if (conn.crumble) stats.crumble += 3;
      } else if (conn.type === 'spring') {                       // a spring under the opening throws you up to the next floor
        put(F - 2, d, y - 1, 'u'); stats.springs++;
      } else if (conn.type === 'lift') {                         // a platform that rides up through the opening (or a zip mover that shoots up)
        conn.zip = zipPick();
        box(F - 3, F - 1, y - 1, y - 1, d, conn.zip ? 'z' : '='); box(F - 3, F - 3, yN, y - 2, d, '|'); if (conn.zip) stats.zips++; else stats.platforms++;
      } else if (EL.refills && Hf >= 8) put(F - 2, d, y - 5, 'o');

      if (SHAPE) {                                         // the ceiling hangs down in uneven lumps where the route allows
        var hang = ri(0, 2);
        for (t = 0; t <= e0 - 1 && t <= F - conn.W - 1; t++) {
          hang = Math.max(0, Math.min(4, hang + ri(-2, 2)));
          var kmax = Hf - 1 - need[t], k = Math.min(hang, kmax);
          for (var hr = yN + 1; hr <= yN + k; hr++) if (get(t, d, hr) === '.') put(t, d, hr, '#');
        }
      }
      backdrop(yN + 1, y - 1, off, F - 1);

      conn.Hf = Hf;
      plan.push({ y: y, d: d, obs: obs, conn: conn });
      y = yN; d = -d; Wprev = conn.W; prevType = conn.type; off = sh; floor++;
    }

    // Backdrop: dim brickwork behind the action (pillars and broken wall panels). It is scenery only.
    function backdrop(r0, r1, t0, t1) {
      if (!SHAPE || r1 - r0 < 3) return;
      var n = ri(2, 4), j, t, rw;
      for (j = 0; j < n; j++) {
        if (rnd() < 0.5) {                                 // a pillar from floor to ceiling
          var pt = ri(t0, t1), pw = ri(1, 2);
          for (t = pt; t < pt + pw && t <= t1; t++) for (rw = r0; rw <= r1; rw++) if (get(t, d, rw) === '.') put(t, d, rw, 'b');
        } else {                                           // a ragged panel hanging from the ceiling or rising from the floor
          var bw = ri(3, 7), bt = ri(t0, Math.max(t0, t1 - bw)), bh = ri(2, Math.max(2, r1 - r0 - 1)), fromTop = rnd() < 0.5;
          for (t = bt; t < bt + bw && t <= t1; t++) {
            var hh = Math.max(1, bh - ri(0, 2));
            for (var m = 0; m < hh; m++) { rw = fromTop ? r0 + m : r1 - m; if (rw >= r0 && rw <= r1 && get(t, d, rw) === '.') put(t, d, rw, 'b'); }
          }
        }
      }
    }

    return {
      plan: plan, stats: stats,
      room: { format: 1, id: 'auto-' + seed, name: 'Auto ' + seed, difficulty: D, world: WORLD || 1, grid: { cols: COLS, rows: ROWS, tile: 10 },
              tiles: g.map(function (row) { return row.join(''); }), entities: [], moves: opts.abilities ? abilitiesOf(opts) : undefined }
    };
  }
