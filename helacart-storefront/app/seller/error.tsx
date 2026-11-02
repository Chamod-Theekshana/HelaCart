"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SellerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="seller-state" role="alert">
      <span className="section-kicker">SELLER CENTER</span>
      <h1>This page could not be displayed</h1>
      <p>
        Something went wrong while loading your store workspace. Your orders and
        products are not affected. Try again, or return to the overview.
      </p>
      {error.digest && (
        <p className="seller-muted">Reference: {error.digest}</p>
      )}
      <div className="inline-actions">
        <button className="primary-btn" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="outline-btn" href="/seller">
          Seller overview
        </Link>
      </div>
    </div>
  );
}
