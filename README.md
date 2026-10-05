# Halo Competitive ANZ

Dedicated Halo 3 servers for the Australian and New Zealand competitive
community, run on [Project Reclaimer](https://projectreclaimer.dev/). Hosted in
Australia so nobody plays with host advantage.

This repo holds everything that makes the servers ours, in the open: the
server config, the playlists, the game types and the maps. Change any of it by
pull request.

> **Status: early.** Project Reclaimer is an early development build, and play
> between different networks has not been verified by its developers yet. No
> server is running yet.

## Playing

1. Own Halo: The Master Chief Collection on Steam, with Halo 3 and its
   campaign installed.
2. Download Project Reclaimer from <https://projectreclaimer.dev/download>.
3. Open it, go to the Server Browser and look for **Halo Competitive ANZ**.

Project Reclaimer runs Halo 3 from your own install with its own menus; you
do not open MCC itself.

## Playlists

| Playlist | File | Server | Status |
|---|---|---|---|
| Hardcore | `hardcore.playlist.json` | Melbourne 1 (UDP 49176), Melbourne 2 (UDP 49177) | Ready; no machine yet. |

Files are in [`server/playlists/`](server/playlists/). Before each game,
players vote between three games drawn from the playlist.

### Hardcore

MCC's Halo 3 Hardcore playlist, game for game. That playlist is MLG's final
4v4 rotation (v8, March 2010) on MLG's own v8 map variants, and every MCC
install already ships its files, so the server plays the real thing rather
than a remake. How that is known: [docs/hardcore.md](docs/hardcore.md). MLG's
settings, transcribed: [docs/mlg-v8.md](docs/mlg-v8.md).

| | Slayer | CTF | King | Oddball |
|---|---|---|---|---|
| Amplified | HARDCORE TS | | | |
| Construct | HARDCORE CON TS | | HARDCORE KING | |
| Guardian | | | | HARDCORE BALL |
| Heretic | HARDCORE TS | HARDCORE CTF (5) | | |
| Narrows | HARDCORE TS | HARDCORE CTF (3) | | |
| Onslaught | | HARDCORE CTF (5) | | |
| The Pit | HARDCORE TS | HARDCORE CTF (3) | | |

Every game: Battle Rifle starts, 110% speed, 110% damage, 90% shield
recharge, no motion tracker. Slayer to 50, Oddball and King to 250, flag to 5
captures on Heretic and Onslaught and 3 on Narrows and The Pit.

The files are Microsoft's and are not in this repo: whoever hosts copies them
from their own MCC install with `scripts/copy-mcc-content.ps1`, from the list
in [`server/content/mcc-content.json`](server/content/mcc-content.json).

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

Halo Competitive ANZ and Project Reclaimer are independent fan projects, not
affiliated with or endorsed by Microsoft, Xbox Game Studios, Halo Studios,
343 Industries, Bungie or Major League Gaming.
