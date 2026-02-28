"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

function isRefreshTokenFailure(message: string) {
  const m = message.toLowerCase();
  return m.includes("refresh token") || m.includes("57p01");
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          if (isRefreshTokenFailure(error.message)) {
            await supabase.auth.signOut({ scope: "local" });
          }
          setAuthError(error.message);
          setAuthed(false);
          setLoading(false);
          if (pathname !== "/login") router.replace("/login");
          return;
        }

        const ok = !!data.session;
        setAuthed(ok);
        setLoading(false);

        // se não estiver logado e não estiver no /login, manda pro login
        if (!ok && pathname !== "/login") router.replace("/login");
        // se estiver logado e estiver no /login, manda pro dashboard
        if (ok && pathname === "/login") router.replace("/");
      } catch (e: unknown) {
        if (!mounted) return;
        const message =
          e instanceof Error ? e.message : "Falha de conexao com o Supabase.";
        if (isRefreshTokenFailure(message)) {
          await supabase.auth.signOut({ scope: "local" });
        }
        setAuthError(message);
        setAuthed(false);
        setLoading(false);
        if (pathname !== "/login") router.replace("/login");
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const ok = !!session;
      setAuthed(ok);

      if (!ok && pathname !== "/login") router.replace("/login");
      if (ok && pathname === "/login") router.replace("/");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  // Enquanto checa sessão, evita piscar sidebar/telas
  if (loading) return null;

  if (authError && pathname === "/login") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-100">
          <h2 className="text-lg font-semibold mb-2">Erro de conexao com Supabase</h2>
          <p className="text-sm whitespace-pre-wrap">
            {authError}
            {"\n\n"}
            Verifique `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`.
          </p>
        </div>
      </div>
    );
  }

  // Se não logado, não renderiza nada aqui (o /login vai aparecer)
  if (!authed && pathname !== "/login") return null;

  return <>{children}</>;
}
