# Asset provenance — browser 4.6.0

I checked the retained provenance record and local originals for this release on
27 October 2026. The public source pages were last checked on 24 October 2026, and
the locally retained originals were matched by SHA-256. The slim browser release does not bundle
them; the complete-project archive does, together with the available licence
evidence. The hashes let a later rebuild identify them without relying on a
filename and a hopeful expression.

| Use | Source and author | Terms recorded by source | Original file | SHA-256 |
|---|---|---|---|---|
| General alien sprites | [Shmup Enemies](https://opengameart.org/content/shmup-enemies), Buch | CC0 | `shmupEnemies_0.png` | `895F90978FB6EAB634095E2FF209E4A43F15C71698BBDD170563C27A28ABC26D` |
| Diver ship | [I ARE SPACESHIP](https://opengameart.org/content/i-are-spaceship-16x16-space-sprites), bart | CC0 | `i_are_spaceship.png` | `73DE15CAF476E8C6B1353F02B719555E506B60C420E07DE4DF4A8FDED7A6191A` |
| Earth | [Pixel Planets](https://opengameart.org/content/pixel-planets), Master484 | CC0/public domain | `PixelPlanets_0.png` | `AF619E4FAB31B2EADDBFA5966FBC4DFBA708964B06D47E6B70F8D5C6A8BF392F` |
| UFO | [Space Shooter Remastered](https://kenney.nl/assets/space-shooter-remastered), Kenney | CC0 | `kenney_ssr.zip` | `0EDBE0AB5CDA6C44901D8C42F150268FDFA0C8D48492098669F37E9C296929B5` |
| Fuel silo | [16x16 Industrial Tileset](https://0x72.itch.io/16x16-industrial-tileset), 0x72 | CC0 | `16x16-industrial-tileset__industrial.v2.png` | `1656866A86EE6C40F9BB0B03AB22493C2AAE067DB6EABA011A9EFE30AA37A290` |
| Explosions | [Explosion Animations Pack](https://ansimuz.itch.io/explosion-animations-pack), ansimuz | CC0 | `explosion-animations-pack__explosion pack 1.zip` | `AF8CE87F5B434112947E411418CE8B8BB0AE306DF2C8A612363E8F4C163A272B` |
| Synth-reference effects | [512 Sound Effects](https://opengameart.org/content/512-sound-effects-8-bit-style), SubspaceAudio / Juhani Junkala | CC0 | `sfx512.zip` | `6D4519229C6E2C9E09502CD4967940052F68664140549A467615B56BDFD1D031` |
| Parallax background | [Space Backgrounds](https://ansimuz.itch.io/space-background), ansimuz | The page has no formal licence field; the author says attribution is not required. The retained archive also includes `public-license.pdf`. | `space-background__space_background_pack.zip` | `8042A9F0CF7FAF8BC50DB9BFEF94E3F4903169D913B1F64CE8DF560CB2809C54` |

The touch controls use four Game-icons.net SVGs under CC BY 3.0:

| Icon | Author | SHA-256 |
|---|---|---|
| [`grab`](https://game-icons.net/1x1/lorc/grab.html) | Lorc | `59EC0217AAE98795FE3FE06F264F6F42E490D3CFA54CCDD20D7CF17A148E758B` |
| [`laser-blast`](https://game-icons.net/1x1/lorc/laser-blast.html) | Lorc | `DE700D52CC968296D38744B9129D52ED257A02EDDF82175236AFEBDF6E90B6DD` |
| [`mars-curiosity`](https://game-icons.net/1x1/delapouite/mars-curiosity.html) | Delapouite | `E35FBC3D7DB0F8CFEBBCAAC53F21DCA787B41DA228B637ED5B68FC048B0C13C9` |
| [`rocket-thruster`](https://game-icons.net/1x1/delapouite/rocket-thruster.html) | Delapouite | `E7EC8104DBE78E6B2E7702EDD42E210BE448A917718D28DD2B0615751C84269E` |

The asset-processing script crops, scales, recolours and packs these sources.
The browser runtime uses the resulting `web/assets.js`; it does not fetch any
third-party material or play the reference WAV files.

Release 4.6.0 adds no external artwork. Its level landmarks and colour washes are
drawn at runtime from simple geometry and the project's existing palette.
