# Seller commission and collections

HelaCart uses seller-collected COD. The shop receives the buyer's full COD payment and separately pays the platform's commission by bank transfer. This feature records obligations and verified payments; it does not operate a bank account or an online payment gateway.

## Start using it

1. Apply the checked-in API migrations with `npm run db:deploy` and restart the API and web application.
2. Sign in with a verified account in `ADMIN_FIREBASE_UIDS`, then open `/admin/commission`.
3. Open **Product rates**. Search for any product and choose **Manage rate**. Assign a percentage (0–100%, up to two decimals) with a recorded reason. Leave the rate blank to remove the assignment. There is no marketplace-wide percentage or fallback rate; every product starts unassigned and inactive. An explicit 0% assignment is also supported.
4. Open **Admin → Settings** at `/admin/settings` for payment days, bank details and instructions. The default is **14 days from successful delivery**, configurable to 1–90 days for future orders. Changes require a reason and reject stale versions.
5. Checkout saves the assigned percentage, computed commission amount, rate version and payment terms on each order item. Subsequent rate/settings changes cannot change existing orders. Unassigned items remain excluded permanently; assigning a rate never back-charges them.
6. Sellers open `/seller/commission` to read their product rates, review charges, monthly statements and bank details, and submit payment receipts. The owner verifies the actual bank transaction before confirming a payment.

Both routes are linked in their workspace sidebars. The admin overview links to the pending commission-payment queue. Screen implementations have descriptive filenames listed in [the screen index](../screens/README.md).

## Money rules

- Currency is LKR. All stored amounts are integer minor units; rates are basis points (500 bps = 5%). Half-up rounding is performed on each order item's merchandise total (unit price × quantity). Each item produces its own charge, allowing different rates in one order and accurate item-specific refunds. Delivery is excluded. A zero-rounded commission remains saved on the item and creates no debt entry.
- For example, merchandise of Rs. 10,000 at an illustrative 5% rate creates Rs. 500 of commission. The percentage in this example is not an installation default.
- A charge is created atomically with the transition to `DELIVERED`, which requires seller confirmation of COD collection. Cancelled, failed or historical unsnapshotted orders do not acquire a charge.
- New item commissions become payable at delivery/collection time plus the saved payment period. With the default, delivery on 1 October at 10:00 makes commission due on 15 October at 10:00. The return window is not added on top of these 14 days.
- A return case in `PENDING` or `APPROVED` automatically pauses all commission for that shop order. Admin can also use **Hold payment** on any of its charges for unresolved refunds, returns or disputes. One action holds all charged items in the shop order atomically. Releasing an admin hold preserves the original due date and cannot bypass an open return. A release after the due date can therefore immediately be overdue. All hold/release decisions retain their reason, actor and version.
- Legacy orders created under the earlier aggregate policy retain their original saved rate and return-window-plus-payment-term calculation. Their records are preserved, and no item commission is backfilled onto historical orders.
- Partial payments are supported. A pending receipt reserves part of the currently payable balance, preventing concurrent submissions from claiming the same amount. It does not reduce outstanding debt.
- Only an owner-approved payment reduces debt. Reviews require a reason and are final; a submitter cannot approve their own payment. Rejected claims can be corrected and submitted with a new request key, including the same bank reference. Pending/approved bank references are unique across shops.
- Confirming an already submitted transfer remains possible after a later refund reduces the outstanding amount: money actually received is kept as account credit, rather than silently discarded. Credit carries forward to future obligations.
- Payments offset the oldest due obligations first when calculating overdue balances. Pending submissions remain outstanding until reviewed.

## Returns, credits and corrections

Resolving a return does not automatically imply a cash refund: the resolution may be a replacement. The owner must verify the actual merchandise refund, open the charge in a shop account, and record the refunded merchandise amount, reference and reason. This adjusts commission only; it neither transfers money nor restocks goods.

Choose the charge for the actual refunded item, identified by its product name and SKU. Partial refund credits use that item's original rate and cumulative rounding. Total refunded merchandise cannot exceed that item's charged base, and a full refund credits exactly its original commission. Another item in the same order can have a different rate and separate refund balance. Legacy aggregate charges retain their original refund rules. An already paid charge can produce a carried-forward credit balance.

The [after-sales workflow](after-sales.md) also creates the applicable credit automatically when an administrator verifies a seller's actual buyer-refund record. Existing manual credits count toward the item's original charged base; the workflow cannot add a second credit beyond that base. Correcting a verified buyer-refund record reverses its linked credit while retaining both histories. Pending refund records and administrator-enabled support-case holds also pause commission eligibility.

If a payment approval or refund credit was recorded incorrectly, the owner can use **Correct approval** or **Credit history → Correct credit record**. A reason, case reference and explicit confirmation are required. A separate adjustment reverses the record's effect; the original approval/credit is retained. Each record can be corrected once. Correcting a refund also restores the relevant merchandise eligibility, preserving cumulative rounding. These corrections do not move money.

Charges, credits, product-rate decisions, holds, settings decisions, reminders and corrections are append-only at the database level. Order item financial snapshots are immutable. Payment details are immutable and permit one pending-to-final review. Financial records are corrected with new entries rather than edits or deletion.

