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
GAME_PORTS=49176-49180
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
