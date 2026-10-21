"use client";

import { useState } from "react";
import { Box, Search, X } from "lucide-react";
import { money } from "@/lib/api";
import { useAdmin, useAdminList } from "@/components/admin-provider";
import {
  AdminBadge,
  AdminDecision,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import {
  dateTime,
  previewAdminProducts,
  shortId,
  type AdminProduct,
} from "@/lib/admin";
import type { ProductStatus } from "@/lib/seller";

const statuses: ProductStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "DRAFT",
  "HIDDEN",
];
export default function AdminProductsPage() {
  const { isPreview, request } = useAdmin();
  const [status, setStatus] = useState<ProductStatus>("PENDING");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [notice, setNotice] = useState("");
  const resource = useAdminList<AdminProduct>(
    "products",
    { q: query, status },
    status === "PENDING" ? previewAdminProducts : [],
  );
  const rows = resource.data ?? [];
  async function commit(reason: string) {
    if (!selected || !decision) return;
    await request(
      `/admin/products/${selected.id}/${decision}`,
      "PATCH",
      decision === "reject" ? { reason } : undefined,
    );
    resource.reload();
    setSelected(null);
    setNotice(`Product ${decision === "approve" ? "approved" : "rejected"}.`);
  }
  return (
    <>
      <AdminHeading
        eyebrow="MODERATION / CATALOG"
        title="Product approvals"
        description="Review submitted listings and return useful feedback to sellers."
      />
      <AdminFeedback error={resource.error} notice={notice} />
      <div className="admin-card">
        <div className="admin-tabs" role="group" aria-label="Product status">
          {statuses.map((value) => (
            <button
              key={value}
              className={status === value ? "active" : ""}
              onClick={() => {
                setStatus(value);
                setSelected(null);
              }}
            >
              {value.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input
              aria-label="Search products"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, SKU, seller or category"
            />
          </label>
          <span>
            {resource.page?.total ?? "—"} matching · all matching records
          </span>
        </div>
        {resource.loading ? (
          <AdminEmpty message="Loading products…" />
        ) : rows.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="admin-product-cell">
                        <span className="admin-product-thumb">
                          {row.imageUrls[0] ? (
                            <img src={row.imageUrls[0]} alt="" />
                          ) : (
                            <Box size={20} />
                          )}
                        </span>
                        <span>
                          <strong>{row.title}</strong>
                          <small>{row.category.name}</small>
                        </span>
                      </div>
                    </td>
                    <td>{row.seller.name}</td>
                    <td>{row.sku}</td>
                    <td className="admin-money">{money(row.priceLkrMinor)}</td>
                    <td>
                      {row.variants.reduce(
                        (sum, variant) =>
                          sum + Math.max(0, variant.onHand - variant.reserved),
                        0,
                      )}
                    </td>
                    <td>
                      <AdminBadge value={row.status} />
                    </td>
                    <td>
                      <button
                        className="admin-link-button"
                        onClick={() => setSelected(row)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty
            message={
              resource.error
                ? "Could not load products."
                : `No ${status.toLowerCase()} products in this queue.`
            }
          />
        )}
      </div>
      {selected && (
        <div
          className="admin-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <aside
            className="admin-drawer admin-product-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Product review details"
          >
            <div className="admin-drawer-head">
              <div>
                <span className="admin-eyebrow">
                  PRODUCT {shortId(selected.id)}
                </span>
                <h2>{selected.title}</h2>
                <AdminBadge value={selected.status} />
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-callout">
                <Box size={20} />
                <p>
                  {selected.seller.name} submitted this listing. Inspect the
                  supplied description, images and stock.
                </p>
              </div>
              <div className="admin-image-grid">
                {selected.imageUrls.length ? (
                  selected.imageUrls.map((url) => (
                    <img src={url} alt={selected.title} key={url} />
                  ))
                ) : (
                  <div>No product images supplied</div>
                )}
              </div>
              <div className="admin-product-numbers">
                <div>
                  <small>Base price</small>
                  <strong>{money(selected.priceLkrMinor)}</strong>
                </div>
                <div>
                  <small>On hand</small>
                  <strong>
                    {selected.variants.reduce(
                      (sum, row) => sum + row.onHand,
                      0,
                    )}
                  </strong>
                </div>
                <div>
                  <small>Reserved</small>
                  <strong>
                    {selected.variants.reduce(
                      (sum, row) => sum + row.reserved,
                      0,
                    )}
                  </strong>
                </div>
                <div>
                  <small>Available</small>
                  <strong>
                    {selected.variants.reduce(
                      (sum, row) =>
                        sum + Math.max(0, row.onHand - row.reserved),
                      0,
                    )}
                  </strong>
                </div>
              </div>
              <h3>Description</h3>
              <p className="admin-description">{selected.description}</p>
              <h3>Product details</h3>
              <dl className="admin-detail-list">
                <dt>Seller</dt>
                <dd>{selected.seller.name}</dd>
                <dt>Category</dt>
                <dd>{selected.category.name}</dd>
                <dt>SKU</dt>
                <dd>{selected.sku}</dd>
                <dt>Slug</dt>
                <dd>{selected.slug}</dd>
                <dt>Submitted</dt>
                <dd>{dateTime(selected.createdAt)}</dd>
              </dl>
              <h3>Variants</h3>
              {selected.variants.length ? (
                selected.variants.map((variant) => (
                  <div key={variant.id} className="admin-variant">
                    <strong>{variant.sku}</strong>
                    <span>
                      {Object.values(variant.optionValues).join(" · ") ||
                        "Default"}{" "}
                      · {money(variant.priceLkrMinor)}
                    </span>
                    <small>
                      {Math.max(0, variant.onHand - variant.reserved)} available
                    </small>
                  </div>
                ))
              ) : (
                <p className="admin-muted">No variants supplied.</p>
              )}
              <h3>Review history</h3>
              {selected.reviews.length ? (
                selected.reviews.map((review, i) => (
                  <div className="admin-history" key={i}>
                    <AdminBadge value={review.decision} />
                    <p>{review.reason ?? "Decision recorded."}</p>
                    <small>{dateTime(review.createdAt)}</small>
                  </div>
                ))
              ) : (
                <p className="admin-muted">No previous decision.</p>
              )}
            </div>
            {selected.status === "PENDING" && (
              <div className="admin-drawer-actions">
                <button
                  className="admin-danger-outline"
                  disabled={isPreview}
                  onClick={() => setDecision("reject")}
                >
                  Reject product
                </button>
                <button
                  className="primary-btn"
                  disabled={isPreview || !selected.imageUrls.length}
                  title={
                    !selected.imageUrls.length
                      ? "Product must have an image"
                      : undefined
                  }
                  onClick={() => setDecision("approve")}
                >
                  Approve product
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
      {decision && selected && (
        <AdminDecision
          title={
            decision === "approve" ? "Approve product?" : "Reject product?"
          }
          description={
            decision === "approve"
              ? `Approve “${selected.title}” for the public catalog?`
              : "Provide a reason the seller can act on before resubmitting."
          }
          label={decision === "approve" ? "Approve product" : "Reject product"}
          dangerous={decision === "reject"}
          noteLabel={decision === "reject" ? "Rejection reason" : undefined}
          minLength={10}
          maxLength={500}
          onClose={() => setDecision(null)}
          onConfirm={commit}
        />
      )}
      {resource.pagination}
    </>
  );
}
