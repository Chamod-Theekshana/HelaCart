"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ClipboardCheck, MailCheck, ShieldCheck } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading } from "@/components/seller-ui";
import { SellerDocumentInput, type DocumentSelection } from "@/components/seller-document-input";
import type { IdentityDocumentType } from "@/lib/seller";

export default function ApplySeller() {
  const router = useRouter();
  const { isPreview, request, refreshProfile } = useSeller();
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(""); const [contactPhone, setContactPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [identityDocumentType, setIdentityDocumentType] = useState<IdentityDocumentType>("NATIONAL_ID");
  const [identityFront, setIdentityFront] = useState<DocumentSelection | null>(null);
  const [identityBack, setIdentityBack] = useState<DocumentSelection | null>(null);
  const [businessRegistration, setBusinessRegistration] = useState<DocumentSelection | null>(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (isPreview) return;
    if (!identityFront || !identityBack) { setError("Add both the front and back photos of your ID card or driving licence."); return; }
    setSaving(true); setError("");
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries({ name: name.trim(), slug: slug.trim(), description: description.trim(), contactPhone: contactPhone.trim(), pickupAddress: pickupAddress.trim(), identityDocumentType })) form.append(key, value);
      form.append("identityFront", identityFront.file); form.append("identityBack", identityBack.file);
      if (businessRegistration) form.append("businessRegistration", businessRegistration.file);
      await request("/seller-applications", "POST", form);
      await refreshProfile(); router.push("/seller");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  return <>
    <Link className="seller-back" href="/seller"><ArrowLeft size={16} /> Back to Seller Center</Link>
    <SellerPageHeading kicker="SELL ON HELACART" title="Become a HelaCart merchant" description="Tell us about your store. Product management becomes available after admin approval." />
    <div className="seller-application-grid"><form className="seller-card seller-form seller-apply-form" onSubmit={(event) => void submit(event)}><div className="seller-form-intro"><span className="seller-status status-approved"><BadgeCheck size={13} /> Merchant application</span><h2>Store information</h2><p>Use your business contact and pickup address so we can review your application.</p></div>
      <div className="seller-fields"><label>Registered store name<input required minLength={2} maxLength={100} value={name} onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Your store name" /></label>
        <label>Public store URL slug<input required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }} placeholder="your-store-name" /></label>
        <label>Contact number<input required type="tel" inputMode="tel" pattern="(0[0-9]{9}|\+94[0-9]{9})" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="0771234567" /></label>
        <label className="wide">Pickup & dispatch address<textarea required minLength={10} maxLength={300} rows={3} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Street, city, district" /></label>
        <label className="wide">Store description (optional)<textarea maxLength={1000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will you sell?" /></label></div>
      <fieldset className="seller-verification" disabled={saving}><legend>Identity verification</legend><p>Upload clear front and back photos of the same ID card or driving licence. Both sides are required.</p>
        <div className="seller-fields"><label className="wide">Identity document<select value={identityDocumentType} onChange={(event) => { setIdentityDocumentType(event.target.value as IdentityDocumentType); setIdentityFront(null); setIdentityBack(null); }}><option value="NATIONAL_ID">National identity card</option><option value="DRIVING_LICENCE">Driving licence</option></select></label>
          <SellerDocumentInput key={`${identityDocumentType}-front`} name="identityFront" label={`${identityDocumentType === "NATIONAL_ID" ? "ID card" : "Driving licence"} — front`} required selection={identityFront} disabled={saving} onChange={setIdentityFront} onError={setError} />
          <SellerDocumentInput key={`${identityDocumentType}-back`} name="identityBack" label={`${identityDocumentType === "NATIONAL_ID" ? "ID card" : "Driving licence"} — back`} required selection={identityBack} disabled={saving} onChange={setIdentityBack} onError={setError} /></div>
      </fieldset>
      <fieldset className="seller-verification" disabled={saving}><legend>Business registration</legend><p>If your business is registered, you can add a photo of the certificate. You can apply without this document.</p>
        <SellerDocumentInput name="businessRegistration" label="Business registration photo" selection={businessRegistration} disabled={saving} onChange={setBusinessRegistration} onError={setError} /></fieldset>
      <div className="seller-inline-help"><ShieldCheck size={18} /><span>Your document photos are private and can be viewed only by authorized HelaCart administrators for application review.</span></div>
      {error && <div className="message error" role="alert">{error}</div>}
      <div className="seller-form-actions"><Link className="outline-btn" href="/seller">Cancel</Link><button className="primary-btn" disabled={saving || isPreview || !identityFront || !identityBack} type="submit">{saving ? "Uploading & submitting…" : "Submit application"}</button></div>
      {(!identityFront || !identityBack) && <p className="seller-footnote">Add both required identity photos to submit your application.</p>}
      {isPreview && <p className="seller-footnote">Connect the API and sign in with a verified email to send an application.</p>}
    </form><aside className="seller-application-side"><div className="seller-card seller-form"><h2>Application access states</h2><p>Track your store through approval and email verification.</p><div className="seller-access-step"><span>1</span><div><strong>Application submitted</strong><small>Store details are received for review.</small></div></div><div className="seller-access-step"><span>2</span><div><strong>Under review</strong><small>Check back here for the approval decision.</small></div></div><div className="seller-access-step"><span>3</span><div><strong>Approved seller</strong><small>Your dashboard unlocks after approval.</small></div></div></div>
      <div className="seller-card seller-form"><div className="seller-apply-benefit"><MailCheck size={20} /><span><strong>Verified email required</strong><small>Verify your account before applying.</small></span></div><div className="seller-apply-benefit"><ClipboardCheck size={20} /><span><strong>Review feedback</strong><small>Application decisions appear in Seller Center.</small></span></div><div className="seller-apply-benefit"><ShieldCheck size={20} /><span><strong>Seller authorization</strong><small>Only approved seller accounts can manage products.</small></span></div></div></aside></div>
  </>;
}
