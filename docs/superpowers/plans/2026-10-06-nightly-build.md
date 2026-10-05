# Nightly Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Melbourne server from nothing at 5:45pm and delete it at midnight, so a night off costs cents rather than about A$10 a month.

**Architecture:** Two resource groups. `halo-competitive-anz` is permanent and holds only things that cost nothing or close to it: the network, the firewall rules, a storage account holding what git cannot (MCC game files, MCC variants, mods, the ban list, logs), one managed identity, and two Logic App schedules. `halo-competitive-anz-nightly` is empty by day. At 5:45pm the start schedule deploys `infra/nightly.json` into it: a VM, its disk, NIC and IP. cloud-init installs Docker, clones `main`, and runs `scripts/nightly-boot.sh`, which downloads the content from storage, writes `.env` and starts compose. A cron job saves the ban list and logs to storage every five minutes. At midnight the stop schedule deploys an empty template in Complete mode, which deletes everything in the nightly group.

**Tech Stack:** Azure Resource Manager JSON templates, Logic Apps (Consumption), managed identities, Blob Storage over REST with `curl`, cloud-init on Ubuntu 24.04, bash, Docker Compose. No new dependencies in the repo.

## Global Constraints

- Subscription `dev` (`66a971e1-0ad6-4f12-ad7b-859e4de82e73`), region `australiasoutheast`. Touch nothing outside the two `halo-competitive-anz*` groups; the subscription holds other projects.
- No game files, MCC variants, mod files or secrets in git. They live in the storage account.
- The RCON password is generated fresh on each boot and is never stored anywhere, including storage.
- RCON ports stay unpublished; the lobby keeper reaches them over the compose network.
- `main` is what goes live: each night's VM clones it. Never push to `main` anything that is not ready to run that evening.
- Schedules use the time zone `AUS Eastern Standard Time`.
- Starting the nightly group is never allowed to create a second public "Melbourne 1": the old VM is deallocated before any test deploy.

## Why not create and delete a whole resource group

Creating a resource group needs rights over the whole subscription, and `dev` holds unrelated projects. An empty group costs nothing, so the nightly group stays and is emptied instead; the Logic Apps get Contributor on that group alone.

## Costs, measured against the price list (AUD)

| | Now | Nightly build |
|---|---|---|
| VM, B2s, A$0.0752/h | A$0.45/night | A$0.47/night (6h15m) |
| OS disk, E4 A$4.65/month | A$4.65/month always | about A$0.04/night |
| Static IP, about A$5.50/month | A$5.50/month always | about A$0.05/night |
| Storage, about 6.5 GB hot LRS | none | about A$0.25/month |
| Month at 6pm to midnight daily | about A$24 | about A$17.50 |
| Month with the servers never on | about A$10 | about A$0.25 |

## File Structure

- Create `infra/nightly.json`: the ARM template for the VM, disk, NIC and IP. Parameters only; no secrets.
- Create `infra/teardown.json`: the empty template the stop schedule deploys in Complete mode.
- Create `infra/logic-start.json`, `infra/logic-stop.json`: the two Logic App workflow definitions, so the schedules are reproducible from the repo.
- Create `scripts/blob.sh`: `blob_get` and `blob_put` over REST with the VM's managed identity. Sourced by the next two.
- Create `scripts/nightly-boot.sh`: runs once from cloud-init. Downloads content, restores the ban list, writes `.env`, starts compose, installs the save cron job, uploads its own log.
- Create `scripts/nightly-save.sh`: run by cron every five minutes. Uploads `server/bans.json` and a tarball of `server/data`.
- Create `scripts/upload-content.ps1`: from a PC, re-uploads one content part (`mods`, `mcc-content` or `game`) after it changes.
- Modify `scripts/validate.js` and `scripts/test-validate.js`: every `infra/*.json` must parse; `nightly.json` must declare the parameters the start schedule passes.
- Modify `.github/workflows/validate.yml`: `bash -n` every `scripts/*.sh`.
- Modify `docs/hosting.md`: an "Azure, built nightly" section.

---

### Task 1: Permanent resources

**Files:** none in the repo. Azure only.

**Interfaces:**
- Produces: storage account `haloanzcontent` (if taken, `haloanzcontent2`; use the name chosen everywhere below) with private containers `content` and `state`; user-assigned identity `halo-nightly-vm` (its resource id and client id are inputs to Task 4); empty group `halo-competitive-anz-nightly`.

- [ ] **Step 1: Create the nightly group, the storage account and the containers**

