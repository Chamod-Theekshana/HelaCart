"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Box, Download, Plus, Search } from "lucide-react";
import { errorMessage, money } from "@/lib/api";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading, SellerStatusBadge } from "@/components/seller-ui";

export default function SellerProductsPage() {
  const { seller, products, isPreview, request, refreshProducts, dataLoading } = useSeller();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const shown = products.filter((row) => (status === "ALL" || row.status === status) &&
    (category === "ALL" || row.categoryId === category) &&
    (stock === "ALL" || (stock === "LOW" ? row.variants.some((variant) => variant.onHand - variant.reserved <= 5) :
      row.variants.every((variant) => variant.onHand - variant.reserved > 5))) &&
    `${row.title} ${row.sku} ${row.category.name}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(shown.length / 10));
  const currentPage = Math.min(page, pageCount);
  const categories = Array.from(new Map(products.map((row) => [row.categoryId, row.category])).entries());
  function exportCsv() {
    const escape = (value: string | number) => {
      const safe = String(value).replace(/^[\s]*[=+\-@]/, "'$&");
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [["Product", "SKU", "Category", "Price LKR", "Available", "Status"],
      ...shown.map((row) => [row.title, row.sku, row.category.name, (row.priceLkrMinor / 100).toFixed(2),
        row.variants.reduce((sum, variant) => sum + Math.max(0, variant.onHand - variant.reserved), 0), row.status])];
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "helacart-products.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function action(productId: string, operation: "submit" | "hide") {
    if (!seller) return;
    setBusy(productId); setNotice("");
    try {
      await request(`/sellers/${seller.id}/products/${productId}/${operation}`, operation === "submit" ? "POST" : "PATCH");
      await refreshProducts(); setNotice(operation === "submit" ? "Product submitted for admin review." : "Product hidden from the storefront.");
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(""); }
  }
  return <>
    <div className="seller-section-hero"><SellerPageHeading kicker="STORE CATALOGUE" title="Products & listings" description="Manage your catalog, follow admin approval, and keep stock ready."
      action={<div className="seller-heading-actions"><button className="outline-btn" type="button" disabled={!shown.length} onClick={exportCsv}><Download size={16} /> Export loaded CSV</button><Link className="primary-btn" href="/seller/products/new"><Plus size={17} /> Add new product</Link></div>} />
      <div className="seller-summary-row">{[["Live online", products.filter((row) => row.status === "APPROVED").length], ["Under review", products.filter((row) => row.status === "PENDING").length], ["Needs fix", products.filter((row) => row.status === "REJECTED").length], ["Low / zero stock", products.filter((row) => row.variants.some((variant) => variant.onHand - variant.reserved <= 5)).length]].map(([label, count]) => <div key={label}><small>{label}</small><strong>{count}</strong></div>)}</div></div>
    {notice && <div className="message info" role="status">{notice}</div>}
    <section className="seller-card seller-catalog"><div className="seller-tabs" role="group" aria-label="Product status">
      {["ALL", "APPROVED", "PENDING", "DRAFT", "REJECTED", "HIDDEN"].map((value) => <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => { setStatus(value); setPage(1); }}>{value === "ALL" ? "All" : value === "PENDING" ? "Pending review" : value} <span>{value === "ALL" ? products.length : products.filter((row) => row.status === value).length}</span></button>)}
    </div>
    <div className="seller-toolbar"><label className="seller-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search title, category or SKU" aria-label="Search seller products" /></label>
      <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filter category"><option value="ALL">All categories</option>{categories.map(([id, row]) => <option key={id} value={id}>{row.name}</option>)}</select>
      <select value={stock} onChange={(event) => { setStock(event.target.value); setPage(1); }} aria-label="Filter stock"><option value="ALL">All stock levels</option><option value="LOW">Low / zero stock</option><option value="READY">Stock available</option></select></div>
    <div className="seller-table-wrap">
      {shown.length ? <table className="seller-table"><thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Available</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {shown.slice((currentPage - 1) * 10, currentPage * 10).map((row) => <tr key={row.id}><td><Link className="seller-product-cell" href={`/seller/products/${row.id}`}><span className="seller-thumb">{row.imageUrls[0] ? <img src={row.imageUrls[0]} alt="" /> : <Box size={21} />}</span><span><strong>{row.title}</strong><small>{row.category.name}</small></span></Link></td>
          <td className="seller-muted">{row.sku}</td><td>{money(row.priceLkrMinor)}</td>
          <td className={row.variants.some((variant) => variant.onHand - variant.reserved <= 5) ? "seller-low" : ""}>{row.variants.reduce((sum, variant) => sum + Math.max(0, variant.onHand - variant.reserved), 0)} units</td>
          <td><SellerStatusBadge status={row.status} /></td><td><div className="seller-row-actions"><Link href={`/seller/products/${row.id}`}>Edit</Link>
            {!isPreview && ["DRAFT", "REJECTED"].includes(row.status) && <button disabled={busy === row.id} onClick={() => void action(row.id, "submit")}>Submit</button>}
            {!isPreview && row.status === "APPROVED" && <button disabled={busy === row.id} onClick={() => void action(row.id, "hide")}>Hide</button>}</div></td></tr>)}
      </tbody></table> : <div className="seller-empty">{dataLoading ? "Loading your products…" : products.length ? "No products match this filter." : "No products yet. Add your first listing to get started."}</div>}
    </div><div className="seller-table-footer"><span>Showing {shown.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, shown.length)} of {shown.length}{products.length === 50 ? " · most recent 50 loaded" : ""}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div></section>
    <p className="seller-footnote">Editing an approved product or its variants moves it to draft. Submit it again for admin review. <Link href="/seller/inventory">Manage stock <ArrowRight size={13} /></Link></p>
  </>;
}