## Statements and reminders

- Monthly account statements use calendar boundaries in `Asia/Colombo`, include opening/closing balances, and list charges, verified payments, refund credits and corrections. Negative entries reduce commission owed. Held charges remain on the account statement and are identified separately in the charge list and balance summary.
- CSV exports run against one consistent database snapshot, escape spreadsheet formulas, and include the entire selected month up to 5,000 entries. Larger periods return an explicit export-limit error rather than a truncated statement.
- Account, charge and payment lists use server pagination. Admin balance search and outstanding/overdue/pending filters operate across the complete marketplace.
- Owner-triggered overdue reminders are delivered through existing in-app notifications, at most once per shop per Sri Lanka calendar day. This package does not send bank payments or email/SMS reminders.

## Access and storage

- Existing verified administrator allowlisting and revocation checks protect every admin endpoint. The current project treats authorized administrators as platform operators; granular finance staff roles are a later feature.
- Verified shop members can read their shop's account and submit payments. Suspended shops retain access to their finance route so they can settle existing debt. Financial reads and receipt retrieval recheck membership and ownership.
- Receipts are required JPEG/PNG/WebP images, up to 5 MB, with MIME/signature checks. They use the existing separate private R2 bucket under `commission-receipts/`; no public receipt URL or storage key is returned.
- Receipt viewing requires an authenticated shop-member or administrator request. Financial responses use `private, no-store`; browser receipt object URLs are revoked on close/account changes.
- Stable request keys make receipt retries and credits/corrections idempotent. Per-shop row locks protect concurrent submissions, payment decisions and adjustments. Cleanup checks whether a receipt was committed before removing a failed upload; uncertain commit outcomes retain the object for recovery.
- Buyer order responses exclude internal commission snapshot fields. Checkout totals and buyer payment amounts are unchanged.

## API routes

Seller routes start at `/api/v1/sellers/:sellerId/commission`:

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET | `/summary`, `/policy` | Own balances and current platform bank instructions |
| GET | `/charges`, `/payments` | Paginated own account records |
| GET | `/products` | Paginated read-only product commission assignments for this shop |
| GET | `/statement`, `/statement.csv` | Monthly account statement and export |
| POST | `/payments` | Multipart transfer details and one `receipt` image |
| GET | `/payments/:id/receipt` | Authenticated private receipt bytes |

Administrator routes start at `/api/v1/admin/commission`:

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET / PATCH | `/policy` | Read or version-checked update of platform terms |
| GET | `/products`, `/products/:id/history` | Search all product assignments and read recent rate history |
| PATCH | `/products/:id` | Admin-only rate assignment/removal with version and reason |
| POST | `/charges/:id/hold` | Hold/release every charged item of the shop order, with version and reason |
| GET | `/policy/history`, `/summary`, `/sellers` | Audit history and marketplace balances |
| GET | `/payments` | Filter payment submissions, optionally by `sellerId` |
| PATCH | `/payments/:id` | Approve or reject once, with a verification note |
| GET | `/payments/:id/receipt` | Private owner receipt view |
| GET | `/sellers/:sellerId/summary`, `/charges`, `/statement`, `/statement.csv` | Shop account details |
| POST | `/sellers/:sellerId/refunds` | Verified merchandise refund commission credit |
| POST | `/sellers/:sellerId/corrections` | Reverse an incorrect approved payment or refund credit |
| POST | `/sellers/:sellerId/reminder` | Once-per-day overdue in-app reminder |

The legacy COD reconciliation APIs and history are retained for compatibility. `/admin/cod` is a read-only view of seller-reported COD records. Those legacy records do not pay commission or count as platform commission collections.

## Verification

Run API `npm run check` for schema, formatting, lint, types, unit/HTTP tests and build. From the built API, run `node scripts/verify-commission.mjs` for isolated real-PostgreSQL financial, concurrency, ownership, rounding and database-history checks. That script creates and removes a disposable schema; it uses an in-memory receipt adapter and never transfers money or writes customer records.

`node scripts/verify-commission-receipt.mjs` separately uploads, reads and removes one tiny non-sensitive image in the configured private R2 bucket. It does not read or modify existing documents.

Browser audits use the real screens and shared components with isolated mock identities and bank transfers. Test-only providers and authentication adapters are confined to the ignored `.next/commission-review` source copy. Design preview remains labelled and read-only.

Product commission verification uses the same isolated database audit, plus `commission-ledger.spec.ts`, `commission.service.spec.ts` and the guarded HTTP cases. Browser checks cover assignment/removal, read-only seller rates, settings without a common percentage, error recovery, hold/release history and layouts down to 320 px. No arbitrary commission assignment or real bank account is preconfigured.

Verified on 26 October 2026: 116 unit tests, 226 HTTP tests, 29 isolated PostgreSQL checks and 138 browser checks passed. Both production builds, type checks and API formatting/lint checks passed; frontend lint has six existing image-element warnings and no errors. Migration `20261026030000_product_commission` was applied to the development database. Its public schema retains a 14-day payment period, zero product-rate assignments and zero financial audit records. The disposable audit schema was removed, mock routes were removed from the isolated source copy, and temporary preview servers were stopped. The updated API is running on port 4000.
