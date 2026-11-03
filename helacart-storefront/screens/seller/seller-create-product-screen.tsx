"use client";
import {ProductDetailsFields} from "@/components/product-details-fields";
import {emptyProductDetails,type ProductDetails} from "@/lib/product-feedback";


import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, PackageCheck, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { demoCategories } from "@/lib/demo";
import { rupeesToMinor, type SellerProduct } from "@/lib/seller";
import type { Category } from "@/lib/types";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading } from "@/components/seller-ui";

export default function NewSellerProduct() {
  const router = useRouter();
  const { seller, isPreview, request, refreshProducts } = useSeller();
  const [categories, setCategories] = useState<Category[]>(isPreview ? demoCategories : []);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [details,setDetails]=useState<ProductDetails>(emptyProductDetails);
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!isPreview) api<Category[]>("/categories").then(setCategories).catch((cause) => setError(errorMessage(cause))); }, [isPreview]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!seller || isPreview) return;
    setError("");
    const priceLkrMinor = rupeesToMinor(price);
    if (priceLkrMinor === null || priceLkrMinor < 1 || priceLkrMinor > 1_000_000_000) { setError("Enter a valid price in rupees (up to two decimal places)."); return; }
    setSaving(true);
    try {
      const created = await request<SellerProduct>(`/sellers/${seller.id}/products`, "POST", {
        title: title.trim(), slug: slug.trim(), description: description.trim(), sku: sku.trim().toUpperCase(),
        categoryId, priceLkrMinor, ...details, specifications:details.specifications.map(row=>({name:row.name.trim(),value:row.value.trim()})),
      });
      await refreshProducts(); router.push(`/seller/products/${created.id}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  return <>
    <Link className="seller-back" href="/seller/products"><ArrowLeft size={16} /> Back to products</Link>
    <SellerPageHeading kicker="NEW LISTING" title="Add a product" description="Create a draft, then add a photo and stock before submitting it for review." />
    <div className="seller-detail-grid"><form className="seller-card seller-form" onSubmit={(event) => void submit(event)}>
      <div className="seller-form-section"><div><h2>Core item details</h2><p>Give buyers clear details about what you are selling.</p></div>
        <div className="seller-fields"><label>Product title<input required minLength={3} maxLength={120} value={title} onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="e.g. Handmade woven basket" /></label>
          <label>Product URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={80} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }} placeholder="handmade-woven-basket" /></label>
          <label className="wide">Description<textarea required minLength={10} maxLength={3000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe materials, size, care and other useful details." /></label>
          <label>Category<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>SKU<input required minLength={2} maxLength={64} pattern="[A-Za-z0-9]+([-_][A-Za-z0-9]+)*" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="BASKET-001" /></label>
          <label>Price (LKR)<input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1250.00" /></label></div>
      </div>
      <ProductDetailsFields value={details} onChange={setDetails} disabled={isPreview || saving}/>
      <div className="seller-inline-help"><ImagePlus size={19} /><span>Save the draft first. The next page lets you upload photos, add variants and record stock before review.</span></div>
      {error && <div className="message error" role="alert">{error}</div>}
      <div className="seller-form-actions"><Link className="outline-btn" href="/seller/products">Cancel</Link><button className="primary-btn" type="submit" disabled={isPreview || saving || !categories.length}>{saving ? "Saving…" : "Create draft"}</button></div>
      {isPreview && <p className="seller-footnote">Connect the API to create a real product.</p>}
    </form><aside className="seller-side-stack"><div className="seller-card seller-media seller-new-media"><span className="stat-icon mint"><ImagePlus size={22} /></span><h2>Product images</h2><p>Add up to five photos after creating your draft. Images should be clear JPEG, PNG or WebP files under 5 MB each.</p><div className="seller-no-image"><ImagePlus size={30} /> Image slots appear after saving</div></div>
      <div className="seller-card seller-media"><span className="stat-icon blue"><PackageCheck size={22} /></span><h2>Listing review</h2><p>A new product begins as a draft. Submit it for admin review when its description, images and stock are ready.</p><div className="seller-inline-help"><ShieldCheck size={17} /> Approved listings appear in the public catalog.</div></div></aside></div>
  </>;
}
