"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./language-provider";
export function StorefrontRetry() {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="outline-btn"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? t("common.tryingAgain") : t("common.tryAgain")}
    </button>
  );
}