```powershell
$az = (Get-ChildItem "C:\Program Files*\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" | Select -First 1).FullName
& $az group create -n halo-competitive-anz-nightly -l australiasoutheast
& $az storage account create -g halo-competitive-anz -n haloanzcontent -l australiasoutheast --sku Standard_LRS --kind StorageV2 --access-tier Hot --allow-blob-public-access false --min-tls-version TLS1_2
& $az storage container create --account-name haloanzcontent -n content --auth-mode login
& $az storage container create --account-name haloanzcontent -n state --auth-mode login
```

Expected: each returns JSON with `"provisioningState": "Succeeded"` or `"created": true`. If the container commands answer 403, do Step 2's last command first and retry after a minute.

- [ ] **Step 2: Create the VM identity and grant storage access**

```powershell
& $az identity create -g halo-competitive-anz -n halo-nightly-vm -l australiasoutheast
$sa = & $az storage account show -g halo-competitive-anz -n haloanzcontent --query id -o tsv
$vmId = & $az identity show -g halo-competitive-anz -n halo-nightly-vm --query principalId -o tsv
& $az role assignment create --assignee-object-id $vmId --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $sa
$me = & $az ad signed-in-user show --query id -o tsv
& $az role assignment create --assignee-object-id $me --assignee-principal-type User --role "Storage Blob Data Contributor" --scope $sa
```

Expected: two role assignments returned. The second lets `upload-content.ps1` run from this PC.

- [ ] **Step 3: Record the values later tasks need**

```powershell
& $az identity show -g halo-competitive-anz -n halo-nightly-vm --query "{id:id, clientId:clientId}" -o json
& $az network vnet subnet show -g halo-competitive-anz --vnet-name melbourneVNET -n melbourneSubnet --query id -o tsv
& $az network nsg show -g halo-competitive-anz -n melbourne-nsg --query id -o tsv
```

Expected: an identity id, a client id (a GUID), a subnet id and an NSG id. Nothing to commit.

---

### Task 2: Seed the content from the running VM

The current VM holds everything the server needs: `server/game` (2.3 GB), MCC's variants, and `server/content/Mods` (3.7 GB). Package each into a tarball whose paths are relative to `server/`, so the boot script extracts all three with `tar -x -C server`.

**Files:** none in the repo.

**Interfaces:**
- Produces: blobs `content/game.tar`, `content/mcc-content.tar`, `content/mods.tar`.

- [ ] **Step 1: Make a two-hour upload token for the `content` container**

```powershell
$exp = (Get-Date).ToUniversalTime().AddHours(2).ToString("yyyy-MM-ddTHH:mmZ")
$sas = & $az storage container generate-sas --account-name haloanzcontent -n content --auth-mode login --as-user --permissions cw --expiry $exp -o tsv
```

- [ ] **Step 2: Build and upload the three tarballs from the VM**

Write this to `%TEMP%\seed-content.sh`, scp it to `/tmp`, strip CRs and run it with the token as its argument.

```bash
#!/bin/bash
set -euo pipefail
SAS="$1"
cd ~/Halo-Competitive-ANZ/server
tar -cf /tmp/game.tar game
# Unquoted globs: bash expands them. tar does not expand patterns when creating.
tar -cf /tmp/mcc-content.tar content/Game\ Modes/h3_*.bin content/Maps/mlg_*_012.mvar
tar -tf /tmp/mcc-content.tar | wc -l   # expect 18, the files in mcc-content.json
tar -cf /tmp/mods.tar --exclude=README.md content/Mods
for f in game mcc-content mods; do
  curl -fsS -T "/tmp/$f.tar" -H "x-ms-blob-type: BlockBlob" "https://haloanzcontent.blob.core.windows.net/content/$f.tar?$SAS"
  echo "uploaded $f.tar $(du -h /tmp/$f.tar | cut -f1)"
  rm "/tmp/$f.tar"
done
```

```powershell
scp -q "$env:TEMP\seed-content.sh" halo@20.211.218.55:/tmp/
ssh halo@20.211.218.55 "sed -i 's/\r$//' /tmp/seed-content.sh && bash /tmp/seed-content.sh '$sas'"
```

Expected: `uploaded game.tar 2.3G`, `uploaded mcc-content.tar` (well under 1M), `uploaded mods.tar 3.7G`.

- [ ] **Step 3: Confirm the blobs**

```powershell
& $az storage blob list --account-name haloanzcontent -c content --auth-mode login --query "[].{name:name, MB:properties.contentLength}" -o table
```

