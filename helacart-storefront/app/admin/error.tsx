"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

export default function AdminError({
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
    <section className="admin-state" role="alert">
      <span>
        <ClipboardCheck size={25} />
      </span>
      <h1>This admin page failed to load</h1>
      <p>
        An unexpected error occurred. No changes were made. Try again or go back
        to the operations overview.
        {error.digest ? ` Reference: ${error.digest}` : ""}
      </p>
      <div className="inline-actions">
        <button className="primary-btn" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="outline-btn" href="/admin">
          Operations overview
        </Link>
      </div>
    </section>
  );
}
