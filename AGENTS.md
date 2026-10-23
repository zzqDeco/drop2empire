# Drop to Empire (滴水成城 · D2E) Engineering Instructions

- **Contract-First Thrift IDL**: All HTTP wire DTOs and routes live in `contracts/game/http_empire.thrift`. Run `make gen` (`./ops/codegen.sh`) whenever changing the contract to regenerate `contracts/gen/game` and `packages/api-client/src/generated.ts`.
- **4-Layer Hexagonal Clean DDD**: `services/game` is structured into `internal/{domain,app,adapter,infra}` and guarded by `internal/arch_test.go` and `make check-arch`.
  - `domain/` must depend only on the Go standard library (zero external or framework imports).
  - `app/` must depend only on the Go standard library and `internal/domain`.
  - `adapter/http` binds generated Hertz/HTTP routes and never imports `infra/`.
  - `infra/pg` implements `domain.TxManager` and `domain.WorldRepository` using `drop2empire/pkg/postgres` and never imports `app/` or `adapter/`.
- **Authoritative Server State & Fixed-Point Accounting**:
  - Never use floating-point accumulators for balances. Physical resources use milli-units (`1.000 = 1,000`), and currency uses basis-units (`1.0000 Gold = 10,000`).
  - Maintain the Monetary Supply Identity (`M_issued = M_player + M_escrow + M_npc + M_treasury`) across every market match, crafting fee, war stipend, and tax burn.
- **Blueprint & Ink Design System (`apps/web`)**:
  - All colors, surfaces, radii, shadows, and typography scales live in `apps/web/src/tokens.css`.
  - Every numeric readout (resource stocks, production rates, countdowns, prices, quantities, combat power, pattern seeds) must use `.mono-num` (`var(--font-mono)` + `font-variant-numeric: tabular-nums`).
  - `apps/web/src/design-tokens.test.ts` enforces WCAG AA contrast (`>= 4.5:1`), zero unreferenced CSS classes, standard font weights, and the `ICON` size scale (`{14, 16, 18, 20, 24}`).
