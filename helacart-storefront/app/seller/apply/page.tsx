"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ClipboardCheck, MailCheck, ShieldCheck } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading } from "@/components/seller-ui";

export default function ApplySeller() {
  const router = useRouter();
  const { isPreview, request, refreshProfile } = useSeller();
  const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [description, setDescription] = useState(""); const [contactPhone, setContactPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (isPreview) return;
    setSaving(true); setError("");
    try {
      await request("/seller-applications", "POST", { name: name.trim(), slug: slug.trim(),
        description: description.trim(), contactPhone: contactPhone.trim(), pickupAddress: pickupAddress.trim() });
      await refreshProfile(); router.push("/seller");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  return <>
    <Link className="seller-back" href="/seller"><ArrowLeft size={16} /> Back to Seller Center</Link>
    <SellerPageHeading kicker="SELL ON HELACART" title="Become a HelaCart merchant" description="Tell us about your store. Product management becomes available after admin approval." />
    <div className="seller-application-grid"><form className="seller-card seller-form seller-apply-form" onSubmit={(event) => void submit(event)}><div className="seller-form-intro"><span className="seller-status status-approved"><BadgeCheck size={13} /> Merchant application</span><h2>Store information</h2><p>Use your business contact and pickup address so we can review your application.</p></div>
      <div className="seller-fields"><label>Registered store name<input required minLength={2} maxLength={100} value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Your store name" /></label>
        <label>Public store URL slug<input required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="your-store-name" /></label>
        <label>Contact number<input required pattern="(0[0-9]{9}|\+94[0-9]{9})" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="0771234567" /></label>
        <label className="wide">Pickup & dispatch address<textarea required minLength={10} maxLength={300} rows={3} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Street, city, district" /></label>
        <label className="wide">Store description (optional)<textarea maxLength={1000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will you sell?" /></label></div>
      {error && <div className="message error" role="alert">{error}</div>}
      <div className="seller-form-actions"><Link className="outline-btn" href="/seller">Cancel</Link><button className="primary-btn" disabled={saving || isPreview} type="submit">{saving ? "Sending…" : "Submit application"}</button></div>
      {isPreview && <p className="seller-footnote">Connect the API and sign in with a verified email to send an application.</p>}
    </form><aside className="seller-application-side"><div className="seller-card seller-form"><h2>Application access states</h2><p>Track your store through approval and email verification.</p><div className="seller-access-step"><span>1</span><div><strong>Application submitted</strong><small>Store details are received for review.</small></div></div><div className="seller-access-step"><span>2</span><div><strong>Under review</strong><small>Check back here for the approval decision.</small></div></div><div className="seller-access-step"><span>3</span><div><strong>Approved seller</strong><small>Your dashboard unlocks after approval.</small></div></div></div>
      <div className="seller-card seller-form"><div className="seller-apply-benefit"><MailCheck size={20} /><span><strong>Verified email required</strong><small>Verify your account before applying.</small></span></div><div className="seller-apply-benefit"><ClipboardCheck size={20} /><span><strong>Review feedback</strong><small>Application decisions appear in Seller Center.</small></span></div><div className="seller-apply-benefit"><ShieldCheck size={20} /><span><strong>Seller authorization</strong><small>Only approved seller accounts can manage products.</small></span></div></div></aside></div>
  </>;
}
