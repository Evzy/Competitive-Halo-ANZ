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
| Memory | About 1-2 GB per server during a game; 4 GB covers two servers, and three busy at once can need 6. |
| Disk | About 1.5 GB for one map, 5.5 GB for every multiplayer map. |
| Network | A public IPv4 address, and **inbound UDP**. |

Providers with Australian x86 VPSs and inbound UDP include Vultr, Linode
(Akamai), DigitalOcean, AWS Lightsail and BinaryLane. Compare current prices
yourself; they move.

## Testing before paying for anything

Two steps, each answering a different question.

### 1. A home PC: does it work at all?

Free, today, and it answers the biggest unknown: Project Reclaimer has not
verified play between different networks. The host has the advantage this
project exists to remove, which does not matter for a test.

Windows runs the server natively, with no Wine, and this repo's `server`
folder already has the layout Reclaimer expects, so it runs from a clone:

```powershell
git clone https://github.com/Evzy/Halo-Competitive-ANZ.git
cd Halo-Competitive-ANZ
.\scripts\copy-mcc-content.ps1

# project-reclaimer.exe from https://projectreclaimer.dev/download, renamed
.\project-reclaimer.exe dedicated init C:\reclaimer-init --from --maps "Construct,Guardian,Heretic,Narrows,The Pit,Foundry"
Move-Item C:\reclaimer-init\game server\game
Copy-Item .\project-reclaimer.exe server\

cd server
$env:RECLAIMER_DEDICATED_UPNP = "true"   # or forward the ports by hand
.\project-reclaimer dedicated check
.\project-reclaimer dedicated
```

Allow the ports through Windows Firewall, from a terminal opened as
administrator:

```powershell
New-NetFirewallRule -DisplayName "Reclaimer games" -Direction Inbound -Protocol UDP -LocalPort 49176-49178 -Action Allow
New-NetFirewallRule -DisplayName "Reclaimer browser" -Direction Inbound -Protocol TCP -LocalPort 49175 -Action Allow
```

**Check for CGNAT first.** Many Australian providers put customers behind a
shared address, and then nothing outside can reach the server whatever the
router says. Compare the WAN address on the router's status page with
`Invoke-RestMethod https://ifconfig.me/ip`. Different, or a WAN address
starting `100.64` to `100.127`, means CGNAT; Aussie Broadband removes it free
on request, other providers vary.

Then have somebody on a **different connection**, not in the same house, find
**Halo Competitive ANZ | Melbourne 1** in the Server Browser and join. Worth
writing down: did it appear in the browser, could they join, their ping, and
whether anything rubber-banded with eight in.

### 2. A Melbourne VPS on trial credit: is it fair?

The real test: a datacentre server nobody hosts from, with a full lobby on a
league night. Several providers give new accounts credit that covers a month
or two of a 4 GB x86 VPS, which is enough. Each needs a card, and offers
change, so check the current terms:

| Provider | Melbourne | Sydney |
|---|---|---|
| Akamai (Linode) | Yes | Yes |
| Microsoft Azure | Yes (Australia Southeast) | Yes (Australia East) |
| AWS | Yes (opt-in region) | Yes |
| DigitalOcean | No | Yes |

