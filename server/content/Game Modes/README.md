# Game Modes

Game variants (`.bin`) and shareable game types (`.json`) used by the
playlists. Add one by pull request.

A playlist names a game type either by **path** (`"Game Modes/MLG TS 8.bin"`)
or by the name stored **inside** the file (`"MLG TS 8"`). Either way, **name
the file exactly as the playlist does**: `npm run validate` cannot read inside
a `.bin`, so it finds game types by file name, and refuses to pass an enabled
server whose playlist names one it cannot find.

To make one: in the Project Reclaimer client, choose a map and game type in
Host Game, set the rules in Game Options, and choose **Save as variant**. The
file lands in `Documents\My Games\Project Reclaimer\Game Modes`.
