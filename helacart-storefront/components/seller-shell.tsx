"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Box, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, Plus, Settings, ShoppingBag, UserRound, Wallet, X } from "lucide-react";
import { Brand } from "./site-header";
import { useShop } from "./shop-provider";
import { useSeller } from "./seller-provider";

const nav = [
  { href: "/seller", label: "Overview", icon: LayoutDashboard },
  { href: "/seller/products", label: "Products", icon: Box },
  { href: "/seller/inventory", label: "Inventory & Stock", icon: ShoppingBag },
  { href: "/seller/orders", label: "Orders", icon: ClipboardList },
  { href: "/seller/settings", label: "Delivery Settings", icon: Settings },
];

export function SellerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, authReady, signOutBuyer } = useShop();
  const { seller, sellers, applications, profile, loading, dataLoading, error, isPreview, selectSeller } = useSeller();
  const showApplication = pathname === "/seller/apply";
  const pending = applications.find((row) => row.status === "PENDING");
  const rejected = applications.find((row) => row.status === "REJECTED");
  return <div className="seller-app">
    <aside className={`seller-sidebar ${menuOpen ? "open" : ""}`}>
      <div className="seller-brand"><Brand /><span>MERCHANT HUB</span></div>
      <div className="seller-switch">
        {sellers.length > 1 ? <select value={seller?.id} onChange={(event) => selectSeller(event.target.value)} aria-label="Choose seller store">
          {sellers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select> : <strong>{seller?.name ?? (isPreview ? "Design preview" : "Set up your store")}</strong>}
        <span className="seller-store-status">{seller ? <><BadgeCheck size={13} /> Approved seller</> : "Seller workspace"}</span>
      </div>
      <nav className="seller-nav" aria-label="Seller navigation">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href}
          className={pathname === href || (href === "/seller/products" && pathname.startsWith(href + "/")) ? "active" : ""}
          onClick={() => setMenuOpen(false)}><Icon size={18} /> {label}</Link>)}
      </nav>
      <Link className="seller-storefront-link" href="/" onClick={() => setMenuOpen(false)}><ShoppingBag size={17} /> Visit storefront <ExternalLink size={14} /></Link>
      <div className="seller-sidebar-bottom"><Link href="/seller/settings" onClick={() => setMenuOpen(false)}><Settings size={17} /> Store profile</Link>
        {user && <button onClick={() => void signOutBuyer()}><LogOut size={17} /> Sign out</button>}</div>
    </aside>
    {menuOpen && <button className="seller-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="seller-main">
      <header className="seller-top"><button type="button" className="seller-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <div className="seller-top-pills"><span className="seller-top-pill"><span className="seller-live-dot" /> {seller ? "Approved store" : "Merchant workspace"}</span>
          <span className="seller-top-pill muted"><Wallet size={16} /> Cash on delivery</span></div>
        {seller && <Link className="primary-btn seller-top-add" href="/seller/products/new"><Plus size={17} /> Add product</Link>}
        <span className="seller-top-account">{user?.email ?? "Your workspace"} <UserRound size={18} /></span></header>
      <main className="seller-content">
        {isPreview && <div className="seller-preview" role="status">Design preview · Sample products and orders. Connect the API and sign in to manage real store data.</div>}
        {!isPreview && (!authReady || (user && loading)) ? <div className="seller-state">Loading your seller workspace…</div>
        : !isPreview && !user ? <div className="seller-state"><h1>Sign in to manage your store</h1><p>Use the Firebase account linked to your HelaCart seller application.</p><Link className="primary-btn" href="/auth">Sign in</Link></div>
        : !isPreview && profile && !profile.emailVerified ? <div className="seller-access"><div className="seller-state"><span className="section-kicker">ACCOUNT VERIFICATION</span><h1>Verify your email</h1><p>Open your Firebase verification email, confirm the address, and return here to manage your store.</p><Link className="primary-btn" href="/auth">Check sign-in status</Link></div></div>
        : !isPreview && error && !seller && !showApplication ? <div className="seller-state"><h1>Could not load your store</h1><p>{error}</p><button className="primary-btn" onClick={() => window.location.reload()}>Try again</button></div>
        : !isPreview && !seller && !showApplication ? <div className="seller-access"><div className="seller-state"><span className="section-kicker">SELLER ACCESS</span><h1>{pending ? "Your application is under review" : rejected ? "Your seller application was rejected" : "Start selling on HelaCart"}</h1>
            <p>{pending ? "The dashboard opens after your store is approved." : rejected ? rejected.reviews[0]?.reason ?? "Contact the HelaCart team for details." : "Create a seller application to set up your store."}</p>
            {!pending && !rejected && <Link className="primary-btn" href="/seller/apply">Apply to sell</Link>}
          </div><div className="seller-access-steps"><h2>Application status</h2><div className="seller-access-step"><span>1</span><div><strong>Application submitted</strong><small>{pending || rejected ? "We received your store information." : "Tell us about your store and pickup address."}</small></div></div><div className="seller-access-step"><span>2</span><div><strong>Admin review</strong><small>{pending ? "Your application is awaiting a decision." : rejected ? "Your application requires attention." : "The HelaCart team reviews your application."}</small></div></div><div className="seller-access-step"><span>3</span><div><strong>Seller access</strong><small>Your approved store appears here automatically.</small></div></div></div></div> : <>{dataLoading && !isPreview && <div className="seller-preview">Updating store data…</div>}{error && seller && <div className="message error" role="alert">{error}</div>}{children}</>}
      </main>
    </div>
  </div>;
}
