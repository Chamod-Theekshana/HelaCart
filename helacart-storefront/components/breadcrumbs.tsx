import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumbs"><Link href="/">Home</Link>
    {items.map((item, index) => <span key={index}><ChevronRight size={13} />
      {item.href ? <Link href={item.href}>{item.label}</Link> : <strong>{item.label}</strong>}
    </span>)}
  </nav>;
}
