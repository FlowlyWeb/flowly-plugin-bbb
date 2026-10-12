#!/usr/bin/env bash
# ==============================================================================
# build-deb.sh — Build .deb package for flowly-plugin-server
# ==============================================================================
# Usage: bash scripts/build-deb.sh
# Output: dist/flowly-plugin-server_<version>_all.deb
#
# Installs to /usr/local/bigbluebutton/flowly-plugin-server/
# Creates systemd service: flowly-plugin-server.service
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PKG_DIR"

VERSION=$(node -e "console.log(require('./package.json').version)")
PKG_NAME="flowly-plugin-server"
INSTALL_DIR="/usr/local/bigbluebutton/flowly-plugin-server"

echo "=== Building ${PKG_NAME} ${VERSION} ==="

# Clean previous build
rm -rf dist/deb-staging dist/*.deb

# Create staging directory structure
STAGING="dist/deb-staging"
mkdir -p "${STAGING}${INSTALL_DIR}"
mkdir -p "${STAGING}/etc/systemd/system"
mkdir -p "${STAGING}/etc/nginx/sites-available"
mkdir -p "${STAGING}/DEBIAN"

# Copy application files
cp -r server.js core/ modules/ package.json "${STAGING}${INSTALL_DIR}/"

# Install production dependencies (flat, no symlinks)
cd "${STAGING}${INSTALL_DIR}"
npm install --omit=dev --no-audit --no-fund 2>/dev/null
cd "$PKG_DIR"

# Create .env.example
cp .env.example "${STAGING}${INSTALL_DIR}/.env.example"

# Create systemd service file
cat > "${STAGING}/etc/systemd/system/${PKG_NAME}.service" << 'EOF'
[Unit]
Description=Flowly Plugin Server — WebSocket bridge for BBB
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=bigbluebutton
Group=bigbluebutton
WorkingDirectory=/usr/local/bigbluebutton/flowly-plugin-server
EnvironmentFile=-/usr/local/bigbluebutton/flowly-plugin-server/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create nginx config
cat > "${STAGING}/etc/nginx/sites-available/${PKG_NAME}.conf" << 'EOF'
# Flowly Plugin Server — WebSocket reverse proxy
# Enable with: ln -s /etc/nginx/sites-available/flowly-plugin-server.conf /etc/bigbluebutton/nginx/flowly-plugin-server.nginx
location /flowly-plugin-server {
    proxy_pass http://127.0.0.1:8094;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
EOF

# Create DEBIAN control file
cat > "${STAGING}/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: web
Priority: optional
Architecture: all
Depends: nodejs (>= 18), postgresql, redis-server
Maintainer: Geezot <contact@geezot.com>
Description: Flowly Plugin Server — WebSocket bridge for BigBlueButton
 Provides real-time communication between BBB HTML5 plugins and the
 BBB backend via WebSocket, PostgreSQL, and Redis.
EOF

# Create postinst script
cat > "${STAGING}/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

INSTALL_DIR="/usr/local/bigbluebutton/flowly-plugin-server"

# Create .env from example if not exists
if [ ! -f "${INSTALL_DIR}/.env" ]; then
    cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
    echo "Created ${INSTALL_DIR}/.env — please configure it."
fi

# Set ownership
chown -R bigbluebutton:bigbluebutton "${INSTALL_DIR}"

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable flowly-plugin-server.service

echo ""
echo "flowly-plugin-server installed."
echo "  1. Edit ${INSTALL_DIR}/.env"
echo "  2. Enable nginx: ln -s /etc/nginx/sites-available/flowly-plugin-server.conf /etc/bigbluebutton/nginx/flowly-plugin-server.nginx"
echo "  3. Start: systemctl start flowly-plugin-server"
echo ""
EOF
chmod 755 "${STAGING}/DEBIAN/postinst"

# Create prerm script
cat > "${STAGING}/DEBIAN/prerm" << 'EOF'
#!/bin/bash
set -e
if systemctl is-active --quiet flowly-plugin-server.service; then
    systemctl stop flowly-plugin-server.service
fi
EOF
chmod 755 "${STAGING}/DEBIAN/prerm"

# Build the .deb
mkdir -p dist
fakeroot dpkg-deb --build "${STAGING}" "dist/${PKG_NAME}_${VERSION}_all.deb"

# Clean staging
rm -rf dist/deb-staging

echo "=== Built dist/${PKG_NAME}_${VERSION}_all.deb ==="
