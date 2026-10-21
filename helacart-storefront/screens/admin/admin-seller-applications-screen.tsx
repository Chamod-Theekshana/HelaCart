"use client";

import { useState } from "react";
import { CheckCircle2, Search, Store, X } from "lucide-react";
import { useAdmin, useAdminList } from "@/components/admin-provider";
import {
  AdminBadge,
  AdminDecision,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import { AdminSellerDocuments } from "@/components/admin-seller-documents";
import { VerifiedShopBadge } from "@/components/verified-shop-badge";
import {
  dateTime,
  previewApplications,
  shortId,
  type AdminApplication,
  type AdminSellerStatus,
} from "@/lib/admin";

export default function AdminApplicationsPage() {
  const { isPreview, request } = useAdmin();
  const [status, setStatus] = useState<AdminSellerStatus>("PENDING");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [decision, setDecision] = useState<
    "approve" | "reject" | "verify" | "revoke" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [verifyOnApproval, setVerifyOnApproval] = useState(false);
  const [verificationNote, setVerificationNote] = useState("");
  const resource = useAdminList<AdminApplication>(
    "seller-applications",
    { q: query, status },
    status === "PENDING" ? previewApplications : [],
  );
  const rows = resource.data ?? [];
  const identityComplete = Boolean(
    selected?.identityDocumentType &&
    selected.documents?.some((doc) => doc.kind === "IDENTITY_FRONT") &&
    selected.documents?.some((doc) => doc.kind === "IDENTITY_BACK"),
  );
  async function commit(reason: string) {
    if (!selected || !decision) return;
    if (decision === "verify" || decision === "revoke") {
      await request(
        `/admin/seller-applications/${selected.id}/verification`,
        "PATCH",
        {
          isVerified: decision === "verify",
          expectedVersion: selected.verificationVersion,
          reason,
        },
      );
      resource.reload();
      setSelected(null);
      setNotice(
        decision === "verify"
          ? "Shop verified. The badge is now visible to shoppers."
          : "Shop verification removed. The public badge has been removed.",
      );
      return;
    }
    await request(
      `/admin/seller-applications/${selected.id}/${decision}`,
      "PATCH",
      decision === "reject"
        ? { reason }
        : verifyOnApproval
          ? { verifyShop: true, verificationReason: verificationNote.trim() }
          : undefined,
    );
    resource.reload();
    setSelected(null);
    setNotice(
      decision === "approve"
        ? verifyOnApproval
          ? "Application approved and shop verified. The badge is now visible to shoppers."
          : "Application approved. Open the shop in the approved tab to review and award its Verified shop badge."
        : "Application rejected.",
    );
  }
  return (
    <>
      <AdminHeading
        eyebrow="MODERATION / MERCHANT ONBOARDING"
        title="Seller applications"
        description="Approve seller access and manage Verified shop badges after reviewing identity documents."
      />
      <AdminFeedback error={resource.error} notice={notice} />
      <div className="admin-card">
        <div
          className="admin-tabs"
          role="group"
          aria-label="Application status"
        >
          {(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const).map(
            (value) => (
              <button
                key={value}
                className={status === value ? "active" : ""}
                onClick={() => {
                  setStatus(value);
                  setSelected(null);
                  setDecision(null);
                }}
              >
                {value.toLowerCase()}
              </button>
            ),
          )}
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search seller applications"
              placeholder="Search store, slug or owner email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span>
            {resource.page?.total ?? "—"} matching · all matching records
          </span>
        </div>
        {resource.loading ? (
          <AdminEmpty message="Loading applications…" />
        ) : rows.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner email</th>
                  <th>Contact</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <small>{row.slug}</small>
                    </td>
                    <td>
                      {row.members[0]?.user.email ?? "—"}
                      <small>
                        {row.members[0]?.user.emailVerified
                          ? "Verified email"
                          : "Email unverified"}
                      </small>
                    </td>
                    <td>{row.contactPhone ?? "—"}</td>
                    <td>{dateTime(row.createdAt)}</td>
                    <td>
                      <AdminBadge value={row.status} />
                      {row.isVerified && <small>Verified shop</small>}
                    </td>
                    <td>
                      <button
                        className="admin-link-button"
                        onClick={() => {
                          setSelected(row);
                          setVerifyOnApproval(false);
                          setVerificationNote("");
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty
            message={
              resource.error
                ? "Could not load applications."
                : `No ${status.toLowerCase()} seller applications in this queue.`
            }
          />
        )}
      </div>
      {selected && (
        <div
          className="admin-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <aside
            className="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Seller application details"
          >
            <div className="admin-drawer-head">
              <div>
                <span className="admin-eyebrow">
                  SELLER APPLICATION {shortId(selected.id)}
                </span>
                <h2>{selected.name}</h2>
                <AdminBadge value={selected.status} />
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-callout">
                <Store size={20} />
                <p>
                  Review the submitted store information and verified owner
                  before making a final decision.
                </p>
              </div>
              <h3>Store profile</h3>
              <dl className="admin-detail-list">
                <dt>Slug</dt>
                <dd>{selected.slug}</dd>
                <dt>Description</dt>
                <dd>{selected.description || "Not provided"}</dd>
                <dt>Contact</dt>
                <dd>{selected.contactPhone ?? "—"}</dd>
                <dt>Pickup address</dt>
                <dd>{selected.pickupAddress ?? "—"}</dd>
                <dt>Submitted</dt>
                <dd>{dateTime(selected.createdAt)}</dd>
              </dl>
              <h3>Owner account</h3>
              {selected.members.map((member) => (
                <div className="admin-owner" key={member.user.id}>
                  <strong>{member.user.email}</strong>
                  <span>
                    {member.user.emailVerified ? (
                      <>
                        <CheckCircle2 size={15} /> Email verified
                      </>
                    ) : (
                      "Email not verified"
                    )}
                  </span>
                </div>
              ))}
              <AdminSellerDocuments
                sellerId={selected.id}
                documentType={selected.identityDocumentType}
                documents={selected.documents ?? []}
              />
              {(selected.status === "PENDING" ||
                (selected.status === "APPROVED" && !selected.isVerified)) &&
                !identityComplete && (
                  <p className="message error">
                    Front and back identity photos are required before this
                    application can be approved or the shop can be verified.
                  </p>
                )}
              <h3>Shop verification</h3>
              {selected.isVerified ? (
                <>
                  <VerifiedShopBadge />
                  <p className="admin-muted">
                    Verified {dateTime(selected.verifiedAt)}
                    {selected.status !== "APPROVED"
                      ? ". This shop is not publicly visible while it is not approved."
                      : "."}
                  </p>
                </>
              ) : (
                <p className="admin-muted">
                  No Verified shop badge. Approval to sell does not
                  automatically verify a shop.
                </p>
              )}
              <p className="admin-muted">
                Check the identity front and back photos before verifying.
                Business registration is optional.
              </p>
              <h3>Verification history</h3>
              {selected.verificationHistory?.length ? (
                <>
                  {selected.verificationHistory.map((entry) => (
                    <div className="admin-history" key={entry.id}>
                      <strong>
                        {entry.isVerified
                          ? "Shop verified"
                          : "Verification removed"}
                      </strong>
                      <p>{entry.reason}</p>
                      <small>
                        {dateTime(entry.createdAt)} · {entry.reviewer.email}
                      </small>
                    </div>
                  ))}
                  {selected.verificationVersion >
                    selected.verificationHistory.length && (
                    <p className="admin-muted">
                      Showing the latest 20 decisions. Earlier decisions remain
                      in the audit record.
                    </p>
                  )}
                </>
              ) : (
                <p className="admin-muted">No verification decisions yet.</p>
              )}
              <h3>Review history</h3>
              {selected.reviews.length ? (
                selected.reviews.map((review, i) => (
                  <div className="admin-history" key={i}>
                    <AdminBadge value={review.decision} />
                    <p>{review.reason ?? "Decision recorded."}</p>
                    <small>{dateTime(review.createdAt)}</small>
                  </div>
                ))
              ) : (
                <p className="admin-muted">No previous review decision.</p>
              )}
            </div>
            {selected.status === "PENDING" && (
              <div className="admin-drawer-actions">
                <button
                  className="admin-danger-outline"
                  disabled={isPreview}
                  onClick={() => setDecision("reject")}
                >
                  Reject application
                </button>
                <button
                  className="primary-btn"
                  disabled={isPreview || !identityComplete}
                  onClick={() => setDecision("approve")}
                >
                  Approve application
                </button>
              </div>
            )}
            {(selected.status === "APPROVED" || selected.isVerified) && (
              <div className="admin-drawer-actions">
                <button
                  className={
                    selected.isVerified ? "admin-danger-outline" : "primary-btn"
                  }
                  disabled={
                    isPreview || (!selected.isVerified && !identityComplete)
                  }
                  onClick={() =>
                    setDecision(selected.isVerified ? "revoke" : "verify")
                  }
                >
                  {selected.isVerified ? "Remove verification" : "Verify shop"}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
      {(decision === "approve" || decision === "reject") && selected && (
        <AdminDecision
          title={
            decision === "approve"
              ? "Approve seller application?"
              : "Reject seller application?"
          }
          description={
            decision === "approve"
              ? `Approve ${selected.name} and grant its owner seller access?`
              : `Provide feedback to ${selected.name}. This decision will be recorded.`
          }
          label={decision === "approve" ? "Approve seller" : "Reject seller"}
          dangerous={decision === "reject"}
          noteLabel={decision === "reject" ? "Rejection reason" : undefined}
          minLength={10}
          maxLength={500}
          onClose={() => setDecision(null)}
          onConfirm={commit}
        >
          {decision === "approve" && (
            <div>
              <label
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: "auto", flex: "none" }}
                  checked={verifyOnApproval}
                  onChange={(event) =>
                    setVerifyOnApproval(event.target.checked)
                  }
                />
                Also verify this shop
              </label>
              {verifyOnApproval && (
                <label>
                  Verification review note (admin only)
                  <textarea
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    value={verificationNote}
                    onChange={(event) =>
                      setVerificationNote(event.target.value)
                    }
                    placeholder="Confirm you reviewed the front and back identity photos."
                  />
                </label>
              )}
            </div>
          )}
        </AdminDecision>
      )}
      {(decision === "verify" || decision === "revoke") && selected && (
        <AdminDecision
          title={
            decision === "verify"
              ? "Verify this shop?"
              : "Remove shop verification?"
          }
          description={
            decision === "verify"
              ? `Confirm you have reviewed ${selected.name}'s identity document front and back. This awards a public Verified shop badge.`
              : `Remove the Verified shop badge from ${selected.name}. Selling approval is managed separately.`
          }
          label={decision === "verify" ? "Verify shop" : "Remove verification"}
          noteLabel={
            decision === "verify"
              ? "Verification review note (admin only)"
              : "Removal reason (admin only)"
          }
          minLength={10}
          maxLength={500}
          dangerous={decision === "revoke"}
          onClose={() => setDecision(null)}
          onConfirm={commit}
        />
      )}
      {resource.pagination}
    </>
  );
}
