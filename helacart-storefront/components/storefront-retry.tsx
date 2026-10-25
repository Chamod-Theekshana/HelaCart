"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function StorefrontRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="outline-btn"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Trying again..." : "Try again"}
    </button>
  );
}
