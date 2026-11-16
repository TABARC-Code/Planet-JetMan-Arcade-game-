# Test report — v4.8.0

Final release tested on 16 November 2026 from release/4.8.0.

## Final release

- JavaScript syntax checks passed for all ten browser and regression files. Python
  syntax checks passed for the builder and both deterministic packaging tools.
- The complete mechanics suite passed: mission rotation, all four loadouts,
  Classic mode, coordinated enemies, salvage, level events, optional objectives
  and the command-vehicle encounter.
- Controller lifecycle, art-contract and generated-audio suites passed.
- The final 224 KB single-file browser rebuilt with SHA-256
  1F7C984F5E84EA22AC7A657CF83AE2658DDF23305B927115DE6BECB40A282E9E.
- Isolated Chromium interaction passed game start, ambience off/on, pause and
  explicit recovery, and controller-dialog open and safe close.
- The 1280×800 level-four frame showed the command vehicle, strike warning, HUD,
  scanner, rover, Jetman, enemy damage and explosion states.
- The same browser completed a 12,000-frame soak with no console or page errors:
  SELFTEST OK frames=12000 games=1 maxLevel=1 ms=15815 audio=suspended buffers=28 ambience=6 music=30.0s.
- The browser archive's seven-entry manifest and source archive's 41-entry
  manifest matched every extracted payload file.
- All four suites passed again inside the extracted source archive. Its rebuild
  matched its own top-level game and the browser archive byte-for-byte.
- The desktop-interaction bridge was unavailable. Browser checks used an isolated
  Chromium process with real keyboard events, rendered pixels and console capture;
  this was not a hand-operated GUI playthrough.

## v4.8.0-dev.4 milestone record

- Command-vehicle gating, shielding, target marking, reaction time, exposed-core
  punishment, faster damaged phase, score award and destruction passed.
- The missile site remained protected while the vehicle lived. A premature bomb
  was rejected without being lost, and the normal mission completed once the
  shield source had gone.
- An ignored marked strike hit Jetman; moving before impact remained valid
  counterplay. The art stage showed the mobile vehicle, shield brackets, charged
  cannon, ground marker, scanner contact and HUD state at level four.
- Solar interference, teleporter outages, meteor fronts, low-gravity surges and
  all three optional objectives passed again.
- Diver/heavy herding, chaser site defence, UFO cargo theft/recovery and the full
  salvage loop passed again.
- Mission rotation, all four loadouts, Classic mode and the complete earlier
  mechanics, controller, art and audio suites passed again.
- The rebuilt 223 KB single-file browser completed a 12,000-frame headless soak:
  `SELFTEST OK frames=12000 games=1 maxLevel=1 ms=15075 audio=suspended buffers=28 ambience=6 music=30.0s`.
- Project-facing wording contains no prohibited development-tool references.

The development browser's interactive console could not be inspected during the
dev.4 run. The final release's isolated Chromium interaction and console check are
recorded above rather than being retroactively assigned to that earlier milestone.

A physical-controller playthrough remains unverified. Hardware remains hardware,
obstinately.

The v4.7.0 regression record follows as historical evidence for the inherited
controller, art and audio systems.

## Passed

- JavaScript syntax checks for `game.js`, `sfx.js`, `music.js`, `input.js`,
  `main.js` and `assets.js`.
- All existing controller recovery, controller-setting, level-profile, gameplay,
  diver, damage-sprite and warning regressions.
- Mechanics coverage for bomb, bridge kit, rover, trailer, teleport, refuelling,
  missiles, Earth damage, crash craters, enemy damage states and UFO behaviour.
- Controller lifecycle coverage for ownership, edge inputs, active and inactive
  disconnection, neutral recovery, focus reset, explicit Start recovery, device
  replacement, diagnostics and invalid-axis sanitisation.
- Art contract for every enemy and explosion sheet, parallax layers, Earth, silo
  and packed browser asset.
- Original-art contract for Jetman's 15 shared body rows, four five-row poses,
  17-pixel grid and declared palette.
- Rover contract for the 42-pixel chassis, three articulated wheel positions and
  the trailer's two-wheel silhouette.
- Audio contract for 22 generated event recipes, six four-second ambience beds,
  level-theme mapping, event priority, cooldowns, instance limits and voice stealing.
- Runtime scan confirming that the browser source references no WAV, MP3, OGG,
  M4A or AAC file.
- Python syntax checks for the one-file builder and both packaging tools.
- One-file browser build at 193 KB, containing the current source, art, generated
  sound, ambience and music.
- In-browser Black Sky art-stage inspection of Jetman, rover, trailer, damaged
  heavy, diver warning, obstruction marker and explosions; no console warnings or
  errors were reported.
- In-browser 12,000-frame soak from the rebuilt single-file edition:
  `SELFTEST OK frames=12000 games=1 maxLevel=1 ms=3317 audio=suspended buffers=28 ambience=6 music=30.0s`.
- Live browser interaction after a user gesture: game start, ambience off/on and
  pause/recovery completed without console warnings or errors.
- The extracted browser package matched all 38 manifest entries.
- The extracted complete package matched all 413 manifest entries across 414 files.
- Controller, mechanics, art and audio suites passed again inside both extracted
  archives.
- Both extracted source trees rebuilt `index.html` byte-for-byte to the released
  single-file build.

## Honest limits

- The automated soak deliberately begins without a user gesture, so the browser
  reports its AudioContext as suspended. Buffer construction and live post-gesture
  startup were verified; subjective loudspeaker balance was not.
- No physical controller was available to unplug and reconnect. Deterministic
  Gamepad snapshots cover the recovery state machine, but real USB, Bluetooth,
  browser-driver and pad-mapping behaviour remains a manual check.
- The parked Python/Windows edition is legacy material in the complete archive. It
  was not rebuilt or presented as v4.7.0 or feature-equivalent.
- No complete human playthrough was performed. The deterministic suites and browser
  soak are broad, but they cannot decide whether the third consecutive crater was
  thrilling or merely the moon being difficult.
