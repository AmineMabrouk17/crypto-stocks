# ADR-006: run the Rust backend as a supervised service on the VPS

Status: accepted (2026-11-21)

## Context

The whole backend was migrated from Next.js route handlers and `@crypto-stocks/lib`
server-side fetchers to the standalone axum service in `rust/`. ADR-001 defined the
HTTP boundary (`/api/*` rewritten by Next.js), and ADR-005 kept the TypeScript code
until wire parity was proven. Parity is now proven: 52 Cargo tests, 51 local HTTP
checks, and green lint/typecheck/build.

The production frontend is deployed on Vercel. A successful Vercel build does not
run a long-lived process, so the Rust binary needs a host of its own. This VPS is
that host.

## Decision

1. **Rust is the backend.** All `/api/*` traffic is served by
   `crypto-stocks-backend`; the Next.js app is a pure frontend plus a rewrite to
   `BACKEND_ORIGIN`. Browser-direct Binance/CoinGecko helpers stay in TypeScript.
2. **Run it as a systemd service on this VPS**, not as an ad-hoc `nohup` process:
   - binary at `/opt/crypto-stocks-backend/crypto-stocks-backend`
   - config at `/etc/crypto-stocks-backend.env` (`HOST=0.0.0.0`, `PORT=8080`,
     `CORS_ORIGINS`, later `GEMINI_API_KEY`/`GROQ_API_KEY`)
   - dedicated unprivileged `crypto-stocks` user, hardened unit (no-new-privileges,
     private tmp, read-only filesystem except the install dir)
   - `Restart=always`, `RestartSec=2`, enabled at boot
   - a 1-minute health timer that curls `/health` and restarts a stuck process
3. **Installer is in the repo:** `rust/deploy/install-vps-service.sh` plus the
   unit/timer files in `rust/deploy/`. Rebuilding and re-running the installer
   is the deploy procedure.
4. **Vercel points at this VPS:** set `BACKEND_ORIGIN` to the VPS origin
   (`http://<vps-ip>:8080`) in the Vercel project. The rewrite is server-side, so
   no browser mixed-content issue.

## Consequences

- The service survives crashes, hangs and VPS reboots without manual action.
- Logs are in `journalctl -u crypto-stocks-backend -f`.
- The API port is public and unauthenticated, as the original proxies were.
  Anyone can use it as a read-only upstream relay. If abuse appears, add a
  shared-secret header to the Next.js rewrite or restrict port 8080 with a
  firewall rule. This is the main security residual.
- Server-hosted chat stays unavailable until keys are added in phase 2; BYOK
  is unaffected.
- Rollback: `systemctl disable --now crypto-stocks-backend*` and revert the
  merge commit; the previous route handlers are in git history.
