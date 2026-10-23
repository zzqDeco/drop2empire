# System Overview & Service Guarantees

`drop2empire` (**滴水成城 · D2E**) is an authoritative web strategy and economic simulation game combining progressive single-player settlement building, a multi-zone 2D portal extraction roguelite, a real-time central limit order book (CLOB) spot market, and a daily 20:00 chamber territory war.

---

## 1. Runtime & Network Topology

```mermaid
flowchart LR
  subgraph Public["Public Internet (:8443 HTTPS)"]
    PlayerBrowser["Player Browser SPA (/)"]
  end

  subgraph Loopback["Host Loopback Only (127.0.0.1:18480 via SSH Tunnel)"]
    AdminBrowser["Operator Browser (/admin)"]
  end

  PlayerBrowser -->|TLS :8443| CaddyPublic["Caddy Public Site (:8443)"]
  AdminBrowser -->|SSH Local Forward| CaddyAdmin["Caddy Admin Site (:18480)"]

  CaddyPublic -->|Static Assets| WebDist["apps/web/dist"]
  CaddyPublic -->|/api/v1/empire/* (Blocks /admin/* -> 403)| GameSvc["services/game · Hertz (:8080)"]

  CaddyAdmin -->|X-D2E-Admin-Tunnel: 1| GameSvc

  GameSvc -->|Single-Key JSONB + Advisory Locks| PG[("PostgreSQL 17")]
```

### Key Delivery & Security Guarantees

1. **Physical Admin Plane Isolation**:
   - The public HTTPS edge (`:8443`) serves only the player-facing SPA and player APIs. Any request to `/admin*` or `/api/v1/empire/admin/*` on the public listener is rejected with `HTTP 403` at the Caddy edge before reaching the application.
   - The operator console (`/admin`) and admin APIs (`/api/v1/empire/admin/*`) are bound exclusively to host loopback (`127.0.0.1:18480` -> container `:8081`) and require an active SSH local port forward (`ssh -L 18480:127.0.0.1:18480 root@<host>`) plus the `X-D2E-Admin-Tunnel: 1` header injected by the loopback Caddy listener.
2. **Invitation-Only Registration (`Teamie` Model)**:
   - Public registration requires a valid single-use invitation code.
   - When the world has zero accounts, `D2E_BOOTSTRAP_INVITE_CODE` (default `teamie-bootstrap`) initializes the first account.
   - Operators generate and revoke single-use 7-day invitation codes (`D2E-XXXX-XXXX`) from the SSH-tunneled `/admin` console. Invitation consumption and player creation commit atomically inside the same transaction.
3. **Authoritative Continuous Tick Settlement**:
   - Every state-reading or state-mutating request runs inside `TxManager.WithinTx` and advances the authoritative world and player clocks (`AdvancePlayerToNow`) before executing domain logic.
   - Resource production, population water upkeep, charcoal/iron/ration conversion chains, storage cap clamping, and overflow siphon transformations are computed deterministically on the server.
4. **Fixed-Point Monetary Supply Identity**:
   - All physical resources are stored in integer **milli-units** (`1.000 = 1,000`), and all currency balances are stored in integer **basis-units** (`1.0000 Gold = 10,000`).
   - Every market order placement, cancellation, trade match, crafting fee, war stipend, and tax burn preserves the global invariant:
     $$M_{\text{issued}} = M_{\text{player}} + M_{\text{escrow}} + M_{\text{npc}} + M_{\text{treasury}}$$
     while tracking cumulative burned taxes separately in $M_{\text{burned}}$.
