# Competitive Halo ANZ

Dedicated Halo 3 servers for the Australian and New Zealand competitive
community, run on [Project Reclaimer](https://projectreclaimer.dev/). Hosted in
Australia so nobody plays with host advantage.

This repo holds everything that makes the servers ours, in the open: the
server config, the playlists, the game types and the maps. Change any of it by
pull request.

> **Status: early.** Project Reclaimer is an early development build, and play
> between different networks has not been verified by its developers yet. The
> starter rotation runs on base game types; the MLG v8 rotation is waiting on
> its game and map variant files (below).

## Playing

1. Own Halo: The Master Chief Collection on Steam, with Halo 3 and its
   campaign installed.
2. Download Project Reclaimer from <https://projectreclaimer.dev/download>.
3. Open it, go to the Server Browser and look for **Competitive Halo ANZ**.

Project Reclaimer runs Halo 3 from your own install with its own menus; you
do not open MCC itself.

## Playlists

| Playlist | File | Server | Status |
|---|---|---|---|
| ANZ Starter Rotation | `starter.playlist.json` | UDP 49176 | Live. Base game types only, so it runs today. |
| ANZ MLG v8 | `mlg-v8.playlist.json` | UDP 49177 | Off until the MLG v8 files below are added. |

Files are in [`server/playlists/`](server/playlists/). Before each game,
players vote between three games drawn from the playlist.

### ANZ MLG v8

Major League Gaming's final Halo 3 4v4 settings (v8, March 2010), all eleven
games, taken from MLG's own settings page. Full settings and sources:
[docs/mlg-v8.md](docs/mlg-v8.md).

| | Slayer | Multi Flag | King | Oddball |
|---|---|---|---|---|
| Amplified | MLG TS 8 | | | |
| Construct | MLG CStruct TS8 | | MLG King 8 | |
| Guardian | | | | MLG Ball 8 |
| Heretic | MLG TS 8 | MLG CTF 5Flag 8 | | |
| Narrows | MLG TS 8 | MLG CTF Nar 8 | | |
| Onslaught | | MLG CTF 5Flag 8 | | |
| The Pit | MLG TS 8 | MLG CTF Pit 8 | | |

Every game: Battle Rifle starts, 110% speed, 110% damage, 90% shield
recharge, no motion tracker. Slayer to 50, Oddball and King to 250, flag to 5
captures on Heretic and Onslaught and 3 on Narrows and The Pit.

### ANZ Starter Rotation

The MLG maps' base versions on Halo 3's base game types: Slayer to 50 with
Battle Rifle starts, and plain CTF, King of the Hill and Oddball. A stand-in
until the MLG files land, not a recreation of them.

## MLG v8 files we still need

The MLG v8 server stays off until each of these is in the repo, named exactly
as below. They are MLG's own variants from their "MLG Gametypes" file share.

Game variants, in [`server/content/Game Modes/`](server/content/Game%20Modes/):

- [ ] `MLG TS 8.bin`
- [ ] `MLG CStruct TS8.bin`
- [ ] `MLG Ball 8.bin`
- [ ] `MLG King 8.bin`
- [ ] `MLG CTF 5Flag 8.bin`
- [ ] `MLG CTF Nar 8.bin`
- [ ] `MLG CTF Pit 8.bin`

Map variants, in [`server/content/Maps/`](server/content/Maps/):

- [ ] `MLG Amplified 8.mvar`
- [ ] `MLG Cons TS 8.mvar`
- [ ] `MLG Cons King 8.mvar`
- [ ] `MLG Heretic 8.mvar`
- [ ] `MLG Narrows 8.mvar`
- [ ] `MLG Pit 8.mvar`
- [ ] `MLG Onslaught 8.mvar`
- [ ] `MLG Guardian.mvar` (which version MLG used for v8 is unconfirmed; see
  [docs/mlg-v8.md](docs/mlg-v8.md#not-confirmed))

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add one.

## Maps and mods

- **Halo 3's own maps** come from each player's install. Nothing to add.
- **Forge maps** live in [`server/content/Maps/`](server/content/Maps/), in
  git.
- **Mod maps** are listed in [`mods.json`](mods.json) by Steam Workshop ID,
  with their author and link. The mod files themselves are never committed:
  they are large and belong to their authors. Players download them through
  Steam Workshop or from the server when they join.

No mods yet. Suggest one by pull request; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Hosting

[docs/hosting.md](docs/hosting.md): an Australian VPS, Docker, and the game
files copied from your own install.

## License

[MIT](LICENSE), for everything in this repo except what other people made:
MLG's variants are MLG's, and mods listed in `mods.json` are their authors'.

## What is not here

No game files, and nothing from Microsoft or Project Reclaimer. Every host
copies what a server needs from their own MCC install, and the server program
comes from Project Reclaimer's releases.

Competitive Halo ANZ and Project Reclaimer are independent fan projects, not
affiliated with or endorsed by Microsoft, Xbox Game Studios, Halo Studios,
343 Industries, Bungie or Major League Gaming.