Then follow [First-time setup](#first-time-setup) below.

**Not worth trying:** Oracle Cloud's Always Free tier has Melbourne and
Sydney, but its only free x86 machine has 1 GB of memory and an eighth of a
core, under what one server needs; its large free machines are ARM, which
cannot run the server. Google Cloud's free VM is US-only.

**Railway cannot host this.** It accepts no inbound UDP, which the game port
needs, and its nearest region is Singapore, about 80-100 ms from the east
coast. Railway's own workaround for UDP is a playit.gg tunnel, which adds a
relay hop, the opposite of what a fair server is for.

## First-time setup

1. **On the VPS**, clone this repo and run the setup script:

   ```bash
   git clone https://github.com/Evzy/Halo-Competitive-ANZ.git
   cd Halo-Competitive-ANZ
   bash scripts/setup-vps.sh
   ```

   It installs Docker, opens TCP 49175 and UDP 49176-49178 in `ufw`, and
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
   scp -r C:\reclaimer-init\game\halo3 you@your-vps:Halo-Competitive-ANZ/server/game/
   scp "server\content\Game Modes\h3_*.bin" "you@your-vps:'Halo-Competitive-ANZ/server/content/Game Modes/'"
   scp server\content\Maps\mlg_*_012.mvar you@your-vps:Halo-Competitive-ANZ/server/content/Maps/
   ```

   On the VPS, `ls server/game` should show `halo3`. None of these files go in
   git; `.gitignore` excludes them, and `npm run validate` fails if one is
   committed anyway.

5. **Mods**, once `mods.json` lists any. On the Windows PC, from a clone of
   this repo:

   ```powershell
   .\scripts\sync-mods.ps1
   scp -r server\content\Mods you@your-vps:Halo-Competitive-ANZ/server/content/
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

## Azure, built nightly

The live servers do not run on a machine that stays around. At 5:45pm
Melbourne time a schedule builds a fresh VM from `main`; at midnight another
deletes it. Nothing on the VM survives the night except what it saves to
storage, so **whatever is on `main` at 5:45pm is what goes live**.

Two resource groups in the `dev` subscription:

| Group | Holds | Lifetime |
|---|---|---|
| `halo-competitive-anz` | VNet, `melbourne-nsg`, storage account `haloanzcontent`, identity `halo-nightly-vm`, Logic Apps `melbourne-start` and `melbourne-stop` | permanent |
| `halo-competitive-anz-nightly` | the VM, its disk, NIC and public IP | 5:45pm to midnight, empty otherwise |

`melbourne-start` deploys `infra/nightly.json`; cloud-init clones `main` and
runs `scripts/nightly-boot.sh`, which pulls the game, MCC content and mods
from the `content` container, restores the ban list, writes a fresh `.env`
with a new RCON password and starts the stack. It takes about five minutes.
`melbourne-stop` deploys the empty `infra/teardown.json` in Complete mode,
which deletes everything in the nightly group.

The public IP is different every night. Players never need it: the servers
announce themselves to the master list. To reach tonight's VM yourself (SSH is
open only from the address in `melbourne-nsg`'s `ssh-from-home` rule):

```powershell
az deployment group show -g halo-competitive-anz-nightly -n nightly --query properties.outputs.publicIp.value -o tsv
ssh halo@<ip>
```

What is kept, in the `state` container:

| Path | What | When |
|---|---|---|
| `boots/<date-HHMM>.log` | the boot script's log, success or failure | end of each boot |
| `logs/<date>.tgz` | `server/data`, the servers' own logs | every 5 minutes |
| `bans.json` | the ban list, restored at the next boot | every 5 minutes |

A ban made in the last five minutes before midnight can be lost. A failed
build sends no alert; the evidence is the boot log, or no servers on the list.

**Adding a mod** is `sync-mods.ps1` as before, then
`.\scripts\upload-content.ps1 -Part mods`. The same script uploads
`mcc-content` after `copy-mcc-content.ps1`, and `game` after an MCC update.
Tonight's build uses whatever was uploaded last.

**Turning it off** is disabling both Logic Apps. With the nightly group empty
the only cost left is storage, a few cents a month. When turning them back
on, a recurrence whose `startTime` has already passed fires the moment it is
enabled, so move `startTime` in `infra/logic-*.json` to a future date and
re-apply first. Enabling `melbourne-stop` early is harmless; enabling
`melbourne-start` early builds a server that runs until midnight.

The old always-on VM `melbourne` (static IP `20.211.218.55`) is deallocated
and kept as a fallback until the nightly build has run cleanly twice, then
deleted with its disk, NIC, IP and shutdown schedule.

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

## A second city

A machine runs the servers its own `dedicated.toml` lists, so Sydney 1 and
Sydney 2 are a second machine. Its `dedicated.toml` differs only in the two
names, which must not collide with Melbourne's: the Server Browser lists both
machines side by side. How that file is kept (a per-city copy in this repo,
or a local edit) is decided when there is a second machine; until then this
repo describes Melbourne. Melbourne and Sydney are roughly 10-15 ms apart, so
one city serves both for a start.

## Stats

Reclaimer servers report finished games to the project's public stats service
by default (`stats_server` in `dedicated.toml`; `"off"` reports nowhere).
Getting these games onto the ANZ dashboard is a separate piece of work: the
dashboard's watcher reads MCC carnage reports, and it is not yet known whether
Reclaimer writes the same format. The remote console's live event stream
(kills, joins, game start and end) is the other possible source.
