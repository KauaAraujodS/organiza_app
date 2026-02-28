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
  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
