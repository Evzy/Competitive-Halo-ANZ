# Competitive Halo ANZ

Dedicated Halo 3 servers for the Australian and New Zealand competitive
community, run on [Project Reclaimer](https://projectreclaimer.dev/). Hosted in
Australia so nobody plays with host advantage.

This repo holds everything that makes the servers ours, in the open: the
server config, the playlists, the game types and the maps. Change any of it by
pull request.

> **Status: early.** Project Reclaimer is an early development build, and play
> between different networks has not been verified by its developers yet. The
> starter rotation runs on base game types; the real Hardcore rotation is
> waiting on its game type files (below).

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
| ANZ Hardcore 8s | `hardcore-8s.playlist.json` | UDP 49177 | Off until the game types below are added. |

Files are in [`server/playlists/`](server/playlists/). Before each game,
players vote between three games drawn from the playlist.

### ANZ Hardcore 8s

The competitive rotation: the same maps and game types the ANZ dashboard
tracks.

| | Slayer | CTF | King | Ball |
|---|---|---|---|---|
| Construct | HARDCORE TS | | HARDCORE KING | |
| Guardian | HARDCORE TS | | | HARDCORE BALL |
| Heretic | HARDCORE TS | HARDCORE CTF | | |
| Narrows | HARDCORE TS | HARDCORE CTF | | |
| The Pit | HARDCORE TS | HARDCORE CTF | | |

### ANZ Starter Rotation

The same maps on Halo 3's base game types: Slayer to 50 with Battle Rifle
starts, and plain CTF, King of the Hill and Oddball. A stand-in until the
Hardcore game types land, not a recreation of them.

## Gametypes we still need

The Hardcore playlist names these, and its server stays off until each has a
file in [`server/content/Game Modes/`](server/content/Game%20Modes/), named
exactly as below:

- [ ] `HARDCORE TS`
- [ ] `HARDCORE CTF`
- [ ] `HARDCORE KING`
- [ ] `HARDCORE BALL`

They should match MCC's Hardcore playlist settings. See
[CONTRIBUTING.md](CONTRIBUTING.md) for how to make and add one.

## Maps and mods

- **Halo 3's own maps** come from each player's install. Nothing to add.
- **Forge maps** live in [`server/content/Maps/`](server/content/Maps/), in
  git.
- **Mod maps** are listed in [`mods.json`](mods.json) by Steam Workshop ID,
  with their author and link. The mod files themselves are never committed:
  they are large and belong to their authors. Players download them through
  Steam Workshop or from the server when they join.

None yet. Suggest one by pull request; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Hosting

[docs/hosting.md](docs/hosting.md): an Australian VPS, Docker, and the game
files copied from your own install.

## What is not here

No game files, and nothing from Microsoft or Project Reclaimer. Every host
copies what a server needs from their own MCC install, and the server program
comes from Project Reclaimer's releases.

Competitive Halo ANZ and Project Reclaimer are independent fan projects, not
affiliated with or endorsed by Microsoft, Xbox Game Studios, Halo Studios,
343 Industries or Bungie.
