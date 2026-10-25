import type { ProductStatus, OrderStatus } from "@/lib/seller";

export function SellerStatusBadge({ status }: { status: ProductStatus | OrderStatus }) {
  return <span className={`seller-status status-${status.toLowerCase()}`}>{status.toLowerCase().replaceAll("_", " ")}</span>;
}

export function SellerPageHeading({ kicker, title, description, action }: {
  kicker: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return <div className="seller-page-heading"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
