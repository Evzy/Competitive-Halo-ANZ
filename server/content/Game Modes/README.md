# Game Modes

Game variants (`.bin`) and shareable game types (`.json`) used by the
playlists. These are small, made by the community, and are the open part of
this repo: add one by pull request.

A playlist names a game type by the name stored **inside** the file (for
example `"HARDCORE TS"`). **Name the file the same** (`HARDCORE TS.bin`):
`npm run validate` cannot read inside a `.bin`, so it finds a playlist's game
types by file name, and refuses to pass an enabled server whose playlist names
one it cannot find.

To make one: in the Project Reclaimer client, choose a map and game type in
Host Game, set the rules in Game Options, and choose **Save as variant**. The
file lands in `Documents\My Games\Project Reclaimer\Game Modes`.
