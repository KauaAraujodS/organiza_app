// app/ui/MobileHeader.tsx
"use client";

import { useState } from "react";
import MobileMenuDrawer from "./MobileMenuDrawer";
import styles from "./shell.module.css";

export default function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.mobileHeader}>
      <div className={styles.mobileBrand}>
        <div className={styles.mobileBrandIcon}>
          ✦
        </div>
        <div>
          <div className={styles.mobileBrandName}>OrganizaApp</div>
          <div className={styles.mobileBrandSub}>Sua vida organizada</div>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className={styles.mobileMenuBtn}
      >
        {open ? "Fechar" : "Menu"}
      </button>

      <MobileMenuDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
