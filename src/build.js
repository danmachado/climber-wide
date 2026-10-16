var fs = require('fs'), d = __dirname;
var tilesJs = fs.readFileSync(d + '/shared-tiles.js', 'utf8'), gen = fs.readFileSync(d + '/gen.js', 'utf8'), cfg = fs.readFileSync(d + '/shared-config.js', 'utf8'), heroJs = fs.readFileSync(d + '/shared-hero.js', 'utf8'), worldsJs = fs.readFileSync(d + '/shared-worlds.js', 'utf8'), foesJs = fs.readFileSync(d + '/shared-foes.js', 'utf8'), screenJs = fs.readFileSync(d + '/shared-screen.js', 'utf8');
var generateRoom = new Function(screenJs + '\n' + gen + '\nreturn generateRoom;')();

// Built-in starter set: the hand-made first room plus generated rooms (each one is cleared by the auto-player in tests).
// About half of each world uses the island layout (floating slabs, pillars and shelves to climb) instead of floors.
// Wide: every level is generated for now, level 1 included (the frame's hand-made 1-1 is portrait and stays there).
// A hand-made wide 1-1 with the combat trial goes back in when Dan has played the wide build.
var SET = [   // Brickyard: the common pieces, introduced one at a time, then all together
  ['First Light', { difficulty: 1, obstacles: 0, styles: ['jump'],  spikes: 0, elements: { refills: true } }, 4110],
  ['Low Road',    { difficulty: 1, obstacles: 0, styles: ['jump'],  spikes: 1, elements: { spikes: true, refills: true, springs: true } }, 4111],
  ['Brickwork',   { difficulty: 1, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, refills: true, crumble: true, gems: true } }, 4112],
  ['Switchback',  { difficulty: 2, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, movers: true, gems: true } }, 4213],
  ['Long Reach',  { difficulty: 2, obstacles: 1, styles: ['dash'],  spikes: 1, elements: { spikes: true, refills: true, zips: true, gems: true } }, 4214],
  ['Needle Row',  { difficulty: 3, obstacles: 2, styles: ['jump'],  layout: 'islands', spikes: 2, elements: { spikes: true, refills: true, crumble: true, springs: true, keys: true } }, 4315],
  ['Updraft',     { difficulty: 3, obstacles: 1, styles: ['climb'], spikes: 1, elements: { spikes: true, refills: true, zips: true, movers: true, keys: true, gems: true } }, 4316],
  ['High Wire',   { difficulty: 4, obstacles: 2, styles: [],        layout: 'islands', spikes: 2, elements: { spikes: true, refills: true, crumble: true, movers: true, zips: true, springs: true, gems: true, keys: true } }, 4417]
];
// World 2: ice, with the common pieces layered in.
var SET2 = [
  ['Cold Snap',   { difficulty: 1, obstacles: 0, styles: ['jump'],  spikes: 1, elements: { spikes: true, ice: true, refills: true } }, 5111],
  ['Glaze',       { difficulty: 1, obstacles: 1, styles: [],        layout: 'islands', spikes: 1, elements: { spikes: true, ice: true, refills: true, gems: true } }, 5112],
  ['Slipstream',  { difficulty: 2, obstacles: 1, styles: ['dash'],  spikes: 1, elements: { spikes: true, ice: true, refills: true, zips: true, gems: true } }, 5213],
  ['Rime',        { difficulty: 2, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { spikes: true, ice: true, refills: true, springs: true, keys: true } }, 5214],
  ['Black Ice',   { difficulty: 3, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, ice: true, refills: true, crumble: true, gems: true } }, 5315],
  ['Hard Frost',  { difficulty: 3, obstacles: 2, styles: ['jump'],  spikes: 2, elements: { spikes: true, ice: true, refills: true, movers: true, zips: true, keys: true } }, 5316],
  ['Whiteout',    { difficulty: 4, obstacles: 1, styles: [],        layout: 'islands', spikes: 1, elements: { spikes: true, ice: true, refills: true, movers: true, springs: true, keys: true, gems: true } }, 5417],
  ['Deep Freeze', { difficulty: 4, obstacles: 2, styles: [],        spikes: 2, elements: { spikes: true, ice: true, refills: true, crumble: true, movers: true, zips: true, keys: true, gems: true } }, 5418]
];
// World 3: flames, fireballs, jets, with the common pieces layered in.
var SET3 = [
  ['Pilot Light', { difficulty: 1, obstacles: 0, styles: ['jump'],  spikes: 1, elements: { firepits: true, refills: true } }, 6111],
  ['Cinders',     { difficulty: 1, obstacles: 1, styles: [],        layout: 'islands', spikes: 1, elements: { firepits: true, fireballs: true, refills: true, gems: true } }, 6112],
  ['Flashpoint',  { difficulty: 2, obstacles: 1, styles: ['dash'],  spikes: 1, elements: { firepits: true, jets: true, refills: true } }, 6213],
  ['Bellows',     { difficulty: 2, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { firepits: true, fireballs: true, refills: true, zips: true, keys: true } }, 6214],
  ['Slag Run',    { difficulty: 3, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, firepits: true, fireballs: true, jets: true, refills: true, movers: true, gems: true } }, 6315],
  ['Backdraft',   { difficulty: 3, obstacles: 2, styles: ['jump'],  spikes: 2, elements: { firepits: true, jets: true, refills: true, zips: true, keys: true } }, 6316],
  ['Crucible',    { difficulty: 4, obstacles: 1, styles: [],        layout: 'islands', spikes: 1, elements: { spikes: true, firepits: true, fireballs: true, jets: true, refills: true, crumble: true, gems: true, keys: true } }, 6417],
  ['Meltdown',    { difficulty: 4, obstacles: 2, styles: [],        spikes: 2, elements: { spikes: true, firepits: true, fireballs: true, jets: true, refills: true, crumble: true, movers: true, zips: true, keys: true, gems: true } }, 6418]
];
// World 4, the Temple: the common pieces over yellow stone, named like arcade stages.
var SET4 = [
  ['Raid',        { difficulty: 1, obstacles: 0, styles: ['jump'],  spikes: 1, elements: { spikes: true, refills: true, springs: true } }, 8111],
  ['Vault',       { difficulty: 1, obstacles: 1, styles: [],        layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, keys: true, gems: true } }, 8112],
  ['Strafe',      { difficulty: 2, obstacles: 1, styles: ['dash'],  spikes: 1, elements: { spikes: true, refills: true, zips: true, lasers: true, gems: true } }, 8213],
  ['Ambush',      { difficulty: 2, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, crumble: true, keys: true } }, 8214],
  ['Round 2',     { difficulty: 3, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, refills: true, movers: true, drones: true, gems: true } }, 8315],
  ['Continue?',   { difficulty: 3, obstacles: 2, styles: ['jump'],  spikes: 2, elements: { spikes: true, refills: true, springs: true, lasers: true, keys: true, gems: true } }, 8316],
  ['Boss Rush',   { difficulty: 4, obstacles: 2, styles: [],        layout: 'islands', spikes: 2, elements: { spikes: true, refills: true, crumble: true, zips: true, lasers: true, drones: true, gems: true, keys: true } }, 8417],
  ['Final Round', { difficulty: 5, obstacles: 2, styles: [],        spikes: 2, elements: { spikes: true, refills: true, crumble: true, movers: true, zips: true, springs: true, lasers: true, drones: true, gems: true, keys: true } }, 8518]
];
// World 5, Neon Row: the night city. Sparks on cables and holo signs, half of them island rooms.
var SET5 = [
  ['Night Shift', { difficulty: 1, obstacles: 0, styles: ['jump'],  spikes: 1, elements: { spikes: true, refills: true, springs: true } }, 9111],
  ['Afterglow',   { difficulty: 1, obstacles: 1, styles: [],        layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, gems: true } }, 9112],
  ['Static',      { difficulty: 2, obstacles: 1, styles: ['dash'],  spikes: 1, elements: { spikes: true, refills: true, zips: true, crumble: true, wires: true, gems: true } }, 9213],
  ['Downpour',    { difficulty: 2, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, springs: true, keys: true } }, 9214],
  ['Signal',      { difficulty: 3, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, refills: true, movers: true, zips: true, holos: true, gems: true, keys: true } }, 9315],
  ['Back Alley',  { difficulty: 3, obstacles: 2, styles: ['jump'],  layout: 'islands', spikes: 2, elements: { spikes: true, refills: true, zips: true, crumble: true, keys: true, gems: true } }, 9316],
  ['Overpass',    { difficulty: 4, obstacles: 2, styles: [],        spikes: 2, elements: { spikes: true, refills: true, crumble: true, movers: true, zips: true, springs: true, wires: true, holos: true, gems: true, keys: true } }, 9417],
  ['Last Train',  { difficulty: 5, obstacles: 2, styles: [],        layout: 'islands', spikes: 2, elements: { spikes: true, refills: true, crumble: true, zips: true, springs: true, gems: true, keys: true } }, 9518]
];
// One tall (two-screen) level per world, so the scrolling camera has something to show.
var TALL = [
  ['The Long Way', { difficulty: 2, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, crumble: true, movers: true, zips: true, springs: true, gems: true, keys: true }, world: 1, rows: 54 }, 7111],
  ['Cold Shaft',   { difficulty: 3, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, refills: true, ice: true, springs: true, zips: true, gems: true, keys: true }, world: 2, rows: 54 }, 7212],
  ['The Chimney',  { difficulty: 3, obstacles: 1, styles: ['jump'],  layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, firepits: true, fireballs: true, jets: true, lava: true, springs: true, gems: true }, world: 3, rows: 54 }, 7313],
  ['The Pyramid',  { difficulty: 3, obstacles: 1, styles: [],        spikes: 1, elements: { spikes: true, refills: true, zips: true, springs: true, lasers: true, drones: true, gems: true, keys: true }, world: 4, rows: 54 }, 7414],
  ['The Tower',    { difficulty: 3, obstacles: 1, styles: ['climb'], layout: 'islands', spikes: 1, elements: { spikes: true, refills: true, zips: true, springs: true, crumble: true, gems: true, keys: true }, world: 5, rows: 54 }, 7515]
];
var starters = [], plans = [];
SET.forEach(function (s, i) {
  s[1].world = 1;
  var out = generateRoom(s[1], s[2]);
  out.room.id = 'starter-0' + (i + 1); out.room.name = s[0]; out.room.world = 1; out.room.level = i + 1;
  starters.push(out.room); plans.push(out.plan);
});
SET2.forEach(function (s, i) {
  s[1].world = 2;
  var out = generateRoom(s[1], s[2]);
  out.room.id = 'ice-0' + (i + 1); out.room.name = s[0]; out.room.level = i + 1;
  starters.push(out.room); plans.push(out.plan);
});
// Par times: the auto-player's time on each level (written by `tests/gentest.js 0`) plus a margin, so a clean,
// unhurried run earns the time star. The hand-made first room uses the demo's time instead.
var PAR_MARGIN = 1.4, times = {};
try { times = JSON.parse(fs.readFileSync(d + '/starter-times.json', 'utf8')); } catch (e) {}
starters.forEach(function (r) { if (times[r.id]) r.par = Math.ceil(times[r.id] * PAR_MARGIN); });
SET3.forEach(function (s, i) {
  s[1].world = 3;
  var out = generateRoom(s[1], s[2]);
  out.room.id = 'fire-0' + (i + 1); out.room.name = s[0]; out.room.level = i + 1;
  starters.push(out.room); plans.push(out.plan);
});
SET4.forEach(function (s, i) {
  s[1].world = 4;
  var out = generateRoom(s[1], s[2]);
  out.room.id = 'temple-0' + (i + 1); out.room.name = s[0]; out.room.level = i + 1;
  starters.push(out.room); plans.push(out.plan);
});
SET5.forEach(function (s, i) {
  s[1].world = 5;
  var out = generateRoom(s[1], s[2]);
  out.room.id = 'neon-0' + (i + 1); out.room.name = s[0]; out.room.level = i + 1;
  starters.push(out.room); plans.push(out.plan);
});
TALL.forEach(function (s, i) {
  var out = generateRoom(s[1], s[2]);
  out.room.id = 'tall-0' + (i + 1); out.room.name = s[0]; out.room.level = 9;
  starters.push(out.room); plans.push(out.plan);
});
starters.forEach(function (r) { if (times[r.id]) r.par = Math.ceil(times[r.id] * PAR_MARGIN); });
fs.writeFileSync(d + '/starter-plans.json', JSON.stringify({ rooms: starters, plans: plans }));

