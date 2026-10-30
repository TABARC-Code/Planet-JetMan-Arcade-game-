# Programmer notes — browser 4.7.0

For 4.7.0 I replaced the two silhouettes that still looked like placeholders.
Jetman now has one shared 17-pixel body across idle, two walking strides and flight,
so his visor, pack and chest panel stay attached to the same person. The rover now
has a properly outlined chassis, three articulated wheel positions, a readable cab
and a trailer which appears engineered rather than mildly embarrassed.

I reviewed two CC0 platformer sheets for scale and pose rhythm, then kept their
pixels out of the build. The result is original project art, fixed to the existing
palette and tested at row level. Collision geometry has not changed.

The audio system grew up at the same time. Effects and ambience now use separate
buses, a 16-voice priority limit and short warning ducking. Six level beds provide
radio hiss, relay chatter and low machinery without inventing lunar weather. Heavy
damage, missile launch and level transition each gained their own cue. Everything
is still generated in JavaScript.

Future ideas: a boarding animation, cannon recoil and a rover damage state. I have
left them out until the new scale has survived ordinary play; enthusiasm remains a
poor substitute for collision testing.

## v4.6.0 notes

For 4.6.0 I turned the difficulty curve into six named profiles. The same moon now
develops a recognisable geography: Dust Plain rocks, Static Valley aerials, Crater
Belt crystals, Red Terminator pylons, Iron Waste girders and Black Sky obelisks.
They are deliberately decorative. A scenic rock which stops the rover is merely a
bug wearing a small hat.

The controller panel exposes the thresholds that used to be constants. I kept the
old values as defaults, split upward thrust from downward boarding, and added a
release buffer for worn sticks. Applying settings re-arms the neutral-input gate;
closing the panel never resumes play. The player should decide when danger starts.

The new art contract reads the real PNG headers and checks every packed strip. It
cannot judge whether an alien is handsome, but it will notice if one loses a frame,
changes dimensions or vanishes from the single-file build.

Future ideas: optional light rumble after a surviving heavy takes a hit, stronger
mission variation beyond the sixth level, and a key-remapping page. I have not put
rumble in this release without physical hardware testing. Optimism is not a driver.

## v4.5.0 notes

For 4.5.0 I pulled the enemy-behaviour, art, world, play, audio and QA notes into one small
argument: threats ought to tell the truth. A diver now holds position for 0.55
seconds, flashes a shape-based warning and commits to the target it announced.
Re-aiming halfway down would be clever code and rotten manners.

The rover follows the same rule. Its nose lamp and amber chevron remain visible
while a crater blocks it, and the mechanical thunk happens once per obstruction
episode. The session counters measure episodes rather than frames; otherwise one
stubborn second on the accelerator becomes sixty alleged design disasters.

F2 exposes those figures locally. They are deliberately plain counters, with no
network, persistent identifier or analytics theatre. I also repaired release
provenance and wrote a browser-only package guide after noticing that the previous
README advertised several files the ZIP did not contain.

The controller-settings proposal—dead-zone hysteresis, accessible diagnostics and
optional rumble—belongs in its own release. It touches persistence, menu focus and
hardware testing, so squeezing it into this build would make 4.5.0 wider and less
credible. I have left that as an idea for a later release.

## Controller recovery implementation notes

I started with the files, not the folklore. The available project was a plain
folder rather than a repository, and its browser source had no reliable embedded
release marker. The project owner subsequently supplied the v4.4.0 release record.
That makes controller recovery, proper damaged sprites and audio warnings v4.5.0
work. I still won't pretend the folder proves details that its files do not contain.

The controller repair is a small state machine because unplugging hardware is not
merely a missing array entry. I track which pad last supplied meaningful input,
pause only when that pad vanishes, and quarantine a returning controller until it
has produced a neutral sample. Otherwise a player reconnecting with Start held can
unpause immediately, which is less “seamless recovery” and more trapdoor.

Damage art is derived once, in memory, from the existing enemy frames. A surviving
heavy first flashes pale at the point of impact, then settles into a darker,
scorched set of frames. No new external artwork was smuggled into the credits, and
the single-file build still carries everything it needs.

For sound, I kept the countdown pip and made a separate descending double warning.
It now marks low fuel and an active controller loss. Enemy damage keeps its blunt
hit sound; mixing every alert into the same siren would be efficient in the way a
smoke alarm wired to the doorbell is efficient.

Future ideas I deliberately left on the bench: light controller rumble for a
surviving heavy, a small settings panel for dead zones and volume, and an on-screen
controller diagram. All three are useful. None was necessary to make this recovery
path safe, legible and testable.
