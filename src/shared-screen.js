  // ---- the screen and the room shape: one place, read by the game, the builder, the auto-builder and the tests ----
  // Landscape, 16:9, the frame's 270 x 480 buffer turned on its side. A room is one screen of 48 x 27 tiles, or a tall
  // room of two (54 rows) that scrolls. Everything that lays out a screen reads these; nothing else may bake a size in.
  var SCREEN = { w: 480, h: 270, tile: 10, cols: 48, rows: 27, tall: 54 };
  if (typeof module !== 'undefined') module.exports = SCREEN;
  if (typeof window !== 'undefined') window.SCREEN = SCREEN;   // gen.js is also loaded on its own by the tests
