"use client";
import {variantNeedsStock} from "@/lib/seller";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Box,
  ClipboardList,
  PackageCheck,
  Plus,
  ShoppingBag,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { previewOrders, type SellerOrderRecord } from "@/lib/seller";
import { pageOf, type Page } from "@/lib/shops";
import {
  previewInventory,
  previewSellerSummary,
  type SellerSummary,
  type InventoryEntry,
} from "@/lib/workspace";
import { money } from "@/lib/api";
import { formatSellerDate } from "@/lib/seller";
import { useSeller, useSellerResource } from "@/components/seller-provider";
import { SellerStatusBadge } from "@/components/seller-ui";

export default function SellerOverview() {
  const { seller, isPreview } = useSeller();
  const summary = useSellerResource<SellerSummary>(
    "summary",
    previewSellerSummary,
  );
  const recent = useSellerResource<Page<SellerOrderRecord>>(
    "orders?limit=5",
    pageOf(previewOrders, 1, 5),
  );
  const low = useSellerResource<Page<InventoryEntry>>(
    "inventory?stock=LOW&limit=4",
    pageOf(
      previewInventory.filter(
        (row) => variantNeedsStock(row.variant),
      ),
      1,
      4,
    ),
  );
  const orders = recent.data?.items ?? [],
    lowStock = low.data?.items ?? [],
    dataLoading = recent.loading;
  const active = summary.data?.activeOrders ?? 0,
    lowCount = summary.data?.lowStock ?? 0,
    pendingProducts = summary.data?.productCounts.PENDING ?? 0;
  return (
    <>
      {(summary.error || recent.error || low.error) && (
        <div className="message error" role="alert">
          {summary.error || recent.error || low.error}
          <button
            onClick={() => {
              summary.reload();
              recent.reload();
              low.reload();
            }}
          >
            Try again
          </button>
        </div>
      )}
      <section className="seller-hero">
        <div>
          <div className="seller-hero-badges">
            <span>
              <BadgeCheck size={14} /> Approved store
            </span>
            {isPreview && <span>Sample demonstration data</span>}
          </div>
          <h1>Welcome back{seller ? `, ${seller.name}` : ""}</h1>
          <p>
            {active
              ? `${active} customer order${active === 1 ? "" : "s"} awaiting fulfilment.`
              : "Your products, orders and stock are ready to manage."}
          </p>
        </div>
        <div className="seller-hero-actions">
          <Link className="outline-btn" href="/">
            View storefront
          </Link>
          <Link className="primary-btn" href="/seller/products/new">
            <Plus size={17} /> Add product
          </Link>
        </div>
      </section>
      <div className="seller-alert-grid">
        <Link href="/seller/settings" className="seller-alert">
          <span className="stat-icon mint">
            <Truck size={20} />
          </span>
          <span>
            <strong>
              Delivery fee{" "}
              {seller?.shippingFeeLkrMinor == null ? "needed" : "configured"}
            </strong>
            <small>
              {seller?.shippingFeeLkrMinor == null
                ? "Set a fee to enable checkout"
                : `${money(seller.shippingFeeLkrMinor)} per seller order`}
            </small>
          </span>
          <ArrowRight size={16} />
        </Link>
        <Link href="/seller/inventory" className="seller-alert">
          <span className="stat-icon rose">
            <TriangleAlert size={20} />
          </span>
          <span>
            <strong>
              {lowCount} low stock variant{lowCount === 1 ? "" : "s"}
            </strong>
            <small>
              {lowCount
                ? "At or below the configured stock level"
                : "Inventory is looking healthy"}
            </small>
          </span>
          <ArrowRight size={16} />
        </Link>
        <Link href="/seller/products" className="seller-alert">
          <span className="stat-icon blue">
            <ClipboardList size={20} />
          </span>
          <span>
            <strong>{pendingProducts} in review</strong>
            <small>Awaiting product approval</small>
          </span>
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="seller-stats">
        <Link href="/seller/products" className="seller-stat">
          <span className="seller-stat-label">
            Total products <Box size={18} />
          </span>
          <strong>{summary.data?.totalProducts ?? "—"}</strong>
          <small>All catalog listings</small>
        </Link>
        <Link href="/seller/products" className="seller-stat">
          <span className="seller-stat-label">
            Approved products <BadgeCheck size={18} />
          </span>
          <strong>
            {summary.data ? (summary.data.productCounts.APPROVED ?? 0) : "—"}
          </strong>
          <small>Available in the marketplace</small>
        </Link>
        <Link href="/seller/orders" className="seller-stat">
          <span className="seller-stat-label">
            Active orders <Truck size={18} />
          </span>
          <strong>{summary.data?.activeOrders ?? "—"}</strong>
          <small>Awaiting fulfilment or delivery</small>
        </Link>
        <Link href="/seller/inventory" className="seller-stat">
          <span className="seller-stat-label">
            Low stock alert <TriangleAlert size={18} />
          </span>
          <strong>{summary.data?.lowStock ?? "—"}</strong>
          <small>Variants needing attention</small>
        </Link>
      </div>
      <div className="seller-dashboard-grid seller-overview-grid">
        <section className="seller-card seller-recent-orders">
          <div className="seller-card-heading">
            <div>
              <h2>Recent customer orders</h2>
              <p>Follow cash on delivery and fulfilment</p>
            </div>
            <Link href="/seller/orders">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {orders.length ? (
            <div
              className="seller-table-wrap"
              role="region"
              aria-label="Recent customer orders"
              tabIndex={0}
            >
              <table className="seller-table">
                <thead>
                  <tr>
                    <th>Order ref</th>
                    <th>Buyer & district</th>
                    <th>Date</th>
                    <th>COD amount</th>
                    <th>Fulfilment</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link
                          className="seller-link"
                          href={`/seller/orders?order=${encodeURIComponent(row.id)}`}
                        >
                          #{row.order.id.slice(0, 8)}
                        </Link>
                        <small className="seller-cell-note">
                          {row.items.length} item
                          {row.items.length === 1 ? "" : "s"}
                        </small>
                      </td>
                      <td>
                        <strong>{row.order.recipient}</strong>
                        <small className="seller-cell-note">
                          {row.order.district}
                        </small>
                      </td>
                      <td>{formatSellerDate(row.createdAt)}</td>
                      <td className="seller-money">
                        {money(row.totalLkrMinor)}
                      </td>
                      <td>
                        <SellerStatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="seller-empty">
              {dataLoading
                ? "Loading orders…"
                : "No orders yet. New orders will appear here."}
            </div>
          )}
        </section>
        <aside className="seller-side-stack">
          <section className="seller-card">
            <div className="seller-card-heading">
              <div>
                <h2>Inventory health</h2>
                <p>Variants needing a restock</p>
              </div>
              <Box size={19} />
            </div>
            {lowStock.length ? (
              <div className="seller-action-list">
                {lowStock.slice(0, 4).map(({ product, variant }) => (
                  <Link
                    key={variant.id}
                    href={`/seller/products/${product.id}`}
                  >
                    <span className="seller-thumb">
                      {product.imageUrls[0] ? (
                        <img src={product.imageUrls[0]} alt="" />
                      ) : (
                        <ShoppingBag size={20} />
                      )}
                    </span>
                    <span>
                      <strong>{product.title}</strong>
                      <small>
                        {variant.sku} ·{" "}
                        {Math.max(0, variant.onHand - variant.reserved)}{" "}
                        available
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="seller-empty">No low stock variants.</div>
            )}
            <Link className="seller-panel-foot" href="/seller/inventory">
              Manage all stock variants <ArrowRight size={15} />
            </Link>
          </section>
          <section className="seller-next-card">
            <PackageCheck size={25} />
            <h2>Keep your store ready</h2>
            <p>
              Review incoming orders, keep products approved, and update stock
              when new supplies arrive.
            </p>
            <Link href="/seller/products">
              Manage products <ArrowRight size={16} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