Expected: three rows. Step 2 printed `18` for the variant count; anything else means a glob missed and the playlists will fail to load tonight.

---

### Task 3: Boot and save scripts

**Files:**
- Create: `scripts/blob.sh`, `scripts/nightly-boot.sh`, `scripts/nightly-save.sh`
- Modify: `.github/workflows/validate.yml`

**Interfaces:**
- Consumes: blobs from Task 2.
- Produces: `nightly-boot.sh ACCOUNT CLIENT_ID USER` and `nightly-save.sh ACCOUNT CLIENT_ID USER`, both run as root from the repo; Task 4's cloud-init calls the first with exactly these three arguments.

- [ ] **Step 1: Make CI syntax-check every shell script, and watch it fail on a broken one**

In `.github/workflows/validate.yml`, after `- run: npm run validate`, add:

```yaml
      - run: for f in scripts/*.sh; do bash -n "$f" || exit 1; done
```

Run locally under WSL or Git Bash: `for f in scripts/*.sh; do bash -n "$f" || exit 1; done`. Expected: passes for the existing `setup-vps.sh`.

- [ ] **Step 2: Write `scripts/blob.sh`**

```bash
# Blob Storage over REST with the VM's managed identity. Sourced, not run;
# expects ACCOUNT and CLIENT_ID to be set. No az CLI: it is 1 GB of Python for
# two HTTP requests.

blob_token() {
  curl -fsS -H Metadata:true \
    "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F&client_id=${CLIENT_ID}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
}

blob_url() { echo "https://${ACCOUNT}.blob.core.windows.net/$1/$2"; }

# blob_get CONTAINER NAME > file. Fails on a missing blob.
blob_get() {
  curl -fsS -H "Authorization: Bearer $(blob_token)" -H "x-ms-version: 2021-08-06" "$(blob_url "$1" "$2")"
}

# blob_put CONTAINER NAME FILE. Streams the file; a single PUT holds up to 5000 MiB.
blob_put() {
  curl -fsS -T "$3" -H "Authorization: Bearer $(blob_token)" -H "x-ms-version: 2021-08-06" \
    -H "x-ms-blob-type: BlockBlob" "$(blob_url "$1" "$2")" >/dev/null
}
```

- [ ] **Step 3: Write `scripts/nightly-boot.sh`**

```bash
#!/bin/bash
# Runs once, as root, from cloud-init on the VM the start schedule builds each
# evening (infra/nightly.json). Fetches what git cannot hold, writes .env and
# starts the servers. Its log is uploaded to state/boots/ whether it succeeds
# or not, because nobody is watching this machine boot.
#
#   nightly-boot.sh STORAGE_ACCOUNT IDENTITY_CLIENT_ID USER
set -euo pipefail
ACCOUNT="$1"; CLIENT_ID="$2"; USER_NAME="$3"
REPO="/home/${USER_NAME}/Halo-Competitive-ANZ"
LOG=/var/log/halo-boot.log
exec > >(tee -a "$LOG") 2>&1
cd "$REPO"
source scripts/blob.sh
trap 'echo "exit $?"; blob_put state "boots/$(TZ=Australia/Melbourne date +%F-%H%M).log" "$LOG" || true' EXIT

echo "== $(date -u) content"
for part in game mcc-content mods; do
  blob_get content "$part.tar" | tar -x -C server
  echo "extracted $part"
done

echo "== ban list"
blob_get state bans.json > server/bans.json 2>/dev/null && echo "restored" || { rm -f server/bans.json; echo "none yet"; }

echo "== .env"
cat > .env <<EOF
GAME_PORTS=49176-49178
RECLAIMER_DEDICATED_AUTO_UPDATE=true
RECLAIMER_DEDICATED_RCON_PASSWORD=$(openssl rand -hex 24)
RECLAIMER_DEDICATED_RCON_ADDRESS=0.0.0.0
LOBBY_KEEPER_PORTS=49176,49177
LOBBY_KEEPER_MIN_PLAYERS=8
EOF
chmod 600 .env
mkdir -p server/data
chown -R "${USER_NAME}:${USER_NAME}" "$REPO"

echo "== compose"
docker compose pull -q
docker compose up -d
docker compose ps

echo "== save job"
cat > /etc/cron.d/halo-save <<EOF
*/5 * * * * root bash ${REPO}/scripts/nightly-save.sh ${ACCOUNT} ${CLIENT_ID} ${USER_NAME} >> /var/log/halo-save.log 2>&1
EOF
echo "== $(date -u) up"
```

