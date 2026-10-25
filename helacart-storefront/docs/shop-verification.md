# Verified shops

Selling approval and shop verification are separate decisions. All existing and new shops default to `isVerified: false`; approval does not award a badge. Only a verified administrator on the API allowlist can award or remove verification.

## Admin workflow

Open **Admin → Seller applications → approved → Review**. Review the private NIC or driving licence front and back photos, then select **Verify shop** and enter a review note (10–500 characters). The shop must be approved and both identity photos must exist. Business registration is optional.

During a pending application's approval, the optional **Also verify this shop** checkbox offers the same review note requirement. It starts unchecked. When selected, approval, verification and both audit decisions commit together; ordinary approval remains unverified.

Verified shops offer **Remove verification**, which requires a reason. Suspended shops appear in the suspended tab, where an existing verification can also be removed. Removal changes the badge independently of approval. The drawer shows the latest 20 verification decisions, including the administrator, time and reason; all older records remain in the database.

## Public and seller views

The teal **Verified shop** badge appears on verified public shop profiles and shared shop cards on the homepage and directory. Clicking or using Enter on the badge explains: “Shop identity reviewed by HelaCart.” Card links and badge controls are separate accessible elements. Unverified shops have no public verification label. Suspended/unapproved shops remain excluded from public shop routes.

The Seller Center shop profile shows the same badge when verified. An approved unverified shop explains that verification requires a separate admin review. Sellers cannot edit verification through profile or application payloads.

## API and persistence

`PATCH /api/v1/admin/seller-applications/:id/verification`

```json
{
  "isVerified": true,
  "expectedVersion": 0,
  "reason": "Reviewed both sides of the submitted identity document."
}
```

The existing admin guard validates the verified allowlisted Firebase identity and checks token revocation. The reviewer is derived from that identity. Unknown/forged fields are rejected. The route has a per-IP write limit of 20/minute in addition to the general request limit.

The badge update and `SellerVerification` audit row commit in one database transaction. A conditional update checks the expected version, previous badge state, approval and mandatory documents. Duplicate, stale or ineligible requests return 409 without appending history; missing shops return 404. Every successful decision increments the version, including removals, so an old screen cannot overwrite a later revoke/reverify cycle.

The additive migration `20261021160000_shop_verification` has been applied to the configured database. Public shop queries expose only the verification boolean; internal history, reviewer identity, reasons, document keys and version are not public. Requests use no-store caching so subsequent page loads reflect removals.

## Validation

- API: 57 unit and 130 HTTP checks pass, including 21 new verification boundary checks. Prisma validation, lint, TypeScript and production build pass.
- Real database: `helacart-api/scripts/verify-shop-verification.mjs` passes 13 checks for default state, required photos, approval, optional registration, audit records, public privacy, suspension, revocation, combined approval and stale versions. All temporary records roll back; no identity images are uploaded or customer shops verified by this check.
- Storefront: TypeScript, targeted lint and isolated production build pass. Browser fixtures check verify/remove confirmations, public badge updates, audit history, combined approval and stale-decision feedback, plus 28 overflow checks across 1440, 768, 390 and 320 px. The browser fixture substitutes admin authorization only in an ignored source copy; real authorization is exercised through HTTP tests.

Ignored browser scripts, reports and screenshots are under `.next/storefront-polish-review/verification*`. No fixture routes or authorization overrides are included in the application source.
