
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { getAvatarUrlFromUser, getDisplayNameFromUser } from "@/app/lib/profile";
import styles from "./shell.module.css";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type SidebarProps = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[styles.navItem, active ? styles.navItemActive : ""].join(" ")}
    >
      <span className={styles.iconSoft}>{icon}</span>
      <span className={styles.navLabel}>{label}</span>
    </Link>
  );
}

export default function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Usuário");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    async function syncProfileFromSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      setDisplayName(getDisplayNameFromUser(user));
      setAvatarUrl(getAvatarUrlFromUser(user));
    }

    void syncProfileFromSession();
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      void syncProfileFromSession();
    });
    const onFocus = () => {
      void syncProfileFromSession();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      authSub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const items: Item[] = [
    {
      href: "/",
      label: "Dashboard",
      icon: (
        <span className="text-sm" aria-hidden>
          ▦
        </span>
      ),
    },
    {
      href: "/files",
      label: "Arquivos",
      icon: (
        <span className="text-sm" aria-hidden>
          📁
        </span>
      ),
    },
    {
      href: "/tasks",
      label: "Atividades",
      icon: (
        <span className="text-sm" aria-hidden>
          ☑
        </span>
      ),
    },
    {
      href: "/passwords",
      label: "Senhas",
      icon: (
        <span className="text-sm" aria-hidden>
          🔒
        </span>
      ),
    },
    {
      href: "/calendar",
      label: "Calendário",
      icon: (
        <span className="text-sm" aria-hidden>
          🗓
        </span>
      ),
    },
    {
      href: "/financas",
      label: "Finanças",
      icon: (
        <span className="text-sm" aria-hidden>
          💲
        </span>
      ),
    },
    {
      href: "/ai",
      label: "Assistente IA",
      icon: (
        <span className="text-sm" aria-hidden>
          ✨
        </span>
      ),
    },
    {
      href: "/configuracao",
      label: "Configuração",
      icon: (
        <span className="text-sm" aria-hidden>
          ⚙
        </span>
      ),
    },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Foto de perfil" className={styles.brandAvatar} />
          ) : (
            <span className={styles.brandGlyph} aria-hidden>
              {displayName.slice(0, 1).toUpperCase() || "U"}
            </span>
          )}
        </div>
        <div>
          <div className={styles.brandName}>{displayName}</div>
          <div className={styles.brandSub}>Conta pessoal</div>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {items.map((it) => (
          <NavItem
            key={it.href}
            href={it.href}
            label={it.label}
            icon={it.icon}
            active={isActive(it.href)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <button
          className={styles.footerBtn}
          type="button"
          onClick={onToggleTheme}
        >
          <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
          <span className={styles.footerText}>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
        </button>

        <button
          onClick={handleLogout}
          className={styles.footerBtn}
          type="button"
        >
          <span aria-hidden>⎋</span>
          <span className={styles.footerText}>Sair</span>
        </button>
      </div>
    </aside>
  );
}
