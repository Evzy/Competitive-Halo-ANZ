#!/usr/bin/env bash
# Prepares a fresh Ubuntu VPS to run the servers: Docker, the host firewall,
# and the folders Docker must not create as root. Run from the repo root:
#
#   bash scripts/setup-vps.sh
#
# The provider's own firewall (security group, cloud firewall) is separate
# and still needs the same ports opened in its dashboard.
set -euo pipefail

cd "$(dirname "$0")/.."

GAME_PORTS="$(grep -E '^GAME_PORTS=' .env 2>/dev/null | cut -d= -f2 || true)"
GAME_PORTS="${GAME_PORTS:-49176-49179}"
MASTER_PORT=49175

echo "== Docker"
if ! command -v docker >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker "$USER"
  echo "Added $USER to the docker group. Log out and back in before running docker without sudo."
fi

echo "== Firewall (ufw)"
if command -v ufw >/dev/null; then
  sudo ufw allow OpenSSH
  sudo ufw allow "${MASTER_PORT}/tcp"
  sudo ufw allow "${GAME_PORTS/-/:}/udp"
  sudo ufw --force enable
  sudo ufw status
fi
# Docker publishes ports past ufw on its own, so ufw is not what keeps RCON
# private: compose.yaml binding it to 127.0.0.1 is.

echo "== Folders"
mkdir -p server/game server/content/Mods server/data
[ -f .env ] || cp .env.example .env

cat <<EOF

Next:
  1. Open TCP ${MASTER_PORT} and UDP ${GAME_PORTS} in your provider's firewall too.
  2. Upload the game files into server/game (see docs/hosting.md).
  3. docker compose up -d && docker compose logs -f
EOF
