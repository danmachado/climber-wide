  // ---- worlds: each world is a theme and an ordered list of levels (shared by the game and the builder) ----
  // A room says which world and level it is with two plain fields in its data: world (1, 2, ...) and level (1, 2, ...).
  // Rooms without them belong to world 1 and go after the numbered levels.
  var WORLDS = [
    { id: 1, name: 'Brickyard', theme: 'brick', tiles: [], elements: [] },
    { id: 2, name: 'Icehouse',  theme: 'frost', tiles: ['I'], elements: ['ice'] },
    { id: 3, name: 'Furnace',   theme: 'ember', tiles: ['F', '*', 'J', '~'], elements: ['firepits', 'fireballs', 'jets', 'lava'] },
    { id: 4, name: 'Temple',    theme: 'jungle', tiles: ['L', 'O'], elements: ['lasers', 'drones'] },
    { id: 5, name: 'Neon Row',  theme: 'neon',   tiles: ['w', '%'], elements: ['wires', 'holos'] }
  ];
  // Pieces that belong to one world only. tiles are level characters, elements are the auto-builder's piece names.
  // Everything not listed by any world is common and can be used anywhere. A new world lists its own pieces here.
  function tileWorld(ch) { for (var i = 0; i < WORLDS.length; i++) if (WORLDS[i].tiles.indexOf(ch) >= 0) return WORLDS[i].id; return 0; }
  function elementWorld(name) { for (var i = 0; i < WORLDS.length; i++) if (WORLDS[i].elements.indexOf(name) >= 0) return WORLDS[i].id; return 0; }
  // sky is the gradient top to horizon, far is [far band, near band, detail] for the silhouettes, skyline their shape.
  var THEMES = {
    brick: { tiles: 'brick', bg: '#0a0d1c', dot: '#1b2145', back: ['#171e47', '#0f1432', '#262f68'], accent: '#ffb74a', accentLo: '#c47f24',
      sky: ['#070a16', '#10153a', '#262d66'], far: ['#141a46', '#0b0f2c', '#2d3576'], skyline: 'town', scene: 'yard' },
    ember: { tiles: 'ember', bg: '#120909', dot: '#3a1714', back: ['#2b1513', '#1b0c0b', '#4a2119'], accent: '#ff8a4a', accentLo: '#c25a24',
      sky: ['#0b0404', '#1e0a08', '#521c12'], far: ['#26110d', '#110504', '#7a2e1c'], skyline: 'cave', scene: 'forge' },
    frost: { tiles: 'frost', bg: '#07121d', dot: '#16324a', back: ['#12283c', '#0b1a29', '#1f4460'], accent: '#9fe3ff', accentLo: '#5aa3c4',
      sky: ['#040b14', '#0d2238', '#204d6c'], far: ['#143148', '#091826', '#5a93b6'], skyline: 'peaks', scene: 'glacier' },
    jungle: { tiles: 'jungle', bg: '#07141a', dot: '#1a3a3c', back: ['#24403a', '#172b26', '#6f9a80', '#3a5c50'], backKind: 'stone', accent: '#ff4fa3', accentLo: '#b8306f',
      sky: ['#1a6a8e', '#38acbc', '#a4ead6'], far: ['#4f9f8c', '#3f8a78', '#86c9b4'], skyline: 'pyramid',
      // the ruined back wall (ruinsBack/ruinsFront in shared-tiles.js): each nearer layer a step darker
      ruins: { cloud: 'rgba(255,255,255,0.22)', canopy: ['#7cc6b0', '#5fb39c', '#9ad6c2', '#7cc6b0'],
        mid: { body: ['#62a594', '#5fa08f', '#66a998'], mortar: '#559484', carve: '#559484', hi: '#93cdb9', lo: '#518d7d', side: '#62a594', cut: '#62a594',
               pil: ['#6aad9b', '#84c2ad', '#5a9787'], fr: ['#62a594', '#93cdb9', '#518d7d'], shadow: '#3f7a6a' },
        near: { body: ['#35564a', '#325148', '#395b4d'], mortar: '#243c34', carve: '#22382f', hi: '#93c79a', cut: '#5e8670', side: '#466c5c', lo: '#1c2f29',
                pil: ['#3f6658', '#5c8a72', '#2a463d'], fr: ['#3c6253', '#76a687', '#1f3530'], shadow: '#082019' },
        leaf: ['#145a32', '#23803f', '#3fa152', '#86d070'], leafFar: ['#4f9f7c', '#5fab86', '#72b892'] } },
    neon: { tiles: 'neon', bg: '#0c0a1e', dot: '#c4b8f2', back: ['#13112b', '#0b0a1c', '#221e44'], backKind: 'windows', accent: '#ff3ab8', accentLo: '#b01f7c',
      sky: ['#24194e', '#4f3f94', '#a592dc'], far: ['#241446', '#140b2e', '#38f0ff'], skyline: 'towers' }   // a lavender night: the far city is light haze, the play layer stays darkest
  };
  function worldOf(room) { var n = (room && room.world) | 0; return WORLDS[n - 1] ? n : 1; }
  function themeOf(room) { return THEMES[WORLDS[worldOf(room) - 1].theme] || THEMES.brick; }
  // Stars: one for beating the level, one for few falls, one for beating the par time.
  var STAR_FALLS = 2;
  function parOf(room) { return room.par > 0 ? room.par : 20 + 6 * (room.difficulty || 1); }
