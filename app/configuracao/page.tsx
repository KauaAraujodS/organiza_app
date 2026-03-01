"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getDisplayNameFromUser } from "../lib/profile";
import styles from "./page.module.css";

type ProfileState = {
  email: string;
  userId: string;
  lastSignIn: string;
  hasGoogleProvider: boolean;
  providerAvatar: string;
  hideAvatar: boolean;
};

type IntegrationState = {
  googleConnected: boolean;
  supabaseConnected: boolean;
};

const GOOGLE_TOKEN_KEY = "organiza_google_token";
const CACHE_KEYS = [
  "organiza_dashboard_cache_v1",
  "organiza_drive_root_id",
];

export default function ConfiguracaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState<ProfileState>({
    email: "-",
    userId: "-",
    lastSignIn: "-",
    hasGoogleProvider: false,
    providerAvatar: "",
    hideAvatar: false,
  });
  const [integrations, setIntegrations] = useState<IntegrationState>({
    googleConnected: false,
    supabaseConnected: false,
  });
  const [displayName, setDisplayName] = useState("");
  const [customAvatarData, setCustomAvatarData] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPasswordConfirm, setLoginPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const activeAvatar = profile.hideAvatar ? "" : customAvatarData || profile.providerAvatar || "";

  async function fileToOptimizedDataUrl(file: File) {
    const fileBuffer = await file.arrayBuffer();
    const blob = new Blob([fileBuffer], { type: file.type || "image/jpeg" });
    const imageBitmap = await createImageBitmap(blob);

    const maxSide = 320;
    const scale = Math.min(1, maxSide / Math.max(imageBitmap.width, imageBitmap.height));
    const width = Math.max(1, Math.round(imageBitmap.width * scale));
    const height = Math.max(1, Math.round(imageBitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Falha ao processar imagem.");
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 200_000) {
      throw new Error("Imagem muito grande. Use uma foto menor.");
    }
    return dataUrl;
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = data.session?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        const googleRaw = localStorage.getItem(GOOGLE_TOKEN_KEY);
        const googleConnected = Boolean(googleRaw);

        const lastSignIn = user.last_sign_in_at
          ? new Date(user.last_sign_in_at).toLocaleString("pt-BR")
          : "-";
        const providers = Array.isArray(user.app_metadata?.providers)
          ? (user.app_metadata.providers as string[])
          : [];
        const hasGoogleProvider = providers.includes("google");
        const providerAvatar =
          typeof user.user_metadata?.picture === "string"
            ? user.user_metadata.picture
            : typeof user.user_metadata?.avatar_url === "string"
              ? user.user_metadata.avatar_url
              : "";
        const existingCustomAvatar =
          typeof user.user_metadata?.custom_avatar_data === "string"
            ? user.user_metadata.custom_avatar_data
            : "";
        const hideAvatar = Boolean(user.user_metadata?.hide_avatar);

        setProfile({
          email: user.email || "-",
          userId: user.id || "-",
          lastSignIn,
          hasGoogleProvider,
          providerAvatar,
          hideAvatar,
        });
        setDisplayName(getDisplayNameFromUser(user));
        setCustomAvatarData(existingCustomAvatar);
        setIntegrations({
          googleConnected,
          supabaseConnected: true,
        });
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleSetLoginPassword() {
    setMsg("");
    if (loginPassword.length < 8) {
      setMsg("Use uma senha com no mínimo 8 caracteres.");
      return;
    }
    if (loginPassword !== loginPasswordConfirm) {
      setMsg("A confirmação da senha não confere.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: loginPassword });
      if (error) throw error;
      setLoginPassword("");
      setLoginPasswordConfirm("");
      setMsg("Senha de acesso configurada com sucesso. Agora você pode entrar com email e senha.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao configurar senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveProfile() {
    setMsg("");
    const cleanName = displayName.trim();

    if (!cleanName) {
      setMsg("Informe um nome para o perfil.");
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: cleanName,
          custom_avatar_data: customAvatarData || null,
          hide_avatar: profile.hideAvatar,
        },
      });
      if (error) throw error;
      setMsg("Perfil atualizado com sucesso.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao atualizar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarFileChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Selecione um arquivo de imagem válido.");
      return;
    }

    try {
      setMsg("");
      const optimized = await fileToOptimizedDataUrl(file);
      setCustomAvatarData(optimized);
      setProfile((prev) => ({ ...prev, hideAvatar: false }));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao processar imagem.");
    }
  }

  async function applyAvatarMode(next: "provider" | "none") {
    setMsg("");
    const hideAvatar = next === "none";

    if (next === "provider") {
      setCustomAvatarData("");
    } else {
      setCustomAvatarData("");
    }

    setProfile((prev) => ({ ...prev, hideAvatar }));
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim() || "Usuário",
          custom_avatar_data: null,
          hide_avatar: hideAvatar,
        },
      });
      if (error) throw error;
      setMsg(
        next === "provider"
          ? "Foto padrão da conta aplicada."
          : "Perfil definido para ficar sem foto."
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao atualizar foto de perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  function clearLocalCache() {
    CACHE_KEYS.forEach((k) => sessionStorage.removeItem(k));
    CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    setMsg("Cache local limpo com sucesso.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Configuração</h1>
          <span className={styles.headerPill}>Conta Global</span>
        </div>
        <p className={styles.subtitle}>Configurações gerais da conta e preferências globais do aplicativo.</p>
      </header>

      <section className={styles.grid}>
        <article className={`${styles.card} ${styles.profileCard}`}>
          <h2 className={styles.cardTitle}>Perfil</h2>
          <div className={styles.profileRow}>
            <div className={styles.avatarPreview}>
              {activeAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeAvatar} alt="Foto de perfil" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarFallback}>
                  {(displayName || "U").trim().slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className={styles.profileFields}>
              <p className={styles.profileHint}>Como o app e a IA devem te chamar no dia a dia.</p>
              <label className={styles.inputWrap}>
                <span className={styles.kvLabel}>Nome</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={styles.input}
                  placeholder="Como prefere ser chamado"
                />
              </label>

              <label className={styles.inputWrap}>
                <span className={styles.kvLabel}>Foto de perfil (arquivo opcional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleAvatarFileChange(file);
                    e.currentTarget.value = "";
                  }}
                  className={styles.input}
                />
              </label>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Salvando..." : "Salvar perfil"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    void applyAvatarMode("provider");
                  }}
                  disabled={savingProfile}
                >
                  Usar foto padrão da conta
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    void applyAvatarMode("none");
                  }}
                  disabled={savingProfile}
                >
                  Ficar sem foto
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className={`${styles.card} ${styles.accountCard}`}>
          <h2 className={styles.cardTitle}>Conta</h2>
          {loading ? (
            <p className={styles.muted}>Carregando dados da conta...</p>
          ) : (
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Email</span>
                <span className={styles.kvValue}>{profile.email}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>ID do usuário</span>
                <span className={styles.kvValue}>{profile.userId}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Último login</span>
                <span className={styles.kvValue}>{profile.lastSignIn}</span>
              </div>
            </div>
          )}
        </article>

        <article className={`${styles.card} ${styles.globalCard}`}>
          <h2 className={styles.cardTitle}>Configurações Globais</h2>
          <div className={styles.kvList}>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Fuso horário</span>
              <span className={styles.kvValue}>{timezone}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Idioma padrão</span>
              <span className={styles.kvValue}>Português (Brasil)</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Tema</span>
              <span className={styles.kvValue}>Controlado pelo botão de tema do menu</span>
            </div>
          </div>
        </article>

        <article className={`${styles.card} ${styles.integrationCard}`}>
          <h2 className={styles.cardTitle}>Integrações</h2>
          <div className={styles.integrationList}>
            <div className={styles.integrationItem}>
              <span>Google (Agenda/Drive)</span>
              <span className={integrations.googleConnected ? styles.ok : styles.warn}>
                {integrations.googleConnected ? "Conectado" : "Não conectado"}
              </span>
            </div>
            <div className={styles.integrationItem}>
              <span>Supabase</span>
              <span className={integrations.supabaseConnected ? styles.ok : styles.warn}>
                {integrations.supabaseConnected ? "Conectado" : "Não conectado"}
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className={`${styles.card} ${styles.securityCard}`}>
        <h2 className={styles.cardTitle}>Acesso por email e senha</h2>
        {profile.hasGoogleProvider ? (
          <>
            <p className={styles.help}>
              Você já conectou sua conta Google. Se definir uma senha abaixo, poderá entrar depois apenas com
              <strong> o mesmo email do Google + senha</strong>, sem clicar em &quot;Entrar com Google&quot; toda vez.
            </p>
            <div className={styles.passwordGrid}>
              <label className={styles.inputWrap}>
                <span className={styles.kvLabel}>Nova senha</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Mínimo 8 caracteres"
                />
              </label>
              <label className={styles.inputWrap}>
                <span className={styles.kvLabel}>Confirmar senha</span>
                <input
                  type="password"
                  value={loginPasswordConfirm}
                  onChange={(e) => setLoginPasswordConfirm(e.target.value)}
                  className={styles.input}
                  placeholder="Repita a senha"
                />
              </label>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={handleSetLoginPassword}
                disabled={savingPassword}
                className={styles.primaryBtn}
              >
                {savingPassword ? "Salvando..." : "Salvar senha de acesso"}
              </button>
            </div>
          </>
        ) : (
          <p className={styles.help}>
            Esta opção aparece após o primeiro login com Google.
          </p>
        )}
      </section>

      <section className={`${styles.actionsCard} ${styles.toolsCard}`}>
        <h2 className={styles.cardTitle}>Ações</h2>
        <div className={styles.actions}>
          <button type="button" onClick={clearLocalCache} className={styles.secondaryBtn}>
            Limpar cache local
          </button>
          <button type="button" onClick={handleLogout} className={styles.dangerBtn}>
            Sair da conta
          </button>
        </div>
      </section>

      {msg ? <p className={styles.feedback}>{msg}</p> : null}
    </main>
  );
}
