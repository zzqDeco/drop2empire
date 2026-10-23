# Contributing to Drop to Empire (滴水成城)

Before modifying game mechanics, contracts, or UI styles, review:
- [`AGENTS.md`](AGENTS.md) — architectural and numerical invariants
- [`docs/gdd-v1.md`](docs/gdd-v1.md) — Game Design Document (GDD V1.0)

## 1. 4-Layer Hexagonal Clean DDD Rules

```text
cmd/main.go ──► adapter/http ──► app ──► domain ◄── infra/pg
```

- `domain/`: Pure Go entities, fixed-point formulas, 30-minute benchmark simulator, spot market matching engine, and deterministic graph war settlement. Zero third-party imports.
- `app/`: Transactional use-case orchestration (`TxManager.WithinTx`).
- `adapter/http`: Stateless wire DTO mapping generated from `contracts/game/http_empire.thrift`.
- `infra/pg`: PostgreSQL persistence and audit tables (`d2e_world_state`, `d2e_trades_audit`, `d2e_collectibles_audit`) built on `drop2empire/pkg/postgres`.

## 2. Verification Matrix

```sh
make check-arch
make test
```
