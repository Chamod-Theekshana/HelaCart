"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  RotateCcw,
  Store,
  Wallet,
} from "lucide-react";
import { previewAdminSummary, type AdminSummary } from "@/lib/workspace";
import { money } from "@/lib/api";
import { useAdminResource, useAdminList } from "@/components/admin-provider";
import {
  AdminBadge,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import {
  dateTime,
  previewAdminCod,
  previewAdminOrders,
  previewAdminProducts,
  previewAdminReturns,
  previewApplications,
  shortId,
  type AdminApplication,
  type AdminCod,
  type AdminOrder,
  type AdminProduct,
  type AdminReturn,
} from "@/lib/admin";

export default function AdminOverview() {
  const summary = useAdminResource<AdminSummary>(
    "/workspace/admin/summary",
    previewAdminSummary,
  );
  const applications = useAdminList<AdminApplication>(
    "seller-applications",
    { status: "PENDING", limit: "2" },
    previewApplications,
  );
  const products = useAdminList<AdminProduct>(
    "products",
    { status: "PENDING", limit: "2" },
    previewAdminProducts,
  );
  const returns = useAdminList<AdminReturn>(
    "returns",
    { status: "PENDING", limit: "2" },
    previewAdminReturns,
  );
  const cod = useAdminList<AdminCod>("cod", { limit: "2" }, previewAdminCod);
  const orders = useAdminList<AdminOrder>(
    "orders",
    { limit: "5" },
    previewAdminOrders,
  );
  const loading =
    applications.loading ||
    products.loading ||
    returns.loading ||
    cod.loading ||
    orders.loading;
  const error = [
    summary.error,
    applications.error,
    products.error,
    returns.error,
    cod.error,
    orders.error,
  ]
    .filter(Boolean)
    .join(" · ");
  const cards = [
    {
      href: "/admin/seller-applications",
      title: "Merchant onboarding",
      count: summary.data?.pendingApplications,
      icon: Store,
      detail: "Pending seller applications",
    },
    {
      href: "/admin/products",
      title: "Product approvals",
      count: summary.data?.pendingProducts,
      icon: BadgeCheck,
      detail: "Listings awaiting review",
    },
    {
      href: "/admin/returns",
      title: "Returns",
      count: summary.data?.pendingReturns,
      icon: RotateCcw,
      detail: "Requests awaiting decision",
    },
    {
      href: "/admin/cod",
      title: "COD unreconciled",
      count: summary.data?.unreconciledCollections,
      icon: Wallet,
      detail: "Delivered collections in queue",
    },
  ];
  return (
    <>
      <div className="admin-intro">
        <ClipboardCheck size={24} />
        <div>
          <strong>Operations overview</strong>
          <p>
            Review current moderation and COD queues. Counts cover all matching
            records across the marketplace.
          </p>
        </div>
      </div>
      <AdminHeading
        eyebrow="HELACART OPERATIONS"
        title="Overview"
        description="Keep seller onboarding, catalog review and COD operations moving."
      />
      <AdminFeedback error={error} />
      <div className="admin-kpis">
        {cards.map(({ href, title, count, icon: Icon, detail }) => (
          <Link href={href} className="admin-kpi" key={href}>
            <span className="admin-kpi-head">
              {title}
              <Icon size={20} />
            </span>
            <strong>{count ?? (loading ? "…" : "—")}</strong>
            <small>{detail}</small>
            <span className="admin-kpi-link">
              Open queue <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      <div className="admin-overview-columns">
        <section className="admin-card">
          <div className="admin-card-head">
            <div>
              <h2>Needs attention</h2>
              <p>Items ready for an administrator to review</p>
            </div>
          </div>
          <div className="admin-attention">
            {(applications.data ?? []).slice(0, 2).map((row) => (
              <Link key={row.id} href="/admin/seller-applications">
                <span className="admin-list-icon">
                  <Store size={19} />
                </span>
                <span>
                  <strong>Seller application: {row.name}</strong>
                  <small>Submitted {dateTime(row.createdAt)}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
            {(products.data ?? []).slice(0, 2).map((row) => (
              <Link key={row.id} href="/admin/products">
                <span className="admin-list-icon">
                  <BadgeCheck size={19} />
                </span>
                <span>
                  <strong>Product approval: {row.title}</strong>
                  <small>
                    {row.seller.name} · {money(row.priceLkrMinor)}
                  </small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
            {(returns.data ?? []).slice(0, 2).map((row) => (
              <Link key={row.id} href="/admin/returns">
                <span className="admin-list-icon warn">
                  <RotateCcw size={19} />
                </span>
                <span>
                  <strong>Return request {shortId(row.id)}</strong>
                  <small>Submitted {dateTime(row.createdAt)}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
            {(cod.data ?? []).slice(0, 2).map((row) => (
              <Link key={row.id} href="/admin/cod">
                <span className="admin-list-icon">
                  <Wallet size={19} />
                </span>
                <span>
                  <strong>COD reconciliation {shortId(row.id)}</strong>
                  <small>{money(row.totalLkrMinor)} expected</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
            {!loading &&
              ![applications.data, products.data, returns.data, cod.data].some(
                (rows) => rows?.length,
              ) &&
              !error && (
                <AdminEmpty message="No pending items in the loaded queues." />
              )}
          </div>
        </section>
        <aside className="admin-card">
          <div className="admin-card-head">
            <div>
              <h2>Queue shortcuts</h2>
              <p>Go directly to a review workflow</p>
            </div>
          </div>
          <div className="admin-shortcuts">
            {cards.map(({ href, title, icon: Icon }) => (
              <Link href={href} key={href}>
                <Icon size={18} /> {title} <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </aside>
      </div>
      <section className="admin-card">
        <div className="admin-card-head">
          <div>
            <h2>Recent orders</h2>
            <p>Read-only view of the latest loaded COD orders</p>
          </div>
          <Link href="/admin/orders">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        {orders.data?.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer & district</th>
                  <th>Seller</th>
                  <th>COD amount</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.slice(0, 5).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="admin-link" href="/admin/orders">
                        {shortId(row.id)}
                      </Link>
                    </td>
                    <td>
                      {row.recipient}
                      <small>{row.district}</small>
                    </td>
                    <td>
                      {row.sellerOrders
                        .map((part) => part.seller.name)
                        .join(", ")}
                    </td>
                    <td className="admin-money">{money(row.totalLkrMinor)}</td>
                    <td>
                      <AdminBadge value={row.sellerOrders[0]?.status ?? "—"} />
                    </td>
                    <td>{dateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty
            message={loading ? "Loading recent orders…" : "No orders yet."}
          />
        )}
      </section>
    </>
  );
}
