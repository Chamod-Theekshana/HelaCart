"use client";

import { useState, type FormEvent } from "react";
import { Search, Wallet } from "lucide-react";
import { money } from "@/lib/api";
import { rupeesToMinor } from "@/lib/seller";
import { useAdmin, useAdminResource } from "@/components/admin-provider";
import { AdminBadge, AdminDecision, AdminEmpty, AdminFeedback, AdminHeading } from "@/components/admin-ui";
import { dateTime, previewAdminCod, shortId, type AdminCod } from "@/lib/admin";

export default function AdminCodPage() {
  const { request, isPreview } = useAdmin();
  const resource = useAdminResource<AdminCod[]>("/admin/cod/reconciliation-queue", previewAdminCod);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const shown = (resource.data ?? []).filter((row) => `${row.id} ${row.sellerId}`.toLowerCase().includes(query.toLowerCase()));
  const selected = shown.find((row) => row.id === selectedId) ?? shown[0] ?? null;
  const received = rupeesToMinor(amount);
  const differs = Boolean(selected && received !== null && received !== selected.totalLkrMinor);

  function select(id: string) {
    setSelectedId(id); setAmount(""); setReference(""); setNote(""); setFormError(""); setNotice("");
  }
  function prepare(event: FormEvent) {
    event.preventDefault(); setFormError("");
    if (!selected) return;
    if (received === null || received < 0 || received > 1_000_000_000) { setFormError("Enter a valid received amount in LKR (maximum LKR 10,000,000)."); return; }
    if (reference.trim().length < 4 || reference.trim().length > 120) { setFormError("Enter a reference of 4–120 characters."); return; }
    if (differs && note.trim().length < 10) { setFormError("Explain the difference in at least 10 characters."); return; }
    if (note.trim().length > 0 && note.trim().length < 10) { setFormError("Optional notes must be at least 10 characters if provided."); return; }
    setConfirm(true);
  }
  async function commit() {
    if (!selected || received === null) return;
    await request(`/admin/cod/${selected.id}/reconciliations`, "POST", {
      amountReceivedMinor: received, reference: reference.trim(),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    resource.reload(); setSelectedId(""); setAmount(""); setReference(""); setNote("");
    setNotice("COD reconciliation recorded. The queue will refresh.");
  }
  return <>
    <AdminHeading eyebrow="FULFILMENT / SETTLEMENTS" title="COD reconciliation" description="Record received cash against delivered seller orders. Differences are recorded as disputes for follow-up." />
    <AdminFeedback error={resource.error || formError} notice={notice} />
    <div className="admin-split">
      <section className="admin-card">
        <div className="admin-card-head"><div><h2>Collection queue</h2><p>Unreconciled deliveries · latest 50 records</p></div><Wallet size={19} /></div>
        <div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search seller order or seller ID" aria-label="Search loaded COD queue" /></label><span>{shown.length} shown</span></div>
        {resource.loading ? <AdminEmpty message="Loading COD queue…" /> : shown.length ? <div className="admin-record-list">{shown.map((row) => <button key={row.id} className={selected?.id === row.id ? "selected" : ""} onClick={() => select(row.id)}>
          <span><strong>{shortId(row.id)}</strong><small>Seller {shortId(row.sellerId)}</small><small>Collected {dateTime(row.paymentCollectedAt)}</small></span>
          <span className="admin-record-end"><strong>{money(row.totalLkrMinor)}</strong><small>Expected COD</small></span>
        </button>)}</div> : <AdminEmpty message={resource.error ? "Could not load the COD queue." : "No unreconciled COD collections in the loaded queue."} />}
      </section>
      <aside className="admin-card admin-order-detail">{selected ? <>
        <div className="admin-card-head"><div><span className="admin-eyebrow">SELLER ORDER {shortId(selected.id)}</span><h2>Record collection</h2><p>Payment marked collected {dateTime(selected.paymentCollectedAt)}</p></div><AdminBadge value="PENDING" /></div>
        <div className="admin-detail-section"><h3>Collection details</h3><dl className="admin-detail-list"><dt>Seller ID</dt><dd>{selected.sellerId}</dd><dt>Expected COD</dt><dd className="admin-money">{money(selected.totalLkrMinor)}</dd><dt>Latest attempt</dt><dd>{selected.codReconciliations[0] ? dateTime(selected.codReconciliations[0].createdAt) : "None"}</dd></dl></div>
        {selected.codReconciliations[0] && <div className="admin-callout"><strong>Previous reconciliation: <AdminBadge value={selected.codReconciliations[0].decision} /></strong><p>Received {money(selected.codReconciliations[0].amountReceivedMinor)} · {selected.codReconciliations[0].reference}</p>{selected.codReconciliations[0].note && <p>{selected.codReconciliations[0].note}</p>}</div>}
        <form className="admin-cod-form" onSubmit={prepare}>
          <label>Amount received (LKR)<input required inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Collection reference<input required minLength={4} maxLength={120} placeholder="e.g. bank deposit or collection reference" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
          <label>Note {differs ? "(required for a difference)" : "(optional)"}<textarea rows={3} minLength={differs || note ? 10 : undefined} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain discrepancies or add collection details" /></label>
          {differs && <p className="admin-difference">Received amount differs from expected COD. This will be recorded as disputed.</p>}
          <button className="primary-btn" type="submit" disabled={isPreview}>Review reconciliation</button>
          {isPreview && <p className="admin-muted">Sample records are read-only.</p>}
        </form>
      </> : <AdminEmpty message={resource.loading ? "Loading collection…" : "Select a seller order to record its collection."} />}</aside>
    </div>
    {confirm && selected && received !== null && <AdminDecision title={differs ? "Record disputed collection?" : "Record reconciled collection?"}
      description={`Seller order ${shortId(selected.id)} · expected ${money(selected.totalLkrMinor)} · received ${money(received)} · reference ${reference.trim()}. This creates an audit record.`}
      label={differs ? "Record dispute" : "Record reconciliation"} dangerous={differs}
      onClose={() => setConfirm(false)} onConfirm={commit} />}
  </>;
}