- [ ] **Step 4: Write `scripts/nightly-save.sh`**

```bash
#!/bin/bash
# Run by cron every five minutes on the nightly VM. The VM is deleted at
# midnight with no warning, so anything worth keeping goes to storage as it
# happens: the ban list, and the servers' logs and chat.
#
#   nightly-save.sh STORAGE_ACCOUNT IDENTITY_CLIENT_ID USER
set -euo pipefail
ACCOUNT="$1"; CLIENT_ID="$2"; USER_NAME="$3"
cd "/home/${USER_NAME}/Halo-Competitive-ANZ"
source scripts/blob.sh

[ -f server/bans.json ] && blob_put state bans.json server/bans.json
tar -czf /tmp/halo-logs.tgz -C server data
blob_put state "logs/$(TZ=Australia/Melbourne date +%F).tgz" /tmp/halo-logs.tgz
```

- [ ] **Step 5: Syntax-check, then commit**

Run: `for f in scripts/*.sh; do bash -n "$f" || exit 1; done` (Git Bash). Expected: no output, exit 0.

```bash
git add scripts/blob.sh scripts/nightly-boot.sh scripts/nightly-save.sh .github/workflows/validate.yml
git commit -m "Add the nightly VM's boot and save scripts"
```

These scripts do nothing until Task 4's template calls them, so merging them changes nothing live.

---

### Task 4: The VM template, and the validator checking it

**Files:**
- Create: `infra/nightly.json`, `infra/teardown.json`
- Modify: `scripts/validate.js`, `scripts/test-validate.js`

**Interfaces:**
- Consumes: `nightly-boot.sh ACCOUNT CLIENT_ID USER` from Task 3; ids from Task 1.
- Produces: template parameters `sshPublicKey`, `subnetId`, `nsgId`, `identityId`, `identityClientId`, `storageAccount` (required) and `vmName`, `vmSize`, `adminUsername`, `repoUrl`, `branch` (defaulted). Task 5's start schedule passes the required six.

- [ ] **Step 1: Write the failing validator test**

In `scripts/test-validate.js`, before the final summary line, add:

```js
test('infra: nightly.json declares what the start schedule passes', () => {
  const template = { parameters: { sshPublicKey: {}, subnetId: {}, nsgId: {}, identityId: {}, identityClientId: {} } };
  assert.deepStrictEqual(checkInfra({ 'nightly.json': template }), ['infra/nightly.json: does not declare parameter storageAccount']);
  template.parameters.storageAccount = {};
  assert.deepStrictEqual(checkInfra({ 'nightly.json': template }), []);
  assert.deepStrictEqual(checkInfra({}), ['infra/nightly.json is missing']);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`. Expected: `FAIL infra: ...` with `checkInfra is not a function`.

- [ ] **Step 3: Implement `checkInfra` in `scripts/validate.js`**

Add after `checkConfig`, returning an error list like the other `check*` functions:

```js
// The start schedule (infra/logic-start.json) passes these to nightly.json.
// A parameter renamed in one and not the other fails the deploy at 5:45pm,
// with nobody watching.
const NIGHTLY_PARAMS = ['sshPublicKey', 'subnetId', 'nsgId', 'identityId', 'identityClientId', 'storageAccount'];

function checkInfra(templates) {
  const nightly = templates['nightly.json'];
  if (!nightly) return ['infra/nightly.json is missing'];
  return NIGHTLY_PARAMS
    .filter(p => !(nightly.parameters && nightly.parameters[p]))
    .map(p => `infra/nightly.json: does not declare parameter ${p}`);
}
```

In `main()`, just before the `for (const e of errors) console.log(...)` line, load every `infra/*.json` (a parse error is itself an error) and check them:

```js
  const infraDir = path.join(ROOT, 'infra');
  const templates = {};
  for (const f of fs.readdirSync(infraDir).filter(f => f.endsWith('.json'))) {
    try {
      templates[f] = JSON.parse(fs.readFileSync(path.join(infraDir, f), 'utf8'));
    } catch (err) {
      errors.push(`infra/${f}: ${err.message}`);
    }
  }
  errors.push(...checkInfra(templates));
```

Add `checkInfra` to the `module.exports` line, and to the `require('./validate')` destructuring at the top of `scripts/test-validate.js`.

