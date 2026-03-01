// app/ui/MobileMenuDrawer.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

const items = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/files", label: "Arquivos", icon: "📁" },
  { href: "/tasks", label: "Atividades", icon: "✅" },
  { href: "/passwords", label: "Senhas", icon: "🔒" },
  { href: "/calendar", label: "Calendário", icon: "🗓️" },
  { href: "/financas", label: "Finanças", icon: "💲" },
  { href: "/ai", label: "Assistente IA", icon: "✨" },
  { href: "/configuracao", label: "Configuração", icon: "⚙" },
];

export default function MobileMenuDrawer({
  open,
  onClose,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <button
        aria-label="Fechar menu"
        onClick={onClose}
        className={styles.drawerBackdrop}
      />

      {/* drawer */}
      <div className={styles.drawer}>
        <div className={styles.drawerHead}>
          <div className={styles.drawerTitle}>Menu</div>
          <div className={styles.drawerHeadActions}>
            <button type="button" onClick={onToggleTheme} className={styles.drawerThemeBtn}>
              {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            </button>
            <button
              onClick={onClose}
              className={styles.drawerCloseBtn}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className={styles.drawerList}>
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onClose}
                className={[styles.drawerItem, active ? styles.drawerItemActive : ""].join(" ")}
              >
                <span className={styles.iconSoftAlt}>{it.icon}</span>
                <span className={styles.drawerLabel}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
