# MLG Halo 3 v8

Major League Gaming's final Halo 3 4v4 settings, released 15 March 2010 and
used for the rest of Halo 3's MLG era. The 2019 Halo Classic tournaments
played on these rules, with files downloaded from the official HCS gamertag.

This is the historical reference. **The server does not use MLG's 2010 game
variant files**: it plays MCC's Hardcore playlist, which is this rotation on
MLG's own v8 map variants, from files every MCC install ships. See
[hardcore.md](hardcore.md).

## Sources

1. **MLG's own settings page, "Official MLG Halo 3 Settings v8"**, archived
   22 May 2010:
   <http://web.archive.org/web/20100522082656/http://www.mlgpro.com:80/Official_Halo_3_Game_Types>.
   This is the primary source. Everything below comes from it unless marked
   otherwise.
2. **MLG's file share** (gamertag "MLG Gametypes") on the Bungie.net archive,
   for the exact file names:
   [game variants](http://bnetarchive.haloman30.com/Online/Halo3UserContentDetails7071.html?h3fileid=108028419),
   [service record with map variants](https://bnetarchive.haloman30.com/Stats/Halo3/Defaultb3d6.html?player=MLG+Gametypes++).
3. The v7 rotation, which v8 changed by one game: MLG's v7 announcement as
   [quoted on Se7enSins](https://www.se7ensins.com/forums/threads/h3-mlg-v7-released.93439/),
   and the [v8 change notes on halo.fr](https://www.halo.fr/e-sport/8540/maj-news-officielle-mlg-v8-dans-les-bacs/)
   (16 March 2010, citing MLGpro).

## The eleven games

| # | Game | Game variant | Map variant |
|---|---|---|---|
| 1 | Amplified Slayer | `MLG TS 8` | `MLG Amplified 8` (Foundry) |
| 2 | Construct Slayer | `MLG CStruct TS8` | `MLG CStruct TS8` |
| 3 | Heretic Slayer | `MLG TS 8` | `MLG Heretic 8` |
| 4 | Narrows Slayer | `MLG TS 8` | `MLG Narrows 8` |
| 5 | The Pit Slayer | `MLG TS 8` | `MLG Pit 8` |
| 6 | Guardian Oddball | `MLG Ball 8` | `MLG Guardian 8` |
| 7 | Construct King | `MLG King 8` | `MLG Construct 8` |
| 8 | Heretic 5 Flag | `MLG CTF 5Flag 8` | `MLG Heretic 8` |
| 9 | Onslaught 5 Flag | `MLG CTF 5Flag 8` | `MLG Onslaught 8` (Foundry) |
| 10 | Narrows 3 Flag | `MLG CTF Nar 8` | `MLG Narrows 8` |
| 11 | The Pit 3 Flag | `MLG CTF Pit 8` | `MLG Pit 8` |

MLG's page lists the maps for each game type:

- **Multi Flag:** Heretic, Narrows, Onslaught, The Pit
- **Team King:** Construct
- **Team Oddball:** Guardian
- **Team Slayer:** Amplified, Construct, Heretic, Narrows, The Pit

Which flag variant goes on which map: v7 is stated as "Onslaught (5Flag),
Heretic (5Flag), The Pit, Narrows", v8 changed no flag games, and the
remaining two variants are named for their maps (`Nar`, `Pit`).

Map variant names are as stored in the files MCC ships (by author "MLG
Gametypes"); MLG's 20 May 2010 uploads named the two Construct variants
`MLG Cons TS 8` and `MLG Cons King 8`. Game variant names are as they appear
on MLG's file share. MLG's settings page
spells two of them differently in its change list ("MLG The Pit 8",
"MLG Cstruct TS 8"); the file share is what a player downloaded.

### What v8 changed from v7

From MLG's page: "The overall settings were unchanged from v7 to v8. One Game
Type was added to the rotation: Guardian Ball. In addition, Heretic Ball was
removed from the Game Type rotation."

- **MLG Heretic 8:** two spawns removed from Carbine-2, and all Plasma
  Grenades removed from the map.
- **MLG Cstruct TS 8:** a Custom Camouflage bottom centre, near the Gold Lift.
- **Cstruct King, Amplified, Narrows, Onslaught, The Pit:** no changes.

## Settings

### Every game

| Setting | Value |
|---|---|
| Primary Weapon | Battle Rifle |
| Shield Recharge Rate | 90% |
| Damage Modifier | 110% |
| Player Speed | 110% |
| Motion Tracker Mode | Off |
| Suicide Penalty | None |
| Betrayal Penalty | None |
| Team Changing | Not Allowed |

### MLG TS 8

| Setting | Value |
|---|---|
| Custom Powerup Traits, Duration | 3 Seconds |
| Custom Powerup Traits, Damage Resistance | Invulnerable |
| Custom Powerup Traits, Shield Multiplier | 3X Overshields |
| Custom Powerup Traits, Shield Recharge Rate | 200% (Faster) |
| Custom Powerup Traits, Player Speed | Unchanged |
| Time Limit | 15 Minutes |
| Vehicle Set | No Vehicles |

Score to win is not on MLG's page. It is 50 kills per Halopedia and the 2019
Halo Classic rules, which is also Team Slayer's default.

### MLG CStruct TS8 (Construct Slayer only)

| Setting | Value |
|---|---|
| Custom Powerup Traits, Duration | 60 Seconds |
| Custom Powerup Traits, Player Speed | Unchanged |
| Custom Powerup Traits, Active Camo | Good Camo |
| Time Limit | 15 Minutes |
| Vehicle Set | No Vehicles |

### MLG Ball 8

| Setting | Value |
|---|---|
| Score to Win | 250 |
| Ball Carrier Traits, Damage Modifier | 50% |
| Time Limit | 15 Minutes |

### MLG King 8

| Setting | Value |
|---|---|
| Score to Win | 250 |
| Hill Movement | 2 Minutes |
| Hill Movement Order | Sequence |
| Custom Powerup Traits, Duration | 3 Seconds |
| Custom Powerup Traits, Damage Resistance | Invulnerable |
| Custom Powerup Traits, Shield Multiplier | 3X Overshields |
| Custom Powerup Traits, Shield Recharge Rate | 200% (Faster) |
| Custom Powerup Traits, Player Speed | Unchanged |
| Time Limit | 15 Minutes |
| Respawn Time | 10 Seconds |

### MLG CTF 5Flag 8 (Heretic, Onslaught)

| Setting | Value |
|---|---|
| Captures to Win | 5 |
| Flag At Home to Score | Enabled |
| Flag Return Time | 3 Seconds |
| Flag Reset Time | 15 Seconds |
| Flag Carrier Traits, Damage Modifier | 50% |
| Time Limit | 30 Minutes |

### MLG CTF Nar 8 (Narrows)

| Setting | Value |
|---|---|
| Flag At Home to Score | Enabled |
| Flag Return Time | 3 Seconds |
| Flag Reset Time | 15 Seconds |
| Flag Carrier Traits, Damage Modifier | 50% |
| Time Limit | 30 Minutes |

### MLG CTF Pit 8 (The Pit)

| Setting | Value |
|---|---|
| Flag Return Time | Disabled |
| Flag Reset Time | 15 Seconds |
| Flag Carrier Traits, Damage Modifier | 50% |
| Custom Powerup Traits, Duration | 3 Seconds |
| Custom Powerup Traits, Damage Resistance | Invulnerable |
| Custom Powerup Traits, Shield Multiplier | 3X Overshields |
| Custom Powerup Traits, Shield Recharge Rate | 200% (Faster) |
| Custom Powerup Traits, Player Speed | Unchanged |
| Time Limit | 30 Minutes |

Captures to win for Narrows and The Pit are not on MLG's page. They are 3 per
Halopedia and the 2019 Halo Classic rules, which is also CTF's default.

## The GameBattles variants, not used here

MLG published a second set for online ladders: `GB CTF 5Flag 8`,
`GB CTF Nar 8` and `GB CTF Pit 8`. Same as the MLG versions except a
**15-minute** time limit and **30-second sudden death**.

## Not confirmed

- **The Guardian map variant** was an open question until MCC's install
  answered it: MCC ships `mlg_guardian_v8_012.mvar`, named "MLG Guardian 8",
  by MLG Gametypes, and its Hardcore playlist plays Oddball on it.
- **Map weapon and spawn layouts.** These live inside the map variants, so
  they come with the files. Halopedia lists respawn times (Battle Rifle 10s,
  Carbine 90s, Sniper 150s, Rocket Launcher 180s, and so on) that are not on
  MLG's page; they are not repeated here as fact.
- **The 15-minute matchmaking time limit** Halopedia mentions for CTF applies
  to Bungie's MLG playlist, not to MLG's tournament files.

The variants are MLG's work and are credited to them here. They are not
covered by this repo's MIT license, and none of them is in this repo.
