# Support cases, item returns and refund records

Buyers use **Get support** or **Return items** on an order. General questions can be opened from `/account/support`. Shops use `/seller/support` and `/seller/returns`; administrators use `/admin/support`, `/admin/returns` and `/admin/refunds`.

## Private support conversations

An order-linked case is visible to that order's buyer, members of its shop and verified allowlisted administrators. A general buyer case is between that buyer and HelaCart; a general shop case is between the shop and HelaCart. The API derives participants from the authenticated account and order, rather than accepting client-supplied buyer or seller identities.

Case titles and replies are text. Conversations have paginated messages, versioned decisions and in-app notifications with direct case links. Create/reply retries reuse request keys. Every new reply advances the case version, so an administrator cannot resolve a case using an older version that omits a new reply. Messages and decision history cannot be edited or deleted through the application.

Statuses are open, under review, waiting for buyer, waiting for seller, resolved and closed. A participant's reply reopens a resolved case. Closed cases refuse new replies; administrators can reopen them through a recorded decision.

An administrator can hold commission on an order-linked case. Resolving or closing that case releases its own hold. Other support cases, returns, pending refund records and manual commission holds remain independent. Opening a support case does not automatically grant a buyer control over commission settlement.

## Selected items and quantities

The return form loads the buyer's purchased items and remaining return quantities from the API. A buyer chooses only the required items and quantities and supplies a reason. A delivered shop order can have multiple partial requests within `RETURN_WINDOW_DAYS` (14 days by default), measured from successful delivery.

Pending, approved and resolved requests reserve their item quantities. Rejected requests release those quantities while the return window remains open. Order-row locks and database validation prevent concurrent requests from reserving more than was purchased. Item value is calculated from the saved purchase price. Request keys protect retries, and the API rejects quantities or items outside the buyer's order.

Migration `20261026050000_after_sales` retains older whole-order return requests by creating their corresponding return-item records. No old request, order total or financial snapshot is deleted or rewritten.

## Actual refund records

COD money remains with the seller. After the seller returns money to the buyer, the shop records the refunded merchandise amount, optional delivery amount, cash/bank-transfer method, payment date and transaction/receipt reference against an approved return item. The form explicitly confirms that the refund has already occurred.

A new record is **awaiting verification**. Only an administrator's evidence review can mark it verified or rejected; a submitter cannot verify their own record. The system records the refund and its verification; recording or verifying it does not initiate a bank transfer.

Pending and verified, uncorrected records reserve their amounts. Merchandise refunds cannot exceed that return item's saved value. Delivery refunds share the shop order's original delivery-fee budget across every partial return and record. Rejected or reversed records release their reserved budget. Request keys and references protect duplicate submissions. Refund dates must be valid, no earlier than delivery and no later than the current Sri Lanka calendar date.

Verification credits any applicable HelaCart commission using the original order-item rate, excluding delivery. Existing manual credits count toward the original charged base, so an automatically linked credit cannot over-credit an item. Historical aggregate charges retain their original-rate calculation. Pending refunds also pause commission when a return was previously resolved.

An incorrect verified record can be corrected once by an administrator with a reason and reference. A separate reversal preserves the original record and reverses its linked commission credit where applicable. Original reviewed records and correction history remain immutable. This corrects records; it does not recover money from the buyer or transfer funds.

Return resolution records a distinct outcome: full verified item refund, partial verified refund, replacement or another agreed resolution. Pending refund records must be reviewed first. Refund outcomes require verified evidence. Replacement/other resolutions do not imply a cash refund, and no return resolution automatically restocks inventory.

## API and operations

Authenticated buyer routes are under `/api/v1/me/after-sales`; shop routes are under `/api/v1/sellers/:sellerId/after-sales`; admin routes are under `/api/v1/admin/after-sales`.

- Buyers read `return-options/:sellerOrderId`, `returns`, `refunds` and support cases. The existing `POST /me/returns` accepts a request key and selected item/quantity array; an omitted item array retains the legacy whole-remaining-order behavior.
- Shops read their returns/refund history and submit actual refund records at `POST …/refunds`.
- Admins verify/reject at `PATCH …/refunds/:id`, or append a correction at `POST …/refunds/:id/reverse`.
- Case participants use `GET/POST …/support`, `GET …/support/:id`, and `GET/POST …/support/:id/messages` as allowed for their role. Admins change status/holds at `PATCH …/support/:id`.
- The existing admin return review/resolution routes remain supported; resolution now also accepts an outcome.

Financial/support responses are private and uncached. Suspended shops retain access to their returns, refunds, support and commission workspaces to settle existing obligations. Writes are rate limited. The current project treats verified allowlisted admins as HelaCart operators; there is no separate delegated finance-staff role.

Verification uses API unit/HTTP tests, `node scripts/verify-after-sales.mjs` against an automatically removed audit schema, and browser fixtures with mock identities and refund evidence. Those tests do not write customer records, send external messages or transfer money. Browser adapters and fixture routes are confined to the ignored audit source copy and removed after the audit.

Completed verification on 26 October 2026: 133 unit tests and 267 HTTP tests passed, alongside 10 after-sales database checks, 11 delivery database checks, 165 after-sales/production browser checks and 56 delivery form checks. Both production builds, schema validation, type checks and API lint/format checks passed. Frontend lint has no errors and six pre-existing image-element warnings. Both new migrations are applied to the development database; its public schema contains no support, shipment or refund audit fixtures. Disposable schemas and mock routes were removed, preview servers stopped and normal providers restored. The regular API and storefront are available on ports 4000 and 3000.
