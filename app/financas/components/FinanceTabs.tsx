"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../finance.module.css";

const tabs = [
  { href: "/financas", label: "Dashboard" },
  { href: "/financas/transacoes", label: "Transações" },
  { href: "/financas/contas", label: "Contas" },
  { href: "/financas/cartoes", label: "Cartões" },
  { href: "/financas/dividas", label: "Dívidas" },
  { href: "/financas/metas", label: "Metas" },
  { href: "/financas/relatorios", label: "Relatórios" },
  { href: "/financas/config", label: "Config" },
];

export default function FinanceTabs() {
  const pathname = usePathname();

  return (
    <div className={styles.tabsRow}>
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={active ? styles.tabActive : styles.tabInactive}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