// Trial rooms: hand-made rooms built around one move each (src/trials-make.js writes them, tests/trials.js proves each
// one with a recorded run in src/trial-runs.json). They go after a world's own levels and never hold the next world
// back. Par is the recorded run's time x TRIAL_MARGIN (the search plays sharper than a person), and the recording
// joins the idle demo.
var WIDE_TRIALS = false;   // the six trial rooms are 27 wide (portrait); they come back once redrawn for 48 x 27
var TRIAL_MARGIN = 2, trialRuns = {};
try { trialRuns = JSON.parse(fs.readFileSync(d + '/trial-runs.json', 'utf8')); } catch (e) {}
var trialDemos = {};
(WIDE_TRIALS ? fs.readdirSync(d + '/trials') : []).filter(function (f) { return /\.json$/.test(f); }).map(function (f) { return JSON.parse(fs.readFileSync(d + '/trials/' + f, 'utf8')); })
  .sort(function (a, b) { return (a.difficulty - b.difficulty) || (a.id < b.id ? -1 : 1); }).forEach(function (r) {   // easier trials first
  var top = 0;
  starters.forEach(function (s) { if (worldOfRoom(s) === r.world) top = Math.max(top, s.level || 0); });
  r.level = top + 1;
  var rec = trialRuns[r.id];
  if (rec) {
    r.par = Math.max(8, Math.ceil(rec.length / 60 * TRIAL_MARGIN));
    var rl = []; rec.forEach(function (c) { if (rl.length && rl[rl.length - 2] === c) rl[rl.length - 1]++; else rl.push(c, 1); });
    trialDemos[r.id] = rl;
  }
  starters.push(r);
});
function worldOfRoom(r) { return r.world || 1; }

var one = JSON.stringify(starters[0]), all = JSON.stringify(starters);
var demos = '{}';
try { demos = fs.readFileSync(d + '/starter-demos.json', 'utf8'); } catch (e) {}
demos = JSON.stringify(Object.assign(JSON.parse(demos), trialDemos));
function fill(t, rooms) {
  return t.split('/*ALL_ROOMS*/').join(all.slice(1, -1)).split('/*DEMOS*/').join(demos).split('/*ROOM_JSON*/').join(rooms).split('/*SHARED_TILES*/').join(tilesJs).split('/*GEN*/').join(gen).split('/*SHARED_CONFIG*/').join(cfg).split('/*SHARED_HERO*/').join(heroJs).split('/*SHARED_FOES*/').join(foesJs).split('/*SHARED_WORLDS*/').join(worldsJs).split('/*SHARED_SCREEN*/').join(screenJs);
}
fs.writeFileSync(d + '/../index.html', fill(fs.readFileSync(d + '/template.html', 'utf8'), all.slice(1, -1)));
fs.mkdirSync(d + '/../builder', { recursive: true });
fs.writeFileSync(d + '/../builder/index.html', fill(fs.readFileSync(d + '/builder-template.html', 'utf8'), one));
