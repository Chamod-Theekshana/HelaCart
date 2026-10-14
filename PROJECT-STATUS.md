# HelaCart project status

Assessment: 2026-10-14. Scope: COD-first marketplace backend and future clients.

## Implemented in this package

- Firebase identity/profile, admin UID allowlist, seller applications and approval.
- Moderated categories/products, seller-scoped variants and stock movements.
- Buyer addresses and carts, multi-seller atomic COD checkout, fulfillment and cancellation.
- R2 product image upload (requires your own bucket, token and public domain).
- In-app buyer/seller notifications, buyer-initiated returns with admin review and resolution.
- Admin COD remittance queue, disputed amounts and append-only reconciliation records.
- Versioned migrations, isolated database integration verification, unit and HTTP tests.

## Still needed for a real launch

| Work | State / next action |
| --- | --- |
| Live configuration | Apply migration 7 to the existing Neon development branch; set R2 credentials and custom domain; test with real Firebase tokens. |
| Real COD operations | Agree on return windows, actual refund/replacement actions, seller remittance evidence and payout procedures; validate with pilot sellers. |
| Clients | Build customer storefront and seller/admin dashboards; build Flutter app if it remains part of scope. |
| Infrastructure | Hosted environment, TLS domain, secret storage, backup restore, monitoring, rate limits, security and load review. |
| Expanded commerce | Courier tracking, richer search, stocktaking, discounts/tax rules where needed, seller suspension and reapplication. |
| Online payments | Gateway and verified callbacks, refunds, commissions, payouts and a proper money ledger if this feature is required. |

## Estimate

Backend feature coverage for a **limited, manually operated COD pilot** is roughly
**75–80%**; about **20–25%** remains for integration and operational hardening. This
is a scope estimate, not a verified production-readiness percentage. The complete
marketplace with website and Flutter client is substantially less complete. No
source-only milestone proves live Neon, Firebase, R2, bank or courier behavior.

The user's existing database was not modified by preparing this archive. Read
`START-HERE.md`, then `helacart-api/README.md` for exact Windows steps.
