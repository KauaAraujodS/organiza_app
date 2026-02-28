// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import type { Viewport } from "next";
import AuthGate from "./ui/AuthGate";
import AppShell from "./ui/AppShell";

export const metadata: Metadata = {
  title: "OrganizaApp",
  description: "Sua vida organizada",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeBootScript = `
    (function () {
      try {
        var saved = localStorage.getItem('organiza_theme');
        var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        var theme = saved === 'light' || saved === 'dark' ? saved : (prefersLight ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', theme);
      } catch (_) {}
    })();
  `;

  return (
    <html lang="pt-BR">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
