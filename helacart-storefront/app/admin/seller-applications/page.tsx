"use client";

import { useState } from "react";
import { CheckCircle2, Search, Store, X } from "lucide-react";
import { useAdmin, useAdminResource } from "@/components/admin-provider";
import { AdminBadge, AdminDecision, AdminEmpty, AdminFeedback, AdminHeading } from "@/components/admin-ui";
import { AdminSellerDocuments } from "@/components/admin-seller-documents";
import { dateTime, previewApplications, shortId, type AdminApplication, type AdminSellerStatus } from "@/lib/admin";

export default function AdminApplicationsPage() {
  const { isPreview, request } = useAdmin();
  const [status, setStatus] = useState<AdminSellerStatus>("PENDING");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [notice, setNotice] = useState("");
  const resource = useAdminResource<AdminApplication[]>(`/admin/seller-applications?status=${status}`, status === "PENDING" ? previewApplications : []);
  const rows = (resource.data ?? []).filter((row) => `${row.name} ${row.slug} ${row.members.map((member) => member.user.email).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const identityComplete = Boolean(selected?.identityDocumentType && selected.documents?.some(doc => doc.kind === "IDENTITY_FRONT") && selected.documents?.some(doc => doc.kind === "IDENTITY_BACK"));
  async function commit(reason: string) {
    if (!selected || !decision) return;
    await request(`/admin/seller-applications/${selected.id}/${decision}`, "PATCH", decision === "reject" ? { reason } : undefined);
    resource.reload(); setSelected(null); setNotice(`Application ${decision === "approve" ? "approved" : "rejected"}.`);
  }
  return <>
    <AdminHeading eyebrow="MODERATION / MERCHANT ONBOARDING" title="Seller applications" description="Review store information before granting access to the Seller Center." />
    <AdminFeedback error={resource.error} notice={notice} />
    <div className="admin-card"><div className="admin-tabs" role="group" aria-label="Application status">{(["PENDING", "APPROVED", "REJECTED"] as const).map((value) => <button key={value} className={status === value ? "active" : ""} onClick={() => { setStatus(value); setSelected(null); }}>{value.toLowerCase()}</button>)}</div>
      <div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input aria-label="Search loaded seller applications" placeholder="Search store, slug or owner email" value={query} onChange={(e) => setQuery(e.target.value)} /></label><span>{rows.length} shown · latest 50 per status</span></div>
      {resource.loading ? <AdminEmpty message="Loading applications…" /> : rows.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Store</th><th>Owner email</th><th>Contact</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.slug}</small></td><td>{row.members[0]?.user.email ?? "—"}<small>{row.members[0]?.user.emailVerified ? "Verified email" : "Email unverified"}</small></td><td>{row.contactPhone ?? "—"}</td><td>{dateTime(row.createdAt)}</td><td><AdminBadge value={row.status} /></td><td><button className="admin-link-button" onClick={() => setSelected(row)}>Review</button></td></tr>)}</tbody></table></div> : <AdminEmpty message={resource.error ? "Could not load applications." : `No ${status.toLowerCase()} seller applications in the loaded queue.`} />}
    </div>
    {selected && <div className="admin-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="admin-drawer" role="dialog" aria-modal="true" aria-label="Seller application details">
      <div className="admin-drawer-head"><div><span className="admin-eyebrow">SELLER APPLICATION {shortId(selected.id)}</span><h2>{selected.name}</h2><AdminBadge value={selected.status} /></div><button onClick={() => setSelected(null)} aria-label="Close details"><X size={20} /></button></div>
      <div className="admin-drawer-body"><div className="admin-callout"><Store size={20} /><p>Review the submitted store information and verified owner before making a final decision.</p></div>
        <h3>Store profile</h3><dl className="admin-detail-list"><dt>Slug</dt><dd>{selected.slug}</dd><dt>Description</dt><dd>{selected.description || "Not provided"}</dd><dt>Contact</dt><dd>{selected.contactPhone ?? "—"}</dd><dt>Pickup address</dt><dd>{selected.pickupAddress ?? "—"}</dd><dt>Submitted</dt><dd>{dateTime(selected.createdAt)}</dd></dl>
        <h3>Owner account</h3>{selected.members.map((member) => <div className="admin-owner" key={member.user.id}><strong>{member.user.email}</strong><span>{member.user.emailVerified ? <><CheckCircle2 size={15} /> Email verified</> : "Email not verified"}</span></div>)}
        <AdminSellerDocuments sellerId={selected.id} documentType={selected.identityDocumentType} documents={selected.documents ?? []} />
        {selected.status === "PENDING" && !identityComplete && <p className="message error">Front and back identity photos are required before this application can be approved.</p>}
        <h3>Review history</h3>{selected.reviews.length ? selected.reviews.map((review, i) => <div className="admin-history" key={i}><AdminBadge value={review.decision} /><p>{review.reason ?? "Decision recorded."}</p><small>{dateTime(review.createdAt)}</small></div>) : <p className="admin-muted">No previous review decision.</p>}
      </div>
      {selected.status === "PENDING" && <div className="admin-drawer-actions"><button className="admin-danger-outline" disabled={isPreview} onClick={() => setDecision("reject")}>Reject application</button><button className="primary-btn" disabled={isPreview || !identityComplete} onClick={() => setDecision("approve")}>Approve application</button></div>}
    </aside></div>}
    {decision && selected && <AdminDecision title={decision === "approve" ? "Approve seller application?" : "Reject seller application?"}
      description={decision === "approve" ? `Approve ${selected.name} and grant its owner seller access?` : `Provide feedback to ${selected.name}. This decision will be recorded.`}
      label={decision === "approve" ? "Approve seller" : "Reject seller"} dangerous={decision === "reject"}
      noteLabel={decision === "reject" ? "Rejection reason" : undefined} minLength={10} maxLength={500}
      onClose={() => setDecision(null)} onConfirm={commit} />}
  </>;
}
