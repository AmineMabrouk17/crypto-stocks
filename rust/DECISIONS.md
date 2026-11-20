# Architecture decisions

## ADR-001: axum HTTP front door owns `/api/*`

Status: accepted (2026-11-20)

Context: the frontend must keep calling the same URLs; the Rust service is the
new backend implementation.

Decision: Rust binds `127.0.0.1:8080` by default (`HOST`/`PORT` override).
Next.js rewrites `/api/:path*` to `BACKEND_ORIGIN`. This is the only
frontend-facing change apart from resolver deduplication.

Consequences: Next.js route handlers become dead code after parity and are
removed in the final commit.

## ADR-002: one asset resolution per navigation

Status: accepted (2026-11-20)

Context: `generateMetadata` and the page component each call `resolveAsset`,
fanning out to several Yahoo/CoinGecko requests.

Decision: add `GET /api/assets/resolve?symbol=&idHint=` and wrap the client
call in React `cache()` so both server components share one result per
navigation.

Consequences: one new internal endpoint; no change to existing endpoints.

## ADR-003: equivalence bar

Status: accepted (2026-11-20)

Context: the frontend must work unchanged.

Decision: identical status codes, JSON keys/values, `Cache-Control` headers and
error text where specified. JSON key order is explicitly not part of the
contract.

Consequences: every route gets wiremock-backed integration tests comparing
shape against recorded old output.

## ADR-004: checkpoint cadence

Status: accepted (2026-11-20)

Context: the migration is large.

Decision: wave-by-wave with small conventional commits. Ask only when a
decision is hard to undo or the bar cannot be met.

## ADR-005: dead code removal timing

Status: accepted (2026-11-20)

Context: parity must be demonstrated before deleting the reference.

Decision: remove server-only TypeScript in the final commit after all gates,
tests, benchmarks and the PR table are recorded. Keep client-only helpers.
