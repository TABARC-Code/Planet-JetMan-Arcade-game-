# Lunar Jetman — browser release 4.8.0

Version 4.8.0 adds rotating missions, rover loadouts, coordinated enemies,
risk-and-reward salvage, level events, optional objectives and the mobile command
vehicle encounter. Classic mode keeps the old-school pressure without removing the
warnings which make a hard game readable.

Open `index.html` in a modern desktop browser. It is the complete game: artwork,
generated sound and music are embedded, so no installation or network connection
is required. Browsers wait for a key press or click before allowing sound.

## What is in this archive

- `index.html` — the playable, self-contained browser build.
- `RELEASE-README.md` — the short guide used inside the browser-only ZIP.
- `source/web/` — the browser rules, input, renderer, generated audio and packed art.
- `source/tests/` — deterministic Node regression tests.
- `source/tools/build_web.py` — rebuilds the single HTML file from `source/web/`.
- `source/tools/package_browser.py` and `package_source.py` — create deterministic
  browser and source archives from explicit file lists.
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
- P: pause. M: mute. N: music. B: ambience. F: fullscreen. F2: field telemetry.
- F3: controller setup and live pad status. Esc: title.

Standard-mapped gamepads are supported. If the active pad disappears, play pauses
and never resumes by itself. A returning pad must first be neutral, so a held
trigger cannot become a surprise shot.

The controller panel has separate horizontal, thrust and board/descend dead zones,
plus an optional release buffer for noisy sticks. The defaults reproduce 4.5.0's
input response. Six named level profiles stage enemy introductions, scenery and
their own generated ambience; scenery does not alter collision geometry.

The first three missions rotate between bomb delivery, stranded-supply recovery
and emergency rover repair. Before starting, choose one rover loadout with Left or
Right, or keys 1–4: cannon, bridge reserve, fuel reserve or cargo rack. Press T, Up
or Down on the title screen to toggle Classic mode. Classic starts with three lives,
shorter deadlines, faster waves, tougher missiles and no automatic replacement
bridge kits. It is meant to be difficult; the warnings remain fair.

Enemies now combine their existing strengths: divers use heavies to shape an
escape route, chasers screen missile sites, and UFOs raid loose cargo. Destroyed
enemies occasionally leave fuel cells, laser cells or unstable technology. The
first two are immediate supplies; unstable technology pays well at the rover and
explodes after nine seconds if enthusiasm outruns judgement.

Each level also names one predictable disruption: solar interference, a teleporter
outage, a meteor front or a low-gravity surge. Events are announced, temporary and
repeat on a fixed rotation. An optional objective sits beside the main job and pays
500 points per current level for combat, salvage recovery or a fast finish. Missing
it never blocks the primary mission.

From level four, later bomb runs add a mobile command vehicle around the missile
site. Its shield rejects ordinary fire. The vehicle marks a ground strike, fires,
then exposes its core briefly; one clean hit forces it to recover and four openings
destroy it. At half strength its damaged phase cycles faster, while the warning
remains explicit. Bombs bounce clear of the protected site instead of disappearing.

Jetman and the rover now use original, higher-detail pixel art. Jetman's four poses
share a stable 17×20 design, while the rover has a 42-pixel outlined chassis,
articulated wheels and a two-wheel trailer. No external character or vehicle frames
are required. The browser also synthesises 22 event effects, six ambience beds and
the music at runtime; the archive contains no playable audio files.

## Rebuild and test

From the archive root, with Python and Node available:

```text
python source/tools/build_web.py
node source/tests/mechtest.js
node source/tests/inputtest.js
node source/tests/arttest.js
node source/tests/audiotest.js
```

The build script expects the package layout and writes `source/dist_web/index.html`.
The top-level `index.html` is the tested release build. Packaging scripts accept an
`--output-root` directory and refuse development version markers.
