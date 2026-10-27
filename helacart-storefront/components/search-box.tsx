"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { api, hasApi } from "@/lib/api";
import s from "./discovery.module.css";
type Suggestions = {
  products: {
    id: string;
    title: string;
    category: { name: string; slug: string };
    seller: { name: string };
  }[];
  categories: { name: string; slug: string }[];
};
export function SearchBox({ mobile = false }: { mobile?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<{ q: string; data: Suggestions | null }>({
    q: "",
    data: null,
  });
  const router = useRouter(),
    id = useId();
  useEffect(() => {
    if (!hasApi || q.trim().length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      api<Suggestions>(
        `/discovery/suggestions?q=${encodeURIComponent(q.trim())}`,
      )
        .then((data) => {
          if (live) setState({ q, data });
        })
        .catch(() => {
          if (live) setState({ q, data: null });
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);
  const result = state.q === q ? state.data : null;
  const links = [
    ...(result?.products.map((p) => ({
      href: `/products/${p.id}`,
      label: p.title,
      detail: `${p.category.name} · ${p.seller.name}`,
    })) ?? []),
    ...(result?.categories.map((c) => ({
      href: `/products?category=${encodeURIComponent(c.slug)}`,
      label: c.name,
      detail: "Browse category",
    })) ?? []),
    {
      href: `/products?q=${encodeURIComponent(q.trim())}&sort=relevance`,
      label: `Search for “${q.trim()}”`,
      detail: "All matching products",
    },
  ];
  const show = open && q.trim().length >= 2;
  return (
    <form
      action="/products"
      className={`${mobile ? "mobile-search container" : "site-search"} ${s.search}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <Search size={19} aria-hidden="true" />
      <input
        name="q"
        maxLength={80}
        autoComplete="off"
        aria-label="Search products"
        placeholder="Search for your next good find"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        role="combobox"
        aria-expanded={show}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={
          show && active >= 0 ? `${id}-${active}` : undefined
        }
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
          if (
            (e.key === "ArrowDown" || e.key === "ArrowUp") &&
            q.trim().length >= 2
          ) {
            e.preventDefault();
            setOpen(true);
            setActive((a) =>
              e.key === "ArrowDown"
                ? (a + 1) % links.length
                : a <= 0
                  ? links.length - 1
                  : a - 1,
            );
          }
          if (e.key === "Enter" && show && active >= 0) {
            e.preventDefault();
            router.push(links[active].href);
            setOpen(false);
          }
        }}
      />
      <input type="hidden" name="sort" value="relevance" />
      <button type="submit">Search</button>
      {show && (
        <div
          id={id}
          className={s.suggestions}
          role="listbox"
          aria-label="Search suggestions"
        >
          {links.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              role="option"
              aria-selected={active === index}
              id={`${id}-${index}`}
              data-active={active === index}
              onClick={() => setOpen(false)}
            >
              {link.label}
              <small>{link.detail}</small>
            </Link>
          ))}
        </div>
      )}
    </form>
  );
}
