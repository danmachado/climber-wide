# Climber: project brief

Paste this into the Climber Game project's instructions, or add it as project knowledge. It points at everything
else; the code itself carries the detailed rules in CLAUDE.md.

## What it is

A single-screen precision platformer (Celeste-style movement, original art and levels) for Dan's wall-mounted
Tokenframe, a 55 inch portrait Android display running Chrome as a PWA. Plus a room builder that publishes levels.
Repo: danmachado/climber on GitHub, served by GitHub Pages from main.

## Where the knowledge lives

- `CLAUDE.md` in the repo: the rules of the codebase (build pipeline, tests, every mechanic and world, the frame's
  performance limits, reply style). Any session with the repo attached reads it automatically. Keep it current.
- Research reports (Claude Docs):
  - Celeste Movement Report: https://claude.ai/artifact/WXE5vrhWKFG1gsxUSfZXC9
  - Celeste Level Design Report: https://claude.ai/artifact/3r47QJcGcrht8vH2powQ23
  - Celeste Aesthetic Report: https://claude.ai/artifact/MLXRM7ZVP6pR2Mk8A7b8KQ
  - Celeste Character Report: https://claude.ai/artifact/BpFht5FFqds5G4Hk7W4ENC
  - Death Fight Forever Report (world 4, Temple): https://claude.ai/artifact/Phg4TAT78vSfPFmP8sxXob
  - Neon City Report (world 5, Neon Row): https://claude.ai/artifact/BJJEWg4w4RFnMa5JZBAaU3
- Diagnostic pages for the frame: `controller-test/` and `perf/` in the repo.

## Standing rules from Dan

- Dan does account setup, sign-in, purchases and anything that costs money. Claude never enters passwords or
  creates accounts.
- Inspiration only: all art, levels, characters, names and sounds are original. Nothing copied from other games.
- Say plainly what was tested and what was not, especially anything not yet seen on the frame.
- The frame is slow at repainting: no full-screen redraws per frame, no flashing or strobing, mark dirty rectangles.
- Every new level element goes into the game, the builder palette, the auto-builder (`src/gen.js`) and the
  auto-player (`tests/gentest.js`), with a large sweep at zero failures before shipping.
- Reply style: short, casual, bullets for steps, no em dashes, no emoji.

## State as of 2026-10-14

- Five worlds: Brickyard, Icehouse, Furnace, Temple, Neon Row. Nine levels each (one tall), half of them island
  layouts (floating slabs, pillars, shelves) and half floors.
- Hero: hero-wolf, the lone climber with the bandana (two one-pixel tails and a lock of hair simulated in code).
- Six trial rooms (hand-made, one move each): Pinpoint and Handhold close out Brickyard, Kickback Icehouse, Dash Only
  Furnace, Freefall Temple, Cascade Neon Row. Framed on the map, never block the next world. Each is proven beatable
  by a recorded run in the real game, and the dash, climb and super rooms are proven unbeatable without that move.
- Not yet seen on the frame: Temple, Neon Row, island layouts, the hero restyle, lasers and drones readability,
  the trial rooms.
- Next up when Dan says so: a smarter auto-player for island rooms (option A), more island hazards (drones,
  lasers on slabs), and whatever he brings.

## Climber Wide (2026-10-16): the landscape version

- Dan's 8BitDo switches to Apple mode, so the game plays on his laptop. The plan: keep the frame's portrait game
  untouched, build a landscape version for laptops, TVs and iPads, ship to Steam first (web build in a desktop
  wrapper), then consoles (Nintendo, PlayStation, Xbox) if it is good.
- Separate repo `climber-wide` (a copy with the frame's full history; `danmachado/climber-wide` on GitHub once Dan
  creates it, page at `danmachado.github.io/climber-wide/`). Its own `CLAUDE.md` says how it differs. One-time steps
  for Dan in `docs/WIDE-SETUP.md`: make the empty GitHub repo, push, turn on Pages; run the SQL that copies the two
  Supabase tables to `rooms_wide` and `room_versions_wide` with their policies.
- Decided: option B, wide rooms (48 x 27 tiles, same 10 px tiles, tall rooms 54 rows; the frame's buffer turned on its
  side, exactly 16:9), with a fresh level set. Option A (scrolling the old tall rooms) left dead space at the sides.
- Done 2026-10-16: the copy; own save prefix (`climberwide.`) and own tables; `src/shared-screen.js` as the one place
  the screen and room shape live (game, builder, auto-builder, tests all read it); every screen relaid for landscape;
  all 45 levels generated fresh (level 1 too); auto-player 45/45, sweeps 3600/3600 floors and 3600/3600 islands;
  parallax (sky, far and near silhouettes on layers behind the room, sliding with the camera in tall rooms plus a
  small lead with the hero; PARALLAX switch under GRAPHICS; off in the fast mode).
- Parked in the wide repo until redrawn for 48 x 27: the hand-made combat 1-1 and the six trial rooms (portrait).
  Neon Row's far-row traffic and far-window blinking are off with parallax on (the far rows are a still layer).
- Not yet seen by Dan on any screen: the wide build, parallax. Everything above is headless (Playwright) only.
- Next for wide: Dan plays it on the laptop; level design for landscape (wide floors rooms are long corridors, islands
  suit it better); a hand-made wide 1-1 with combat; trials redrawn; Steam prep (fullscreen with whole-number scaling,
  pause on focus loss, keyboard remap, then an Electron or Tauri wrapper).
