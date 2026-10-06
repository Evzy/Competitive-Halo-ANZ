# Hosting the servers

How to run Halo Competitive ANZ's servers on an Australian VPS. Project
Reclaimer's own guide is the reference for everything here:
<https://projectreclaimer.dev/host.html>.

The live servers do this on a VM that Azure builds every evening and deletes
at midnight; [Azure, built nightly](#azure-built-nightly) covers that. The
sections before it are how any one machine is set up, which is also what the
nightly VM does automatically.

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

This is how the live servers run when they are on (they are **off** for now;
see Turning it off and on). There is no machine that stays around: at
**5:45pm** Melbourne time Azure builds a brand-new VM from `main`, and at
**midnight** it deletes it, disk and IP included. Nothing on the VM survives
the night except what it saves to storage, so **whatever is on `main` at
5:45pm is what goes live**, and outside those hours the only cost is storage
(a few cents a month).

### How a night runs

1. **5:45pm.** The Logic App `melbourne-start` deploys `infra/nightly.json`
   into the group `halo-competitive-anz-nightly`: a B2s VM, a 30 GB disk, a
   NIC on the permanent network and firewall, and a new public IP.
2. **cloud-init** (inside that template) installs Docker and git, clones `main`
   and runs `scripts/nightly-boot.sh`, which:
   - downloads `game.tar`, `mcc-content.tar` and `mods.tar` from the storage
     account and unpacks them into `server/`;
   - restores the ban list from `state/bans.json`;
   - writes a fresh `.env`: auto-update on, a new random RCON password
     (never stored anywhere), the lobby keeper on Melbourne 1 and 2;
   - starts the stack with `docker compose up -d`;
   - installs a cron job running `scripts/nightly-save.sh` every 5 minutes;
   - uploads its own log to `state/boots/`, success or failure.

   The servers are on the master list about five minutes after 5:45pm.
   Players find them there, so the IP changing every night does not matter.
3. **Every 5 minutes**, `nightly-save.sh` copies the ban list and the
   servers' logs to storage.
4. **Midnight.** `melbourne-stop` deploys `infra/teardown.json`, an empty
   template, in Complete mode. Complete mode deletes everything in the group
   that the template does not list, which is everything.

The VM reads storage as the managed identity `halo-nightly-vm`, so no key or
password is on the VM or in this repo. `scripts/blob.sh` holds the storage
calls both scripts share.

### Where everything lives

| Group | Holds | Lifetime |
|---|---|---|
| `halo-competitive-anz` | `melbourneVNET` and `melbourne-nsg` (the firewall), storage account `haloanzcontent`, identity `halo-nightly-vm`, Logic Apps `melbourne-start` and `melbourne-stop` | permanent |
| `halo-competitive-anz-nightly` | the VM, its disk, NIC and public IP | 5:45pm to midnight, empty otherwise |

Storage account `haloanzcontent`:

| Container / path | What | Written by |
|---|---|---|
| `content/game.tar`, `mcc-content.tar`, `mods.tar` | what the server needs that is not in git | `scripts/upload-content.ps1`, from your PC |
| `state/bans.json` | the ban list, restored at the next boot | every 5 minutes |
| `state/logs/<date>.tgz` | `server/data`, the servers' own logs | every 5 minutes |
| `state/boots/<date-HHMM>.log` | the boot script's log | end of each boot |

In the repo:

| File | Role |
|---|---|
| `infra/nightly.json` | the VM template, including cloud-init |
| `infra/teardown.json` | the empty template midnight deploys |
| `infra/logic-start.json`, `infra/logic-stop.json` | the two schedules; ids and the SSH key are placeholders filled in by `azure-nightly.ps1 apply` |
| `scripts/nightly-boot.sh`, `nightly-save.sh`, `blob.sh` | run on the VM |
| `scripts/azure-nightly.ps1` | run from your PC: status, IP, build or tear down now, apply the schedules |
| `scripts/upload-content.ps1` | run from your PC: replace one of the three tarballs |

`npm run validate` (and CI) fails if `nightly.json` stops declaring a
parameter `logic-start.json` passes it, and syntax-checks the shell scripts.

### Day to day, from your PC

| Task | Command |
|---|---|
| Is it up? Latest boot logs | `.\scripts\azure-nightly.ps1 status` |
| Tonight's IP | `.\scripts\azure-nightly.ps1 ip` |
| SSH in (open only from the address in `melbourne-nsg`'s `ssh-from-home` rule) | `ssh halo@<ip>`, then the commands in "Day to day" above |
| Build now, outside 5:45pm (a failed build, a test) | `.\scripts\azure-nightly.ps1 build` |
| Delete it now | `.\scripts\azure-nightly.ps1 teardown` |
| Added a mod | `sync-mods.ps1`, then `.\scripts\upload-content.ps1 -Part mods` |
| Changed the MCC variants | `copy-mcc-content.ps1`, then `.\scripts\upload-content.ps1 -Part mcc-content` |
| MCC or Reclaimer needs new game files | `dedicated init` (First-time setup, step 2), then `.\scripts\upload-content.ps1 -Part game` |
| Changed `infra/logic-*.json` | push to `main`, then `.\scripts\azure-nightly.ps1 apply` |

A config change (playlists, `dedicated.toml`, `compose.yaml`, the boot script)
needs nothing but a push to `main`: tonight's build clones it. A change to
`infra/nightly.json` is the same, because the schedule fetches the template
from `main` on GitHub. Content changes need the upload, because the tarballs
are not in git. A build in progress or already running keeps what it started
with; `teardown` then `build` picks up a change tonight.

Things to know:

- **A failed build sends no alert.** The evidence is `status` showing a boot
  log that does not end in `up`, or no servers on the list. There is no
  fallback machine: read the boot log, fix `main`, then `teardown` and
  `build`.
- **A ban made in the last five minutes before midnight can be lost.**
- **RCON** is open inside Docker only, never to the internet, and its password
  is in `.env` on tonight's VM.

### Turning it off and on

**It is OFF now.** Both schedules were disabled on 6 October 2026 after a good
test week-night (four servers on F4s v2, the second FFA added mid-evening). The
nightly group is empty, so the only cost is storage, which is kept so the game
files do not have to be uploaded again: a few cents a month.

```powershell
.\scripts\azure-nightly.ps1 off   # disable the 5:45pm build, tear down a running server, disable midnight
.\scripts\azure-nightly.ps1 on    # enable both again; the next build is the next 5:45pm
```

`build` and `teardown` run the schedules, so they only work while it is on.

**Before `on`, two dates in `infra/logic-start.json` must be in the future**,
and `on` refuses until they are:

- **`startTime`.** A schedule whose `startTime` has passed fires the moment it
  is enabled or re-applied, which would build a server on the spot. Set it to
  a date before the first night you want (keep the time before 17:45).
- **The last night**, the date in the `Until_the_last_night` condition.
  `melbourne-start` builds only while the time is before it; after it, the
  schedule wakes at 5:45pm and does nothing, while `melbourne-stop` still
  deletes anything left up. Set it to the morning after the last night you
  want, in UTC (midnight Melbourne is 13:00 UTC the day before in AEDT), or
  far in the future to run indefinitely. `status` prints it.

Then push, run `apply` (it copies the file to Azure and keeps the schedules
off), and run `on`. `on` enables `melbourne-stop` first: if its own
`startTime` has passed it fires once on enable, which empties an already-empty
group and costs nothing. `apply` also refuses to re-apply a schedule that is
on with a `startTime` in the past, for the same reason.

### From nothing

Everything permanent can be rebuilt with the Azure CLI. Subscription `dev`,
region `australiasoutheast`.

```powershell
$az = (Get-ChildItem "C:\Program Files*\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" | Select -First 1).FullName
$g = 'halo-competitive-anz'

# Groups, network and firewall
& $az group create -n $g -l australiasoutheast
& $az group create -n halo-competitive-anz-nightly -l australiasoutheast
& $az network vnet create -g $g -n melbourneVNET --address-prefixes 10.0.0.0/16 --subnet-name melbourneSubnet --subnet-prefixes 10.0.0.0/24
& $az network nsg create -g $g -n melbourne-nsg
& $az network nsg rule create -g $g --nsg-name melbourne-nsg -n ssh-from-home --priority 100 --protocol Tcp --destination-port-ranges 22 --source-address-prefixes <your home IP>
& $az network nsg rule create -g $g --nsg-name melbourne-nsg -n reclaimer-games --priority 110 --protocol Udp --destination-port-ranges 49176-49178
& $az network nsg rule create -g $g --nsg-name melbourne-nsg -n reclaimer-browser --priority 120 --protocol Tcp --destination-port-ranges 49175

# Storage, and the identity the VM reads it as
& $az storage account create -g $g -n haloanzcontent -l australiasoutheast --sku Standard_LRS --kind StorageV2 --access-tier Hot --allow-blob-public-access false --min-tls-version TLS1_2
& $az identity create -g $g -n halo-nightly-vm -l australiasoutheast
$sa = & $az storage account show -g $g -n haloanzcontent --query id -o tsv
& $az role assignment create --assignee-object-id (& $az identity show -g $g -n halo-nightly-vm --query principalId -o tsv) --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $sa
& $az role assignment create --assignee-object-id (& $az ad signed-in-user show --query id -o tsv) --assignee-principal-type User --role "Storage Blob Data Contributor" --scope $sa
# Wait a minute for the role to take effect, then:
& $az storage container create --account-name haloanzcontent -n content --auth-mode login
& $az storage container create --account-name haloanzcontent -n state --auth-mode login
```

Then upload the content (`upload-content.ps1` with `-Part game`,
`-Part mcc-content` and `-Part mods`, after First-time setup steps 2 and 3
and `sync-mods.ps1`), set future `startTime`s, and run
`.\scripts\azure-nightly.ps1 apply`. That creates both schedules disabled and
grants them exactly what they need: Contributor on the nightly group for both;
for `melbourne-start` also Managed Identity Operator on `halo-nightly-vm` and
Network Contributor on the network and firewall, so its VM can use them. Then
`on`, and test with `build` and `teardown` rather than waiting for 5:45pm.

The storage account name must be globally unique. If `haloanzcontent` is
taken, the name is also in `scripts/azure-nightly.ps1`,
`scripts/upload-content.ps1` and `infra/logic-start.json`.

The old always-on VM `melbourne` and its static IP `20.211.218.55` were
deleted on 6 October 2026, after the first test night.

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
