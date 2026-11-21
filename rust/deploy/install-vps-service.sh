#!/usr/bin/env bash
# Install the Rust backend as a supervised systemd service on this VPS.
# Idempotent: safe to re-run after a rebuild.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/rust/deploy"
SERVICE_USER="crypto-stocks"
INSTALL_DIR="/opt/crypto-stocks-backend"
ENV_FILE="/etc/crypto-stocks-backend.env"

echo "==> Building release binary"
CARGO_INCREMENTAL=0 CARGO_PROFILE_RELEASE_STRIP=true \
  cargo build --manifest-path "$REPO_ROOT/rust/Cargo.toml" --release -p crypto-stocks-backend --locked

echo "==> Creating service user and directories"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$INSTALL_DIR"
install -m 0755 "$REPO_ROOT/rust/target/release/crypto-stocks-backend" \
  "$INSTALL_DIR/crypto-stocks-backend"

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Writing $ENV_FILE (edit it to add API keys)"
  cat > "$ENV_FILE" <<'EOF'
# Bound publicly so Vercel's server-side /api/* rewrites can reach it.
HOST=0.0.0.0
PORT=8080
RUST_LOG=info
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:3100,https://crypto-stocks-web-taupe.vercel.app

# Phase 2: set these for server-hosted chat models, then `systemctl restart crypto-stocks-backend`.
# GEMINI_API_KEY=
# GROQ_API_KEY=
EOF
  chmod 0600 "$ENV_FILE"
else
  echo "==> Keeping existing $ENV_FILE"
fi

echo "==> Installing systemd units"
install -m 0644 "$DEPLOY_DIR/crypto-stocks-backend.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/crypto-stocks-backend-health.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/crypto-stocks-backend-health.timer" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now crypto-stocks-backend.service
systemctl enable --now crypto-stocks-backend-health.timer

echo "==> Waiting for health"
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "OK: $(curl -fsS http://127.0.0.1:8080/health)"
    systemctl --no-pager status crypto-stocks-backend.service | head -12
    exit 0
  fi
  sleep 1
done

echo "ERROR: backend did not become healthy" >&2
journalctl -u crypto-stocks-backend -n 30 --no-pager >&2
exit 1
