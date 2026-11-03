"use client";
import {variantNeedsStock} from "@/lib/seller";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Box, Download, Plus, Search } from "lucide-react";
import { previewProducts, type SellerProduct } from "@/lib/seller";
import { previewSellerSummary, type SellerSummary } from "@/lib/workspace";
import { errorMessage, money } from "@/lib/api";
import {
  useSeller,
  useSellerList,
  useSellerResource,
} from "@/components/seller-provider";
import { SellerPageHeading, SellerStatusBadge } from "@/components/seller-ui";

export default function SellerProductsPage() {
  const { seller, isPreview, request, refreshProducts } = useSeller();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const summary = useSellerResource<SellerSummary>(
    "summary",
    previewSellerSummary,
  );
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const sample = previewProducts.filter(
    (row) =>
      (status === "ALL" || row.status === status) &&
      (category === "ALL" || row.categoryId === category) &&
      (stock === "ALL" ||
        (stock === "LOW"
          ? row.variants.some(
              (variant) => variantNeedsStock(variant),
            )
          : row.variants.every(
              (variant) => !variantNeedsStock(variant),
            ))) &&
      `${row.title} ${row.sku} ${row.category.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const resource = useSellerList<SellerProduct>(
    "products",
    { q: query, status, categoryId: category, stock },
    sample,
  );
  const products = resource.data ?? [],
    shown = products,
    dataLoading = resource.loading;
  const categories = (summary.data?.categories ?? []).map(
    (row) => [row.id, row] as const,
  );
  function exportCsv() {
    const escape = (value: string | number) => {
      const safe = String(value).replace(/^[\s]*[=+\-@]/, "'$&");
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["Product", "SKU", "Category", "Price LKR", "Available", "Status"],
      ...shown.map((row) => [
        row.title,
        row.sku,
        row.category.name,
        (row.priceLkrMinor / 100).toFixed(2),
        row.variants.reduce(
          (sum, variant) =>
            sum + Math.max(0, variant.onHand - variant.reserved),
          0,
        ),
        row.status,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF", rows.map((row) => row.map(escape).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "helacart-products.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function action(productId: string, operation: "submit" | "hide") {
    if (!seller) return;
    setBusy(productId);
    setNotice("");
    try {
      await request(
        `/sellers/${seller.id}/products/${productId}/${operation}`,
        operation === "submit" ? "POST" : "PATCH",
      );
      await refreshProducts();
      setNotice(
        operation === "submit"
          ? "Product submitted for admin review."
          : "Product hidden from the storefront.",
      );
    } catch (cause) {
      setNotice(errorMessage(cause));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="seller-section-hero">
        <SellerPageHeading
          kicker="STORE CATALOGUE"
          title="Products & listings"
          description="Manage your catalog, follow admin approval, and keep stock ready."
          action={
            <div className="seller-heading-actions">
              <button
                className="outline-btn"
                type="button"
                disabled={!shown.length}
                onClick={exportCsv}
              >
                <Download size={16} /> Export page CSV
              </button>
              <Link className="primary-btn" href="/seller/products/new">
                <Plus size={17} /> Add new product
              </Link>
            </div>
          }
        />
        <div className="seller-summary-row">
          {[
            ["Live online", summary.data?.productCounts.APPROVED ?? "—"],
            ["Under review", summary.data?.productCounts.PENDING ?? "—"],
            ["Needs fix", summary.data?.productCounts.REJECTED ?? "—"],
            ["Low / zero stock", summary.data?.lowStockProducts ?? "—"],
          ].map(([label, count]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
      {(resource.error || summary.error) && (
        <div className="message error" role="alert">
          {resource.error || summary.error}
          <button
            onClick={() => {
              resource.reload();
              summary.reload();
            }}
          >
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="message info" role="status">
          {notice}
        </div>
      )}
      <section className="seller-card seller-catalog">
        <div className="seller-tabs" role="group" aria-label="Product status">
          {["ALL", "APPROVED", "PENDING", "DRAFT", "REJECTED", "HIDDEN"].map(
            (value) => (
              <button
                key={value}
                type="button"
                className={status === value ? "active" : ""}
                onClick={() => {
                  setStatus(value);
                }}
              >
                {value === "ALL"
                  ? "All"
                  : value === "PENDING"
                    ? "Pending review"
                    : value}{" "}
                <span>
                  {value === "ALL"
                    ? (summary.data?.totalProducts ?? "—")
                    : summary.data
                      ? (summary.data.productCounts[value] ?? 0)
                      : "—"}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="seller-toolbar">
          <label className="seller-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search title, category or SKU"
              aria-label="Search seller products"
            />
          </label>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
            aria-label="Filter category"
          >
            <option value="ALL">All categories</option>
            {categories.map(([id, row]) => (
              <option key={id} value={id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            value={stock}
            onChange={(event) => {
              setStock(event.target.value);
            }}
            aria-label="Filter stock"
          >
            <option value="ALL">All stock levels</option>
            <option value="LOW">Low / zero stock</option>
            <option value="READY">Stock available</option>
          </select>
        </div>
        <div
          className="seller-table-wrap"
          role="region"
          aria-label="Product listings"
          tabIndex={0}
        >
          {shown.length ? (
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        className="seller-product-cell"
                        href={`/seller/products/${row.id}`}
                      >
                        <span className="seller-thumb">
                          {row.imageUrls[0] ? (
                            <img src={row.imageUrls[0]} alt="" />
                          ) : (
                            <Box size={21} />
                          )}
                        </span>
                        <span>
                          <strong>{row.title}</strong>
                          <small>{row.category.name}</small>
                        </span>
                      </Link>
                    </td>
                    <td className="seller-muted">{row.sku}</td>
                    <td>{money(row.priceLkrMinor)}</td>
                    <td
                      className={
                        row.variants.some(
                          (variant) => variantNeedsStock(variant),
                        )
                          ? "seller-low"
                          : ""
                      }
                    >
                      {row.variants.reduce(
                        (sum, variant) =>
                          sum + Math.max(0, variant.onHand - variant.reserved),
                        0,
                      )}{" "}
                      units
                    </td>
                    <td>
                      <SellerStatusBadge status={row.status} />
                    </td>
                    <td>
                      <div className="seller-row-actions">
                        <Link href={`/seller/products/${row.id}`}>Edit</Link>
                        {!isPreview &&
                          ["DRAFT", "REJECTED"].includes(row.status) && (
                            <button
                              disabled={busy === row.id}
                              onClick={() => void action(row.id, "submit")}
                            >
                              Submit
                            </button>
                          )}
                        {!isPreview && row.status === "APPROVED" && (
                          <button
                            disabled={busy === row.id}
                            onClick={() => void action(row.id, "hide")}
                          >
                            Hide
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="seller-empty">
              {dataLoading
                ? "Loading your products…"
                : products.length
                  ? "No products match this filter."
                  : "No products yet. Add your first listing to get started."}
            </div>
          )}
        </div>
        {resource.pagination}
      </section>
      <p className="seller-footnote">
        Editing an approved product or its variants moves it to draft. Submit it
        again for admin review.{" "}
        <Link href="/seller/inventory">
          Manage stock <ArrowRight size={13} />
        </Link>
      </p>
    </>
  );
}
