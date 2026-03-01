"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import styles from "./page.module.css";

function isRefreshTokenFailure(message: string) {
  const m = message.toLowerCase();
  return m.includes("refresh token") || m.includes("57p01");
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Se já estiver logado, manda pro dashboard
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
          setMsg(error.message);
          return;
        }
        if (data.session) router.replace("/");
      } catch (e: unknown) {
        if (!mounted) return;
        const message =
          e instanceof Error
            ? e.message
            : "Falha de conexao com o Supabase. Confira as variaveis no .env.local.";
        if (isRefreshTokenFailure(message)) {
          await supabase.auth.signOut({ scope: "local" });
        }
        setMsg(
          message
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLoginEmail(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      router.replace("/");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupEmail() {
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setMsg("Conta criada! Verifique seu e-mail se a confirmação estiver ativa.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setMsg(null);
    setLoading(true);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
          // Drive: permitir ver/criar/editar/excluir SOMENTE arquivos que o app usar/criar
          scopes:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
          
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) setMsg(error.message);
    } finally {
      // não precisa setLoading(false) aqui porque você vai ser redirecionado
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Organize App</h1>

        <form onSubmit={handleLoginEmail} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Senha</label>
            <input
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Senha"
              autoComplete="current-password"
            />
          </div>

          <div className={styles.actions}>
            <button
              disabled={loading}
              className={styles.secondaryBtn}
              type="submit"
            >
              Entrar
            </button>

            <button
              disabled={loading}
              className={styles.secondaryBtn}
              type="button"
              onClick={handleSignupEmail}
            >
              Criar conta
            </button>
          </div>

          <button
            disabled={loading}
            className={styles.fullBtn}
            type="button"
            onClick={handleGoogleLogin}
          >
            Entrar com Google
          </button>

          {msg && (
            <p className={styles.error}>
              {msg}
            </p>
          )}

          <p className={styles.hint}>
            Aviso: se você não conectar o Google, os arquivos ficam só neste
            computador (sem nuvem).
          </p>
        </form>
      </div>
    </div>
  );
}
