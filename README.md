# Lunar Jetman — browser release 4.6.0

Open `index.html` in a modern desktop browser. It is the complete game: artwork,
generated sound and music are embedded, so no installation or network connection
is required. Browsers wait for a key press or click before allowing sound.

## What is in this archive

- `index.html` — the playable, self-contained browser build.
- `source/web/` — the browser rules, input, renderer, generated audio and packed art.
- `source/tests/` — deterministic Node regression tests.
- `source/tools/build_web.py` — rebuilds the single HTML file from `source/web/`.
- Release notes, programmer notes, test report, credits, provenance and checksums.

There is no Python or Windows edition in this browser package, and no source-asset
archive. Those are deliberately outside this release rather than being promised by
a README and then absent when somebody quite reasonably goes looking for them.

## Controls

- Arrows or WASD: move; Up fires the jetpac.
- Space, Z or Ctrl: fire.
- X, C, Shift or Enter: pick up/drop; in the rover, lay a bridge.
- Down or S: board the rover or use a teleporter.
- Up while in the rover: get out.
- P: pause. M: mute. N: music. F: fullscreen. F2: field telemetry.
- F3: controller setup and live pad status. Esc: title.

Standard-mapped gamepads are supported. If the active pad disappears, play pauses
and never resumes by itself. A returning pad must first be neutral, so a held
trigger cannot become a surprise shot.

The controller panel has separate horizontal, thrust and board/descend dead zones,
plus an optional release buffer for noisy sticks. The defaults reproduce 4.5.0's
input response. Six named level profiles now stage enemy introductions and change
the decorative lunar skyline; scenery does not alter collision geometry.

## Rebuild and test

From the archive root, with Python and Node available:

```text
python source/tools/build_web.py
node source/tests/mechtest.js
node source/tests/inputtest.js
node source/tests/arttest.js
```

The build script expects the package layout and writes `source/dist_web/index.html`.
The top-level `index.html` is the already tested release build.

