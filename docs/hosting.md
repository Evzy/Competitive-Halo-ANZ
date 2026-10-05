# Hosting the servers

How to run Halo Competitive ANZ's servers on an Australian VPS. Project
Reclaimer's own guide is the reference for everything here:
<https://projectreclaimer.dev/host.html>.

## Where to host

The point of a dedicated server is that nobody has host advantage, so it
belongs where the players are: **Sydney or Melbourne**. Melbourne and Sydney
are roughly 10-15 ms apart, Auckland is roughly 25-30 ms from Sydney, Perth
roughly 50 ms.

What the box needs:

| | |
|---|---|
| Location | Sydney or Melbourne |
| CPU | x86-64. **Not ARM**: the server is a Windows program run under Wine. |
| Memory | About 1-2 GB per server during a game; 4 GB covers two servers. |
| Disk | About 1.5 GB for one map, 5.5 GB for every multiplayer map. |
| Network | A public IPv4 address, and **inbound UDP**. |

Providers with Australian x86 VPSs and inbound UDP include Vultr, Linode
(Akamai), DigitalOcean, AWS Lightsail and BinaryLane. Compare current prices
yourself; they move.

**Railway cannot host this.** It accepts no inbound UDP, which the game port
needs, and its nearest region is Singapore, about 80-100 ms from the east
coast. Railway's own workaround for UDP is a playit.gg tunnel, which adds a
relay hop, the opposite of what a fair server is for.

## First-time setup

1. **On the VPS**, clone this repo and run the setup script:

   ```bash
   git clone <this repo> Competitive-Halo-ANZ
   cd Competitive-Halo-ANZ
   bash scripts/setup-vps.sh
   ```

   It installs Docker, opens TCP 49175 and UDP 49176-49177 in `ufw`, and
   creates `.env` from `.env.example`. Open the same ports in the provider's
   own firewall too.

2. **On a Windows PC with MCC and Halo 3 installed**, download
   `project-reclaimer-<version>.exe` from
   <https://projectreclaimer.dev/download>, rename it `project-reclaimer.exe`,
   and copy the game files a server needs. `--maps` keeps it to the maps the
   playlists use. Foundry is in the list because Amplified and Onslaught are
   built on it:

   ```powershell
   .\project-reclaimer.exe dedicated init C:\reclaimer-init --from --maps "Construct,Guardian,Heretic,Narrows,The Pit,Foundry"
   ```

3. **Copy the Hardcore variants.** On the same PC, from a clone of this repo:

   ```powershell
   .\scripts\copy-mcc-content.ps1
   ```

   It copies the fifteen files listed in `server/content/mcc-content.json`
   (MCC's Hardcore game variants and MLG's v8 map variants) from your MCC
   install into `server\content`. Pass `-Mcc "<folder>"` if MCC is not in the
   default Steam library. See [hardcore.md](hardcore.md).

4. **Upload the game files and the variants** to the VPS:

   ```powershell
   scp -r C:\reclaimer-init\game\halo3 you@your-vps:Competitive-Halo-ANZ/server/game/
   scp "server\content\Game Modes\h3_*.bin" "you@your-vps:'Competitive-Halo-ANZ/server/content/Game Modes/'"
   scp server\content\Maps\mlg_*_012.mvar you@your-vps:Competitive-Halo-ANZ/server/content/Maps/
   ```

   On the VPS, `ls server/game` should show `halo3`. None of these files go in
   git; `.gitignore` excludes them, and `npm run validate` fails if one is
   committed anyway.

5. **Mods**, once `mods.json` lists any. On the Windows PC, from a clone of
   this repo:

   ```powershell
   .\scripts\sync-mods.ps1
   scp -r server\content\Mods you@your-vps:Competitive-Halo-ANZ/server/content/
   ```

6. **Secrets**, in `.env` on the VPS: `RECLAIMER_DEDICATED_RCON_PASSWORD` if
   you want the remote console.

7. **Start**:

   ```bash
   docker compose up -d
   docker compose logs -f
   docker compose exec reclaimer dedicated status
   ```

   If something is missing, the log says what and the container waits for it.

## Checking it from outside

From a player's PC, with the client:

```powershell
.\project-reclaimer.exe server-status your-vps:49176
```

It shows what the server answers. The Server Browser shows each server's
ping, which is the number that matters.

**Internet play between different networks is not yet verified by Project
Reclaimer** (their download page says so). The first real test is a player on
a home connection joining this VPS.

## Day to day

| Task | Command |
|---|---|
| Pull config changes from git | `git pull && docker compose restart` |
| Apply `.env` or `compose.yaml` edits | `docker compose up -d` |
| Update the image (Wine and the server) | `docker compose pull && docker compose up -d` |
| Players and status | `docker compose exec reclaimer dedicated status` |
| Ban | `docker compose exec reclaimer dedicated ban <player ID or IP> --reason "..."` |
| Check files and config | `docker compose run --rm reclaimer dedicated check` |
| Logs | `docker compose logs -f`, and `server/data/<server>/server.log` |

## When it breaks

- **A Steam update to MCC stops the servers.** Each Reclaimer release supports
  one version of Halo 3's engine file. Once a release supports the new one,
  re-run step 2 on the Windows PC and upload `game/halo3/halo3.dll` again.
  `dedicated check` names the file when it does not match.
- **Players can't join after a Reclaimer update.** Server and players must run
  the same release (0.9.1 cannot play 0.9.0). `RECLAIMER_DEDICATED_AUTO_UPDATE=true`
  in `.env` keeps the server current, at the cost of restarting mid-game when a
  release lands.
- **Remote console from your PC.** It is bound to the VPS's loopback on
  purpose; tunnel to it with `ssh -L 49176:127.0.0.1:49176 you@your-vps`, then
  point the RCON client at `127.0.0.1:49176`.

## Stats

Reclaimer servers report finished games to the project's public stats service
by default (`stats_server` in `dedicated.toml`; `"off"` reports nowhere).
Getting these games onto the ANZ dashboard is a separate piece of work: the
dashboard's watcher reads MCC carnage reports, and it is not yet known whether
Reclaimer writes the same format. The remote console's live event stream
(kills, joins, game start and end) is the other possible source.
