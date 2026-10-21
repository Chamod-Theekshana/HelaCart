import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
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
        <div className="container footer-welcome">
          <div>
            <span>THE HELACART WAY</span>
            <h2>Good finds. Local roots.</h2>
          </div>
          <Link href="/seller/apply">
            Have a shop of your own?{" "}
            <span>
              Join HelaCart <ArrowRight size={16} />
            </span>
          </Link>
        </div>
        <div className="container footer-columns">
          <div className="footer-about">
            <Brand />
            <p>
              Everyday favourites and unexpected finds from independent shops
              across Sri Lanka.
            </p>
            <span className="footer-local-note">
              A little closer to the shops behind the things you love.
            </span>
          </div>
          <div>
            <strong>Take a look around</strong>
            <Link href="/products">Shop all products</Link>
            <Link href="/shops">Meet the shops</Link>
            <Link href="/products?sort=newest">New arrivals</Link>
          </div>
          <div>
            <strong>Make yourself at home</strong>
            <Link href="/account/profile">My profile</Link>
            <Link href="/orders">My orders</Link>
            <Link href="/cart">My cart</Link>
          </div>
          <div>
            <strong>A little help</strong>
            <Link href="/#how-it-works">How shopping works</Link>
            <Link href="/account/returns">Track a return</Link>
            <Link href="/account/security">Account & security</Link>
            <Link href="/seller">Seller Center</Link>
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
