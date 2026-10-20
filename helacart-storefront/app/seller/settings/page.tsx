"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Info, MapPin, ShoppingBag } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import { rupeesToMinor, type SellerAccount } from "@/lib/seller";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading } from "@/components/seller-ui";

export default function SellerSettings() {
  const { seller, isPreview, request, refreshProfile } = useSeller();
  return <DeliverySettingsForm key={`${seller?.id}-${seller?.shippingFeeLkrMinor}`} seller={seller} isPreview={isPreview} request={request} refreshProfile={refreshProfile} />;
}

function DeliverySettingsForm({ seller, isPreview, request, refreshProfile }: {
  seller: SellerAccount | null; isPreview: boolean;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  refreshProfile: () => Promise<void>;
}) {
  const [fee, setFee] = useState(seller?.shippingFeeLkrMinor == null ? "" : (seller.shippingFeeLkrMinor / 100).toFixed(2));
  const [saving, setSaving] = useState(false); const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!seller || isPreview) return;
    const shippingFeeLkrMinor = rupeesToMinor(fee);
    if (shippingFeeLkrMinor === null || shippingFeeLkrMinor > 100_000_000) { setNotice("Enter a valid delivery fee in rupees, including 0 for free delivery."); return; }
    setSaving(true); setNotice("");
    try {
      await request<SellerAccount>(`/sellers/${seller.id}/delivery-settings`, "PATCH", { shippingFeeLkrMinor });
      await refreshProfile(); setNotice("Delivery fee saved. Buyers can see it in their cart and checkout.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  return <>
    <SellerPageHeading kicker="LOGISTICS & FULFILMENT" title="Delivery fee & fulfilment settings" description="Manage your single delivery fee charged once per seller order at checkout." />
    {notice && <div className="message info" role="status">{notice}</div>}
    <div className="seller-settings-grid"><form className="seller-card seller-form" onSubmit={(event) => void submit(event)}><div className="seller-card-heading"><div><h2>Standard delivery fee</h2><p>Flat fee for each order from your store</p></div>{seller?.shippingFeeLkrMinor != null && <span className="seller-status status-approved"><CircleCheck size={13} /> Configured</span>}</div>
        <div className="seller-fee-display"><small>CURRENTLY CHARGED AT CHECKOUT</small><strong>{seller?.shippingFeeLkrMinor == null ? "Not configured" : money(seller.shippingFeeLkrMinor)}</strong><span>per seller order</span></div>
        <label>Set your store delivery fee (LKR)<span className="seller-currency-input"><span>Rs.</span><input required inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g. 350.00" /></span></label>
        <p className="seller-muted">Enter 0 to offer free delivery. A blank fee prevents buyers from checking out with your products.</p>
        <div className="seller-inline-help"><Info size={19} /><span>The current API supports one flat seller delivery fee. District specific rates and courier scheduling are not yet available.</span></div>
        <div className="seller-form-actions"><button className="outline-btn" type="button" onClick={() => setFee(seller?.shippingFeeLkrMinor == null ? "" : (seller.shippingFeeLkrMinor / 100).toFixed(2))}>Reset</button><button className="primary-btn" disabled={isPreview || saving} type="submit">{saving ? "Saving…" : "Save changes"}</button></div>
        {isPreview && <p className="seller-footnote">Connect the API to update the real delivery fee.</p>}
      </form><div className="seller-side-stack"><div className="seller-card seller-form seller-checkout-preview"><div className="seller-card-heading"><div><h2>Buyer experience preview</h2><p>Example of how your fee appears at checkout</p></div><ShoppingBag size={21} /></div>
        <div className="seller-preview-receipt"><span>Example item subtotal <b>{money(420000)}</b></span><span>Delivery fee ({seller?.name ?? "Your store"}) <b>{seller?.shippingFeeLkrMinor == null ? "Set a fee" : money(seller.shippingFeeLkrMinor)}</b></span><span className="total">Example COD total <b>{seller?.shippingFeeLkrMinor == null ? "—" : money(420000 + seller.shippingFeeLkrMinor)}</b></span><small>Illustrative subtotal only. Actual checkout totals depend on the buyer&apos;s cart.</small></div>
      </div><div className="seller-card seller-form"><div className="seller-card-heading"><div><h2>Store information</h2></div><MapPin size={21} /></div>
        <dl className="seller-info-list"><dt>Store name</dt><dd>{seller?.name ?? "—"}</dd><dt>Store slug</dt><dd>{seller?.slug ?? "—"}</dd><dt>Approval</dt><dd>{seller?.status.toLowerCase() ?? "—"}</dd></dl>
        <p className="seller-muted">Store profile editing is not available in the current API.</p></div></div></div>
  </>;
}
