# Contributing to Drop to Empire (滴水成城 · D2E)

Before changing behavior, contracts, or game balance, read:
- [`AGENTS.md`](AGENTS.md) — non-negotiable engineering and game design invariants
- [`docs/README.md`](docs/README.md) — 4D modular game design and architecture documentation index
- [`docs/architecture/overview.md`](docs/architecture/overview.md) — runtime topology, SSH-tunneled admin isolation, and transactional guarantees
- [`docs/architecture/ddd-idl.md`](docs/architecture/ddd-idl.md) — 4-layer Hexagonal Clean DDD and unified Thrift IDL pipeline
- [`docs/contracts/http-v1.md`](docs/contracts/http-v1.md) — HTTP REST contract specification

---

## 1. Security & Plane Isolation Boundaries

- **Public Player Edge (`:8443` HTTPS)**: Exposes only player authentication, settlement, wasteland raid, market, and war routes. Caddy explicitly blocks `/admin*` and `/api/v1/empire/admin/*` with `HTTP 403` on the public listener.
- **SSH Loopback Admin Plane (`127.0.0.1:18480`)**: Admin console and `/api/v1/empire/admin/*` endpoints are bound exclusively to `127.0.0.1:18480` on the production host and gated by `X-D2E-Admin-Tunnel: 1` in both Caddy and the Go HTTP adapter (`services/game/internal/adapter/http/handler.go`). Operators access `/admin` via SSH local port forwarding:
  ```sh
  ssh -N -L 18480:127.0.0.1:18480 root@<production-host>
  # Open http://127.0.0.1:18480/admin
  ```
- **Invitation-Only Registration**: Every public registration requires a single-use invitation code (`D2E-XXXX-XXXX`) generated in `/admin` (or `D2E_BOOTSTRAP_INVITE_CODE` when initializing the first account in an empty database).

---

## 2. 4-Layer Hexagonal Clean DDD Rules

`services/game` follows the strict 4-layer inward dependency rule:

```text
cmd/main.go ──► adapter/http ──► app ──► domain ◄── infra/pg
```

| Layer | Package | Responsibility | Allowed Imports |
| :--- | :--- | :--- | :--- |
| `domain/` | `services/game/internal/domain` | Entities, value objects, fixed-point resource/currency math, 2D raid engine, CLOB matching engine, chamber war engine, coded `domain.Error`, and outbound port interfaces (`WorldRepository`, `TxManager`) | **Go standard library only** (zero third-party, `pgx`, `hertz`, or cross-package imports) |
| `app/` | `services/game/internal/app` | Application use-case orchestration and transaction boundaries (`TxManager.WithinTx`) | **Go standard library + `internal/domain` only** |
| `adapter/` | `services/game/internal/adapter/http` | Inbound Hertz HTTP route adapter binding `contracts/gen/game/hertz_gen/game/empire` and translating `*domain.Error` via `pkg/httpx` | `internal/app`, `internal/domain`, `contracts/gen/game`, `drop2empire/pkg/httpx`, `drop2empire/pkg/observability` (**never imports `internal/infra`**) |
| `infra/` | `services/game/internal/infra/pg` | Outbound PostgreSQL 17 implementation using `drop2empire/pkg/postgres` | `internal/domain`, `drop2empire/pkg/postgres`, `pgx/v5` (**never imports `internal/app` or `internal/adapter`**) |

- **No Flat Legacy Files**: `services/game/internal/` may contain only `{domain,app,adapter,infra}` subdirectories and `arch_test.go`.
- **Architecture Gate (`arch_test.go`)**: `services/game/internal/arch_test.go` fails `go test` if any layer violates its import boundary.

---

## 3. Contract-First IDL & Code Generation

All external HTTP DTOs and route bindings live in [`contracts/game/http_empire.thrift`](contracts/game/http_empire.thrift).

Whenever you modify `http_empire.thrift`:

```sh
# 1. Regenerate Go Hertz bindings (contracts/gen/game) and TypeScript SDK (packages/api-client/src/generated.ts)
make gen

# 2. Stage generated files and verify architecture + codegen sync
git add contracts/ packages/api-client/src/generated.ts
make check-arch
```

Commit the `.thrift` change, regenerated `contracts/gen/game` and `packages/api-client/src/generated.ts`, implementation updates, and documentation updates together.

---

## 4. Modular Game Design Documentation Governance (`docs/design/`)

Every gameplay feature, formula, or catalog update must be documented in the appropriate layer under [`docs/design/`](docs/design):

1. **`docs/design/01-overall/` (Overall Design — Cross-Season Constants)**:
   - Core pillars, zero-spoiler progressive disclosure rules, 9-chapter story chronicle, and the 3-phase player lifecycle (`Phase 1 / 2 / 3`).
2. **`docs/design/02-macro/` (Macro Design — Server-Wide Economy & War)**:
   - Monetary Supply Identity ($M_{\text{issued}} = M_{\text{player}} + M_{\text{escrow}} + M_{\text{npc}} + M_{\text{treasury}}$), CLOB price-time priority matching, 4-profession specialization interlocks, and 7-day chamber territory war resolution.
3. **`docs/design/03-micro/` (Micro Design — Single-Player & Single-Raid Mechanics)**:
   - Settlement resource couplings, upkeep & hydration penalty, storage caps & 10:1 overflow siphon, 17 blueprints, 4 edicts, caravan barter, 2D multi-zone portal extraction roguelite mechanics (real-time countdown, movement cooldown rate limits, 5-tier chest channeling durations, safebox protection, single-use blueprint learning/destruction, 54 pre-raid buff cards), and layered `LordAvatarSVG` / `ProceduralRelicSVG` rendering.
4. **`docs/design/04-seasons/` (Seasonal Design — Reset Boundaries & Per-Season Catalogs)**:
   - Cross-season reset vs. permanent retention rules (`season-framework.md`) and season-specific item, blueprint, and cosmetic drop tables (e.g., `s1-obsidian-awakening.md`).

---

## 5. Local Verification Matrix

Run the full verification suite before committing or deploying:

```sh
# 1. Architecture boundaries & Thrift codegen sync check
make check-arch

# 2. Full Go test suite (-race + go vet) & Frontend suite (tsc + eslint + vitest + vite build)
make test
```

---

## 6. Branching & Production Delivery

1. **Trunk-Based Development**: `main` is the only ongoing development branch.
2. **Production Deployment**: `make deploy` (`./ops/deploy-aliyun.sh`) synchronizes the verified repository to the production host, builds the multi-stage Docker images (`deploy/Dockerfile.game`, `deploy/Dockerfile.web`), starts the compose stack (`deploy/docker-compose.prod.yml`), and verifies both the public HTTPS edge (`:8443`) and the loopback admin guard (`127.0.0.1:18480`).
3. **Immutable Releases**: Cut permanent archive branches with `git push origin main:refs/heads/release/vX.Y.Z`. Never delete or force-push a published `release/v*` branch or tag.
