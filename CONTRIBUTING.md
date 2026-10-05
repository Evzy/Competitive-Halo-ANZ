# Contributing

Everything here changes by pull request. Run the checks first:

```
npm test
npm run validate
```

They need Node 20 or newer and nothing else. GitHub runs the same two on every
pull request. They check what can be checked without the game; a host's
`dedicated check` is the final word.

## An MLG v8 file

The README's "MLG v8 files we still need" lists each one with the exact file
name the playlist expects. They are MLG's original variants, so the file must
be MLG's, not a remake:

1. Put it in `server/content/Game Modes/` (game variants) or
   `server/content/Maps/` (map variants), named exactly as the README lists.
2. Check its settings against [docs/mlg-v8.md](docs/mlg-v8.md) before opening
   the pull request, and say where the file came from.
3. Tick its box in the README.

## A game type of our own

1. In the Project Reclaimer client, open **Host Game**, choose a map and the
   base game type, set the rules in **Game Options**, and choose **Save as
   variant**.
2. Find the file in `Documents\My Games\Project Reclaimer\Game Modes`.
3. Rename it to the name the playlist uses. The validator finds game types by
   file name.
4. Put it in `server/content/Game Modes/` and say in the pull request what it
   is for.

## A Forge map

Put the `.mvar` or saved `.json` in `server/content/Maps/`, and name it in a
playlist as `"Maps/<file>"`. If it uses objects from a mod, that mod needs to be
in `mods.json` too.

## A mod map

Add an entry to `mods.json`. Do not commit the mod's files.

```json
{
  "mods": [
    {
      "id": "2977651586",
      "name": "Warlock",
      "author": "who made it",
      "url": "https://steamcommunity.com/sharedfiles/filedetails/?id=2977651586",
      "maps": ["MLG Warlock"]
    }
  ]
}
```

`maps` holds the names playlists use for the mod's maps. Name them that way in
a playlist too, never as `workshop:<id>/<file>`: the Docker server has no Steam,
so a `workshop:` reference makes it try a download that fails.

Credit the author. A mod we use is someone else's work.

## A playlist change

Playlists are in `server/playlists/`. The format is Project Reclaimer's:
<https://projectreclaimer.dev/host.html#playlists>. In short:

- 3 to 128 games, each a `map` and a `game`, with optional `name`, `weight`
  (1-100), `rules` and `options`.
- No game twice. A renamed copy still counts as a repeat; raise its weight.
- At most 23 different mod maps.

A new playlist file also needs a row in the README's Playlists table, and a
server in `server/dedicated.toml` if it should run. The validator checks the
README row.

## Admins

Admins are listed by Project Reclaimer player ID (64 hex characters, from the
client's **Settings -> Connectivity -> Your player ID**) in `admins` in
`server/dedicated.toml`.

## Never

- Game files (`.map`, `halo3.dll`, anything from the MCC install).
- Mod files.
- Passwords. They go in `.env` on the host, which is not in git.
