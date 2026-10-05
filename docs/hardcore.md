# Hardcore is MLG v8

MCC's Halo 3 Hardcore playlist is MLG's final 4v4 rotation (v8, March 2010):
the same eleven games, on MLG's own v8 map variants, with game variants Halo
Studios re-released for the HCS. Every MCC install already ships all of it,
so the Hardcore server here uses those exact files and nobody has to find or
remake anything.

## How this is known

Not from memory or a wiki. MCC defines its matchmaking playlists in a plain
XML file in the install,
`Data\careerdb\findgamehopperdb-v4.xml`. The `H3Hardcore` playlist reads:

| Map | Map variant | Game variant |
|---|---|---|
| Narrows | `mlg_narrows_v8_012` | `h3_4v4_hardcoreSlayer_50kills` |
| Narrows | `mlg_narrows_v8_012` | `h3_4v4_hardcoreFlag_narrows_3points` |
| Heretic | `mlg_heretic_v8_012` | `h3_4v4_hardcoreSlayer_50kills` |
| Heretic | `mlg_heretic_v8_012` | `h3_4v4_hardcoreFlag_heretic_5points` |
| The Pit | `mlg_the_pit_v8_012` | `h3_4v4_hardcoreSlayer_50kills` |
| The Pit | `mlg_the_pit_v8_012` | `h3_4v4_hardcoreFlag_pit_3points` |
| Construct | `mlg_construct_ts8_012` | `h3_4v4_hardcoreSlayer_construct_50kills` |
| Construct | `mlg_construct_v8_012` | `h3_4v4_hardcoreKing_250points` |
| Guardian | `mlg_guardian_v8_012` | `h3_4v4_hardcoreBall_250points` |
| Foundry | `mlg_amplified_v8_012` | `h3_4v4_hardcoreSlayer_50kills` |
| Foundry | `mlg_onslaught_v8_012` | `h3_4v4_hardcoreFlag_heretic_5points` |

Every entry has weight 50, so all eleven are equally likely.

The files themselves are in the install's `halo3\hopper_game_variants` and
`halo3\hopper_map_variants`. The names stored inside them:

| Game variant file | Name in game | MLG v8 equivalent |
|---|---|---|
| `h3_4v4_hardcoreSlayer_50kills` | HARDCORE TS | MLG TS 8 |
| `h3_4v4_hardcoreSlayer_construct_50kills` | HARDCORE CON TS | MLG CStruct TS8 |
| `h3_4v4_hardcoreFlag_heretic_5points` | HARDCORE CTF | MLG CTF 5Flag 8 |
| `h3_4v4_hardcoreFlag_narrows_3points` | HARDCORE CTF | MLG CTF Nar 8 |
| `h3_4v4_hardcoreFlag_pit_3points` | HARDCORE CTF | MLG CTF Pit 8 |
| `h3_4v4_hardcoreKing_250points` | HARDCORE KING | MLG King 8 |
| `h3_4v4_hardcoreBall_250points` | HARDCORE BALL | MLG Ball 8 |

| Map variant file | Name in game |
|---|---|
| `mlg_amplified_v8_012` | MLG Amplified 8 |
| `mlg_construct_ts8_012` | MLG CStruct TS8 |
| `mlg_construct_v8_012` | MLG Construct 8 |
| `mlg_guardian_v8_012` | MLG Guardian 8 |
| `mlg_heretic_v8_012` | MLG Heretic 8 |
| `mlg_narrows_v8_012` | MLG Narrows 8 |
| `mlg_onslaught_v8_012` | MLG Onslaught 8 |
| `mlg_the_pit_v8_012` | MLG Pit 8 |

The map variants are MLG's originals: their author is "MLG Gametypes", the
tag MLG published from. The game variants' descriptions point at halo.gg and
the HCS, and their names (HARDCORE TS, HARDCORE CON TS, HARDCORE CTF,
HARDCORE KING, HARDCORE BALL) are exactly what MCC carnage reports record for
the ANZ dashboard's games.

The descriptions agree with MLG's settings where they say anything: CTF on
Heretic and Onslaught is to 5 with flag at home required, Narrows to 3 with
flag at home required, The Pit to 3 with flag at home not required, King and
Ball to 250. The settings inside a variant are bit-packed and are not
decoded here, so "the same as MLG's, setting for setting" is not claimed;
"what MCC's Hardcore playlist plays" is exact, because these are its files.
MLG's own settings are transcribed in [mlg-v8.md](mlg-v8.md).

## Other Hardcore files in the install, and why they are not used

| Files | What they are |
|---|---|
| `h3_hardcore_*_09_2018`, `hardcore_*` | An older Hardcore set, named "Hardcore TS" etc. in title case. CTF is "3 captures to win" on every map and Ball is 100 points, so it is not MLG v8. Not in any current playlist. |
| `h3_4v4_team_hardcoreBall_200points_15min`, `h3_4v4_team_hardcoreKing_200points_15min` | 200-point Ball and King. Not in the Hardcore playlist. |
| `h3_2v2_team_hardcoreSlayer_25kills` (2V2 HARDCORE TS), `h3_ffa_hardcoreSlayer_12min` (HARDCORE FFA), `h3_1v1_team_hardcoreSlayer_15kills` | The Hardcore Doubles, FFA and 1v1 playlists. Candidates for later servers. |
| `mlg_team_slayer_010` and the other `mlg_*_010` | MLG's game variants under their generic names ("MLG Team Slayer", "MLG Multi Flag"), version not stated in the file. |

## Keeping it current

`server/content/mcc-content.json` lists the fifteen files and
`scripts/copy-mcc-content.ps1` copies them from the host's install. If an MCC
update renames one, the script says which, and the playlist and manifest
change together. Re-check the XML above at the same time.
