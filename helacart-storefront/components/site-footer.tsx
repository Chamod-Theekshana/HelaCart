import Link from "next/link";
import { Banknote, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Brand } from "./site-header";

export function TrustStrip() {
  return (
    <div className="trust-strip">
      <div className="container trust-grid">
        <div>
          <span className="trust-icon">
            <Truck size={21} />
          </span>
          <span>
            <strong>Made for Sri Lanka</strong>
            <small>Discover independent shops</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Banknote size={21} />
          </span>
          <span>
            <strong>Cash on delivery</strong>
            <small>Pay when your order arrives</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <ShieldCheck size={21} />
          </span>
          <span>
            <strong>Clear from the start</strong>
            <small>Review item and delivery totals</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <PackageCheck size={21} />
          </span>
          <span>
            <strong>Your orders, in one place</strong>
            <small>Follow them in your account</small>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter({ showTrust = true }: { showTrust?: boolean }) {
  return (
    <>
      {showTrust && <TrustStrip />}
      <footer className="site-footer">
        <div className="container footer-columns">
          <div className="footer-about">
            <Brand />
            <p>
              A marketplace for independent shops across Sri Lanka. Good finds,
              local roots, and cash on delivery.
            </p>
          </div>
          <div>
            <strong>Shopping</strong>
            <Link href="/products">Shop all products</Link>
            <Link href="/#categories">Categories</Link>
            <Link href="/products?sort=newest">New arrivals</Link>
          </div>
          <div>
            <strong>Shops</strong>
            <Link href="/shops">Discover shops</Link>
            <Link href="/seller">Seller Center</Link>
            <Link href="/seller/apply">Open your shop</Link>
          </div>
          <div>
            <strong>Your account</strong>
            <Link href="/account/profile">My profile</Link>
            <Link href="/favorites">My Favorites</Link>
            <Link href="/orders">Track an order</Link>
            <Link href="/account/returns">Returns</Link>
            <Link href="/#how-it-works">Shopping help</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getUTCFullYear()} HelaCart. A place for good finds.
          </span>
          <span>
            Sri Lanka <span aria-hidden="true">·</span> LKR{" "}
            <span aria-hidden="true">·</span> Cash on delivery
          </span>
        </div>
      </footer>
    </>
  );
}
