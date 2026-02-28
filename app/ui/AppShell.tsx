"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import MobileHeader from "./MobileHeader";
import styles from "./shell.module.css";

type ThemeMode = "dark" | "light";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("organiza_theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") window.localStorage.setItem("organiza_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  if (isLogin) return <>{children}</>;

  return (
    <div className={styles.shellRoot}>
      <div className={styles.shellLayout}>
        <Sidebar theme={theme} onToggleTheme={toggleTheme} />
        <div className={styles.contentCol}>
          <div className={`${styles.mobileTopbar} ${styles.mobileTopbarHiddenDesktop}`}>
            <MobileHeader theme={theme} onToggleTheme={toggleTheme} />
          </div>
          <main className={styles.mainContent}>{children}</main>
        </div>
      </div>
    </div>
  );
}
