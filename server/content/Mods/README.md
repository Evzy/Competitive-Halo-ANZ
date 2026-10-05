# Mods

Mod files are never committed. They are large, and they belong to their
authors. `mods.json` at the repo root lists every mod the servers use by Steam
Workshop ID, and `scripts/sync-mods.ps1` copies them here from a Steam install
that has them subscribed.

The Docker image has no Steam, so a Linux host copies this folder up from a
Windows PC (see `docs/hosting.md`). For the same reason, playlists name mod
maps by their **map name**, never by a `workshop:<id>/<file>` reference: a
`workshop:` reference makes the server try to download the item, which fails
without Steam.
