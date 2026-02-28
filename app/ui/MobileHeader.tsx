// app/ui/MobileHeader.tsx
"use client";

import { useState } from "react";
import MobileMenuDrawer from "./MobileMenuDrawer";
import styles from "./shell.module.css";

export default function MobileHeader({
  theme,
  onToggleTheme,
}: {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.mobileHeader}>
      <div className={styles.mobileBrand}>
        <div className={styles.mobileBrandIcon}>✦</div>
        <div>
          <div className={styles.mobileBrandName}>OrganizaApp</div>
          <div className={styles.mobileBrandSub}>Sua vida organizada</div>
        </div>
      </div>

      <div className={styles.mobileActions}>
        <button type="button" onClick={onToggleTheme} className={styles.mobileThemeBtn}>
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button onClick={() => setOpen((v) => !v)} className={styles.mobileMenuBtn}>
          {open ? "Fechar" : "Menu"}
        </button>
      </div>

      <MobileMenuDrawer
        open={open}
        onClose={() => setOpen(false)}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </div>
  );
}
