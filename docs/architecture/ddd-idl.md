# Unified Thrift IDL & 4-Layer Clean DDD Architecture

`drop2empire` enforces the exact same **Contract-First Thrift IDL** and **4-Layer Hexagonal Clean DDD** architecture as `teamie`.

---

## 1. 4-Layer Hexagonal Clean DDD Structure

`services/game` is organized into four strict inward-pointing layers under `services/game/internal/`:

```text
cmd/main.go ──► adapter/http ──► app ──► domain ◄── infra/pg
```

| Layer | Package | Responsibility | Allowed Imports |
| :--- | :--- | :--- | :--- |
| **Domain** | `internal/domain` | World & Player aggregates, fixed-point resource/currency math, supply-chain coupling, 2D extraction raid engine, CLOB matching engine, chamber war settlement, and repository/transaction ports (`WorldRepository`, `TxManager`) | **Go standard library only** (zero external packages, zero framework or database imports) |
| **Application** | `internal/app` | Use-case orchestration, transactional boundaries (`WithinTx`), session/invite orchestration, and domain command dispatch | **Go standard library + `internal/domain` only** |
| **Inbound Adapter** | `internal/adapter/http` | Binds generated Hertz HTTP routes (`contracts/gen/game`), maps domain state to wire DTOs, enforces session/cookie auth and admin loopback guards | `internal/app`, `internal/domain`, `contracts/gen/game`, `drop2empire/pkg/httpx` (**never imports `internal/infra`**) |
| **Outbound Infrastructure** | `internal/infra/pg` | Implements `domain.TxManager` and `domain.WorldRepository` over PostgreSQL 17 (`drop2empire/pkg/postgres`) with transactional row locking (`SELECT ... FOR UPDATE`) | `internal/domain`, `drop2empire/pkg/postgres`, `pgx/v5` (**never imports `internal/app` or `internal/adapter`**) |

### Architecture Gate (`internal/arch_test.go` & `ops/check-architecture.sh`)
- `services/game/internal/arch_test.go` parses the Go AST of every package under `internal/` and fails `go test` if any layer imports a forbidden dependency or if flat `.go` files are added directly under `internal/`.
- `make check-arch` (`./ops/check-architecture.sh`) additionally verifies that `./ops/codegen.sh` produces zero uncommitted diff in `contracts/gen/game` and `packages/api-client/src/generated.ts`.

---

## 2. Contract-First Thrift IDL Pipeline

All HTTP wire DTOs, service signatures, and route annotations are defined in a single canonical IDL:
- [`contracts/game/http_empire.thrift`](../../contracts/game/http_empire.thrift)

Running `make gen` (`./ops/codegen.sh`) executes two deterministic code generators:
1. **`tools/thrift-go-http-codegen`**: Generates Go DTO structs, Hertz handler interfaces, and `RegisterEmpireServiceRoutes` in `contracts/gen/game/hertz_gen/game/empire/`.
2. **`tools/thrift-ts-codegen`**: Generates TypeScript interfaces and route metadata in `packages/api-client/src/generated.ts`, consumed by `EmpireClient` (`packages/api-client/src/index.ts`).

---

## 3. Fixed-Point Accounting Units

To eliminate IEEE-754 floating-point drift across continuous production ticks and market order matching:

| Domain Quantity | Storage Type | Unit Name | Scale Factor | Example |
| :--- | :--- | :--- | :---: | :--- |
| Physical Resources (`water`, `wood`, `charcoal`, `stone`, `flint`, `ancient_shard`, `iron_ingot`, `ration`) | `int64` | `Milli` | `1,000` | `1.500 水 = 1500` |
| Currency (`Gold`) & Market Prices | `int64` | `Basis` | `10,000` | `19.2000 G = 192000` |
| Discrete Inventory Items (Crafted devices, single-use raid blueprints `bp_*`, S1 cosmetics `cos_*`) | `int64` | `Units` | `1` | `1 台抽水机 = 1` |
| Raid Movement & Channeling Timers | `int32` / `int64` | `Milliseconds` | `1,000 ms = 1s` | `MoveCooldown = 360ms` |
