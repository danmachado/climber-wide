  // ---- scenes: the painted backgrounds of the Brickyard, the Icehouse and the Furnace (wide, Oct 2026) ----
  // Built the way the Temple's ruins are: each world paints four depths, back to front, and drawSky asks for the
  // ones it wants. 'sky' (the gradient and what hangs in it), 'far' (the distant skyline), 'near' (the nearer
  // skyline), 'front' (the room's own back wall, broken open so the depths behind show through its holes). With
  // parallax on, sky, far and near are painted on their own layers and slide at their own rates; front stays with
  // the terrain. Without it (the builder, GAME BOY) all four go into one canvas and the picture is the same.
  // Value by depth, as in the Temple and Neon Row: the far skyline sits close to the sky's own value, each nearer
  // depth is a step darker, and the terrain is the brightest thing on screen. Light comes from the upper left (the
  // moon) in the Brickyard and the Icehouse, and from below (the lava) in the Furnace.
  // Everything is painted into pixel buffers (PB) and put down in one drawImage, once per room build. Nothing here
  // costs anything per frame. Art is original; inspiration only.
  var SCENES = {};
  function scRnd(seed, salt) {                             // one generator per depth, so the depths never disturb each other
    var s = ((Math.abs(seed) + salt * 7919) % 2147483646) + 1, R = {};
    R.r = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
    R.bt = function (a, c) { return a + Math.floor(R.r() * (c - a + 1)); };
    R.f = function (a, c) { return a + R.r() * (c - a); };
    R.pick = function (a) { return a[Math.floor(R.r() * a.length)]; };
    return R;
  }
  function scNoise(x, s) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return tileHash(i, s) * (1 - f) + tileHash(i + 1, s) * f; }   // smooth 1D value noise, 0..1
  // Pixel buffer: colours packed as RGBA bytes (little-endian Uint32), 0 is transparent.
  var SC_N = {};
  function scHex(c) { var n = SC_N[c]; if (n === undefined) n = SC_N[c] = parseInt(c.slice(1), 16); return n; }
  function pk(c) { var n = scHex(c); return ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; }
  function PB(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  PB.prototype.set = function (x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = pk(c); };
  PB.prototype.on = function (x, y) { x = Math.floor(x); y = Math.floor(y); return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] !== 0; };
  PB.prototype.rect = function (x, y, w, h, c) { var v = pk(c), x0 = Math.max(0, Math.floor(x)), x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h)); for (var yy = Math.max(0, Math.floor(y)); yy < y1; yy++) for (var xx = x0; xx < x1; xx++) this.d[yy * this.w + xx] = v; };
  PB.prototype.clear = function (x, y) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 0; };
  PB.prototype.mix = function (x, y, c, a) {               // lay a colour over what is there, a from 0 to 1
    x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    if (a > 1) a = 1;
    var i = y * this.w + x, d = this.d[i], da = (d >>> 24) / 255, n = scHex(c), sr = n >> 16, sg = (n >> 8) & 255, sb = n & 255;
    var oa = a + da * (1 - a), k = da * (1 - a);
    var r = Math.round((sr * a + (d & 255) * k) / oa), g = Math.round((sg * a + ((d >> 8) & 255) * k) / oa), bb = Math.round((sb * a + ((d >> 16) & 255) * k) / oa);
    this.d[i] = ((Math.round(oa * 255) << 24) | (bb << 16) | (g << 8) | r) >>> 0;
  };
  PB.prototype.oval = function (cx, cy, rx, ry, c, a) {
    for (var y = -ry; y <= ry; y++) { var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); for (var x = -hw; x < hw; x++) { if (a === undefined) this.set(cx + x, cy + y, c); else this.mix(cx + x, cy + y, c, a); } }
  };
  PB.prototype.line = function (x0, y0, x1, y1, c, a) {   // a one-pixel line
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 4000; n++) { if (a === undefined) this.set(x0, y0, c); else this.mix(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  };
  PB.prototype.glyph = function (x, y, g, s, c, a) { var rows = GLYPHS[g & 15].split('|'); for (var yy = 0; yy < 5; yy++) for (var xx = 0; xx < 3; xx++) if (rows[yy].charAt(xx) === '1') for (var q = 0; q < s * s; q++) this.mix(x + xx * s + (q % s), y + yy * s + Math.floor(q / s), c, a); };
  PB.prototype.put = function (b) { var cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.d.buffer), this.w, this.h), 0, 0); b.drawImage(cv, 0, 0); };
  function scLerp(a, c, t) { var n = scHex(a), m = scHex(c), q = Math.round(Math.max(0, Math.min(1, t)) * 8) / 8, k = a + c + q, v = SC_L[k]; if (v) return v; var r = Math.round((n >> 16) * (1 - q) + (m >> 16) * q), g = Math.round(((n >> 8) & 255) * (1 - q) + ((m >> 8) & 255) * q), bb = Math.round((n & 255) * (1 - q) + (m & 255) * q); return (SC_L[k] = '#' + ((1 << 24) | (r << 16) | (g << 8) | bb).toString(16).slice(1)); }   // eight steps between two colours
  var SC_L = {};
  function scGrad(b, w, h, stops) { var gr = b.createLinearGradient(0, 0, 0, h); for (var i = 0; i < stops.length; i++) gr.addColorStop(Math.min(1, Math.max(0, stops[i][0])), stops[i][1]); b.fillStyle = gr; b.fillRect(0, 0, w, h); }
  // stops: [t, colour] down the bottom screen-height of the layer (t 0 at its top, 1 at the bottom); above it, the first colour
  function scSky(b, w, h, h0, stops) { scGrad(b, w, h, [[0, stops[0][1]]].concat(stops.map(function (s) { return [(h - h0 + s[0] * h0) / h, s[1]]; }))); }
  function scMist(b, w, h, y0, rgb, a) { var gr = b.createLinearGradient(0, y0, 0, h); gr.addColorStop(0, 'rgba(' + rgb + ',0)'); gr.addColorStop(1, 'rgba(' + rgb + ',' + a + ')'); b.fillStyle = gr; b.fillRect(0, y0, w, h - y0); }
  // Holes in a back wall: lumpy blobs, one per band down the room, spread across it. F(x, y) > 0 inside a hole.
  function scHoles(R, w, h, n, rmin, rmax) {
    var out = [], off = R.r();
    for (var i = 0; i < n; i++) {
      var p1 = R.r() * 6.28, p2 = R.r() * 6.28, lump = new Float32Array(64);
      for (var k = 0; k < 64; k++) { var a = k * Math.PI / 32; lump[k] = 1 + 0.22 * Math.sin(a * 3 + p1) + 0.1 * Math.sin(a * 7 + p2); }
      var hx = Math.round(((off + i * 0.618 + R.r() * 0.3) % 1) * (w + 40) - 20);
      out.push([hx, Math.round((i + R.r()) * h / n), R.bt(rmin, rmax), R.bt(Math.round(rmin * 0.7), Math.round(rmax * 0.8)), lump]);
    }
    return out;
  }
  function scField(w, h, B) {
    var gw = (w >> 1) + 1, gh = (h >> 1) + 1, g = new Float32Array(gw * gh), gx, gy, i;
    for (gy = 0; gy < gh; gy++) for (gx = 0; gx < gw; gx++) {
      var x = gx * 2, y = gy * 2, best = -9;
      for (i = 0; i < B.length; i++) {
        var o = B[i], dx = (x - o[0]) / o[2], dy = (y - o[1]) / o[3], d2 = dx * dx + dy * dy;
        if (d2 > 4) continue;
        var ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy, da = ax + ay ? (dy >= 0 ? (dx >= 0 ? dy / (ax + ay) : 2 - dy / (ax + ay)) : (dx < 0 ? 2 - dy / (ax + ay) : 4 + dy / (ax + ay))) : 0;
        var d = Math.sqrt(d2) * o[4][(da * 16) & 63];
        if (1 - d > best) best = 1 - d;
      }
      g[gy * gw + gx] = best;
    }
    return function (x, y) { x = x < 0 ? 0 : (x >= w ? w - 1 : x); y = y < 0 ? 0 : (y >= h ? h - 1 : y); return g[(y >> 1) * gw + (x >> 1)]; };
  }
  // Does a piece of wall at (x, y), part of a unit (a brick, a girder section) centred at (ux, uy), survive the holes?
  // Whole units fall out inside a hole, units on its rim break raggedly; bonus below zero makes a unit sturdier.
  function scGone(F, x, y, ux, uy, bonus) { var fu = F(ux, uy) + bonus; return fu > 0.1 || (fu > -0.3 && F(x, y) + bonus + (tileHash(x >> 1, (y >> 1) + 977) - 0.5) * 0.3 > 0.02); }
  function scHoleCount(w, h) { return Math.max(3, Math.round(4.2 * (w * h) / (480 * 270))); }
  // The edge pass for a broken wall in mask m: lit tops, the cut face under them, dark undersides, side faces, and a
  // short cast shadow on whatever shows through below a broken course. E: { hi, cut, lo, side, shadow (rgb), sh }
  function scEdges(p, m, w, h, E) {
    var x, y, i, sv = E.shadow ? scHex(E.shadow) : 0, SH = E.sh || [0, 110, 70, 40, 18];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (m[i]) {
        if (!p.d[i]) continue;                                // a gap that counts as wall (a missing window pane)
        if (E.hi && y > 0 && !m[i - w]) p.d[i] = pk(E.hi);
        else if (E.cut && ((y > 1 && !m[i - 2 * w]) || (y > 2 && !m[i - 3 * w]))) p.d[i] = pk(E.cut);
        else if (E.lo && y < h - 1 && !m[i + w]) p.d[i] = pk(E.lo);
        else if (E.side && ((x > 0 && !m[i - 1]) || (x < w - 1 && !m[i + 1]))) p.d[i] = pk(E.side);
      } else if (E.shadow && !p.d[i]) {
        for (var d = 1; d <= 4 && y - d >= 0; d++) if (m[i - d * w]) { p.d[i] = ((SH[d] << 24) | ((sv & 255) << 16) | (sv & 0xff00) | (sv >> 16)) >>> 0; break; }
      }
    }
  }
  function scWall(m, w, h, x, y) { return x >= 0 && x < w && y >= 0 && y < h && m[y * w + x] === 1; }
  // A hanging strand (vine, ivy, chain) from (x0, y0) down len pixels; L: [stem, leaf, leaf lit]
  function scVine(p, R, L, x0, y0, len, leafy) {
    var ph = R.r() * 6.28, amp = R.r() < 0.5 ? 1 : 1.6, side = R.r() < 0.5 ? -1 : 1, t;
    for (t = 0; t < len; t++) {
      var xx = x0 + Math.round(Math.sin(ph + t / 5) * amp), yy = y0 + t;
      p.set(xx, yy, L[0]);
      if (leafy && t > 1 && t % 3 === 0) { side = -side; p.set(xx + side, yy, L[1]); if (R.r() < 0.6) p.set(xx + side * 2, yy - 1, L[2]); }
    }
  }
  function scChain(p, x, y0, len, C) { for (var t = 0; t < len; t++) { var k = t % 4; p.set(x + (k === 1 ? -1 : (k === 3 ? 1 : 0)), y0 + t, k === 0 ? C[1] : C[0]); } p.set(x, y0 + len, C[0]); p.set(x + 1, y0 + len + 1, C[1]); p.set(x + 1, y0 + len + 2, C[0]); p.set(x, y0 + len + 3, C[0]); p.set(x - 1, y0 + len + 2, C[0]); }   // links, then a hook
  // A sagging wire from (x0, y0) to (x1, y1)
  function scWire(p, x0, y0, x1, y1, sag, c) { for (var x = Math.round(x0); x <= x1; x++) { var t = (x - x0) / Math.max(1, x1 - x0); p.set(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), c); } }
  function sceneSky(b, w, h, h0, seed, kind, D) {           // drawSky hands a scene world over to here
    var S = SCENES[kind], k, order = ['sky', 'far', 'near', 'front'];
    w = Math.floor(w); h = Math.floor(h);                   // a parallax layer's size can be fractional
    for (k = 0; k < order.length; k++) if (D(order[k]) && S[order[k]]) S[order[k]](b, w, h, h0, scRnd(seed, k + 1), S.P);
  }

  // ==== Brickyard: an old brickworks at night under a big moon ====
  // sky: deep indigo to a dusky violet glow at the horizon, stars, the moon with a halo, thin strata clouds lit on top.
  // far: the works' skyline in pale haze: sawtooth sheds with glazed north lights, blocks, smokestacks with smoke
  // drifting off them, a gas holder in its frame, a water tower, a crane. near: brick warehouses a step darker:
  // arched windows (a few lit warm, a few broken through), loading doors with a lamp, fire escapes, painted signs,
  // water tanks and chimneys, a railway viaduct on arches, telegraph poles and their wires. front: the factory we are
  // in, its back wall of small bricks knocked through: cast iron columns and riveted girders stand across the
  // holes, big arched windows with iron glazing bars and missing panes, a pipe run, chains and a hanging lamp.
  SCENES.yard = {
    P: {
      sky: [[0, '#070a1c'], [0.45, '#141a48'], [0.8, '#2f2f6e'], [1, '#4a3c78']], star: '#cdd2ff',
      moon: ['#f1efff', '#d3d1f4', '#b9b6e6'], halo: '205,200,255', cloud: ['#2b2f6a', '#5a5aa6', '#1e2256'],
      far: { body: '#323a84', hi: '#434d9e', lo: '#2a3176', glass: '#3e4896', win: '#d89a4a', red: '#ff5a4a', smoke: '#6a6eae', back: '#3a3f88', backHi: '#474d98', backWin: '#8a7a9a' }, farMist: '74,70,140',
      near: { body: ['#232a6c', '#262d72', '#20276a'], mortar: '#1c2260', hi: '#353e8c', lo: '#181e56', edge: '#2f378a', pane: '#141944', paneHi: '#2b3378',
              lit: '#ffb74a', litHi: '#ffe0a0', litBar: '#a86424', iron: '#10143a', sign: '#5a62b0', wood: '#3a2f52', woodHi: '#4e4268', street: '255,170,90' },
      wall: { brick: ['#1c2260', '#1f2566', '#1a205a', '#21286a'], burnt: '#161b50', light: '#272e74', mortar: '#13184a', soot: '#121644',
              hi: '#4853a8', cut: '#2b3278', lo: '#0c1032', side: '#232a6a', shadow: '#05071a',
              iron: '#2c3162', ironMid: '#3a4078', ironHi: '#5a62a2', ironLo: '#181b3e', web: '#22264e', rivet: '#6a72b0',
              plaster: '#272e70', plasterLo: '#242a68', plasterEdge: '#1a1f56', beam: '#9aa2ff', frame: '#1a1d40', glass: '#2a3170', glassDark: '#11163e', glassHi: '#4a54a0',
              sill: '#343c84', sillHi: '#4f58aa', pipe: ['#3c3f6c', '#5a5e94', '#262947'], valve: '#9a4a3a', valveHi: '#d0705a',
              chain: ['#2a2e58', '#4a4f86'], moss: ['#2f5f46', '#3f7a5a', '#5f9a74'], lampShade: '#2a2e58', lampHi: '#50568e', bulb: '#ffe6a8', paint: '#4a52a0' }
    },
    sky: function (b, w, h, h0, R, P) {
      scSky(b, w, h, h0, P.sky);
      var p = new PB(w, h), i, x, y, hz = h - h0 * 0.3;
      for (i = 0; i < 170 * w * h / (480 * 270); i++) {   // stars, thinning toward the glow
        x = R.bt(0, w - 1); y = Math.floor(Math.pow(R.r(), 1.3) * hz); var br = R.r();
        p.mix(x, y, P.star, (0.2 + br * 0.55) * (1 - y / hz * 0.6));
        if (br > 0.95) { p.mix(x - 1, y, P.star, 0.25); p.mix(x + 1, y, P.star, 0.25); p.mix(x, y - 1, P.star, 0.25); p.mix(x, y + 1, P.star, 0.25); }
      }
      p.put(b);
      var mr = R.bt(10, 13), mx = R.bt(40, w - 40), my = Math.round(h - h0 + R.bt(34, 64));
      drawGlow(b, mx, my, mr * 7, P.halo, 0.16); drawGlow(b, mx, my, mr * 2.4, P.halo, 0.28);
      var q = new PB(w, h), blobs = [];
      for (i = 0; i < 4; i++) blobs.push([R.f(-0.5, 0.5) * mr, R.f(-0.5, 0.5) * mr, R.f(0.22, 0.42) * mr]);
      for (y = -mr; y <= mr; y++) for (x = -mr; x <= mr; x++) {
        var d = Math.sqrt(x * x + y * y); if (d > mr - 0.3) continue;
        var c = P.moon[0];
        for (i = 0; i < blobs.length; i++) { var bx = x - blobs[i][0], by = y - blobs[i][1]; if (bx * bx + by * by < blobs[i][2] * blobs[i][2]) c = P.moon[1]; }
        if (d > mr - 1.6 || x + y > mr * 1.05) c = c === P.moon[1] ? P.moon[2] : P.moon[1];   // the limb, and a soft shade to the lower right
        q.set(mx + x, my + y, c);
      }
      for (i = 0; i < 3; i++) { var a = R.r() * 6.28, rr = R.r() * mr * 0.6; q.set(mx + Math.cos(a) * rr, my + Math.sin(a) * rr, P.moon[2]); }
      // strata clouds: a few long thin decks, the top edge lit by the moon (more so close to it)
      var cm = new Uint8Array(w * h), n = R.bt(3, 5) * Math.max(1, Math.round(h / 300));
      for (i = 0; i < n; i++) {                           // each deck: a row of flattened lumps, thicker in the middle
        var cy = Math.round(h - h0 * R.f(0.4, 0.95)), cx = R.bt(-60, w - 40), nl = R.bt(4, 9);
        for (var k = 0; k < nl; k++) {
          var e = 1 - Math.abs(k - nl / 2) / (nl / 2 + 1), lx0 = cx + k * R.bt(10, 18), ly0 = cy + R.bt(-1, 2) - Math.round(e * 2), rx2 = R.bt(10, 22), ry2 = Math.max(1, Math.round(R.bt(2, 4) * (0.5 + e)));
          for (y = -ry2; y <= ry2; y++) { var hw = Math.round(rx2 * Math.sqrt(Math.max(0, 1 - (y * y) / (ry2 * ry2)))); for (x = -hw; x < hw; x++) { var qx = lx0 + x, qy = ly0 + y; if (qx >= 0 && qx < w && qy >= 0 && qy < h) cm[qy * w + qx] = 1; } }
        }
      }
      for (y = 1; y < h - 1; y++) for (x = 0; x < w; x++) {
        if (!cm[y * w + x]) continue;
        var near = Math.max(0, 1 - Math.hypot(x - mx, y - my) / 110);
        if (!cm[(y - 1) * w + x]) q.mix(x, y, P.cloud[1], 0.45 + near * 0.5);
        else if (!cm[(y + 1) * w + x]) q.mix(x, y, P.cloud[2], 0.55);
        else q.mix(x, y, P.cloud[0], 0.6 + near * 0.2);
      }
      q.put(b);
    },
    far: function (b, w, h, h0, R, P) {
      var C = P.far, p = new PB(w, h), x, y, i, stacks = [], tops = [];
      function vrun(x, y0, y1, c) { for (var yy = Math.max(0, Math.floor(y0)); yy < Math.min(h, y1); yy++) p.set(x, yy, c); }
      for (x = -R.bt(0, 20); x < w;) {                      // the town beyond the works: a paler row of blocks and roofs, a few lights
        var bw0 = R.bt(14, 40), bh0 = Math.round(h0 * R.f(0.26, 0.5)), gab = R.r() < 0.3;
        for (var dx0 = 0; dx0 < bw0; dx0++) { var gt = gab ? Math.round(Math.min(dx0, bw0 - 1 - dx0) * 0.6) : 0; vrun(x + dx0, h - bh0 - gt, h, C.back); if (!gab || dx0 < bw0 / 2) p.set(x + dx0, h - bh0 - gt, C.backHi); }
        for (i = 0; i < bw0 * bh0 / 120; i++) if (R.r() < 0.5) p.set(x + R.bt(2, bw0 - 3), h - R.bt(4, bh0 - 3), C.backWin);
        x += bw0 + R.bt(0, 3);
      }
      // smokestacks and a crane stand behind the sheds
      var ns = R.bt(2, 4);
      for (i = 0; i < ns; i++) {
        var sx = Math.round((i + R.f(0.15, 0.85)) * w / ns), sh = Math.round(h0 * R.f(0.55, 0.9)), wb = R.bt(6, 8), wt = wb - 2;
        for (y = 0; y < sh; y++) { var ww = Math.round(wb - (wb - wt) * y / sh), x0 = sx - (ww >> 1); for (x = 0; x < ww; x++) p.set(x0 + x, h - 1 - y, x === 0 ? C.hi : (x === ww - 1 ? C.lo : C.body)); }
        var ty = h - sh; p.rect(sx - (wt >> 1) - 1, ty - 2, wt + 2, 2, C.lo); p.rect(sx - (wt >> 1) - 1, ty - 2, wt + 2, 1, C.hi);
        p.rect(sx - (wt >> 1), ty + 6, wt, 1, C.hi); p.rect(sx - (wt >> 1), ty + 9, wt, 1, C.hi);
        if (R.r() < 0.6) { p.set(sx, ty - 3, C.red); stacks.push([sx, ty - 3, true]); } else stacks.push([sx, ty - 2, false]);
      }
      if (R.r() < 0.7) {                                    // a lattice crane
        var kx = R.bt(40, w - 40), kh = Math.round(h0 * R.f(0.55, 0.75)), jl = R.bt(40, 70), dir = R.r() < 0.5 ? -1 : 1, kt = h - kh;
        for (y = kt; y < h; y++) { p.set(kx, y, C.body); p.set(kx + 3, y, C.lo); if ((y - kt) % 6 === 0) p.line(kx, y, kx + 3, y + 5, C.body); }
        for (x = 0; x < jl; x++) { var jx = kx + 1 + dir * x; p.set(jx, kt + 1, C.hi); p.set(jx, kt + 4, C.body); if (x % 5 === 0) p.line(jx, kt + 1, jx + dir * 4, kt + 4, C.body); }
        for (x = 0; x < 14; x++) p.set(kx + 1 - dir * x, kt + 3, C.body); p.rect(dir > 0 ? kx - 13 : kx + 9, kt + 4, 6, 4, C.lo);
        p.line(kx + 1, kt - 8, kx + 1 + dir * (jl - 2), kt + 1, C.body); p.line(kx + 1, kt - 8, kx + 1 - dir * 12, kt + 3, C.body); vrun(kx + 1, kt - 8, kt, C.body);
        var hx = kx + 1 + dir * R.bt(15, jl - 4); vrun(hx, kt + 5, kt + 5 + R.bt(10, 40), C.lo);
      }
      // the works: sheds, blocks, a gas holder, a water tower
      x = -R.bt(0, 20);
      while (x < w) {
        var t = R.r(), sw;
        if (t < 0.35) {                                    // a sawtooth shed: slope up, then a glazed north light straight down
          sw = R.bt(40, 90); var bh = Math.round(h0 * R.f(0.13, 0.24)), tp = R.bt(8, 11), tr = R.bt(4, 6);
          for (var dx = 0; dx < sw; dx++) {
            var ph = dx % tp, rise = Math.round(ph * tr / (tp - 1)), top = h - bh - rise;
            vrun(x + dx, top, h, ph === tp - 1 ? C.lo : C.body);
            p.set(x + dx, top, C.hi);
            if (ph === tp - 1) for (y = top + 1; y < h - bh; y++) p.set(x + dx, y, (y + dx) % 3 ? C.glass : C.win);
          }
          for (i = 0; i < sw / 10; i++) if (R.r() < 0.3) p.set(x + R.bt(1, sw - 2), h - R.bt(3, bh - 2), C.win);
        } else if (t < 0.6) {                              // a plain block with rows of small windows
          sw = R.bt(18, 40); var bh2 = Math.round(h0 * R.f(0.22, 0.44));
          for (var dx2 = 0; dx2 < sw; dx2++) vrun(x + dx2, h - bh2, h, dx2 === 0 ? C.hi : C.body);
          p.rect(x, h - bh2, sw, 1, C.hi); if (R.r() < 0.5) { p.rect(x + 3, h - bh2 - 4, R.bt(4, 9), 4, C.body); p.rect(x + 3, h - bh2 - 4, 4, 1, C.hi); }
          var lit = R.r() < 0.4;
          for (y = h - bh2 + 4; y < h - 3; y += 5) { if (R.r() < 0.3) lit = !lit; for (var wx = x + 2; wx < x + sw - 2; wx += 4) { if (lit && R.r() < 0.7) p.set(wx, y, C.win); else p.set(wx, y, C.lo); } }
        } else if (t < 0.75) {                             // a gas holder: a bell in a frame of posts and rings
          sw = R.bt(34, 52); var gh = Math.round(h0 * R.f(0.18, 0.3)), bell = Math.round(gh * R.f(0.55, 0.9));
          for (var dx3 = 0; dx3 < sw; dx3++) { var e = Math.abs(dx3 - sw / 2) / (sw / 2); vrun(x + dx3, h - bell + Math.round(e * e * 3), h, dx3 < sw / 3 ? C.hi : C.body); }
          for (var pxx = 0; pxx <= sw; pxx += 7) vrun(x + pxx, h - gh - 2, h, C.lo);
          for (y = h - gh; y < h; y += 7) for (var rx = 0; rx <= sw; rx++) p.set(x + rx, y, C.lo);
          p.rect(x, h - gh - 2, sw + 1, 1, C.hi);
        } else if (t < 0.85) {                             // a water tower on legs
          sw = R.bt(14, 20); var lh = R.bt(16, 30), tb = h - lh;
          p.rect(x + 2, tb - 10, sw - 4, 10, C.body); p.rect(x + 2, tb - 10, 2, 10, C.hi); for (var cr = 0; cr < 4; cr++) p.rect(x + 3 + cr, tb - 14 + cr, sw - 6 - cr * 2, 1, cr ? C.body : C.hi);
          vrun(x + 3, tb, h, C.body); vrun(x + sw - 4, tb, h, C.lo); p.line(x + 3, tb, x + sw - 4, tb + lh / 2, C.lo); p.line(x + sw - 4, tb, x + 3, tb + lh / 2, C.lo);
        } else { sw = R.bt(4, 14); }                       // a gap
        x += sw + R.bt(0, 4);
      }
      // smoke drifting off the stacks, all one way
      var wind = R.r() < 0.5 ? -1 : 1;
      for (i = 0; i < stacks.length; i++) {
        var s0 = stacks[i], N = R.bt(14, 24);
        for (var k = 1; k < N; k++) { var cx = s0[0] + wind * (k * 1.6 + k * k * 0.12), cy = s0[1] - 2 - k * 2.4 + k * k * 0.04, r = 1.5 + k * 0.5; p.oval(Math.round(cx), Math.round(cy), Math.round(r * 1.4), Math.round(r), C.smoke, 0.16 * (1 - k / N)); }
      }
      p.put(b);
      for (i = 0; i < stacks.length; i++) if (stacks[i][2]) drawGlow(b, stacks[i][0] + 0.5, stacks[i][1] + 0.5, 5, '255,90,74', 0.4);
      scMist(b, w, h, h - h0 * 0.3, P.farMist, 0.5);
    },
    near: function (b, w, h, h0, R, P) {
      var N = P.near, p = new PB(w, h), x, y, i, glows = [], blds = [];
      x = -R.bt(0, 30);
      while (x < w) {
        var bw = R.bt(44, 110), bh = Math.round(h0 * R.f(0.3, 0.66)), top = h - bh, body = R.pick(N.body), roof = R.r();
        // brick face: a darker mortar course every third row, joints staggered
        for (y = top; y < h; y++) for (var dx = 0; dx < bw; dx++) {
          var yy = y - top, c = body;
          if (yy % 3 === 2) c = N.mortar; else if ((dx + (Math.floor(yy / 3) % 2) * 3) % 6 === 0) c = N.mortar;
          if (dx === 0) c = N.edge; else if (dx === bw - 1) c = N.lo;
          p.set(x + dx, y, c);
        }
        if (roof < 0.4) {                                  // a gable with a lit verge
          var gh = Math.min(18, Math.round(bw / 4));
          for (var gy = 1; gy <= gh; gy++) { var inset = Math.round(gy * (bw / 2) / gh); for (var gx = inset; gx < bw - inset; gx++) p.set(x + gx, top - gy, body); p.set(x + inset, top - gy, N.hi); p.set(x + inset + 1, top - gy, N.hi); p.set(x + bw - inset - 1, top - gy, N.lo); }
          if (bw > 50) { var ox = x + Math.round(bw / 2) - 2, oy = top - Math.round(gh / 2) - 2; p.oval(ox + 2, oy + 2, 3, 3, N.pane); p.set(ox + 1, oy + 1, N.paneHi); }   // a round window in the gable
          if (R.r() < 0.5) { var chx = x + R.bt(6, bw - 10), cht = R.bt(8, 14); p.rect(chx, top - Math.round(gh * 0.6) - cht, 5, cht + 4, body); p.rect(chx - 1, top - Math.round(gh * 0.6) - cht, 7, 2, N.hi); }
        } else {                                           // a flat roof: a coping, a cornice, maybe a water tank
          p.rect(x - 1, top - 1, bw + 2, 1, N.hi); p.rect(x - 1, top, bw + 2, 1, N.lo);
          if (R.r() < 0.55) {
            var tx = x + R.bt(4, Math.max(4, bw - 20)), tw = R.bt(10, 14), tl = R.bt(6, 10), tt = top - tl - 9;
            for (i = 0; i < 9; i++) p.rect(tx, tt + i, tw, 1, i === 0 ? N.woodHi : (i % 3 === 2 ? N.iron : N.wood));
            for (i = 0; i < 4; i++) p.rect(tx + 1 + i, tt - 4 + i, tw - 2 - i * 2, 1, i ? N.wood : N.woodHi);
            p.rect(tx, tt, 1, 9, N.woodHi);
            for (y = tt + 9; y < top; y++) { p.set(tx + 1, y, N.iron); p.set(tx + tw - 2, y, N.iron); }
            p.line(tx + 1, tt + 9, tx + tw - 2, top - 1, N.iron);
          }
          if (R.r() < 0.4) { var cx2 = x + R.bt(4, bw - 8), ch2 = R.bt(6, 12); p.rect(cx2, top - ch2, 5, ch2, body); p.rect(cx2 - 1, top - ch2, 7, 1, N.hi); }
        }
        // arched windows in storeys; lit ones come in runs, some are broken through, some boarded up
        var sto = 15, wsp = R.bt(10, 13), lit = R.r() < 0.25, m0 = 5;
        for (var fy = top + 6; fy + 10 < h - 14; fy += sto) {
          if (R.r() < 0.35) lit = R.r() < 0.3;
          for (var fx = x + m0; fx + 6 < x + bw - m0 + 1; fx += wsp) {
            var st = R.r(), state = lit && st < 0.75 ? 'lit' : (st < 0.08 ? 'broken' : (st < 0.13 ? 'board' : 'dark'));
            for (y = 0; y < 9; y++) for (var wx = 0; wx < 5; wx++) {
              if (y === 0 && (wx === 0 || wx === 4)) continue;
              var px = fx + wx, py = fy + y;
              if (state === 'broken') { p.clear(px, py); continue; }
              if (state === 'lit') p.set(px, py, wx === 2 || y === 4 ? N.litBar : (y < 3 ? N.litHi : N.lit));
              else if (state === 'board') p.set(px, py, (y % 3 === 1) ? N.woodHi : N.wood);
              else p.set(px, py, wx === 0 && y < 4 ? N.paneHi : N.pane);
            }
            p.rect(fx - 1, fy + 9, 7, 1, N.hi);
            if (state === 'lit') glows.push([fx + 2.5, fy + 4, 9, 0.16]);
          }
        }
        // the ground floor: a loading door with a lamp over it
        if (bw > 40) {
          var dw = R.bt(10, 16), dh = R.bt(11, 14), dxx = x + R.bt(4, bw - dw - 4);
          p.rect(dxx - 1, h - dh - 1, dw + 2, 1, N.hi);
          for (y = h - dh; y < h; y++) for (var ddx = 0; ddx < dw; ddx++) p.set(dxx + ddx, y, ddx % 3 === 0 ? N.lo : N.iron);
          if (R.r() < 0.7) { p.rect(dxx + (dw >> 1) - 1, h - dh - 4, 3, 1, N.iron); p.rect(dxx + (dw >> 1) - 1, h - dh - 3, 3, 1, N.litHi); glows.push([dxx + (dw >> 1) + 0.5, h - dh - 2, 16, 0.3]); }
        }
        // a fire escape down one side
        if (bw > 60 && R.r() < 0.45) {
          var ex = R.r() < 0.5 ? x + 3 : x + bw - 19;
          for (var ey = top + 14; ey < h - 16; ey += sto) {
            p.rect(ex, ey, 16, 1, N.iron); for (i = 0; i < 16; i += 3) p.set(ex + i, ey - 1, N.iron); p.rect(ex, ey - 3, 16, 1, N.iron);
            if (ey + sto < h - 16) p.line(((ey - top) / sto) % 2 ? ex + 2 : ex + 13, ey + 1, ((ey - top) / sto) % 2 ? ex + 13 : ex + 2, ey + sto - 1, N.iron);
          }
        }
        // a painted sign, faded, high on a blank stretch
        if (bw > 60 && R.r() < 0.3) {
          var sx = x + R.bt(4, bw - 46), sy = top + 3;
          for (y = sy; y < sy + 13; y++) for (i = 0; i < 42; i++) p.mix(sx + i, y, N.mortar, 0.5);
          for (i = 0; i < 6; i++) p.glyph(sx + 3 + i * 6 + (i > 2 ? 2 : 0), sy + 4, R.bt(0, 15), 1, N.sign, 0.55);
          for (i = 0; i < 42; i++) { p.mix(sx + i, sy + 1, N.sign, 0.35); p.mix(sx + i, sy + 11, N.sign, 0.35); }
        }
        blds.push([x, bw]);
        x += bw + R.bt(6, 22);
      }
      // a railway viaduct on brick arches across part of the street
      if (R.r() < 0.6) {
        var vx = R.bt(-40, w - 160), vw = R.bt(150, 280), dy0 = Math.round(h - h0 * R.f(0.24, 0.34)), sp = R.bt(34, 44), pw = 8, VB = N.body[2];
        for (y = dy0; y < h; y++) for (x = vx; x < vx + vw; x++) {
          var k = ((x - vx) % sp + sp) % sp, inArch = false;
          if (k >= pw && y > dy0 + 8) { var ax = (k - pw) - (sp - pw) / 2, ar = (sp - pw) / 2, ay = y - (dy0 + 8 + ar); inArch = ay > 0 || ax * ax + ay * ay < ar * ar; }
          if (inArch) continue;
          var vc = y < dy0 + 2 ? N.hi : ((y - dy0) % 3 === 2 ? N.mortar : VB);
          if (k === 0 && y > dy0 + 2) vc = N.edge;
          p.set(x, y, vc);
        }
        for (x = vx; x < vx + vw; x++) { if ((x - vx) % 4 === 0) p.set(x, dy0 - 1, N.iron); p.set(x, dy0 - 3, N.iron); }
        var sgx = vx + R.bt(20, vw - 20); for (y = dy0 - 14; y < dy0; y++) p.set(sgx, y, N.iron); p.rect(sgx - 1, dy0 - 16, 3, 3, N.iron); p.set(sgx, dy0 - 15, R.r() < 0.5 ? '#ff5a4a' : '#5aff9a');
        glows.push([sgx + 0.5, dy0 - 14.5, 6, 0.4]);
      }
      // telegraph poles and their wires
      var poles = [], ppx = R.bt(10, 60);
      while (ppx < w + 40) { poles.push([ppx, h - Math.round(h0 * R.f(0.3, 0.42))]); ppx += R.bt(90, 150); }
      for (i = 0; i < poles.length; i++) {
        var pp = poles[i]; for (y = pp[1]; y < h; y++) p.set(pp[0], y, N.iron);
        p.rect(pp[0] - 4, pp[1] + 2, 9, 1, N.iron); p.rect(pp[0] - 3, pp[1] + 6, 7, 1, N.iron); p.set(pp[0] - 4, pp[1] + 1, N.hi); p.set(pp[0] + 4, pp[1] + 1, N.hi);
        if (i) { var q0 = poles[i - 1]; scWire(p, q0[0] - 4, q0[1] + 2, pp[0] - 4, pp[1] + 2, 7, N.iron); scWire(p, q0[0] + 4, q0[1] + 2, pp[0] + 4, pp[1] + 2, 8, N.iron); scWire(p, q0[0] - 3, q0[1] + 6, pp[0] + 3, pp[1] + 6, 6, N.iron); }
      }
      p.put(b);
      for (i = 0; i + 1 < blds.length; i++) { var gx2 = blds[i][0] + blds[i][1], gw2 = blds[i + 1][0] - gx2; drawGlow(b, gx2 + gw2 / 2, h, 16 + gw2, N.street, 0.22); }
      for (i = 0; i < glows.length; i++) drawGlow(b, glows[i][0], glows[i][1], glows[i][2], '255,183,74', glows[i][3]);
    },
    front: function (b, w, h, h0, R, P) {
      var Wc = P.wall, p = new PB(w, h), m = new Uint8Array(w * h), x, y, i;
      var F = scField(w, h, scHoles(R, w, h, scHoleCount(w, h) + 1, 46, 104));
      var PL = scField(w, h, scHoles(R, w, h, scHoleCount(w, h) + 2, 30, 70));   // patches where the old plaster still hangs on
      // the frame: cast iron columns and riveted girders, arched windows in some bays
      var cols = [], girds = [], wins = [];
      for (x = R.bt(14, 70); x < w - 6; x += R.bt(100, 150)) cols.push(x);
      for (y = R.bt(24, 60); y < h - 30; y += R.bt(92, 130)) girds.push(y);
      var colAt = new Int8Array(w).fill(-1), girAt = new Int8Array(h).fill(-1), CW = 10, GH = 9;
      for (i = 0; i < cols.length; i++) for (x = 0; x < CW; x++) if (cols[i] + x < w) colAt[cols[i] + x] = x;
      for (i = 0; i < girds.length; i++) for (y = 0; y < GH; y++) if (girds[i] + y < h) girAt[girds[i] + y] = y;
      var xs = [-20].concat(cols, [w + 20]), ys = [-10].concat(girds, [h + 10]);
      for (var bx = 0; bx + 1 < xs.length; bx++) for (var by = 0; by + 1 < ys.length; by++) {
        var bay = xs[bx + 1] - xs[bx] - CW, sto = ys[by + 1] - ys[by] - GH;
        if (bay < 40 || sto < 60 || R.r() > 0.55) continue;
        var ww = Math.min(bay - 18, R.bt(28, 42)), wh = Math.min(sto - 22, R.bt(44, 66)), wx0 = xs[bx] + CW + Math.round((bay - ww) / 2), wy0 = ys[by] + GH + Math.round((sto - wh) / 2) - 2;
        wins.push({ x: wx0, y: wy0, w: ww, h: wh, r: ww / 2, gx: R.bt(5, 7), gy: R.bt(6, 8), seed: R.bt(0, 9999) });
      }
      function inWin(o, x, y, pad) { if (x < o.x - pad || x >= o.x + o.w + pad || y >= o.y + o.h + pad) return false; var ay = y - (o.y + o.r); if (ay >= 0) return true; var ax = x - (o.x + o.w / 2 - 0.5); return ax * ax + ay * ay < (o.r + pad) * (o.r + pad); }
      var hasLamp = [];
      for (y = 0; y < h; y++) {
        var cr = Math.floor(y / 4), yy = y - cr * 4, off = (cr % 2) * 4;
        for (x = 0; x < w; x++) {
          var gi = girAt[y], ci = colAt[x], c, ux, uy, bonus = 0, win = null;
          for (i = 0; i < wins.length; i++) if (inWin(wins[i], x, y, 3)) { win = wins[i]; break; }
          if (gi >= 0) {                                   // a girder: lit top flange, a riveted web, a dark bottom flange
            ux = (x >> 4 << 4) + 8; uy = y - gi + 4; bonus = -0.6;
            c = [Wc.ironHi, Wc.iron, Wc.iron, Wc.ironLo, Wc.web, Wc.web, Wc.ironLo, Wc.iron, Wc.ironLo][gi];
            if ((gi === 1 || gi === 7) && x % 5 === 2) c = Wc.rivet;
          } else if (ci >= 0) {                            // a column: lit on the left, a fluted shaft, a capital under each girder
            ux = x - ci + 5; uy = (y >> 4 << 4) + 8; bonus = -0.45;
            c = ci === 0 ? Wc.ironHi : (ci === 1 ? Wc.ironMid : (ci >= CW - 2 ? Wc.ironLo : (ci === 4 || ci === 6 ? Wc.ironLo : Wc.iron)));
            for (i = 0; i < girds.length; i++) { var dg = y - (girds[i] + GH), du = girds[i] - 1 - y; if ((dg >= 0 && dg < 4) || (du >= 0 && du < 3)) c = dg === 0 || du === 0 ? Wc.ironLo : (ci === 0 ? Wc.ironHi : Wc.iron); }
          } else if (win) {                                // an arched window: brick ring, sill, iron frame, glazing bars, panes
            ux = win.x + win.w / 2; uy = win.y + win.h / 2; bonus = -0.15;
            if (!inWin(win, x, y, 0)) c = y >= win.y + win.h ? (y === win.y + win.h ? Wc.sillHi : Wc.sill) : (((x * 7 + y * 3) % 9) ? Wc.light : Wc.mortar);
            else if (!inWin(win, x, y, -1)) c = Wc.frame;
            else if ((x - win.x) % win.gx === 0 || (y - win.y - win.r) % win.gy === 0 && y > win.y + win.r) c = Wc.frame;
            else {
              var pane = tileHash(Math.floor((x - win.x) / win.gx) + win.seed, Math.floor((y - win.y) / win.gy) + 7);
              if (pane < 0.45) { if (!scGone(F, x, y, ux, uy, bonus)) m[y * w + x] = 1; continue; }   // a missing pane: the night shows through
              c = pane < 0.8 ? Wc.glass : Wc.glassDark;
              if ((x + y) % 11 === 0 && pane < 0.8) c = Wc.glassHi;
            }
          } else {                                         // brick, 7 by 3, in running bond
            var bx2 = Math.floor((x + off) / 8), bi = (x + off) % 8; ux = bx2 * 8 - off + 4; uy = cr * 4 + 1;
            var pl = PL(x, y) + (tileHash(x, y + 401) - 0.5) * 0.14;
            if (pl > 0.05) {                               // old plaster: flat, a little mottled, a hairline crack here and there
              c = scNoise(x / 9 + scNoise(y / 7, 3) * 2, 4) > 0.62 ? Wc.plasterLo : Wc.plaster;
              if (pl < 0.09) c = Wc.plasterEdge;
              if (tileHash(x >> 2, y + 9) < 0.004) c = Wc.mortar;
              ux = x; uy = y;
            } else if (yy === 3 || bi === 0) c = Wc.mortar;
            else { var bh2 = tileHash(bx2, cr + 31); c = bh2 < 0.06 ? Wc.burnt : (bh2 > 0.96 ? Wc.light : Wc.brick[Math.floor(bh2 * 4) & 3]); if (yy === 0 && bh2 > 0.5) c = Wc.light; }
          }
          if (scGone(F, x, y, ux, uy, bonus)) continue;
          m[y * w + x] = 1; p.set(x, y, c);
        }
      }
      // soot under each girder, and water stains running down from it
      for (i = 0; i < girds.length; i++) for (x = 0; x < w; x++) {
        if (colAt[x] >= 0) continue;
        for (y = girds[i] + GH; y < girds[i] + GH + 12; y++) if (scWall(m, w, h, x, y) && p.d[y * w + x]) p.mix(x, y, Wc.soot, 0.5 * (1 - (y - girds[i] - GH) / 12));
        if (tileHash(x, girds[i]) < 0.06) { var sl = R.bt(8, 40); for (y = girds[i] + GH; y < girds[i] + GH + sl; y++) if (scWall(m, w, h, x, y) && p.d[y * w + x]) p.mix(x, y, Wc.soot, 0.55 * (1 - (y - girds[i] - GH) / sl)); }
      }
      // moonlight falling through the windows onto the wall, down and to the right
      for (i = 0; i < wins.length; i++) {
        var o = wins[i], L = R.bt(70, 130);
        for (var tt = 0; tt < L; tt++) for (var ss = 0; ss < o.w; ss += 1) {
          var bxx = Math.round(o.x + ss + tt * 0.7), byy = Math.round(o.y + o.h * 0.5 + tt);
          if (scWall(m, w, h, bxx, byy) && p.d[byy * w + bxx] && !inWin(o, bxx, byy, 3) && colAt[bxx] < 0 && girAt[byy] < 0) p.mix(bxx, byy, Wc.beam, 0.13 * (1 - tt / L) * (0.6 + 0.4 * Math.sin(ss / o.w * Math.PI)));
        }
      }
      scEdges(p, m, w, h, { hi: Wc.hi, cut: Wc.cut, lo: Wc.lo, side: Wc.side, shadow: Wc.shadow });
      // moss and weeds on broken tops, ivy hanging from broken undersides
      for (y = 2; y < h; y++) for (x = 0; x < w; x++) {
        if (!scWall(m, w, h, x, y)) continue;
        if (!scWall(m, w, h, x, y - 1) && girAt[y] < 0) { var t = tileHash(x + 11, y + 29); if (t < 0.3) p.set(x, y, t < 0.12 ? Wc.moss[2] : Wc.moss[1]); if (t < 0.08) { var th = 1 + Math.floor(tileHash(x, y + 5) * 3); for (i = 1; i <= th; i++) p.set(x, y - i, i === th ? Wc.moss[2] : Wc.moss[1]); } }
        if (!scWall(m, w, h, x, y + 1) && girAt[y] < 0 && tileHash(x + 77, y + 13) < 0.025) scVine(p, R, Wc.moss, x, y + 1, R.bt(4, 22), true);
      }
      // a pipe run along the wall, carried across small gaps, broken off at big ones
      var nP = Math.max(1, Math.round(h / 270));
      for (i = 0; i < nP; i++) {
        var py0 = 0; for (var tries = 0; tries < 20; tries++) { py0 = R.bt(20, h - 20); var ok = true; for (var g = 0; g < girds.length; g++) if (Math.abs(py0 - girds[g] - 3) < 14) ok = false; for (g = 0; g < wins.length; g++) if (py0 > wins[g].y - 6 && py0 < wins[g].y + wins[g].h + 6) ok = false; if (ok) break; }
        for (x = 0; x < w; x++) {
          if (F(x, py0) > 0.28) continue;
          p.set(x, py0, Wc.pipe[1]); p.set(x, py0 + 1, Wc.pipe[0]); p.set(x, py0 + 2, Wc.pipe[2]);
          if (x % 44 === 10) { p.rect(x, py0 - 1, 2, 5, Wc.pipe[2]); p.set(x, py0 - 1, Wc.pipe[1]); }
          if (x % 22 === 4 && scWall(m, w, h, x, py0 + 4)) p.rect(x, py0 + 3, 1, 3, Wc.pipe[2]);
          if (F(x + 1, py0) > 0.28 || F(x - 1, py0) > 0.28) { p.rect(x, py0 - 1, 1, 5, Wc.pipe[2]); }
        }
        var vx = R.bt(40, w - 40); if (F(vx, py0) < 0.2) { p.oval(vx, py0 - 3, 3, 3, Wc.valve); p.oval(vx, py0 - 3, 2, 2, Wc.valveHi); p.oval(vx, py0 - 3, 1, 1, Wc.valve); p.set(vx, py0 - 1, Wc.pipe[2]); }
      }
      // chains and a hanging lamp or two from the girders, over the holes
      var lamps = [];
      for (i = 0; i < girds.length; i++) for (var n = 0; n < 6; n++) {
        x = R.bt(4, w - 4); var gy0 = girds[i] + GH; if (colAt[x] >= 0 || scWall(m, w, h, x, gy0 + 2) || !scWall(m, w, h, x, gy0 - 1)) continue;
        if (lamps.length < Math.round(h / 270) + 1 && R.r() < 0.45) {
          var cl = R.bt(8, 26), ly = gy0 + cl; for (y = gy0; y < ly; y++) p.set(x, y, Wc.chain[0]);
          p.rect(x - 3, ly, 7, 1, Wc.lampHi); p.rect(x - 4, ly + 1, 9, 2, Wc.lampShade); p.rect(x - 1, ly + 3, 3, 1, Wc.bulb); lamps.push([x + 0.5, ly + 3]);
        } else scChain(p, x, gy0, R.bt(10, 40), Wc.chain);
      }
      p.put(b);
      for (i = 0; i < lamps.length; i++) {                // each lamp throws a soft cone of warm light down
        var lx = lamps[i][0], lyy = lamps[i][1], gr = b.createLinearGradient(0, lyy, 0, lyy + 70);
        gr.addColorStop(0, 'rgba(255,200,120,0.22)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); b.fillStyle = gr;
        b.beginPath(); b.moveTo(lx - 3, lyy); b.lineTo(lx + 3, lyy); b.lineTo(lx + 26, lyy + 70); b.lineTo(lx - 26, lyy + 70); b.closePath(); b.fill();
        drawGlow(b, lx, lyy, 18, '255,210,140', 0.35);
      }
    }
  };

  // ==== Icehouse: a glacier pass under the aurora ====
  // sky: deep blue to a pale teal horizon, many stars, two or three curtains of aurora (bright along the lower hem,
  // fading up into teal, a touch of violet at the tips, drawn in vertical rays). far: a range of snow peaks in pale
  // haze, lit on their left faces, shadowed on the right, snow running down the gullies. near: closer peaks a step
  // darker, a frozen waterfall on one face, a band of snowy firs, a snow field and sometimes a cabin with a lit
  // window. front: the ice cave we are in: a wall of glacier ice in wavy strata with grit and bubbles and cracks,
  // fused ice columns, and holes whose rims go pale where the ice thins, snow on every broken top, icicles under
  // every broken underside, frost crystals on the face.
  // Mountains for the far and near depths: peaks drawn tallest first, so the lower ones stand in front.
  function scPeaks(p, R, w, h, h0, n, hmin, hmax, C, salt) {
    var pk2 = [], i, x, y;
    for (i = 0; i < n; i++) { var sh = Math.round(h0 * R.f(hmin, hmax)); pk2.push({ x: Math.round((i + R.f(-0.4, 0.4)) * w / (n - 1)), sh: sh, L: sh * R.f(1.1, 1.9), Rr: sh * R.f(1.1, 1.9), so: R.f(-0.2, 0.25), sn: R.f(0.22, 0.45), s: salt + i * 13 }); }
    pk2.sort(function (a, c) { return c.sh - a.sh; });
    for (i = 0; i < pk2.length; i++) {
      var o = pk2[i], sy = h - o.sh, dk = i / pk2.length * 0.18;   // the nearer (lower) peaks are a touch darker
      for (y = Math.max(0, sy); y < h; y++) {
        var t = (y - sy) / o.sh, tt = Math.pow(t, 0.85), jag = (scNoise(y / 3, o.s) - 0.5) * 5 * Math.min(1, t * 4) + (scNoise(y / 11, o.s + 3) - 0.5) * 8 * t;
        var xl = Math.round(o.x - o.L * tt + jag), xr = Math.round(o.x + o.Rr * tt - jag * 0.7), xs = Math.round(o.x + o.so * o.sh * t + (scNoise(y / 6, o.s + 5) - 0.5) * 4 * t);
        for (x = Math.max(0, xl); x <= Math.min(w - 1, xr); x++) {
          var lit = x < xs, snow = y < sy + o.sh * o.sn * (0.5 + 0.9 * scNoise(x / 5, o.s + 7));
          var u = lit ? (x - xl) / Math.max(1, xs - xl) : (x - xs) / Math.max(1, xr - xs), streak = ((u * 3 + scNoise(y / 9, o.s + 9) * 1.5 + t * 2) % 1) < 0.09 && t > 0.1 && t < o.sn * 1.9;
          var c = snow ? (lit ? (streak ? C.snowSh : C.snowLit) : C.snowSh) : (lit ? (streak ? C.rockMid : C.rockLit) : (streak ? C.rockMid : C.rockSh));
          if (snow && lit && x === xs - 1) c = C.ridge;
          p.set(x, y, c); if (dk > 0) p.mix(x, y, C.rockSh, dk);
        }
      }
    }
    return pk2;
  }
  SCENES.glacier = {
    P: {
      sky: [[0, '#040b18'], [0.4, '#0b2340'], [0.75, '#1a4866'], [1, '#2e6a84']], star: '#d8f2ff',
      aur: ['#c8ffe8', '#46e6a8', '#2aa6c4', '#8a72e0'],
      far: { rockLit: '#3b6884', rockSh: '#2f5874', rockMid: '#35607c', snowLit: '#6a97b2', snowSh: '#4f7c98', ridge: '#82aec6' }, farMist: '46,100,128',
      near: { rockLit: '#1f4560', rockSh: '#16354e', rockMid: '#1a3c56', snowLit: '#5f8ead', snowSh: '#3f6c8a', ridge: '#7eaac6' },
      fir: ['#0c2338', '#15384f', '#7aa6c0', '#4f7c98'], ground: ['#4f7f9c', '#426f8c', '#6f9cb8'],
      fall: ['#4f93ba', '#86c4e0', '#3a7aa2'], cabin: ['#241e30', '#382e46', '#ffcf7a', '#7aa6c0'],
      ice: ['#173a57', '#1b4262', '#163652', '#1e4868', '#14324d'], grit: '#0e2538', bubble: '#4f93bb', crack: '#0a1c2e', crackHi: '#3d7ea6',
      pillar: ['#22547a', '#2a628a', '#4c94bf', '#18405e'], rim: ['#3f86b0', '#2d6d96', '#245d84'], snow: ['#b9dcee', '#8ebdd6', '#5f93b4'],
      icicle: ['#6fb0d6', '#b4e0f4', '#4a8fba'], frost: ['#3f86b0', '#86c4e0'], shadow: '#020a14'
    },
    sky: function (b, w, h, h0, R, P) {
      scSky(b, w, h, h0, P.sky);
      var p = new PB(w, h), i, x, y, t;
      for (i = 0; i < 230 * w * h / (480 * 270); i++) { x = R.bt(0, w - 1); y = Math.floor(Math.pow(R.r(), 1.2) * (h - h0 * 0.25)); var br = R.r(); p.mix(x, y, P.star, 0.18 + br * 0.6); if (br > 0.96) { p.mix(x - 1, y, P.star, 0.3); p.mix(x + 1, y, P.star, 0.3); p.mix(x, y - 1, P.star, 0.3); p.mix(x, y + 1, P.star, 0.3); } }
      var nr = R.bt(2, 3);
      for (var k = 0; k < nr; k++) {                       // aurora curtains
        var base = h - h0 * R.f(0.55, 0.85), a1 = R.f(8, 22), f1 = R.f(0.006, 0.014), p1 = R.r() * 6.28, a2 = R.f(3, 8), f2 = R.f(0.03, 0.05), p2 = R.r() * 6.28;
        var x0 = R.bt(-100, Math.round(w * 0.4)), x1 = x0 + R.bt(Math.round(w * 0.5), w + 100), amax = R.f(0.38, 0.6), s2 = R.bt(0, 999), Lb = R.bt(18, 34);
        for (x = Math.max(0, x0); x < Math.min(w, x1); x++) {
          var edge = Math.min(1, (x - x0) / 40, (x1 - x) / 40), yc = Math.round(base + a1 * Math.sin(x * f1 + p1) + a2 * Math.sin(x * f2 + p2));
          var L = Lb + 22 * scNoise(x / 17, s2 + 3), ray = 0.45 + 0.55 * scNoise(x / 2.2, s2), A = amax * edge * ray;
          for (t = 0; t < L; t++) { var f = 1 - t / L, u = t / L, c = u < 0.5 ? scLerp(P.aur[1], P.aur[2], u / 0.5) : scLerp(P.aur[2], P.aur[3], (u - 0.5) / 0.5); if (t === 0) c = scLerp(P.aur[0], P.aur[1], 1 - ray); p.mix(x, yc - t, c, A * Math.pow(f, 1.2)); }
          for (t = 1; t < 4; t++) p.mix(x, yc + t, P.aur[1], A * 0.25 * (1 - t / 4));
        }
      }
      p.put(b);
    },
    far: function (b, w, h, h0, R, P) {
      var p = new PB(w, h);
      scPeaks(p, R, w, h, h0, R.bt(6, 9), 0.34, 0.78, P.far, 100);
      p.put(b); scMist(b, w, h, h - h0 * 0.35, P.farMist, 0.6);
    },
    near: function (b, w, h, h0, R, P) {
      var p = new PB(w, h), x, y, i, glows = [];
      var pks = scPeaks(p, R, w, h, h0, R.bt(4, 6), 0.2, 0.52, P.near, 300);
      if (R.r() < 0.75) {                                 // a frozen waterfall down the face of one peak
        var o = pks[R.bt(0, pks.length - 1)], fx = o.x + Math.round(o.so * o.sh * 0.3) - R.bt(4, 12), fy = h - Math.round(o.sh * 0.75), fw = R.bt(5, 9);
        for (y = fy; y < h; y++) { var sway = Math.round(Math.sin(y / 9) * 1.2); for (x = 0; x < fw + Math.round((y - fy) / 14); x++) { var c = x === 0 ? P.fall[1] : ((x + Math.floor(y / 3)) % 4 === 0 ? P.fall[2] : (x % 3 === 1 ? P.fall[1] : P.fall[0])); p.set(fx + x + sway, y, c); } }
        for (x = -2; x < fw + 2; x++) { var il = R.bt(2, 6); for (y = 0; y < il; y++) p.set(fx + x, fy - 1 - y, y < 2 ? P.fall[0] : P.fall[1]); }
        glows.push([fx + fw / 2, (fy + h) / 2, 30, '160,220,255', 0.12]);
      }
      // the snow field and a band of snowy firs along it, a pale back row and a dark front row
      var gy = h - R.bt(6, 12);
      for (y = gy; y < h; y++) for (x = 0; x < w; x++) p.set(x, y, y === gy ? P.ground[2] : (scNoise(x / 14 + y / 6, 41) > 0.6 ? P.ground[1] : P.ground[0]));
      function fir(cx, base, fh, back) {
        var tiers = fh > 16 ? 4 : 3, th = fh / tiers;
        for (var k = 0; k < tiers; k++) {
          var ty = base - fh + Math.round(k * th * 0.85), tw = Math.round((k + 1) * fh * 0.55 / tiers) + 1, hh = Math.round(th * 1.3);
          for (var yy = 0; yy < hh; yy++) { var hw = Math.round(tw * (yy + 1) / hh); for (var xx = -hw; xx <= hw; xx++) { var c = back ? P.fir[1] : (xx < -hw + 2 ? P.fir[1] : P.fir[0]); if (yy === hh - 1 || (yy === hh - 2 && xx < 0)) c = xx < 0 ? P.fir[2] : P.fir[3]; p.set(cx + xx, ty + yy, c); } }
        }
        for (var yy2 = base - 3; yy2 < base + 1; yy2++) p.set(cx, yy2, P.fir[0]);
      }
      for (x = -6; x < w + 6; x += R.bt(3, 7)) fir(x, gy + 1, R.bt(10, 22), true);
      for (x = -6; x < w + 6; x += R.bt(4, 11)) if (scNoise(x / 40, 77) > 0.35) fir(x, gy + R.bt(3, 6), R.bt(13, 30), false);
      if (R.r() < 0.6) {                                  // a cabin in the snow, its window lit, a thread of smoke from the chimney
        var cx = R.bt(30, w - 50), cb = gy + 4, C = P.cabin;
        for (i = 0; i < 9; i++) p.rect(cx, cb - 9 + i, 18, 1, i % 3 === 0 ? C[1] : C[0]);
        for (i = 0; i < 5; i++) p.rect(cx - 2 + i, cb - 14 + i, 22 - i * 2 + (i ? 0 : 0), 1, i < 2 ? C[3] : P.ground[1]);
        for (i = 0; i < 5; i++) p.rect(cx + 2 + i, cb - 14 - (4 - i), 14 - i * 2, 1, C[3]);
        p.rect(cx + 13, cb - 20, 3, 6, C[0]); p.rect(cx + 12, cb - 20, 5, 1, C[3]);
        p.rect(cx + 4, cb - 7, 3, 3, C[2]); p.rect(cx + 11, cb - 7, 3, 3, C[2]); p.rect(cx + 5, cb - 7, 1, 3, C[0]); p.rect(cx + 12, cb - 7, 1, 3, C[0]);
        for (var k2 = 1; k2 < 14; k2++) p.oval(cx + 14 + Math.round(k2 * 0.8 + Math.sin(k2 / 2) * 1.5), cb - 21 - k2 * 2, 1 + Math.round(k2 / 5), 1 + Math.round(k2 / 6), P.ground[0], 0.18 * (1 - k2 / 14));
        glows.push([cx + 9, cb - 6, 22, '255,200,120', 0.3]);
      }
      p.put(b);
      for (i = 0; i < glows.length; i++) drawGlow(b, glows[i][0], glows[i][1], glows[i][2], glows[i][3], glows[i][4]);
    },
    front: function (b, w, h, h0, R, P) {
      var p = new PB(w, h), m = new Uint8Array(w * h), x, y, i, k;
      var F = scField(w, h, scHoles(R, w, h, scHoleCount(w, h) + 1, 44, 100));
      // strata: bands of varying thickness, wavy, some gritty
      var bands = [], acc = -20; while (acc < h + 40) { var bt2 = R.bt(3, 13); bands.push({ y: acc, c: R.pick(P.ice), grit: R.r() < 0.22, hi: R.r() < 0.35 }); acc += bt2; }
      var bandAt = new Int16Array(h + 80); for (i = 0, k = 0; i < h + 80; i++) { while (k + 1 < bands.length && bands[k + 1].y <= i - 30) k++; bandAt[i] = k; }
      var pil = [], pAt = new Int8Array(w).fill(-1); for (x = R.bt(20, 90); x < w - 10; x += R.bt(110, 190)) pil.push([x, R.bt(8, 13)]);
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          var c, ux = (x >> 3 << 3) + 4, uy = (y >> 3 << 3) + 4, bonus = 0, inP = -1, pw = 0;
          for (i = 0; i < pil.length; i++) { var bulge = Math.round((scNoise(y / 22, 60 + i) - 0.5) * 6), xl = pil[i][0] + bulge; if (x >= xl && x < xl + pil[i][1]) { inP = x - xl; pw = pil[i][1]; break; } }
          if (inP >= 0) {                                   // a fused ice column: lit on the left, long vertical streaks
            ux = x - inP + (pw >> 1); bonus = -0.45;
            c = inP === 0 ? P.pillar[2] : (inP === pw - 1 ? P.pillar[3] : ((inP + Math.floor(scNoise(y / 30, i) * 3)) % 4 === 1 ? P.pillar[1] : P.pillar[0]));
          } else {
            var yb = y + Math.round(4 * Math.sin(x / 37 + bands.length) + 3 * (scNoise(x / 13, 8) - 0.5)) + 30, bd = bands[bandAt[Math.max(0, Math.min(h + 79, yb))]];
            c = bd.c;
            if (bd.hi && yb - 30 - bd.y < 1) c = P.ice[3];
            if (bd.grit && tileHash(x, y) < 0.025) c = P.grit;
            else if (tileHash(x + 5, y + 3) < 0.004) c = P.bubble;
          }
          if (F(x, y) + bonus + (scNoise(x / 5 + y / 7, 3) - 0.5) * 0.16 > 0) continue;   // ice breaks clean, in smooth curves
          m[y * w + x] = 1; p.set(x, y, c);
        }
      }
      for (k = 0; k < Math.round(7 * h / 270); k++) {      // cracks wandering down the ice, a light glint beside each
        x = R.bt(0, w - 1); y = R.bt(0, h - 1); var len = R.bt(20, 80), dx = 0;
        for (i = 0; i < len; i++) { if (i % 5 === 0) dx = R.bt(-1, 1); x += dx; y += 1; if (scWall(m, w, h, x, y)) { p.set(x, y, P.crack); if (scWall(m, w, h, x + 1, y)) p.set(x + 1, y, P.crackHi); } if (R.r() < 0.05) { var bx = x, by = y; for (var j = 0; j < R.bt(4, 10); j++) { bx += R.r() < 0.5 ? 1 : -1; by += 1; if (scWall(m, w, h, bx, by)) p.set(bx, by, P.crack); } } }
      }
      // rims: the ice goes pale where it thins at a hole; snow sits on every top; icicles hang under every underside
      var tops = [], unders = [];
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        if (!scWall(m, w, h, x, y)) continue;
        if (y > 0 && !scWall(m, w, h, x, y - 1)) { tops.push(x, y); continue; }
        if (y < h - 1 && !scWall(m, w, h, x, y + 1)) { unders.push(x, y); p.set(x, y, P.rim[2]); continue; }
        for (var d = 1; d <= 2; d++) if (!scWall(m, w, h, x - d, y) || !scWall(m, w, h, x + d, y) || !scWall(m, w, h, x, y + d) || !scWall(m, w, h, x, y - d)) { p.set(x, y, P.rim[d - 1]); break; }
      }
      for (i = 0; i < tops.length; i += 2) {
        x = tops[i]; y = tops[i + 1]; var dep = 2 + Math.floor(tileHash(x >> 2, y) * 2);
        for (k = 0; k < dep + 1; k++) if (scWall(m, w, h, x, y + k)) p.set(x, y + k, k === 0 ? P.snow[0] : (k < dep ? P.snow[1] : P.snow[2]));
        if (tileHash(x, y + 77) < 0.1 && scWall(m, w, h, x - 1, y) && scWall(m, w, h, x + 1, y)) p.set(x, y - 1, P.snow[0]);   // a lump of snow standing proud
      }
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (!m[y * w + x] && !p.d[y * w + x]) { for (var dd = 1; dd <= 4 && y - dd >= 0; dd++) if (m[(y - dd) * w + x]) { p.mix(x, y, P.shadow, [0, 0.4, 0.26, 0.15, 0.06][dd]); break; } }
      for (i = 0; i < unders.length; i += 2) {
        x = unders[i]; y = unders[i + 1]; var v = tileHash(x + 13, y + 7);
        if (v > 0.16) continue;
        var L = v < 0.04 ? R.bt(12, 22) : R.bt(2, 10), wide = L > 5 && scWall(m, w, h, x + 1, y) && v < 0.2;
        for (k = 1; k <= L; k++) { p.set(x, y + k, k === L ? P.icicle[1] : (k < 2 ? P.icicle[2] : P.icicle[0])); if (wide && k < L * 0.45) p.set(x + 1, y + k, k === 1 ? P.icicle[2] : P.icicle[1]); }
      }
      for (k = 0; k < Math.round(18 * w * h / (480 * 270)); k++) {   // frost crystals on the face, more toward the holes
        x = R.bt(2, w - 3); y = R.bt(2, h - 3); if (!scWall(m, w, h, x, y) || F(x, y) < -0.9 && R.r() < 0.6) continue;
        p.set(x, y, P.frost[1]); p.set(x - 1, y, P.frost[0]); p.set(x + 1, y, P.frost[0]); p.set(x, y - 1, P.frost[0]); p.set(x, y + 1, P.frost[0]);
        if (R.r() < 0.4) { p.set(x - 1, y - 1, P.frost[0]); p.set(x + 1, y + 1, P.frost[0]); }
      }
      p.put(b);
    }
  };

  // ==== Furnace: a foundry deep under the mountain ====
  // sky: no sky, the dark of a great cavern going red toward the heat below, embers and sparks rising, the ceiling's
  // own stalactites at the very top. far: the cavern: hourglass pillars of rock lit from below, lava falls pouring out
  // of mouths in the rock into a lava lake, its glow climbing the haze. near: the old foundry a step darker: jagged
  // spires, flues with furnace mouths glowing at their feet, a gantry with crucibles on chains, big chains from the
  // dark. front: the room's back wall of basalt columns, broken through in whole segments: magma glowing in the
  // cracks, broken undersides lit hot from below, the tops left dark, stubby stalactites with hot tips.
  SCENES.forge = {
    P: {
      sky: [[0, '#070202'], [0.45, '#170705'], [0.8, '#3a1008'], [1, '#6e220c']], ember: ['#ff8a4a', '#ffd27a'], ceil: '#0e0403',
      far: { body: '#3a1610', lo: '#2e1109', rim: '#8a3a1c', rim2: '#5e2414', mouth: '#120504', win: '#ff9a3c', winHi: '#ffd27a' }, lava: ['#d8844a', '#b04a22', '#7a2a14', '#c4683a', '#3e170d', '#9a3c1a'],
      near: { rock: '#200b07', rockRim: '#6a2412', rockRim2: '#43170c', iron: '#2a1410', ironHi: '#5a2a1a', ironLo: '#170806', band: '#3a1c14', fire: ['#ffd27a', '#ff9a3c', '#e2491f'], smoke: '#120403' },
      wall: { col: ['#2b1714', '#301a16', '#26140f', '#2e1913'], lit: '#45241c', dark: '#1a0c09', joint: '#160a07', bevel: '#3a1f18', top: '#1c0b08', ash: '#4a3028',
              glow: ['#c25a24', '#7a3018', '#4a1d12'], vein: ['#e8823a', '#b8461c', '#5a2212'], tip: '#e2632a', heat: '#ff6a2a' }
    },
    sky: function (b, w, h, h0, R, P) {
      scSky(b, w, h, h0, P.sky);
      var p = new PB(w, h), i, x, y;
      for (x = 0; x < w;) {                                 // the cavern roof, far up: only seen from the top of a tall room
        var sw = R.bt(6, 22), sl = R.bt(6, Math.round(h0 * 0.18));
        for (i = 0; i < sw; i++) { var e = Math.abs(i - sw / 2) / (sw / 2), len = Math.round(sl * (1 - e * e)); for (y = 0; y < len + 3; y++) p.set(x + i, y, P.ceil); }
        x += sw + R.bt(0, 8);
      }
      for (i = 0; i < 140 * w * h / (480 * 270); i++) {    // embers drifting up, thicker toward the heat
        x = R.bt(0, w - 1); y = Math.floor((1 - Math.pow(R.r(), 1.8)) * h); var br = R.r();
        p.mix(x, y, br > 0.85 ? P.ember[1] : P.ember[0], 0.2 + br * 0.6);
        if (br > 0.9) p.mix(x, y + 1, P.ember[0], 0.35);
      }
      p.put(b);
    },
    far: function (b, w, h, h0, R, P) {
      var p = new PB(w, h), C = P.far, Lv = P.lava, x, y, i, glows = [];
      var np = R.bt(3, 5);
      for (i = 0; i < np; i++) {                           // hourglass pillars from the roof to the floor
        var cx = Math.round((i + R.f(0.2, 0.8)) * w / np), wt = R.bt(14, 30), ww = R.bt(5, 11), wb = R.bt(18, 34), my = h - Math.round(h0 * R.f(0.35, 0.6)), s0 = R.bt(0, 999);
        for (y = 0; y < h; y++) {
          var t = y < my ? 1 - y / my : (y - my) / (h - my), hw = Math.round((ww + ((y < my ? wt : wb) - ww) * t * t) + (scNoise(y / 4, s0) - 0.5) * 4);
          for (x = -hw; x <= hw; x++) {
            var lowLit = y > my ? (y - my) / (h - my) : 0, edge = hw - Math.abs(x), c = C.body;
            if ((y + Math.round(scNoise(x / 3, s0 + 1) * 6)) % 15 === 0) c = C.lo;                         // ledges
            else if (Math.abs(x - Math.round((scNoise(y / 12, s0 + 2) - 0.5) * hw * 1.4)) === 0 && scNoise(y / 20, s0 + 4) > 0.45) c = C.lo;   // a long crack
            if (edge < 2 && (lowLit > 0.15 || x < 0 && y > my * 0.5)) c = edge < 1 ? C.rim : C.rim2;
            p.set(cx + x, y, c);
          }
        }
        for (var wn = 0; wn < R.bt(0, 4); wn++) {           // windows carved into the rock, lit from inside
          var wy = h - Math.round(h0 * R.f(0.2, 0.75)), wwx = cx + R.bt(-3, 2);
          p.rect(wwx, wy, 2, 3, C.win); p.set(wwx, wy, C.winHi); if (R.r() < 0.5) { p.rect(wwx + 4, wy, 2, 3, C.win); glows.push([wwx + 3, wy + 1, 8, 0.25]); } else glows.push([wwx + 1, wy + 1, 6, 0.25]);
        }
      }
      for (x = 0; x < w;) {                                // a low ridge of rock along the floor
        var rw = R.bt(10, 40), rh = Math.round(h0 * R.f(0.06, 0.16));
        for (i = 0; i < rw; i++) { var e2 = Math.abs(i - rw / 2) / (rw / 2), top = h - Math.round(rh * (1 - e2 * e2 * 0.8) + (tileHash(x + i, 5) - 0.5) * 3); for (y = top; y < h; y++) p.set(x + i, y, y === top ? C.rim2 : C.body); }
        x += rw + R.bt(-4, 6);
      }
      var lk = h - R.bt(5, 9);                              // the lava lake, crusted
      for (y = lk; y < h; y++) for (x = 0; x < w; x++) { var c = y === lk ? Lv[3] : (scNoise(x / 7 + y / 3, 91) > 0.68 ? Lv[4] : (y < lk + 2 ? Lv[1] : Lv[5])); p.set(x, y, c); }
      var nf = R.bt(2, 3);
      for (i = 0; i < nf; i++) {                           // lava falls out of mouths in the rock
        var fx = Math.round((i + R.f(0.2, 0.8)) * w / nf), fy = h - Math.round(h0 * R.f(0.55, 0.9)), fw = R.bt(4, 8);
        p.oval(fx + (fw >> 1), fy - 2, fw + 6, 7, C.body); p.oval(fx + (fw >> 1), fy, fw + 2, 4, C.mouth); for (x = -4; x < fw + 4; x++) p.set(fx + x, fy - 4 - Math.round(Math.abs(x - fw / 2) / 3), C.rim);
        var step = R.r() < 0.6 ? fy + Math.round((lk - fy) * R.f(0.3, 0.6)) : -1, shift = R.bt(4, 10) * (R.r() < 0.5 ? -1 : 1), off2 = 0;
        for (y = fy; y < lk; y++) {
          if (y === step) { for (x = -3; x < fw + 3; x++) { p.set(fx + x, y, C.rim); p.set(fx + x + shift, y + 1, Lv[3]); } p.oval(fx + (fw >> 1) + shift, y + 3, fw + 2, 2, Lv[0], 0.8); off2 = shift; }
          var wv = fw + Math.round((y - fy) / 40); for (x = 0; x < wv; x++) { var q = (y * 2 + x * 5 + i * 3) % 9; p.set(fx + x + off2 - Math.round((y - fy) / 80), y, x === 0 || x === wv - 1 ? Lv[2] : (q < 2 ? Lv[0] : (q < 5 ? Lv[3] : Lv[1]))); }
        }
        p.oval(fx + (fw >> 1), lk, fw + 4, 3, Lv[3]); p.oval(fx + (fw >> 1), lk, fw, 2, Lv[0]);
        for (y = fy; y < lk; y += 24) glows.push([fx + fw / 2, y, 22, 0.12]);
        glows.push([fx + fw / 2, lk, 34, 0.35]);
      }
      p.put(b);
      scMist(b, w, h, h - h0 * 0.45, '255,110,40', 0.22);
      for (i = 0; i < glows.length; i++) drawGlow(b, glows[i][0], glows[i][1], glows[i][2], '255,140,60', glows[i][3]);
    },
    near: function (b, w, h, h0, R, P) {
      var p = new PB(w, h), N = P.near, x, y, i, glows = [];
      for (x = -R.bt(0, 10); x < w;) {                      // jagged spires lit along their edges from below
        var sw = R.bt(14, 44), sh = Math.round(h0 * R.f(0.06, 0.26)), s0 = R.bt(0, 999), prev = h;
        for (i = 0; i < sw; i++) {
          var e = Math.abs(i - sw / 2) / (sw / 2), top = h - Math.round(sh * Math.sqrt(Math.max(0, 1 - e * e)) * (0.65 + 0.5 * scNoise(i / 3, s0)));
          for (y = top; y < h; y++) p.set(x + i, y, y - top < 1 || (y < prev && i > 0) ? N.rockRim : (y - top < 3 ? N.rockRim2 : N.rock));
          prev = top;
        }
        x += sw + R.bt(-6, 14);
      }
      for (var hb = 0; hb < R.bt(1, 3); hb++) {             // a foundry hall: iron plates, rivets, glowing slit windows, a fire-lit door
        var hx = R.bt(-20, w - 40), hw2 = R.bt(40, 90), hh = Math.round(h0 * R.f(0.14, 0.32)), ht = h - hh;
        for (y = ht; y < h; y++) for (x = 0; x < hw2; x++) p.set(hx + x, y, x === 0 ? N.ironHi : ((x % 12 === 11) ? N.ironLo : ((y - ht) % 10 === 0 && x % 3 === 1 ? N.band : N.iron)));
        for (i = 0; i < 4; i++) p.rect(hx - 3 + i, ht - 4 + i, hw2 + 6 - i * 2, 1, i ? N.iron : N.ironHi);
        for (x = hx + 6; x < hx + hw2 - 6; x += R.bt(14, 22)) { p.rect(x, ht - 9, 4, 5, N.iron); p.rect(x - 1, ht - 9, 6, 1, N.ironHi); }
        for (y = ht + 5; y < h - 16; y += 11) for (x = hx + 4; x < hx + hw2 - 4; x += 6) if (R.r() < 0.6) { p.rect(x, y, 2, 5, N.fire[1]); p.set(x, y + 4, N.fire[0]); glows.push([x + 1, y + 3, 6, 0.18]); }
        var dw = R.bt(8, 12), dx3 = hx + R.bt(6, hw2 - dw - 6); for (y = h - 13; y < h; y++) for (x = 0; x < dw; x++) p.set(dx3 + x, y, y < h - 9 ? N.fire[2] : N.fire[1]); glows.push([dx3 + dw / 2, h - 4, 26, 0.35]);
      }
      var nfl = R.bt(2, 3);
      for (i = 0; i < nfl; i++) {                          // a flue: riveted bands, a lip, a furnace mouth at its foot
        var fx = Math.round((i + R.f(0.15, 0.85)) * w / nfl), fw = R.bt(14, 22), fh = Math.round(h0 * R.f(0.4, 0.72)), ft = h - fh;
        for (y = ft; y < h; y++) for (x = 0; x < fw; x++) p.set(fx + x, y, x === 0 ? N.ironHi : (x === fw - 1 ? N.ironLo : ((y - ft) % 22 < 2 ? N.band : N.iron)));
        for (y = ft; y < h; y += 22) for (x = 2; x < fw - 2; x += 3) p.set(fx + x, y + 1, N.ironHi);
        p.rect(fx - 2, ft - 3, fw + 4, 3, N.iron); p.rect(fx - 2, ft - 3, fw + 4, 1, N.ironHi);
        var mw = Math.min(fw - 4, R.bt(8, 12)), mh = R.bt(10, 14), mx = fx + ((fw - mw) >> 1), my = h - mh - R.bt(2, 6);
        for (y = 0; y < mh; y++) for (x = 0; x < mw; x++) { var ax = x - mw / 2 + 0.5, ay = y - mw / 2; if (ay < 0 && ax * ax + ay * ay > (mw / 2) * (mw / 2)) continue; p.set(mx + x, my + y, y < mh * 0.35 ? N.fire[2] : (y < mh * 0.7 ? N.fire[1] : N.fire[0])); }
        glows.push([mx + mw / 2, my + mh * 0.6, 34, 0.4]);
        for (var k = 1; k < 18; k++) p.oval(fx + (fw >> 1) + Math.round(Math.sin(k / 3) * 2 + k * 0.4), ft - 4 - k * 3, 2 + Math.round(k / 3), 1 + Math.round(k / 4), N.smoke, 0.45 * (1 - k / 18));
      }
      if (R.r() < 0.8) {                                   // a gantry with crucibles hanging under it
        var gx = R.bt(-40, w - 160), gw = R.bt(150, 300), gy = h - Math.round(h0 * R.f(0.4, 0.62));
        for (x = gx; x < gx + gw; x++) { p.set(x, gy, N.ironHi); p.set(x, gy + 1, N.iron); p.set(x, gy + 6, N.iron); if ((x - gx) % 8 === 0) p.line(x, gy + 1, x + 4, gy + 6, N.iron); if ((x - gx) % 8 === 4) p.line(x, gy + 6, x + 4, gy + 1, N.iron); }
        for (x = gx + R.bt(10, 30); x < gx + gw; x += R.bt(60, 90)) for (y = gy + 7; y < h; y++) { p.set(x, y, N.iron); p.set(x + 1, y, N.ironLo); }
        for (var c2 = 0; c2 < R.bt(1, 3); c2++) {
          var cx2 = gx + R.bt(20, gw - 20), cl = R.bt(10, 40), cy2 = gy + 7 + cl;
          scChain(p, cx2, gy + 7, cl, [N.iron, N.ironHi]);
          for (y = 0; y < 7; y++) for (x = -4 + Math.floor(y / 3); x <= 4 - Math.floor(y / 3); x++) p.set(cx2 + x, cy2 + 4 + y, y === 0 ? N.fire[1] : (x === -4 + Math.floor(y / 3) ? N.ironHi : N.iron));
          glows.push([cx2, cy2 + 4, 14, 0.3]);
        }
      }
      for (i = 0; i < R.bt(2, 4); i++) scChain(p, R.bt(10, w - 10), 0, R.bt(Math.round(h * 0.15), Math.round(h * 0.45)), [N.iron, N.ironHi]);
      p.put(b);
      for (i = 0; i < glows.length; i++) drawGlow(b, glows[i][0], glows[i][1], glows[i][2], '255,140,60', glows[i][3]);
    },
    front: function (b, w, h, h0, R, P) {
      var Wc = P.wall, p = new PB(w, h), m = new Uint8Array(w * h), x, y, i, k;
      var F = scField(w, h, scHoles(R, w, h, scHoleCount(w, h) + 1, 44, 100));
      // basalt columns of many widths, each cut by its own joints; whole segments fall out at a hole
      var cols = []; for (x = -R.bt(0, 8); x < w;) { var cw = R.bt(6, 12), jt = [], jy = -R.bt(0, 30); while (jy < h) { jt.push(jy); jy += R.bt(14, 42); } cols.push({ x: x, w: cw, c: R.pick(Wc.col), j: jt, sh: R.bt(-2, 2) }); x += cw; }
      for (i = 0; i < cols.length; i++) {
        var o = cols[i], jt2 = o.j;
        for (k = 0; k < jt2.length; k++) {
          var y0 = jt2[k], y1 = k + 1 < jt2.length ? jt2[k + 1] : h + 40, uy = (y0 + y1) / 2, ux = o.x + o.w / 2;
          for (y = Math.max(0, y0); y < Math.min(h, y1); y++) for (x = o.x; x < o.x + o.w && x < w; x++) {
            if (x < 0) continue;
            var fu = F(ux, uy), gone = fu > 0.05 || (fu > -0.25 && F(x, y) + (tileHash(x >> 2, y >> 3) - 0.5) * 0.1 > 0.08);
            if (gone) continue;
            var c = o.c, dx = x - o.x, hotJ = tileHash(i * 7 + 1, k * 13 + 5) < 0.08, hotS = tileHash(i * 3 + 9, k * 5 + 2) < 0.04;
            if (y === y0) c = hotJ ? (tileHash(x, y) < 0.3 ? Wc.vein[0] : Wc.vein[1]) : Wc.joint; else if (y === y0 + 1) c = hotJ ? Wc.vein[2] : Wc.bevel;
            else if (dx === 0) c = hotS ? Wc.vein[1] : Wc.lit; else if (dx === 1 && hotS) c = Wc.vein[2]; else if (dx === o.w - 1) c = Wc.dark;
            else if (tileHash(x, y + 300) < 0.02) c = Wc.dark;
            m[y * w + x] = 1; p.set(x, y, c);
          }
        }
      }
      // magma in the cracks: wandering veins with a dull halo, a hot core here and there
      var veins = [];
      for (k = 0; k < Math.round(6 * h / 270); k++) {
        x = R.bt(0, w - 1); y = R.bt(0, h - 1); var len = R.bt(14, 60), dx2 = R.r() < 0.5 ? -1 : 1, hot = R.r() < 0.35;
        for (i = 0; i < len; i++) {
          if (R.r() < 0.3) dx2 = R.r() < 0.5 ? -1 : 1; if (R.r() < 0.55) x += dx2; else y += R.r() < 0.7 ? 1 : -1;
          if (!scWall(m, w, h, x, y)) continue;
          for (var q = 0; q < 4; q++) { var hx = x + [1, -1, 0, 0][q], hy = y + [0, 0, 1, -1][q]; if (scWall(m, w, h, hx, hy) && p.d[hy * w + hx] !== pk(Wc.vein[1]) && p.d[hy * w + hx] !== pk(Wc.vein[0])) p.set(hx, hy, Wc.vein[2]); }
          p.set(x, y, hot && i % 7 < 3 ? Wc.vein[0] : Wc.vein[1]);
          if (i % 12 === 0) veins.push([x, y]);
        }
      }
      // the breaks: undersides glow from the heat below, tops stay dark with a little ash; stubby stalactites
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        if (!scWall(m, w, h, x, y)) continue;
        if (y > 0 && !scWall(m, w, h, x, y - 1)) { p.set(x, y, tileHash(x, y + 9) < 0.15 ? Wc.ash : Wc.top); continue; }
        for (var d = 0; d < 3; d++) if (!scWall(m, w, h, x, y + d + 1)) { p.set(x, y, Wc.glow[d]); break; }
      }
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        if (!scWall(m, w, h, x, y) || scWall(m, w, h, x, y + 1) || tileHash(x + 33, y + 71) > 0.08) continue;
        var L = R.bt(3, 11); for (k = 1; k <= L; k++) { var half = Math.round((1 - k / L) * 1.2); for (var xx = -half; xx <= half; xx++) p.set(x + xx, y + k, k >= L - 1 ? Wc.tip : (k > L * 0.6 ? Wc.glow[1] : Wc.col[2])); }
      }
      for (y = 0; y < h; y++) { var heat = 0.16 * Math.pow(y / h, 2); if (heat > 0.01) for (x = 0; x < w; x++) if (m[y * w + x]) p.mix(x, y, Wc.heat, heat); }   // warmer toward the bottom
      p.put(b);
      for (i = 0; i < veins.length; i += 2) drawGlow(b, veins[i][0], veins[i][1], 10, '255,120,40', 0.16);
    }
  };
