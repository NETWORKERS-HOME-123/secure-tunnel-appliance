#!/bin/bash
# UltraSlim Deploy Script
# Uploads source code to the droplet and runs the setup
#
# Usage: bash deploy.sh <droplet-ip>
# Example: bash deploy.sh 139.59.93.230

set -euo pipefail

DROPLET_IP="${1:-139.59.93.230}"
REMOTE_USER="root"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== UltraSlim Deployment ==="
echo "Target: ${REMOTE_USER}@${DROPLET_IP}"
echo "Source: ${SRC_DIR}"
echo ""

# Create remote directories
echo "[1/5] Creating remote directories..."
ssh ${REMOTE_USER}@${DROPLET_IP} "mkdir -p /opt/ultraslim/src/backend /opt/ultraslim/src/tunnel-buddy-main"

# Upload backend source
echo "[2/5] Uploading backend source..."
rsync -avz --delete \
  --exclude='vendor/' \
  --exclude='.git/' \
  "${SRC_DIR}/backend/" \
  "${REMOTE_USER}@${DROPLET_IP}:/opt/ultraslim/src/backend/"

# Upload frontend source
echo "[3/5] Uploading frontend source..."
rsync -avz --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.git/' \
  "${SRC_DIR}/tunnel-buddy-main/" \
  "${REMOTE_USER}@${DROPLET_IP}:/opt/ultraslim/src/tunnel-buddy-main/"

# Upload setup script
echo "[4/5] Uploading setup script..."
scp "${SRC_DIR}/deploy/cloud-init.yaml" "${REMOTE_USER}@${DROPLET_IP}:/opt/ultraslim/cloud-init.yaml"

# Run setup
echo "[5/5] Running setup on droplet..."
ssh ${REMOTE_USER}@${DROPLET_IP} "bash /opt/ultraslim/setup.sh"

echo ""
echo "=== Deployment Complete ==="
echo "Dashboard: https://tunnel.networkershome.com"
echo "Admin:     admin@ultraslim.dev / UltraSlim@2026!"
