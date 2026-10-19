import Link from "next/link";
import { Banknote, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Brand } from "./site-header";

export function TrustStrip() {
  return <div className="trust-strip"><div className="container trust-grid">
    <div><span className="trust-icon"><Truck size={21} /></span><span><strong>Made for Sri Lanka</strong><small>Shop from local sellers</small></span></div>
    <div><span className="trust-icon"><Banknote size={21} /></span><span><strong>Cash on Delivery</strong><small>Pay when your order arrives</small></span></div>
    <div><span className="trust-icon"><ShieldCheck size={21} /></span><span><strong>Shop with clarity</strong><small>See item and delivery totals</small></span></div>
    <div><span className="trust-icon"><PackageCheck size={21} /></span><span><strong>Order history</strong><small>Follow your purchases</small></span></div>
  </div></div>;
}
export function SiteFooter() {
  return <>
    <TrustStrip />
    <footer className="site-footer"><div className="container footer-columns">
      <div className="footer-about"><Brand /><p>A Sri Lankan marketplace for everyday goods from independent sellers. Find something you love.</p></div>
      <div><strong>Shop</strong><Link href="/products">All products</Link><Link href="/cart">Your cart</Link></div>
      <div><strong>Your account</strong><Link href="/account">My account</Link><Link href="/orders">Orders</Link><Link href="/auth">Sign in</Link></div>
      <div><strong>HelaCart</strong><p>Browse products in LKR. Delivery fees are shown in your cart before you order.</p></div>
    </div><div className="container footer-bottom"><span>© HelaCart. All rights reserved.</span><span>Sri Lanka · LKR</span></div></footer>
  </>;
}
