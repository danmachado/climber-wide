# Climber Wide

The landscape (480 x 270) version of Climber, for laptops, TVs and iPads, plus its room builder. The wall frame's portrait version lives in `danmachado/climber`.

- `index.html` is the game.
- `builder/` is the room builder (paint, auto-build, play test, publish).
- `controller-test/` and `perf/` are diagnostic pages for the frame.
- `playground.json` is a sample room using ice, crumble blocks and moving platforms. Import it in the builder.

These files are built output. Published rooms live in Supabase and are fetched by the game at start.
