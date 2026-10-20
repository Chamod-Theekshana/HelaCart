"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, ClipboardCheck, ClipboardList, ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, RotateCcw, ShieldCheck, ShoppingBag, Store, Wallet, X } from "lucide-react";
import { useShop } from "./shop-provider";
import { useAdmin } from "./admin-provider";
import { Brand } from "./site-header";

const items = [
  { href: "/admin", title: "Overview", icon: LayoutDashboard, section: "CORE PLATFORM" },
  { href: "/admin/seller-applications", title: "Seller applications", icon: Store, section: "MODERATION & GOVERNANCE" },
  { href: "/admin/products", title: "Product approvals", icon: BadgeCheck },
  { href: "/admin/categories", title: "Categories", icon: FolderTree },
  { href: "/admin/orders", title: "Orders", icon: ShoppingBag, section: "FULFILMENT & SETTLEMENTS" },
  { href: "/admin/returns", title: "Returns", icon: RotateCcw },
  { href: "/admin/cod", title: "COD reconciliation", icon: Wallet },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, authReady, signOutBuyer } = useShop();
  const { access, accessError, retry, isPreview } = useAdmin();
  const activeName = items.find((item) => item.href === pathname)?.title ?? "Operations";
  let state: React.ReactNode = null;
  if (!isPreview && !authReady) state = <AdminState title="Checking your account" message="Please wait while Firebase restores your session." />;
  else if (!isPreview && !user) state = <AdminState title="Admin sign in" message="Use a verified Firebase account listed in the API's ADMIN_FIREBASE_UIDS." action={<Link className="primary-btn" href="/auth?next=/admin">Sign in</Link>} />;
  else if (!isPreview && !user?.emailVerified) state = <AdminState title="Verify your email" message="Verify your Firebase email, then refresh this page. The API requires a verified administrator." action={<Link className="primary-btn" href="/auth?next=/admin">Check verification</Link>} />;
  else if (access === "loading") state = <AdminState title="Checking admin access" message="Validating your account with the HelaCart API." />;
  else if (access === "denied") state = <AdminState title="Access denied" message="This account is not authorized as a HelaCart administrator. Contact the API operator to configure ADMIN_FIREBASE_UIDS." action={<Link className="outline-btn" href="/">Return to storefront</Link>} />;
  else if (access === "error") state = <AdminState title="Could not verify admin access" message={accessError} action={<button className="primary-btn" onClick={retry}>Try again</button>} />;
  return <div className="admin-app">
    <aside className={`admin-sidebar ${open ? "open" : ""}`}>
      <div className="admin-brand"><Brand /><strong>OPERATIONS CORE</strong></div>
      <span className="admin-side-label">{isPreview ? "SAMPLE DATA ACTIVE" : "ADMIN WORKSPACE"}</span>
      <nav aria-label="Admin navigation">{items.map(({ href, title, icon: Icon, section }) => <div key={href}>
        {section && <span className="admin-nav-section">{section}</span>}
        <Link href={href} className={pathname === href ? "active" : ""} onClick={() => setOpen(false)}><Icon size={18} />{title}</Link>
      </div>)}</nav>
      <div className="admin-side-foot"><Link href="/" onClick={() => setOpen(false)}><ExternalLink size={16} /> Visit storefront</Link><Link href="/seller" onClick={() => setOpen(false)}><Store size={16} /> Seller Center</Link>
        {user && <button onClick={() => void signOutBuyer()}><LogOut size={16} /> Sign out</button>}</div>
    </aside>
    {open && <button className="admin-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="admin-main"><header className="admin-top">
      <button className="admin-menu" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      <span className="admin-top-context"><ClipboardList size={17} /> Operations / {activeName}</span>
      <span className="admin-top-spacer" />
      {isPreview && <span className="admin-preview-chip">Sample data</span>}
      <Link href="/" className="admin-top-store">View buyer storefront <ExternalLink size={15} /></Link>
      <span className="admin-top-user"><ShieldCheck size={18} /><span>{user?.email ?? "Admin preview"}<small>{isPreview ? "Design preview" : "Authorized admin"}</small></span></span>
    </header>
      <main className="admin-content">{isPreview && <div className="admin-preview" role="status">Design preview with sample records. Connect the API and sign in with an authorized administrator to make real decisions.</div>}{state ?? children}</main>
    </div>
  </div>;
}

function AdminState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <section className="admin-state"><span><ClipboardCheck size={25} /></span><h1>{title}</h1><p>{message}</p>{action}</section>;
}
