"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, ImagePlus, Layers3, PackagePlus, Send, Upload } from "lucide-react";
import { apiBase, errorMessage, money } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import { formatSellerDate, rupeesToMinor, type SellerProduct, type SellerVariant, type StockMovement } from "@/lib/seller";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading, SellerStatusBadge } from "@/components/seller-ui";

export default function SellerProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { seller, products, isPreview, request, refreshProducts } = useSeller();
  const previewProduct = isPreview ? products.find((row) => row.id === id) ?? null : null;
  const [liveProduct, setLiveProduct] = useState<SellerProduct | null>(null);
  const product = isPreview ? previewProduct : liveProduct;
  const [title, setTitle] = useState(previewProduct?.title ?? "");
  const [description, setDescription] = useState(previewProduct?.description ?? "");
  const [sku, setSku] = useState(previewProduct?.sku ?? "");
  const [price, setPrice] = useState(previewProduct ? (previewProduct.priceLkrMinor / 100).toFixed(2) : "");
  const [imageUrls, setImageUrls] = useState(previewProduct?.imageUrls.join("\n") ?? "");
  const [variantSku, setVariantSku] = useState(""); const [variantPrice, setVariantPrice] = useState("");
  const [optionName, setOptionName] = useState(""); const [optionValue, setOptionValue] = useState("");
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState("");
  const [movements, setMovements] = useState<Record<string, StockMovement[]>>({});

  const sellerId = seller?.id;
  useEffect(() => {
    if (!sellerId || !id || isPreview) return;
    let active = true;
    request<SellerProduct>(`/sellers/${sellerId}/products/${id}`)
      .then((row) => { if (active) {
        setLiveProduct(row); setTitle(row.title); setDescription(row.description ?? ""); setSku(row.sku);
        setPrice((row.priceLkrMinor / 100).toFixed(2)); setImageUrls(row.imageUrls.join("\n"));
      } })
      .catch((cause) => { if (active) setNotice(errorMessage(cause)); });
    return () => { active = false; };
  }, [sellerId, id, isPreview, request]);

  async function updateDetail(event: FormEvent) {
    event.preventDefault(); if (!seller || !product || isPreview) return;
    const priceLkrMinor = rupeesToMinor(price);
    if (priceLkrMinor === null || priceLkrMinor < 1 || priceLkrMinor > 1_000_000_000) { setNotice("Enter a valid price in rupees."); return; }
    const images = imageUrls.split("\n").map((url) => url.trim()).filter(Boolean);
    if (images.length > 5 || images.some((url) => !url.startsWith("https://"))) { setNotice("Use up to five HTTPS image URLs, one per line."); return; }
    setBusy("details"); setNotice("");
    try {
      const updated = await request<SellerProduct>(`/sellers/${seller.id}/products/${product.id}`, "PATCH", {
        title: title.trim(), description: description.trim(), sku: sku.trim().toUpperCase(), priceLkrMinor, imageUrls: images,
      });
      setLiveProduct(updated); await refreshProducts(); setNotice("Product saved as a draft. Submit it for review when ready.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || !seller || !product || isPreview) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice("Choose a JPEG, PNG or WebP image up to 5 MB."); return;
    }
    setBusy("upload"); setNotice("");
    try {
      const token = await clientAuth()?.currentUser?.getIdToken();
      if (!token) throw new Error("Sign in again to upload an image.");
      const response = await fetch(`${apiBase}/sellers/${seller.id}/products/${product.id}/images`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type }, body: file,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.message === "string" ? payload.message : `Upload failed (${response.status}).`);
      }
      const updated = await request<SellerProduct>(`/sellers/${seller.id}/products/${product.id}`);
      setLiveProduct(updated); setImageUrls(updated.imageUrls.join("\n")); await refreshProducts(); setNotice("Image uploaded. Product is now a draft until reviewed again.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function createVariant(event: FormEvent) {
    event.preventDefault(); if (!seller || !product || isPreview) return;
    const priceLkrMinor = rupeesToMinor(variantPrice);
    if (!priceLkrMinor || priceLkrMinor > 1_000_000_000) { setNotice("Enter a valid variant price."); return; }
    setBusy("variant"); setNotice("");
    try {
      const position = Math.max(0, ...product.variants.map((row) => row.position)) + 1;
      await request(`/sellers/${seller.id}/products/${product.id}/variants`, "POST", {
        position, sku: variantSku.trim().toUpperCase(), optionValues: { [optionName.trim()]: optionValue.trim() }, priceLkrMinor,
      });
      const updated = await request<SellerProduct>(`/sellers/${seller.id}/products/${product.id}`);
      setLiveProduct(updated); await refreshProducts(); setVariantSku(""); setVariantPrice(""); setOptionName(""); setOptionValue("");
      setNotice("Variant added. Submit the product for review when ready.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function adjust(variant: SellerVariant, delta: number, reason: string) {
    if (!seller || !product || isPreview) return;
    setBusy(variant.id); setNotice("");
    try {
      await request(`/sellers/${seller.id}/products/${product.id}/variants/${variant.id}/stock-adjustments`, "POST", { delta, reason });
      const updated = await request<SellerProduct>(`/sellers/${seller.id}/products/${product.id}`);
      setLiveProduct(updated); await refreshProducts(); setNotice("Stock adjusted and recorded in inventory history.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  async function showMovements(variantId: string) {
    if (!seller || !product || isPreview) return;
    try {
      const rows = await request<StockMovement[]>(`/sellers/${seller.id}/products/${product.id}/variants/${variantId}/stock-movements`);
      setMovements((before) => ({ ...before, [variantId]: rows }));
    } catch (cause) { setNotice(errorMessage(cause)); }
  }

  async function transition(operation: "submit" | "hide") {
    if (!seller || !product || isPreview) return;
    setBusy(operation); setNotice("");
    try {
      const updated = await request<SellerProduct>(`/sellers/${seller.id}/products/${product.id}/${operation}`, operation === "submit" ? "POST" : "PATCH");
      setLiveProduct(updated); await refreshProducts(); setNotice(operation === "submit" ? "Sent for admin review." : "Hidden from the public catalog.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(""); }
  }

  return <>
    <Link className="seller-back" href="/seller/products"><ArrowLeft size={16} /> Back to products</Link>
    {!product ? <div className="seller-state">{notice || "Loading product…"}</div> : <>
      <SellerPageHeading kicker="PRODUCTS / EDIT LISTING" title={product.title} description={`SKU ${product.sku} · ${product.category.name}`}
        action={<SellerStatusBadge status={product.status} />} />
      {notice && <div className="message info" role="status">{notice}</div>}
      {product.status === "REJECTED" && product.reviews[0]?.reason && <div className="message error seller-review-feedback"><strong>Admin review feedback</strong><span>{product.reviews[0].reason}</span><small>Update the product, save your changes and resubmit for review.</small></div>}
      <div className="seller-detail-grid"><form className="seller-card seller-form" onSubmit={(event) => void updateDetail(event)}>
        <h2>Core item details</h2><p className="seller-muted">Edits to approved products move them to draft.</p>
        <div className="seller-fields"><label className="wide">Title<input required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="wide">Description<textarea required minLength={10} maxLength={3000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label>Default SKU<input required minLength={2} maxLength={64} pattern="[A-Za-z0-9]+([-_][A-Za-z0-9]+)*" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} /></label>
          <label>Default price (LKR)<input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label className="wide">Image URLs (one HTTPS URL per line, maximum five)<textarea rows={3} value={imageUrls} onChange={(e) => setImageUrls(e.target.value)} /></label></div>
        <button className="primary-btn" disabled={isPreview || Boolean(busy) || product.status === "PENDING"} type="submit">{busy === "details" ? "Saving…" : "Save changes"}</button>
        {product.status === "PENDING" && <p className="seller-muted">Products under review cannot be edited.</p>}
      </form>
      <aside className="seller-side-stack"><div className="seller-card seller-media"><div className="seller-media-heading"><div><h2>Product images</h2><p>JPEG, PNG or WebP · up to 5 MB</p></div><small>{product.imageUrls.length}/5 uploaded</small></div><div className="seller-image-grid">{product.imageUrls.map((url) => <img key={url} src={url} alt={product.title} />)}
        {!product.imageUrls.length && <div className="seller-no-image"><ImagePlus size={31} /><span>No images yet</span></div>}</div>
        <label className="seller-upload"><Upload size={17} /> {busy === "upload" ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={isPreview || Boolean(busy) || product.status === "PENDING" || product.imageUrls.length >= 5} onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = ""; }} /></label>
        <p className="seller-muted">JPEG, PNG or WebP · up to 5 MB · maximum five images. Upload requires configured R2 storage.</p>
      </div><div className="seller-card seller-media seller-governance"><div className="seller-media-heading"><h2>Listing review</h2><SellerStatusBadge status={product.status} /></div><p><BadgeCheck size={16} /> New listings and edits require admin approval before they appear publicly.</p>
        {(["DRAFT", "REJECTED"] as string[]).includes(product.status) && <button className="primary-btn full" disabled={isPreview || Boolean(busy) || !product.imageUrls.length} onClick={() => void transition("submit")}><Send size={16} /> Submit for review</button>}
        {product.status === "APPROVED" && <button className="outline-btn full" disabled={isPreview || Boolean(busy)} onClick={() => void transition("hide")}>Hide product</button>}
      </div></aside></div>
      <section className="seller-stock-formula"><div><Layers3 size={23} /><div><strong>Calculated purchasable inventory</strong><small>For each variant, available stock equals physical stock minus reserved units.</small></div></div>
        <div className="seller-formula-values"><span><small>On hand</small><strong>{product.variants.reduce((sum, row) => sum + row.onHand, 0)}</strong></span><b>−</b><span><small>Reserved</small><strong>{product.variants.reduce((sum, row) => sum + row.reserved, 0)}</strong></span><b>=</b><span className="result"><small>Available</small><strong>{product.variants.reduce((sum, row) => sum + Math.max(0, row.onHand - row.reserved), 0)}</strong></span></div></section>
      <section className="seller-card seller-variants"><div className="seller-card-heading"><div><span className="section-kicker">STOCK CONTROL</span><h2>Variants & inventory</h2></div><Layers3 size={19} /></div>
        <p>Adjust individual variants below. The backend records stock movements and reservation changes.</p>
        {product.variants.map((variant) => <VariantStock key={variant.id} variant={variant} busy={busy === variant.id} disabled={isPreview}
          onAdjust={(delta, reason) => adjust(variant, delta, reason)} onHistory={() => showMovements(variant.id)} movements={movements[variant.id]} />)}
        <form className="seller-add-variant" onSubmit={(event) => void createVariant(event)}><h3><PackagePlus size={18} /> Add variant</h3>
          <div className="seller-fields"><label>Variant SKU<input required minLength={2} maxLength={64} pattern="[A-Za-z0-9]+([-_][A-Za-z0-9]+)*" value={variantSku} onChange={(e) => setVariantSku(e.target.value.toUpperCase())} placeholder="BASKET-BLUE" /></label>
            <label>Price (LKR)<input required inputMode="decimal" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} placeholder="1250.00" /></label>
            <label>Option name<input required pattern="[a-zA-Z][a-zA-Z0-9]*" maxLength={40} value={optionName} onChange={(e) => setOptionName(e.target.value)} placeholder="Color" /></label>
            <label>Option value<input required maxLength={80} value={optionValue} onChange={(e) => setOptionValue(e.target.value)} placeholder="Blue" /></label></div>
          <button className="outline-btn" disabled={isPreview || Boolean(busy) || product.status === "PENDING"} type="submit"><PackagePlus size={16} /> {busy === "variant" ? "Adding…" : "Add variant"}</button></form>
      </section>
    </>}
  </>;
}

function VariantStock({ variant, busy, disabled, onAdjust, onHistory, movements }: {
  variant: SellerVariant; busy: boolean; disabled: boolean;
  onAdjust: (delta: number, reason: string) => Promise<void>;
  onHistory: () => Promise<void>; movements?: StockMovement[];
}) {
  const [delta, setDelta] = useState(""); const [reason, setReason] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const change = Number(delta);
    if (!Number.isInteger(change) || change === 0 || Math.abs(change) > 1_000_000 || reason.trim().length < 5) return;
    await onAdjust(change, reason.trim());
    // Successful and failed responses are surfaced by the parent. Keep form values for retry.
  }
  return <div className="seller-variant-row"><div className="seller-variant-meta"><strong>{variant.sku}</strong><small>{Object.entries(variant.optionValues).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Default variant"} · {money(variant.priceLkrMinor)}</small>
    <span>{variant.onHand} on hand · {variant.reserved} reserved · <b>{Math.max(0, variant.onHand - variant.reserved)} available</b> · <em className={variant.onHand - variant.reserved <= 5 ? "seller-low" : ""}>{variant.onHand - variant.reserved <= 0 ? "Out of stock" : variant.onHand - variant.reserved <= 5 ? "Low stock" : "In stock"}</em></span></div>
    <form className="seller-stock-form" onSubmit={(event) => void submit(event)}><input required type="number" min="-1000000" max="1000000" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+10 / -2" aria-label={`Stock change for ${variant.sku}`} />
      <input required minLength={5} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for adjustment" aria-label={`Adjustment reason for ${variant.sku}`} />
      <button className="outline-btn" disabled={disabled || busy} type="submit">{busy ? "Saving…" : "Adjust"}</button></form>
    {!disabled && <button className="seller-text-button" onClick={() => void onHistory()}>View stock history</button>}
    {movements && <div className="seller-movements">{movements.length ? movements.slice(0, 5).map((row) => <p key={row.id}><b>{row.delta > 0 ? `+${row.delta}` : row.delta}</b> · {row.reason} · {formatSellerDate(row.createdAt)}</p>) : <p>No adjustments recorded yet.</p>}</div>}
  </div>;
}
