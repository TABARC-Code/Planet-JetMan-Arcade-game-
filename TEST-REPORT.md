# Test report — v4.7.0

Tested on 28 October 2026 from the v4.7.0 release source.

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
