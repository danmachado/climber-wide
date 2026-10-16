const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///home/claude/climber-wide/index.html');
  await p.addScriptTag({ content: fs.readFileSync('/home/claude/climber-wide/src/gen.js', 'utf8') + '\nwindow.generateRoom = generateRoom;' });
  const N = +(process.argv[2] || 20);
  const SP = JSON.parse(fs.readFileSync('/home/claude/climber-wide/src/starter-plans.json', 'utf8'));
  const ONE = process.env.ONE ? JSON.parse(process.env.ONE) : null;
  if (process.env.LAYOUT) await p.evaluate((l) => { window.__layout = l; }, process.env.LAYOUT);
  const out = await p.evaluate(([N, SP, ONE]) => {
    const G = window.__climber; G.manual(true);
    const col = (t, d) => d > 0 ? 1 + t : 25 - t;
    function solve(out) {
      G.load(out.room);
      let s = G.state(), frames = 0, where = 'spawn';
      const I = (o) => Object.assign({ x: 0, y: 0, jump: false, dash: false, grab: false }, o);
      const step = (o) => { const q = I(o); if (window.__rec) window.__rec.push((q.x + 1) + 3 * (q.y + 1) + (q.jump ? 9 : 0) + (q.dash ? 18 : 0) + (q.grab ? 36 : 0)); s = G.step(q, 1); window.__last = s; frames++; window.__frames = frames; if (window.__tr && frames % 15 === 0) window.__tr.push(where.replace('floor ', 'f') + ':' + s.x + ',' + s.y + (s.ground ? 'g' : '')); if (s.won) throw { won: true }; if (s.dead) throw new Error('died at ' + where); return s; };
      const until = (fn, cond, max) => { let k = 0; while (!cond()) { step(fn(k)); if (++k > (max || 600)) throw new Error('stuck at ' + where); } };
      for (let i = 0; i < 40; i++) step({});
      if (out.plan && out.plan.kind === 'islands') return solveIslands(out);
      for (let fi = 0; fi < out.plan.length; fi++) {
        const F = out.plan[fi], d = F.d, y = F.y;
        const lead = () => d > 0 ? s.x + 8 : s.x, trail = () => d > 0 ? s.x : s.x + 8;
        const startEdge = (t) => d > 0 ? col(t, d) * 10 : (col(t, d) + 1) * 10;
        const endEdge = (t) => d > 0 ? (col(t, d) + 1) * 10 : col(t, d) * 10;
        const dist = (t) => d > 0 ? startEdge(t) - lead() : lead() - startEdge(t);
        const past = (t, m) => d > 0 ? trail() >= endEdge(t) + m : trail() <= endEdge(t) - m;
        const mover = (rowY) => s.movers.filter(m => m.y === rowY)[0];
        for (let o of F.obs) {
          if (o.type === 'icespikes') o = { type: 'spikes', t0: o.t0 + o.L, w: o.sw };            // slide along the ice, then it is an ordinary spike jump
          else if (o.type === 'iceblock') o = { type: 'block', t0: o.t0 + o.L, w: 2, h: 2 };
          where = 'floor ' + fi + ' ' + o.type + ' t' + o.t0 + ' w' + o.w;
          const last = o.t0 + o.w - 1;
          if (o.type === 'bridge') {            // never stop on a crumbling bridge
            where = 'floor ' + fi + ' bridge w' + o.w;
            until(() => ({ x: d }), () => past(o.t0 + o.w - 1, 2), 400);
            continue;
          }
          if (o.type === 'fireball') {          // wait beside the track, run under while the fireball is up at the top
            where = 'floor ' + fi + ' fireball t' + o.t0;
            const fx0 = col(o.t0, d) * 10, topY = (y - 5) * 10;
            const ball = () => s.fireballs.filter(f => f.x === fx0 && f.y >= topY && f.y <= (y - 1) * 10)[0];
            until(() => ({}), () => s.ground, 200);
            if (dist(o.t0) < 11) until(() => ({ x: -d }), () => dist(o.t0) >= 12, 200);
            until(() => ({ x: d }), () => dist(o.t0) <= 14);
            for (let k = 0; k < 8; k++) step({});
            until(() => ({}), () => { const f = ball(); return f && f.y <= topY + 8 && (f.dir < 0 || f.wait > 0 || f.y === topY); }, 900);
            until(() => ({ x: d }), () => past(o.t0, 3), 200);
            continue;
          }
          if (o.type === 'drone') {             // wait until the drone is parked at the far end and done firing, then run under
            where = 'floor ' + fi + ' drone t' + o.t0;
            const rowY = (y - 5) * 10, homeX = col(o.t0 + 3, d) * 10, nearX = col(o.t0, d) * 10;
            const dr = () => s.drones.filter(q => q.y === rowY && Math.abs(q.x - (homeX + nearX) / 2) <= 25)[0];
            until(() => ({}), () => s.ground, 200);
            if (dist(o.t0) < 11) until(() => ({ x: -d }), () => dist(o.t0) >= 12, 200);
            until(() => ({ x: d }), () => dist(o.t0) <= 14);
            for (let k = 0; k < 8; k++) step({});
            // wait until it has just fired at home and is heading toward us: the beam is spent and the whole trip is clear
            until(() => ({}), () => { const q = dr(); return q && q.fire <= 0 && q.wait <= 0 && q.x === homeX; }, 900);
            until(() => ({ x: d }), () => past(o.t0 + 3, 3), 300);
            continue;
          }
          if (o.type === 'jet') {               // wait beside the vent until it has just gone out, then run past
            where = 'floor ' + fi + ' jet t' + o.t0;
            const jx = col(o.t0, d) * 10;
            const jet = () => s.jets.filter(j => j.x === jx && j.y === (y - 1) * 10)[0];
            until(() => ({}), () => s.ground, 200);
            if (dist(o.t0) < 11) until(() => ({ x: -d }), () => dist(o.t0) >= 12, 200);
            until(() => ({ x: d }), () => dist(o.t0) <= 14);
            for (let k = 0; k < 8; k++) step({});
            until(() => ({}), () => { const j = jet(); return j && !j.on && !j.warn && j.left > 0.7; }, 300);
            until(() => ({ x: d }), () => past(o.t0, 3), 200);
            continue;
          }
          if (o.type === 'ferry') {
            where = 'floor ' + fi + ' ferry w' + o.w;
            const rowY = (y - 2) * 10, cA = col(o.t0, d), cB = col(o.t0 + o.pl - 1, d), cE = col(o.t0 + o.w - 1, d), cE2 = col(o.t0 + o.w - o.pl, d);
            const startX = Math.min(cA, cB) * 10, endX = Math.min(cE, cE2) * 10;
            until(() => ({ x: d }), () => dist(o.t0) <= 9);
            for (let k = 0; k < 8; k++) step({});
            until(() => ({}), () => { const m = mover(rowY); return m && m.x === startX && (m.z === 'idle' || m.wait > 0.15); }, 900);   // a zip mover waits at the start on its own
            // straight up first (spikes or a pit start right at the edge), then drift onto the platform
            until((k) => ({ x: s.y + 10 <= rowY ? ((d > 0 ? s.x >= startEdge(o.t0) + 8 : s.x + 8 <= startEdge(o.t0) - 8) ? 0 : d) : 0, jump: k < 1 || s.vy < 0 }), () => s.ground && s.y + 10 === rowY, 200);
            until(() => ({}), () => { const m = mover(rowY); return m && m.x === endX; }, 900);
            until(() => ({ x: past(o.t0 + o.w - 1, 2) ? 0 : d }), () => past(o.t0 + o.w - 1, 2) && s.ground && s.y + 10 === y * 10, 300);
            step({});
            continue;
          }
          if (o.type === 'wallspikes') {
            const wallEnd = o.t0 + 1;
            until(() => ({ x: d }), () => dist(o.t0) <= 0);
            until(() => ({ x: d, y: -1, grab: true }), () => s.ground && s.y + 10 <= (y - o.h) * 10, 400);
            until(() => ({ x: d }), () => d > 0 ? s.x + 8 >= endEdge(wallEnd) - 1 : s.x <= endEdge(wallEnd) + 1, 200);
            step({ x: d, jump: true });
            let k = 0;
            while (true) { const gone = past(last, 2); step({ x: gone ? 0 : d, jump: s.vy < 0 }); if (s.ground && gone && s.y + 10 === y * 10) break; if (++k > 300) throw new Error('stuck at ' + where); }
            step({});
          } else if (o.type === 'wall') {
            until(() => ({ x: d }), () => dist(o.t0) <= 0);
            until(() => ({ x: d, y: -1, grab: true }), () => s.ground && s.y + 10 <= (y - o.h) * 10, 400);
            until(() => ({ x: past(last, 0) ? 0 : d }), () => past(last, 0) && s.ground && s.y + 10 === y * 10, 300);
          } else {
            until(() => ({}), () => s.ground, 200);
            if (o.type === 'crown' && dist(o.t0) < 26) { until(() => ({ x: -d }), () => dist(o.t0) >= 30, 200); step({}); step({}); step({}); }
            if (o.type !== 'crown' && dist(o.t0) < 4) { until(() => ({ x: -d }), () => dist(o.t0) >= 8, 200); step({}); step({}); }   // landed too close: back off before the jump
            until(() => ({ x: d }), () => dist(o.t0) <= (o.type === 'crown' ? 24 : 6));
            let dashed = false, k = 0;
            step({ x: d, jump: true });
            while (true) {
              const gone = o.type === 'wide' && dashed ? past(last, -6) : past(last, 2);
              const wantDash = o.type === 'wide' && !dashed && s.vy >= -10 && !s.ground;
              if (wantDash) dashed = true;
              step({ x: gone ? 0 : d, jump: s.vy < 0, dash: wantDash });
              if (s.ground && k > 3 && (gone || o.type === 'block')) break;
              if (++k > 300) throw new Error('stuck at ' + where);
            }
            step({});
            if (o.type === 'block') until(() => ({ x: past(last, 0) ? 0 : d }), () => past(last, 0) && s.ground && s.y + 10 === y * 10, 300);
          }
        }
        if (!F.conn) { where = 'floor ' + fi + ' exit'; until(() => ({ x: d }), () => false, 600); }
        const C = F.conn, yN = y - C.Hf;
        where = 'floor ' + fi + ' ' + C.type + ' W' + C.W + ' Hf' + C.Hf;
        const FW = 25 - (C.sh || 0);                       // tile where the far wall starts on this floor
        const wallX = d > 0 ? col(FW, d) * 10 : (col(FW, d) + 1) * 10;
        const atWall = () => d > 0 ? s.x + 8 >= wallX : s.x <= wallX;
        const nearWall = () => d > 0 ? s.x + 8 >= wallX - 6 : s.x <= wallX + 6;
        if (C.type === 'lift') {
          const bottom = (y - 1) * 10;
          until(() => ({ x: d }), () => dist(FW - 3) <= 26);
          for (let k = 0; k < 8; k++) step({});
          until(() => ({}), () => { const m = mover(bottom); return m && (m.z === 'idle' || m.wait > 0.2); }, 1200);
          until((k) => ({ x: d, jump: (dist(FW - 3) <= 1 && s.ground && k % 2 === 0) || s.vy < 0 }), () => s.ground && (d > 0 ? s.x >= startEdge(FW - 3) + 2 : s.x + 8 <= startEdge(FW - 3) - 2) && s.y + 10 <= bottom, 300);
          until(() => ({}), () => s.y + 10 === yN * 10, 900);
          until(() => ({ x: -d }), () => s.ground && s.y + 10 === yN * 10 && (d > 0 ? s.x + 8 <= endEdge(FW - 4) : s.x >= endEdge(FW - 4)), 300);
          step({});
        } else if (C.type === 'spring') {    // step onto the spring, ride it up through the opening, land on the slab
          until(() => ({ x: d }), () => dist(FW - 2) <= -3);
          until(() => ({ jump: true }), () => s.y + 10 <= yN * 10 - 2, 150);
          until((k) => ({ x: -d, jump: s.vy < 0 }), () => s.ground && s.y + 10 === yN * 10, 300);
          step({});
        } else if (C.type === 'open') {
          until(() => ({ x: d }), atWall);
          until(() => ({ x: d, y: -1, grab: true }), () => s.y + 10 <= yN * 10 - 8, 400);
          const edge = endEdge(FW - 1 - C.W);
          until((k) => ({ x: (d > 0 ? s.x + 8 <= edge - 3 : s.x >= edge + 3) ? 0 : -d, jump: k < 12 }), () => s.ground && s.y + 10 === yN * 10, 300);
        } else if (C.type === 'curtain') {
          until(() => ({ x: d }), nearWall);
          step({});
          until((k) => ({ x: -d, y: -1, grab: true, jump: k < 2 || (s.vy < 0 && s.state === 'normal' && k < 30) }), () => s.ground && s.y + 10 === yN * 10, 500);
        } else {
          until(() => ({ x: d }), () => dist(FW - 3) <= 0);
          step({});
          const hop = (dir, feet, near) => {
            until((k) => ({ x: (dir > 0 ? s.x >= near + 3 : s.x + 8 <= near - 3) ? 0 : dir, jump: k < 1 || s.vy < 0 }), () => s.ground && s.y + 10 === feet, 200);
            step({}); step({});
          };
          hop(d, (y - 2) * 10, startEdge(FW - 3)); hop(-d, (y - 4) * 10, endEdge(FW - 5)); hop(-d, yN * 10, endEdge(FW - 8));
        }
      }
      return { ok: false, why: 'ran out of plan' };

      // ---- island rooms: walk island to island following the recorded move for each ----
      function solveIslands(out) {
        const isl = out.plan.islands;
        const feetOn = (q) => s.ground && s.y + 10 === q.y * 10 && s.x + 8 > q.x * 10 && s.x < (q.x + q.w) * 10;
        const goTo = (px, tol, max) => { let lastX = -1, same = 0; until(() => { const dx = s.x + 4 < px - tol ? 1 : (s.x + 4 > px + tol ? -1 : 0); if (s.x === lastX) same++; else same = 0; lastX = s.x; return { x: dx, jump: same > 6 && s.ground }; }, () => Math.abs(s.x + 4 - px) <= tol && s.ground, max || 300); };   // hop over anything low in the way
        const park = (px) => {                           // stop exactly at px: walk near, let momentum die, creep the last pixels
          goTo(px, 6); until(() => ({}), () => s.vx === 0 && s.ground, 30);
          for (let n = 0; n < 40 && Math.abs(s.x + 4 - px) > 1; n++) { step({ x: s.x + 4 < px ? 1 : -1 }); step({}); step({}); }
          until(() => ({}), () => s.vx === 0 && s.ground, 30);
        };
        const standing = () => { for (let j = isl.length - 1; j >= 0; j--) if (feetOn(isl[j])) return j; return -1; };
        const miss = (q) => { if (s.ground && !feetOn(q)) throw new Error('missed at ' + where + ' at ' + s.x + ',' + s.y + ' want y ' + (q.y * 10 - 10) + ' x ' + q.x * 10 + '-' + (q.x + q.w) * 10); };
        let retries = 0, deaths = 0;
        for (let k = 1; k < isl.length; k++) {
          const q = isl[k], p = isl[k - 1], d = q.x + q.w / 2 > p.x + p.w / 2 ? 1 : -1;
          where = 'island ' + k + ' ' + q.move;
          try {
            if (!feetOn(p)) {                                // fell somewhere: settle, find the island we are on, and redo from there
              until(() => ({}), () => s.ground, 300);
              const j = standing(); if (j < 0 || ++retries > 6) throw new Error('lost at ' + where);
              if (j < k - 1) { k = j; continue; }
            }
            const landX = (q.x + q.w / 2) * 10;
            if (q.move === 'hop') {
              // the recipe the generator measured: run at the slab edge, jump as the leading edge reaches it, hold 12 frames,
              // dash sideways at frame 5 if the recipe says so. The take-off edge is the previous island's far edge, or for
              // the floor, the point gap tiles short of the landing.
              const edgePx = k === 1 ? (d > 0 ? q.x * 10 - q.gap * 10 : (q.x + q.w) * 10 + q.gap * 10) : (d > 0 ? (p.x + p.w) * 10 : p.x * 10);
              const backPx = k === 1 ? 60 : Math.min(40, (p.w - (p.lip ? 1 : 0)) * 10 - 12);   // run-up stays on the slab we stand on, short of a lip spike
              if (!p.run) goTo(edgePx - d * backPx, 3);                              // an ice or crumble slab is run straight across, no stopping
              until(() => ({ x: d }), () => (d > 0 ? s.x + 8 >= edgePx - 1 : s.x <= edgePx + 1), 120);
              s = step({ x: d, jump: true });
              let k2 = 0;
              while (!feetOn(q)) { step({ x: d, jump: k2 < 12, dash: q.recipe === 'dash' && k2 === 5 }); if (k2 > 12) miss(q); if (++k2 > 90) throw new Error('stuck at ' + where); }
              if (!q.run) goTo(landX, 6, 200);
            } else if (q.move === 'climb') {
              // stand against the pillar, hold grab and up: the climb pops you onto the top, then walk onto the landing
              const sd = q.side, faceX = sd > 0 ? q.pillar * 10 : (q.pillar + 1) * 10;
              goTo(sd > 0 ? faceX - 5 : faceX + 5, 2);
              until(() => ({ x: sd, y: -1, grab: true }), () => s.ground && s.y + 10 <= q.y * 10, 500);
              goTo(landX, 6, 300);
            } else if (q.move === 'chimney') {
              // a stepped pillar: climb the first step and pop onto it, stand on it, climb the second, walk onto the landing
              const sd = q.side, f1 = sd > 0 ? q.p1 * 10 : (q.p1 + 1) * 10;
              goTo(sd > 0 ? f1 - 5 : f1 + 5, 2);
              until(() => ({ x: sd, y: -1, grab: true }), () => s.ground && s.y + 10 <= q.mid * 10, 500);   // the hop off the first step often grabs the second and keeps going
              if (!feetOn(q)) { goTo(q.p1 * 10 + 5, 2, 60); until(() => ({ x: sd, y: -1, grab: true }), () => s.ground && s.y + 10 <= q.y * 10, 500); }
              goTo(landX, 6, 300);
            } else if (q.move === 'spring') {
              // walk onto the spring, hold jump and the direction through the rise, steer onto the slab on the way down
              const sx = q.spring * 10 + 5;
              until(() => ({ x: s.x + 4 < sx ? 1 : -1 }), () => s.vy < -150, 300);
              until(() => ({ x: d, jump: true }), () => s.vy >= 0, 80);
              until(() => ({ x: s.x + 4 < landX - 4 ? 1 : (s.x + 4 > landX + 4 ? -1 : 0) }), () => { miss(q); return feetOn(q); }, 200);
            } else if (q.move === 'zip') {
              // the mover sits level with the slab at its end: wait for it to be down, walk on, ride up, step off and drop onto the slab
              const tx = q.track * 10 + 5, m0 = () => s.movers.filter(m => m.x === q.track * 10 && m.y >= (q.y - 1) * 10 && m.y <= p.y * 10)[0];   // the mover on this track (another zip may share the column higher up)
              park(tx - d * 14);                                                     // wait clear of the track: a platform coming down beside you crushes
              until(() => ({}), () => { const m = m0(); return m && m.y >= p.y * 10 - 1 && (m.z === 'idle' || m.wait > 0.15 || (m.axis === 'y' && m.dir < 0 && m.y >= p.y * 10 - 1)); }, 1200);
              until(() => ({ x: s.x + 4 < tx - 2 ? 1 : (s.x + 4 > tx + 2 ? -1 : 0) }), () => Math.abs(s.x + 4 - tx) <= 2, 120);
              until(() => ({}), () => s.ground && s.y + 10 <= (q.y - 1) * 10 + 1, 900);
              until(() => ({ x: d }), () => feetOn(q), 80);
              goTo(landX, 6, 200);
            } else if (q.move === 'shelf') {
              // the turn: stand at the slab's near end, jump straight up, drift onto the shelf once the jump peaks
              const off = Math.abs((q.from > 0 ? q.x : q.x + q.w - 1) - q.stand);   // one tile off: jump from the tile centre; two: lean toward the shelf
              const standX = q.stand * 10 + 5 + (off > 1 ? q.from * 3 : -q.from * 2);   // one tile off: lean away so the head clears the shelf's corner
              park(standX);
              s = step({ jump: true });
              let k3 = 0;
              while (!feetOn(q)) { step({ x: s.vy >= -40 ? q.from : 0, jump: k3 < 12 }); if (k3 > 12) miss(q); if (++k3 > 90) throw new Error('stuck at ' + where); }
              goTo(landX, 6, 200);
            }
          } catch (e) {
            if (!e.message || e.message.indexOf('died') !== 0 || ++deaths > 6) throw e;
            for (let f = 0; f < 200 && (s.dead || !s.ground); f++) { s = G.step(I({}), 1); frames++; }      // respawn and start over from the floor
            k = 0;
          }
        }
        where = 'exit'; until(() => ({ x: isl[isl.length - 1].exitDir || 1 }), () => false, 400);
        return { ok: false, why: 'ran out of islands' };
      }
    }
    const res = { total: 0, fail: [], times: {}, demos: {} };
    if (N === 0) { for (let i = 1; i < SP.rooms.length; i++) { res.total++; window.__rec = []; try { const r = solve({ room: SP.rooms[i], plan: SP.plans[i] }); if (!r.ok) res.fail.push([SP.rooms[i].name, r.why]); } catch (e) { if (!e.won) res.fail.push([SP.rooms[i].name, e.message]); else { res.times[SP.rooms[i].id] = +(window.__frames / 60).toFixed(1); const rl = []; for (const c of window.__rec) { if (rl.length && rl[rl.length - 2] === c) rl[rl.length - 1]++; else rl.push(c, 1); } res.demos[SP.rooms[i].id] = rl; } } } window.__rec = null; return res; }
    if (ONE) { const out = window.generateRoom(ONE.opts, ONE.seed); const tr = []; window.__tr = tr; try { solve(out); } catch (e) { return { total: 1, fail: [[tr.join(' | '), e.message || 'won']] }; } return { total: 1, fail: [] }; }
    const styles = ['mixed', 'jump', 'dash', 'climb'];
    const process_layout = (seed, ob) => (window.__layout || 'floors');   // islands are work in progress: LAYOUT=islands to sweep them
    for (let seed = 1; seed <= N; seed++) for (let D = 1; D <= (N === 1 ? 1 : 5); D++) for (const style of styles) for (let ob = 0; ob < 3; ob++) for (let sp = 0; sp < 3; sp++) {
      const el = seed % 4;   // rotate which new pieces are switched on
      const opts = { difficulty: D, obstacles: ob, styles: style === 'mixed' ? [] : (seed % 3 === 0 ? [style, 'jump'] : [style]), spikes: Math.max(1, sp), world: seed % 5 + 1, rows: seed % 7 === 0 ? 96 : 48, layout: process_layout(seed, ob),
                     elements: { springs: seed % 4 !== 1, gems: true, firepits: seed % 3 !== 1, fireballs: seed % 3 !== 2, spikes: sp > 0, refills: seed % 2 === 0, ice: el === 1 || el === 3, crumble: el === 2 || el === 3, movers: el === 0 || el === 3, zips: seed % 5 !== 2, keys: seed % 3 !== 0, jets: seed % 4 !== 3, lava: seed % 2 === 1, lasers: seed % 3 !== 1, drones: seed % 4 !== 2, wires: seed % 2 === 0, holos: seed % 3 !== 2 } };
      const out = window.generateRoom(opts, seed * 7919 + D * 31 + ob * 7 + sp);
      res.total++;
      try { const r = solve(out); if (!r.ok) res.fail.push([JSON.stringify(opts), r.why]); }
      catch (e) { if (e.won) continue; res.fail.push([JSON.stringify(window.__last) + JSON.stringify(opts) + ' seed ' + (seed * 7919 + D * 31 + ob * 7 + sp), e.message]); }
    }
    return res;
  }, [N, SP, ONE]);
  // the auto-player's time on each built-in level is what par times are set from (see src/build.js)
  if (N === 0 && !out.fail.length) { fs.writeFileSync('/home/claude/climber-wide/src/starter-times.json', JSON.stringify(out.times, null, 1)); fs.writeFileSync('/home/claude/climber-wide/src/starter-demos.json', JSON.stringify(out.demos)); console.log('bot times', JSON.stringify(out.times)); }
  const kinds = {};
  out.fail.forEach(f => { const k = f[1].replace(/floor \d+ /, '').replace(/ t\d+/, ''); kinds[k] = (kinds[k] || 0) + 1; });
  console.log('rooms', out.total, 'failed', out.fail.length, JSON.stringify(kinds, null, 0).slice(0, 1500));
  console.log(out.fail.slice(0, ONE ? 1 : +(process.env.PRINT || 4)).map(f => ONE ? f.join(' => ') : f.join(' => ')).join('\n'), 'errors', JSON.stringify(errs).slice(0, 300));
  await b.close();
})();
