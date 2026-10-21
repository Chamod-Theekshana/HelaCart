import Link from "next/link";
export default function ShopNotFound() {
  return (
    <div className="container empty-panel">
      <h1>Shop not found</h1>
      <p>This shop is not available right now.</p>
      <Link className="primary-btn" href="/shops">
        Explore other shops
      </Link>
    </div>
  );
}
