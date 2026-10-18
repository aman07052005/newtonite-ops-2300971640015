# Engineering decisions

## 1. PostgreSQL as the source of truth
**Context:** Items and their history must never disagree, and simultaneous claims must be safe.
**Options:** In-memory storage, a document database, or relational transactions.
**Choice:** PostgreSQL with explicit transactions, constraints and indexes.
**Trade-off:** Requires a database service locally, but correctness is testable and query patterns are clear.

## 2. Optimistic concurrency with `version`
**Context:** Two users may edit the same item from stale screens.
**Options:** Last-write-wins, long-lived row locks, or optimistic locking.
**Choice:** Clients submit the observed version; updates match `WHERE version = $n` and increment it. A mismatch returns HTTP 409.
**Trade-off:** The client must reload/reconcile after conflicts, but silent overwrites are avoided.

## 3. Atomic claim and idempotent create
**Context:** Double-clicks/retries and concurrent claims are normal failure modes.
**Options:** Frontend button disabling alone or database-enforced conditional updates and stored idempotency responses.
**Choice:** Claim uses one conditional SQL update; create stores the response against an idempotency key in the same transaction.
**Trade-off:** A small amount of transaction code buys deterministic retry behaviour.

## 4. Team-scoped RBAC in a shared authorization function
**Context:** Hiding buttons is not authorization.
**Options:** UI-only checks, global roles, or per-team membership roles.
**Choice:** Every resource operation resolves membership for the item's team and checks the role on the server. Admin can access all teams; Lead approval remains explicit.
**Trade-off:** Membership checks add queries, but the rule is consistent and auditable.

## 5. Append-only activity + transactional outbox
**Context:** Auditing must reflect committed state; background work can fail.
**Options:** Write history after update, or commit item/history/outbox together.
**Choice:** Item change, activity event and outbox record share one transaction. The worker claims pending rows and retries with bounded attempts.
**Trade-off:** The demo worker is intentionally simple and polls; at higher throughput a dedicated queue and stronger worker observability would be warranted.

## 6. Cursor pagination and server-side filters
**Context:** The dataset may reach tens of thousands of rows.
**Options:** Fetch-all client filtering, offset pagination, or keyset pagination.
**Choice:** Server-side filters and `(created_at, id)` cursor pagination, backed by indexes.
**Trade-off:** Cursor navigation is less convenient for arbitrary page jumps but remains stable and avoids large offsets.

## Explicit product assumptions
- Work-item states: `OPEN → IN_PROGRESS → AWAITING_APPROVAL → RESOLVED → CLOSED`; reopening is not supported in this slice.
- A Lead of the item's team alone may approve `AWAITING_APPROVAL → RESOLVED`.
- Members can create, claim and edit items within their teams; Viewers may read but not mutate.
- Admin is a platform-wide operator.
- Comments are append-only and team-scoped.
- Due dates are stored as timestamps; SLA policy is not defined by the challenge and is not inferred.
