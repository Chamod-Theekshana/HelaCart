"use client";
import Link from "next/link";
import { useShop } from "@/components/shop-provider";
import { useBuyerAfterSalesRequest } from "@/components/after-sales-client";
import { SupportWorkspace } from "@/components/support-workspace";
import { Breadcrumbs } from "@/components/breadcrumbs";
export default function UserSupportScreen() {
  const { user, isPreview, authReady } = useShop(),
    request = useBuyerAfterSalesRequest();
  return (
    <div className="container account-page">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "Support" },
        ]}
      />
      <div className="page-title">
        <div>
          <span className="section-kicker">WE’RE HERE TO HELP</span>
          <h1>Support & help</h1>
          <p>
            Ask a question, follow replies and resolve order issues with
            HelaCart.
          </p>
        </div>
        <Link href="/orders" className="outline-btn">
          Your orders
        </Link>
      </div>
      {!isPreview && !authReady ? (
        <p>Checking your account…</p>
      ) : !isPreview && !user ? (
        <div className="panel empty-panel">
          <Link href="/auth?next=/account/support" className="primary-btn">
            Sign in for support
          </Link>
        </div>
      ) : !isPreview && !user?.emailVerified ? (
        <div className="panel empty-panel">
          <Link href="/auth?next=/account/support">
            Verify your email to use support.
          </Link>
        </div>
      ) : (
        <SupportWorkspace
          key={user?.uid ?? "preview"}
          root="/me/after-sales"
          role="BUYER"
          request={request}
          isPreview={isPreview}
        />
      )}
    </div>
  );
}
