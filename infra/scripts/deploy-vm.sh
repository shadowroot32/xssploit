#!/usr/bin/env bash
# XSSPLOIT one-shot VM deploy (Ubuntu 24.04, Docker + nginx + certbot).
# Usage:
#   chmod +x infra/scripts/deploy-vm.sh
#   DUCKDNS_DOMAIN=namamu DUCKDNS_TOKEN=xxx ./infra/scripts/deploy-vm.sh
#
# DUCKDNS_DOMAIN = subdomain only (e.g. "xssploitku" → xssploitku.duckdns.org)
set -euo pipefail

: "${DUCKDNS_DOMAIN:?set DUCKDNS_DOMAIN (subdomain only, e.g. xssploitku)}"
: "${DUCKDNS_TOKEN:?set DUCKDNS_TOKEN (from duckdns.org profile)}"

FQDN="${DUCKDNS_DOMAIN}.duckdns.org"
REPO_DIR="${REPO_DIR:-$HOME/xssploit}"

echo "==> 1/6 Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "!! docker group added — run 'newgrp docker' then re-run this script"
  exit 0
fi

echo "==> 2/6 Source code"
if [ ! -d "$REPO_DIR" ]; then
  echo "!! clone your repo to $REPO_DIR first:"
  echo "   git clone https://github.com/USERNAME/xssploit.git $REPO_DIR"
  exit 1
fi
cd "$REPO_DIR"

echo "==> 3/6 .env"
if [ ! -f .env ]; then
  TOKEN=$(openssl rand -hex 32)
  SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
LOCAL_AUTH_TOKEN=$TOKEN
NEXT_PUBLIC_LOCAL_AUTH_TOKEN=$TOKEN
NEXT_PUBLIC_API_URL=https://${FQDN}:4000
CALLBACK_DOMAIN=${FQDN}:5001
CALLBACK_PUBLIC_BASE=https://${FQDN}:5001
CALLBACK_TOKEN_SECRET=$SECRET
EOF
  chmod 600 .env
  echo "   .env created (token saved, chmod 600)"
else
  echo "   .env exists — keeping it"
fi

echo "==> 4/6 Docker build & up"
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build

echo "==> 5/6 nginx"
sudo apt-get update -qq
sudo apt-get install -y -qq nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/xssploit >/dev/null <<EOF
server {
    listen 80;
    server_name ${FQDN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /cb/ {
        rewrite ^/cb/(.*)\$ /\$1 break;
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/xssploit /etc/nginx/sites-enabled/xssploit
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> 6/6 HTTPS (certbot)"
sudo certbot --nginx -d "${FQDN}" --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect

echo ""
echo "✅ DONE"
echo "   Dashboard : https://${FQDN}"
echo "   API health: curl https://${FQDN}/api/health"
echo "   Blind-XSS : https://${FQDN}/cb/p/<token>.js"
echo ""
echo "   NOTE: CALLBACK payloads point at https://${FQDN}:5001 —"
echo "   after HTTPS works you may prefer /cb/ proxy path (port 443):"
echo "   sed -i 's|CALLBACK_PUBLIC_BASE=.*|CALLBACK_PUBLIC_BASE=https://${FQDN}/cb|; s|CALLBACK_DOMAIN=.*|CALLBACK_DOMAIN=${FQDN}/cb|' .env && \\"
echo "   docker compose --env-file .env -f infra/docker/docker-compose.yml up -d"
