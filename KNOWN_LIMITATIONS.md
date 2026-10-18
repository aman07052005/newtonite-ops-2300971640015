# Known limitations

- Demo authentication uses seeded accounts and a shared demo password. Password hashes are stored, but there is no registration, password reset, refresh-token rotation, or account lockout.
- The outbox worker demonstrates bounded retry and idempotent handling by recording processed job IDs; it logs a simulated notification rather than delivering email.
- The UI is intentionally focused on the critical vertical slice, not a polished design system.
- Search is PostgreSQL `ILIKE` over title/description; advanced full-text ranking is not enabled.
- Cursor pagination sorts by creation time and ID. Arbitrary page jumps are not supported.
- The sample seed is modest for fast local startup; `scripts/seed.js` can be extended to generate thousands of items for a load demonstration.
- No rate limiting, CSRF layer (the API uses bearer tokens), observability stack, or production secret management is included.
- The demo is not independently security-audited and should not be exposed to real operational data.