- [ ] **Step 4: Write `infra/teardown.json`**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": []
}
```

- [ ] **Step 5: Write `infra/nightly.json`**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "vmName": { "type": "string", "defaultValue": "melbourne" },
    "vmSize": { "type": "string", "defaultValue": "Standard_B2s" },
    "adminUsername": { "type": "string", "defaultValue": "halo" },
    "sshPublicKey": { "type": "string" },
    "subnetId": { "type": "string" },
    "nsgId": { "type": "string" },
    "identityId": { "type": "string" },
    "identityClientId": { "type": "string" },
    "storageAccount": { "type": "string" },
    "repoUrl": { "type": "string", "defaultValue": "https://github.com/Evzy/Halo-Competitive-ANZ.git" },
    "branch": { "type": "string", "defaultValue": "main" }
  },
  "variables": {
    "repoDir": "[format('/home/{0}/Halo-Competitive-ANZ', parameters('adminUsername'))]",
    "cloudInit": "[format('#cloud-config\npackage_update: true\npackages: [docker.io, docker-compose-v2, git]\nruncmd:\n  - [bash, -c, \"git clone --depth 1 -b {0} {1} {2} && usermod -aG docker {3} && bash {2}/scripts/nightly-boot.sh {4} {5} {3}\"]\n', parameters('branch'), parameters('repoUrl'), variables('repoDir'), parameters('adminUsername'), parameters('storageAccount'), parameters('identityClientId'))]"
  },
  "resources": [
    {
      "type": "Microsoft.Network/publicIPAddresses",
      "apiVersion": "2023-09-01",
      "name": "[concat(parameters('vmName'), '-ip')]",
      "location": "[resourceGroup().location]",
      "sku": { "name": "Standard" },
      "properties": { "publicIPAllocationMethod": "Static" }
    },
    {
      "type": "Microsoft.Network/networkInterfaces",
      "apiVersion": "2023-09-01",
      "name": "[concat(parameters('vmName'), '-nic')]",
      "location": "[resourceGroup().location]",
      "dependsOn": [ "[resourceId('Microsoft.Network/publicIPAddresses', concat(parameters('vmName'), '-ip'))]" ],
      "properties": {
        "networkSecurityGroup": { "id": "[parameters('nsgId')]" },
        "ipConfigurations": [
          {
            "name": "ipconfig1",
            "properties": {
              "subnet": { "id": "[parameters('subnetId')]" },
              "privateIPAllocationMethod": "Dynamic",
              "publicIPAddress": {
                "id": "[resourceId('Microsoft.Network/publicIPAddresses', concat(parameters('vmName'), '-ip'))]",
                "properties": { "deleteOption": "Delete" }
              }
            }
          }
        ]
      }
    },
    {
      "type": "Microsoft.Compute/virtualMachines",
      "apiVersion": "2023-09-01",
      "name": "[parameters('vmName')]",
      "location": "[resourceGroup().location]",
      "dependsOn": [ "[resourceId('Microsoft.Network/networkInterfaces', concat(parameters('vmName'), '-nic'))]" ],
      "identity": {
        "type": "UserAssigned",
        "userAssignedIdentities": { "[parameters('identityId')]": {} }
      },
      "properties": {
        "hardwareProfile": { "vmSize": "[parameters('vmSize')]" },
        "storageProfile": {
          "imageReference": { "publisher": "Canonical", "offer": "ubuntu-24_04-lts", "sku": "server", "version": "latest" },
          "osDisk": { "createOption": "FromImage", "diskSizeGB": 30, "deleteOption": "Delete", "managedDisk": { "storageAccountType": "StandardSSD_LRS" } }
        },
        "osProfile": {
          "computerName": "[parameters('vmName')]",
          "adminUsername": "[parameters('adminUsername')]",
          "customData": "[base64(variables('cloudInit'))]",
          "linuxConfiguration": {
            "disablePasswordAuthentication": true,
            "ssh": { "publicKeys": [ { "path": "[format('/home/{0}/.ssh/authorized_keys', parameters('adminUsername'))]", "keyData": "[parameters('sshPublicKey')]" } ] }
          }
        },
        "networkProfile": {
          "networkInterfaces": [
            { "id": "[resourceId('Microsoft.Network/networkInterfaces', concat(parameters('vmName'), '-nic'))]", "properties": { "deleteOption": "Delete" } }
          ]
        }
      }
    }
  ],
  "outputs": {
    "publicIp": { "type": "string", "value": "[reference(resourceId('Microsoft.Network/publicIPAddresses', concat(parameters('vmName'), '-ip'))).ipAddress]" }
  }
}
```

- [ ] **Step 6: Run the tests and the validator**

Run: `npm test; npm run validate`. Expected: all tests pass including the new one, then `OK.`

