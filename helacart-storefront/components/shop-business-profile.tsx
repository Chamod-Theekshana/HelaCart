"use client";
import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { errorMessage } from "@/lib/api";
import type { PrivateShop } from "@/lib/shops";
import { useShop } from "./shop-provider";
import { useSeller } from "./seller-provider";
import s from "./profile.module.css";

export function ShopBusinessProfile({ shop }: { shop: PrivateShop }) {
  const { user } = useShop();
  const { request, isPreview } = useSeller();
  const [saved, setSaved] = useState(shop);
  const [phone, setPhone] = useState(shop.contactPhone ?? "");
  const [address, setAddress] = useState(shop.pickupAddress ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (isPreview || busy) return;
    setBusy(true); setNotice(null);
    try {
      const updated = await request<PrivateShop>(`/sellers/${shop.id}/shop/business`, "PATCH", { contactPhone: phone.trim(), pickupAddress: address.trim() });
      setSaved(updated); setPhone(updated.contactPhone ?? ""); setAddress(updated.pickupAddress ?? "");
      setNotice({ text: "Business details saved.", error: false });
    } catch (cause) { setNotice({ text: errorMessage(cause), error: true }); }
    finally { setBusy(false); }
  }
  const front = shop.documents.some((file) => file.kind === "IDENTITY_FRONT");
  const back = shop.documents.some((file) => file.kind === "IDENTITY_BACK");
  const business = shop.documents.some((file) => file.kind === "BUSINESS_REGISTRATION");
  return <div className={s.layout}>
    <section className={s.card}><div className={s.privateHeading}><ShieldCheck size={20} /><h2>Private business details</h2></div><p>Used for shop operations and pickup. These details are kept off your public shop page.</p>
      {notice && <div className={`${s.message} ${notice.error ? s.error : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
      <form onSubmit={(event) => void save(event)}><div className={s.fields}>
        <label>Business contact number<input type="tel" autoComplete="tel" required minLength={7} maxLength={25} value={phone} disabled={busy || isPreview} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Pickup address<textarea autoComplete="street-address" required minLength={10} maxLength={500} rows={4} value={address} disabled={busy || isPreview} onChange={(event) => setAddress(event.target.value)} /></label>
        <label>Sign-in email<input value={isPreview ? "shop@example.com" : user?.email ?? ""} disabled /><small>Manage your sign-in address in Login & security.</small></label>
      </div><div className={s.actions}><button className="primary-btn" disabled={busy || isPreview}>{busy ? "Saving..." : "Save business details"}</button><button className="outline-btn" type="button" disabled={busy || isPreview} onClick={() => { setPhone(saved.contactPhone ?? ""); setAddress(saved.pickupAddress ?? ""); setNotice(null); }}>Reset</button></div></form>
      {isPreview && <p className={s.muted}>Sample business details. Sign in to manage your shop.</p>}
    </section>
    <section className={s.card}><h2>Shop verification</h2><p>Your shop approval and submitted document status.</p><span className={s.badge}><ShieldCheck size={14} />{shop.status.toLowerCase()}</span><dl className={s.facts}>
      <div><dt>Shop reference</dt><dd>{shop.slug}</dd></div>
      <div><dt>Identity document</dt><dd>{shop.identityDocumentType === "DRIVING_LICENCE" ? "Driving licence" : shop.identityDocumentType === "NATIONAL_ID" ? "National ID card" : "No document type recorded"}</dd></div>
      <div><dt>Front photo</dt><dd>{isPreview ? "Sample verification" : front ? "On file" : "Not on file"}</dd></div>
      <div><dt>Rear photo</dt><dd>{isPreview ? "Sample verification" : back ? "On file" : "Not on file"}</dd></div>
      <div><dt>Business registration (optional)</dt><dd>{business ? "On file" : "Not supplied"}</dd></div>
    </dl><p className={s.muted}>Identity documents stay private. Contact HelaCart support if your verified business identity needs to change.</p></section>
  </div>;
}
