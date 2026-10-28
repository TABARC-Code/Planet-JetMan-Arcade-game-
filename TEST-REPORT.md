# Test report — v4.6.0

Tested on 27 October 2026 from the clean v4.6.0 release source.

## Passed

- JavaScript syntax checks for `game.js`, `sfx.js`, `music.js`, `input.js` and `main.js`.
- All v4.5.0 controller recovery, diver, damage-sprite, audio-warning and gameplay
  regressions remain in the passing suites.
- Controller-setting checks for clamping, ordered thresholds, hysteresis, exact
  boundaries, safe reconfiguration, one-shot View/Select input and D-pad navigation
  independent of analogue dead zones.
- Six explicit level profiles, their enemy introductions and their bounded
  post-level-six progression.
- Art-asset contract for every enemy strip, explosion sheet, parallax layer, Earth,
  fuel silo and packed browser-asset entry.
- Controller lifecycle regression suite: connection, active-pad ownership,
  one-shot edges, active and inactive disconnection, held-input quarantine,
  neutral recovery, focus reset, explicit Start recovery, same-index device
  replacement, diagnostic pad count and invalid-axis sanitisation.
- Browser mechanics suite: bomb, bridge, rover, trailer, teleport, refuelling,
  missiles, Earth damage, crash craters, enemy damage states, UFO behaviour,
  diver telegraph duration and world-seam targeting, one-shot rover obstruction
  episodes, generated sound data and warning priority.
- One-file browser build, including controller setup, 19 generated effects,
  generated music, packed art, named levels and the F2 field-telemetry view.
- In-browser 12,000-frame soak test from the rebuilt single-file edition:
  `SELFTEST OK frames=12000 games=1 maxLevel=1 ms=3929 audio=suspended sfx=19
  music=30.0s`.
- Browser UI check: F3 opened the labelled modal; a changed horizontal dead zone
  survived reload; Reset restored 40%; Apply closed the panel; no console warnings
  or errors were reported.
- Staged visual comparison of Dust Plain and Black Sky, including their different
  landmarks, level labels, damaged heavy, diver warning, rover marker and explosions.
- Staged render inspection covering the diver brackets, downward chevrons, rover
  obstruction marker, field telemetry and damaged enemy frames.
- Python syntax checks for the browser build and both allowlisted packaging tools.
- The extracted browser package matched all 37 manifest entries; the extracted
  complete package matched all 409 manifest entries across 410 files.
- Controller, mechanics and art suites passed again inside both extracted archives.
- Both extracted source trees rebuilt `index.html` byte-for-byte to SHA-256
  `2DFB3F7023C1FCD044E2DD4B207E37BD1D488D56AFEE41E239390B85F5DE89DF`.

## Honest limits

- The browser reported its AudioContext as suspended during the automated soak
  because no user gesture had occurred. Buffer construction was verified;
  loudspeaker playback and subjective balance were not.
- No physical controller was available to unplug and reconnect. The lifecycle
  logic was exercised with deterministic Gamepad snapshots, but real hardware,
  browser drivers and controller-specific mappings remain a manual check.
- The parked Python/Windows edition is present only in the complete-project
  archive as legacy material. It was not rebuilt or represented as v4.6.0 or
  feature-equivalent; the slim browser package does not include it.
- No complete human playthrough was performed. Deterministic rules checks and a
  12,000-frame browser soak catch regressions; they do not possess human taste,
  timing or the instinct to swear when a bridge kit rolls away.