- [ ] **Step 7: Check the template against Azure without creating anything**

```powershell
$id = & $az identity show -g halo-competitive-anz -n halo-nightly-vm -o json | ConvertFrom-Json
$key = ssh halo@20.211.218.55 "cat ~/.ssh/authorized_keys"
& $az deployment group validate -g halo-competitive-anz-nightly --template-file infra/nightly.json --parameters sshPublicKey="$key" subnetId=$(& $az network vnet subnet show -g halo-competitive-anz --vnet-name melbourneVNET -n melbourneSubnet --query id -o tsv) nsgId=$(& $az network nsg show -g halo-competitive-anz -n melbourne-nsg --query id -o tsv) identityId=$($id.id) identityClientId=$($id.clientId) storageAccount=haloanzcontent --query properties.provisioningState -o tsv
```

Expected: `Succeeded`.

- [ ] **Step 8: Commit**

```bash
git add infra/nightly.json infra/teardown.json scripts/validate.js scripts/test-validate.js
git commit -m "Add the nightly VM template, and validate it"
```

Still nothing live: no schedule deploys it yet.

---

### Task 5: The two schedules

**Files:**
- Create: `infra/logic-start.json`, `infra/logic-stop.json`

**Interfaces:**
- Consumes: template parameters from Task 4; the raw URLs of `infra/nightly.json` and `infra/teardown.json` on `main` (so Task 4 must be pushed first).
- Produces: Logic App `melbourne-start` (repurposed, disabled until Task 7) and new `melbourne-stop` (disabled until Task 7).

- [ ] **Step 1: Write `infra/logic-start.json`**

Replace `<...>` with the values from Task 1 Step 3 and the key from Task 4 Step 7 when applying; the committed file keeps the placeholders, because the ids are not secret but are this subscription's, and the key is mine.

