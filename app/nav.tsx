"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/import", label: "Import" },
  { href: "/reports", label: "Reports" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="nav">
      <Link href="/" className="brand">
        Budget
      </Link>
      <nav>
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
