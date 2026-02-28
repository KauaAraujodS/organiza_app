"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import MobileHeader from "./MobileHeader";
import styles from "./shell.module.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) return <>{children}</>;

  return (
    <div className={styles.shellRoot}>
      <div className={styles.shellLayout}>
        <Sidebar />
        <div className={styles.contentCol}>
          <div className={`${styles.mobileTopbar} ${styles.mobileTopbarHiddenDesktop}`}>
            <MobileHeader />
          </div>
          <main className={styles.mainContent}>{children}</main>
        </div>
      </div>
    </div>
  );
}
