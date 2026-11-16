# Lunar Jetman — browser release 4.8.0

Open `index.html` in a modern desktop browser. The game, artwork, generated sound
and music are contained in that one file; no installation or network connection is
required. Browsers wait for a key press or click before allowing sound.

## Controls

- Arrows or WASD: move; Up fires the jetpac.
- Space, Z or Ctrl: fire.
- X, C, Shift or Enter: pick up/drop; in the rover, lay a bridge.
- Down or S: board the rover or use a teleporter.
- Up while in the rover: get out.
- P: pause. M: mute. N: music. B: ambience. F: fullscreen.
- F2: field telemetry. F3: controller setup and pad status. Esc: title.

Use Left or Right, or keys 1–4, to choose a rover loadout before starting. Press T,
Up or Down on the title screen to toggle Classic mode.

Standard-mapped gamepads are supported. A disconnected active pad pauses play. A
returning pad must be neutral before it can recover, and the game never resumes by
itself. Physical controller reconnection was not available for this release test;
the state machine has deterministic regression coverage.

`MANIFEST-SHA256.txt` records every file in this archive. The source archive is a
separate download for rebuilding, inspection and regression testing.
