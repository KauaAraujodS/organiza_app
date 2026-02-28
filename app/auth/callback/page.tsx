// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { saveGoogleToken } from "../../lib/googleToken";

type ProviderSession = {
  provider_token?: string;
  provider_refresh_token?: string;
  expires_at?: number;
};

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        // garante que o supabase finalize a sessão (troca o code por session)
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          router.replace("/login");
          return;
        }

        const session = data.session as ProviderSession;
        const accessToken = session.provider_token;
        const refreshToken = session.provider_refresh_token;
        const expiresAt = session.expires_at;

        // Se o login foi com Google e o token veio, salva
        if (accessToken) {
          saveGoogleToken({
            accessToken,
            refreshToken,
            expiresAt,
          });
        }

        // volta pra home (ou /files depois)
        router.replace("/");
      } catch {
        router.replace("/login");
        return;
      }
    };

    run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-sm opacity-80">Finalizando login…</div>
    </div>
  );
}
