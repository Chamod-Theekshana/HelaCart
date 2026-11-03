"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signInHref } from "@/lib/favorites";

/** `/auth?next=<current path>` for the page being rendered (query added on click). */
export function useSignInHref(next?: string) {
  const pathname = usePathname();
  return signInHref(next ?? pathname ?? "/");
}

/**
 * Link to the sign-in page that returns to the current page (path + query) or
 * to an explicit `next` path after sign-in.
 */
export function SignInLink({
  next,
  className,
  children,
  ariaLabel,
}: {
  next?: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const href = useSignInHref(next);
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (
          next ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        // Include the live query string (filters, ?order=…) at click time.
        event.preventDefault();
        router.push(
          signInHref(`${window.location.pathname}${window.location.search}`),
        );
      }}
    >
      {children}
    </Link>
  );
}