```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "triggers": {
      "Evening": {
        "type": "Recurrence",
        "recurrence": { "frequency": "Day", "interval": 1, "timeZone": "AUS Eastern Standard Time", "schedule": { "hours": [17], "minutes": [45] } }
      }
    },
    "actions": {
      "Build_the_server": {
        "type": "Http",
        "inputs": {
          "method": "PUT",
          "uri": "https://management.azure.com/subscriptions/66a971e1-0ad6-4f12-ad7b-859e4de82e73/resourceGroups/halo-competitive-anz-nightly/providers/Microsoft.Resources/deployments/nightly?api-version=2021-04-01",
          "authentication": { "type": "ManagedServiceIdentity", "audience": "https://management.azure.com/" },
          "body": {
            "properties": {
              "mode": "Incremental",
              "templateLink": { "uri": "https://raw.githubusercontent.com/Evzy/Halo-Competitive-ANZ/main/infra/nightly.json" },
              "parameters": {
                "sshPublicKey": { "value": "<ssh public key>" },
                "subnetId": { "value": "<subnet id>" },
                "nsgId": { "value": "<nsg id>" },
                "identityId": { "value": "<identity id>" },
                "identityClientId": { "value": "<identity client id>" },
                "storageAccount": { "value": "haloanzcontent" }
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write `infra/logic-stop.json`**

```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "triggers": {
      "Midnight": {
        "type": "Recurrence",
        "recurrence": { "frequency": "Day", "interval": 1, "timeZone": "AUS Eastern Standard Time", "schedule": { "hours": [0], "minutes": [0] } }
      }
    },
    "actions": {
      "Delete_the_server": {
        "type": "Http",
        "inputs": {
          "method": "PUT",
          "uri": "https://management.azure.com/subscriptions/66a971e1-0ad6-4f12-ad7b-859e4de82e73/resourceGroups/halo-competitive-anz-nightly/providers/Microsoft.Resources/deployments/teardown?api-version=2021-04-01",
          "authentication": { "type": "ManagedServiceIdentity", "audience": "https://management.azure.com/" },
          "body": {
            "properties": {
              "mode": "Complete",
              "templateLink": { "uri": "https://raw.githubusercontent.com/Evzy/Halo-Competitive-ANZ/main/infra/teardown.json" }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Apply both, disabled, and grant their identities only what they need**

```powershell
$def = (Get-Content infra/logic-start.json -Raw) -replace '<ssh public key>', $key -replace '<subnet id>', $subnet -replace '<nsg id>', $nsg -replace '<identity id>', $id.id -replace '<identity client id>', $id.clientId
$def | Set-Content "$env:TEMP\logic-start.json"
& $az logic workflow update -g halo-competitive-anz -n melbourne-start --definition "$env:TEMP\logic-start.json" --state Disabled
& $az logic workflow create -g halo-competitive-anz -n melbourne-stop -l australiasoutheast --definition infra/logic-stop.json --state Disabled --mi-system-assigned
$rg = & $az group show -n halo-competitive-anz-nightly --query id -o tsv
foreach ($n in 'melbourne-start','melbourne-stop') {
  $p = & $az logic workflow show -g halo-competitive-anz -n $n --query identity.principalId -o tsv
  & $az role assignment create --assignee-object-id $p --assignee-principal-type ServicePrincipal --role Contributor --scope $rg
}
$start = & $az logic workflow show -g halo-competitive-anz -n melbourne-start --query identity.principalId -o tsv
& $az role assignment create --assignee-object-id $start --assignee-principal-type ServicePrincipal --role "Managed Identity Operator" --scope $id.id
& $az role assignment create --assignee-object-id $start --assignee-principal-type ServicePrincipal --role "Network Contributor" --scope (& $az network vnet show -g halo-competitive-anz -n melbourneVNET --query id -o tsv)
& $az role assignment create --assignee-object-id $start --assignee-principal-type ServicePrincipal --role "Network Contributor" --scope $nsg
```

Expected: both workflows show `"state": "Disabled"`; five role assignments. The old `Virtual Machine Contributor` assignment on the old VM is removed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add infra/logic-start.json infra/logic-stop.json
git commit -m "Add the nightly start and stop schedules"
```

---

### Task 6: One full test night, by hand

**Files:** none.

- [ ] **Step 1: Take the old VM off the list**

```powershell
& $az vm deallocate -g halo-competitive-anz -n melbourne
```

Expected: completes in about a minute. Nobody can see two "Melbourne 1"s.

- [ ] **Step 2: Run the start schedule now, and time it**

```powershell
& $az rest --method post --uri "https://management.azure.com/subscriptions/66a971e1-0ad6-4f12-ad7b-859e4de82e73/resourceGroups/halo-competitive-anz/providers/Microsoft.Logic/workflows/melbourne-start/triggers/Evening/run?api-version=2016-06-01"
```

A disabled workflow refuses this; enable it, run, and disable it again immediately (`az logic workflow update ... --state Enabled` / `Disabled`).

- [ ] **Step 3: Watch it come up**

```powershell
& $az deployment group show -g halo-competitive-anz-nightly -n nightly --query "{state:properties.provisioningState, ip:properties.outputs.publicIp.value}" -o json
```

Expected: `Succeeded` and an IP within about three minutes. Then, every minute until the log says `up` (target: under ten minutes from the trigger):

```powershell
& $az storage blob list --account-name haloanzcontent -c state --prefix boots/ --auth-mode login --query "[].name" -o tsv
ssh halo@<ip> "sudo tail -5 /var/log/halo-boot.log"
```

- [ ] **Step 4: Check it the way a player would**

```powershell
ssh halo@<ip> "cd ~/Halo-Competitive-ANZ && docker compose exec -T reclaimer dedicated status && docker compose logs --no-log-prefix lobby-keeper"
```

Expected: three servers listed on 0.9.2 or later, the master listing 3/3, the keeper `connected` to Melbourne 1 and 2. Then join Melbourne 2 in the game: Sanctuary, Warlock and Lockout must be on the vote list, which proves `mods.tar` extracted to the right place. After five more minutes, `state/logs/<today>.tgz` exists.

- [ ] **Step 5: Run the stop schedule**

Same as Step 2 with `melbourne-stop` and trigger `Midnight`. Expected within five minutes:

```powershell
& $az resource list -g halo-competitive-anz-nightly -o table
```

prints nothing: VM, disk, NIC and IP are all gone.

If any step fails, fix the script or template on a branch, merge, and repeat from Step 2. The old VM is still there to fall back on.

---

### Task 7: Switch over, then remove the old VM

**Files:**
- Modify: `docs/hosting.md`

- [ ] **Step 1: Turn the schedules on, and the old one off**

```powershell
& $az logic workflow update -g halo-competitive-anz -n melbourne-start --state Enabled
& $az logic workflow update -g halo-competitive-anz -n melbourne-stop --state Enabled
& $az resource update --ids (& $az resource show -g halo-competitive-anz -n shutdown-computevm-melbourne --resource-type Microsoft.DevTestLab/schedules --query id -o tsv) --set properties.status=Disabled
```

- [ ] **Step 2: After two good nights, delete the old VM, its disk, NIC and IP, and its schedule**

```powershell
& $az vm delete -g halo-competitive-anz -n melbourne --yes
& $az disk delete -g halo-competitive-anz -n melbourne_OsDisk_1_da5f1cde3b124fbdb4a70133360a1537 --yes
& $az network nic delete -g halo-competitive-anz -n melbourneVMNic
& $az network public-ip delete -g halo-competitive-anz -n melbourne-ip
& $az resource delete -g halo-competitive-anz -n shutdown-computevm-melbourne --resource-type Microsoft.DevTestLab/schedules
$start = & $az logic workflow show -g halo-competitive-anz -n melbourne-start --query identity.principalId -o tsv
& $az role assignment delete --assignee $start --role "Virtual Machine Contributor"
```

Expected: `az resource list -g halo-competitive-anz -o table` shows only the VNet, NSG, storage account, identity and the two Logic Apps.

- [ ] **Step 3: Document it in `docs/hosting.md`**

Add a section `## Azure, built nightly` after `## Day to day`, covering: the two groups and what lives in each; that `main` goes live at 5:45pm every night; how to find tonight's IP (`az deployment group show -g halo-competitive-anz-nightly -n nightly --query properties.outputs.publicIp.value -o tsv`); where boot logs, server logs and the ban list are kept; how to re-upload mods after adding one (`scripts/upload-content.ps1 -Part mods`); and that the old static IP `20.211.218.55` no longer exists.

- [ ] **Step 4: Write `scripts/upload-content.ps1`**

```powershell
<#
.SYNOPSIS
Uploads one part of the server's content to the storage account the nightly VM
builds from. Run after sync-mods.ps1 or copy-mcc-content.ps1 changes something.

.EXAMPLE
.\scripts\upload-content.ps1 -Part mods
.\scripts\upload-content.ps1 -Part game -GameDir "D:\SteamLibrary\steamapps\common\Halo The Master Chief Collection"
#>
param(
    [Parameter(Mandatory)][ValidateSet('mods', 'mcc-content', 'game')][string]$Part,
    [string]$Account = 'haloanzcontent',
    [string]$GameDir
)
$ErrorActionPreference = 'Stop'
$server = Join-Path (Split-Path -Parent $PSScriptRoot) 'server'
$tar = Join-Path $env:TEMP "$Part.tar"
$az = (Get-ChildItem "C:\Program Files*\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" | Select-Object -First 1).FullName

switch ($Part) {
    'mods'        { tar.exe -cf $tar -C $server --exclude README.md content/Mods }
    'mcc-content' {
        # Neither PowerShell nor tar.exe expands globs for a native command, so list the files.
        $files = @(Get-ChildItem "$server\content\Game Modes\h3_*.bin") + @(Get-ChildItem "$server\content\Maps\mlg_*_012.mvar") |
            ForEach-Object { $_.FullName.Substring($server.Length + 1) -replace '\\', '/' }
        if ($files.Count -ne 18) { throw "Expected the 18 files in mcc-content.json, found $($files.Count). Run copy-mcc-content.ps1 first." }
        tar.exe -cf $tar -C $server @files
    }
    'game'        {
        if (-not $GameDir) { throw '-GameDir is the MCC install folder holding halo3.' }
        tar.exe -cf $tar -C $GameDir --transform 's,^,game/,' halo3
    }
}
& $az storage blob upload --account-name $Account -c content -n "$Part.tar" -f $tar --auth-mode login --overwrite
Remove-Item $tar
Write-Host "Uploaded $Part.tar; tonight's build uses it."
```

Before relying on `-Part game`, compare `tar -tf` of its output with the seeded `game.tar` from Task 2: the seed's layout is the truth, and the folder list the server needs may be more than `halo3`. Fix the script to match, not the other way round. Windows `tar.exe` is bsdtar, which spells `--transform` as `-s ',^,game/,'`; use that if it rejects `--transform`.

- [ ] **Step 5: Commit**

```bash
git add docs/hosting.md scripts/upload-content.ps1
git commit -m "Document the nightly build, and add the content upload script"
```

---

## Not in this plan

- An alert when a night's build fails. Today the evidence is `state/boots/`. A Discord webhook from the boot script's `EXIT` trap is a small follow-up once a failure has actually happened.
- A stable RCON password for organisers. It is generated per boot on purpose; a stable one belongs in Key Vault.
- A stable address or DNS name. Players reach the servers through the master list, which receives each night's address from the servers themselves.
