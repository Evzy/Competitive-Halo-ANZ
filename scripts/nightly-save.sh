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
