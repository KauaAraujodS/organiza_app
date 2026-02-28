"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import styles from "./page.module.css";

type VaultMasterRow = {
  user_id: string;
  salt: string;
  verifier: string;
};

type VaultRow = {
  id: string;
  user_id: string;
  service: string;
  username: string | null;
  url: string | null;
  category: string | null;
  password_ciphertext: string;
  password_iv: string;
  notes_ciphertext: string | null;
  notes_iv: string | null;
  created_at: string;
  updated_at: string;
};

const PBKDF2_ITERATIONS = 310000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function deriveAesKey(masterPassword: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: concatBytes(salt, new Uint8Array([42])),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function deriveVerifier(masterPassword: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: concatBytes(salt, new Uint8Array([99])),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passKey,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function encryptText(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc);
  return {
    ciphertext: bytesToBase64(new Uint8Array(cipher)),
    iv: bytesToBase64(iv),
  };
}

async function decryptText(key: CryptoKey, ciphertextB64: string, ivB64: string) {
  const cipher = base64ToBytes(ciphertextB64);
  const iv = base64ToBytes(ivB64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

function generatePassword(length = 16) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%*()-_=+[]{}";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i += 1) out += chars[bytes[i] % chars.length];
  return out;
}

type VaultStatus = "checking" | "setup" | "locked" | "unlocked";

export default function PasswordsPage() {
  const router = useRouter();
  const keyRef = useRef<CryptoKey | null>(null);

  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<VaultStatus>("checking");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [masterSalt, setMasterSalt] = useState("");
  const [masterVerifier, setMasterVerifier] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [masterPasswordConfirm, setMasterPasswordConfirm] = useState("");

  const [rows, setRows] = useState<VaultRow[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todas");

  const { categories, filteredRows } = useMemo(() => {
    const unique = new Set<string>();
    const filtered: VaultRow[] = [];

    for (const row of rows) {
      const cat = (row.category || "").trim();
      if (cat) unique.add(cat);
      if (activeCategory === "Todas" || cat === activeCategory) filtered.push(row);
    }

    return {
      categories: ["Todas", ...Array.from(unique)],
      filteredRows: filtered,
    };
  }, [activeCategory, rows]);

  async function loadVaultRows(uid: string) {
    const { data, error } = await supabase
      .from("password_vault")
      .select(
        "id,user_id,service,username,url,category,password_ciphertext,password_iv,notes_ciphertext,notes_iv,created_at,updated_at"
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setRows((data || []) as VaultRow[]);
    setVisiblePasswords({});
  }

  async function initialize() {
    setLoading(true);
    setMsg("");
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }
      setUserId(uid);

      const { data: master, error: masterErr } = await supabase
        .from("vault_master")
        .select("user_id,salt,verifier")
        .eq("user_id", uid)
        .maybeSingle();

      if (masterErr) throw masterErr;
      if (!master) {
        setStatus("setup");
      } else {
        const row = master as VaultMasterRow;
        setMasterSalt(row.salt);
        setMasterVerifier(row.verifier);
        setStatus("locked");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao inicializar cofre.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        keyRef.current = null;
        setRows([]);
        setVisiblePasswords({});
        router.replace("/login");
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [router]);

  function resetForm() {
    setEditingId(null);
    setService("");
    setUsername("");
    setPassword("");
    setUrl("");
    setCategory("");
    setNotes("");
  }

  async function handleSetupMasterPassword(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (masterPassword.length < 8) {
      setMsg("Use uma senha mestra com pelo menos 8 caracteres.");
      return;
    }
    if (masterPassword !== masterPasswordConfirm) {
      setMsg("A confirmação da senha mestra não confere.");
      return;
    }

    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = bytesToBase64(salt);
      const verifier = await deriveVerifier(masterPassword, salt);

      const { error } = await supabase.from("vault_master").upsert(
        {
          user_id: userId,
          salt: saltB64,
          verifier,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;

      keyRef.current = await deriveAesKey(masterPassword, salt);
      setMasterSalt(saltB64);
      setMasterVerifier(verifier);
      setMasterPassword("");
      setMasterPasswordConfirm("");
      setStatus("unlocked");
      await loadVaultRows(userId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao configurar senha mestra.");
    }
  }

  async function handleUnlockVault(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const salt = base64ToBytes(masterSalt);
      const verifier = await deriveVerifier(masterPassword, salt);
      if (verifier !== masterVerifier) {
        setMsg("Senha mestra incorreta.");
        return;
      }
      keyRef.current = await deriveAesKey(masterPassword, salt);
      setMasterPassword("");
      setStatus("unlocked");
      await loadVaultRows(userId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao desbloquear cofre.");
    }
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!keyRef.current) {
      setMsg("Cofre bloqueado. Desbloqueie novamente.");
      return;
    }
    if (!service.trim()) {
      setMsg("Serviço é obrigatório.");
      return;
    }
    if (!password) {
      setMsg("Senha é obrigatória.");
      return;
    }

    setSaving(true);
    try {
      const enc = await encryptText(keyRef.current, password);
      const notesTrim = notes.trim();
      const notesEnc = notesTrim ? await encryptText(keyRef.current, notesTrim) : null;

      const payload = {
        service: service.trim(),
        username: username.trim() || null,
        url: url.trim() || null,
        category: category.trim() || null,
        password_ciphertext: enc.ciphertext,
        password_iv: enc.iv,
        notes_ciphertext: notesEnc?.ciphertext ?? null,
        notes_iv: notesEnc?.iv ?? null,
      };

      const { error } = editingId
        ? await supabase
            .from("password_vault")
            .update(payload)
            .eq("user_id", userId)
            .eq("id", editingId)
        : await supabase.from("password_vault").insert({
            user_id: userId,
            ...payload,
          });
      if (error) throw error;

      resetForm();
      setOpenForm(false);
      await loadVaultRows(userId);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar senha.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditRow(row: VaultRow) {
    if (!keyRef.current) {
      setMsg("Cofre bloqueado. Desbloqueie novamente.");
      return;
    }

    try {
      const plainPass = await decryptText(keyRef.current, row.password_ciphertext, row.password_iv);
      const plainNotes =
        row.notes_ciphertext && row.notes_iv
          ? await decryptText(keyRef.current, row.notes_ciphertext, row.notes_iv)
          : "";
      setEditingId(row.id);
      setService(row.service);
      setUsername(row.username || "");
      setPassword(plainPass);
      setUrl(row.url || "");
      setCategory(row.category || "");
      setNotes(plainNotes);
      setOpenForm(true);
    } catch {
      setMsg("Falha ao abrir item para edição.");
    }
  }

  async function toggleRevealPassword(row: VaultRow) {
    if (!keyRef.current) {
      setMsg("Cofre bloqueado. Desbloqueie novamente.");
      return;
    }

    if (visiblePasswords[row.id]) {
      setVisiblePasswords((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }

    try {
      const plain = await decryptText(keyRef.current, row.password_ciphertext, row.password_iv);
      setVisiblePasswords((prev) => ({ ...prev, [row.id]: plain }));
    } catch {
      setMsg("Não foi possível descriptografar esta senha.");
    }
  }

  async function copyPassword(row: VaultRow) {
    if (!keyRef.current) {
      setMsg("Cofre bloqueado. Desbloqueie novamente.");
      return;
    }
    try {
      const plain = visiblePasswords[row.id]
        ? visiblePasswords[row.id]
        : await decryptText(keyRef.current, row.password_ciphertext, row.password_iv);
      await navigator.clipboard.writeText(plain);
      setMsg("Senha copiada.");
    } catch {
      setMsg("Falha ao copiar senha.");
    }
  }

  async function removeRow(row: VaultRow) {
    setMsg("");
    if (!confirm(`Excluir senha de ${row.service}?`)) return;
    const { error } = await supabase
      .from("password_vault")
      .delete()
      .eq("user_id", userId)
      .eq("id", row.id);
    if (error) {
      setMsg(error.message);
      return;
    }
    await loadVaultRows(userId);
  }

  function lockVault() {
    keyRef.current = null;
    setVisiblePasswords({});
    resetForm();
    setOpenForm(false);
    setStatus("locked");
    setMasterPassword("");
  }

  if (loading || status === "checking") {
    return <div className={styles.loading}>Carregando cofre...</div>;
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gerenciador de Senhas</h1>
          <p className={styles.subtitle}>Cofre criptografado com backup no Supabase.</p>
        </div>
        <div className={styles.actions}>
          {status === "unlocked" ? (
            <button
              onClick={lockVault}
              className={styles.btnSecondary}
              type="button"
            >
              Bloquear
            </button>
          ) : null}
          <button
            onClick={() => {
              if (openForm) {
                resetForm();
              }
              setOpenForm((v) => !v);
            }}
            disabled={status !== "unlocked"}
            className={styles.btnPrimary}
            type="button"
          >
            + Nova Senha
          </button>
        </div>
      </div>

      {status === "setup" ? (
        <form
          onSubmit={handleSetupMasterPassword}
          className={[styles.card, styles.cardNarrow].join(" ")}
        >
          <h2 className={styles.h2}>Configurar Senha Mestra</h2>
          <p className={styles.help}>
            Essa senha é usada para criptografar/descriptografar. Ela não é armazenada em texto.
          </p>
          <div className={styles.field}>
            <label className={styles.label}>Senha Mestra</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className={styles.input}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Confirmar Senha Mestra</label>
            <input
              type="password"
              value={masterPasswordConfirm}
              onChange={(e) => setMasterPasswordConfirm(e.target.value)}
              className={styles.input}
            />
          </div>
          <button
            type="submit"
            className={styles.btnPrimary}
          >
            Criar Cofre
          </button>
        </form>
      ) : null}

      {status === "locked" ? (
        <form
          onSubmit={handleUnlockVault}
          className={[styles.card, styles.cardNarrow].join(" ")}
        >
          <h2 className={styles.h2}>Desbloquear Cofre</h2>
          <div className={styles.field}>
            <label className={styles.label}>Senha Mestra</label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className={styles.input}
              placeholder="Digite sua senha mestra"
            />
          </div>
          <button
            type="submit"
            className={styles.btnPrimary}
          >
            Desbloquear
          </button>
        </form>
      ) : null}

      {status === "unlocked" && openForm ? (
        <form onSubmit={handleSavePassword} className={styles.card}>
          <h3 className={styles.h3}>{editingId ? "Editar Senha" : "Nova Senha"}</h3>
          <div className={styles.field}>
            <label className={styles.label}>Serviço</label>
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              className={styles.input}
              placeholder="Ex: Gmail"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Nome de Usuário / Email</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              placeholder="Ex: usuario@email.com"
            />
          </div>
          <div className={styles.row}>
            <div className={styles.grow}>
              <label className={styles.label}>Senha</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Digite a senha"
              />
            </div>
            <button
              type="button"
              onClick={() => setPassword(generatePassword(16))}
              className={[styles.btnSecondary, styles.btnGenerate].join(" ")}
            >
              Gerar
            </button>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>URL (opcional)</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={styles.input}
              placeholder="https://..."
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Categoria</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={styles.input}
              placeholder="Ex: email"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={styles.textarea}
              placeholder="Observações adicionais"
            />
          </div>
          <div className={styles.rowActions}>
            <button
              type="submit"
              disabled={saving}
              className={styles.btnPrimary}
            >
              {saving ? "Salvando..." : "Salvar Senha"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenForm(false);
                resetForm();
              }}
              className={styles.btnSecondary}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {status === "unlocked" ? (
        <>
          <div className={styles.categories}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={[
                  styles.categoryBtn,
                  activeCategory === cat ? styles.categoryBtnActive : "",
                ].join(" ")}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.list}>
            {filteredRows.map((row) => (
              <div key={row.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <div className={styles.itemTitle}>{row.service}</div>
                    {row.category ? (
                      <span className={styles.chip}>
                        {row.category}
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => removeRow(row)}
                    className={styles.dangerGhost}
                    title="Excluir"
                  >
                    🗑
                  </button>
                </div>

                <div className={styles.itemBody}>
                  <div className={styles.line}>
                    <span className={styles.lineLabel}>Usuário:</span>
                    <div className={styles.lineValue}>
                      <span>{row.username || "—"}</span>
                      {row.username ? (
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(row.username || "")}
                          className={styles.ghostIcon}
                          title="Copiar usuário"
                        >
                          ⧉
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.line}>
                    <span className={styles.lineLabel}>Senha:</span>
                    <div className={styles.lineValue}>
                      <span>{visiblePasswords[row.id] || "••••••••••••"}</span>
                      <button
                        type="button"
                        onClick={() => toggleRevealPassword(row)}
                        className={styles.ghostIcon}
                        title="Exibir/ocultar senha"
                      >
                        👁
                      </button>
                      <button
                        type="button"
                        onClick={() => copyPassword(row)}
                        className={styles.ghostIcon}
                        title="Copiar senha"
                      >
                        ⧉
                      </button>
                    </div>
                  </div>
                  {row.url ? (
                    <div className={styles.line}>
                      <span className={styles.lineLabel}>URL:</span>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.link}
                      >
                        {row.url}
                      </a>
                    </div>
                  ) : null}
                  <div className={styles.itemFooter}>
                    <button
                      type="button"
                      onClick={() => handleEditRow(row)}
                      className={styles.btnSmall}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredRows.length === 0 ? (
              <div className={styles.empty}>
                Nenhuma senha salva.
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {msg ? <div className={styles.error}>{msg}</div> : null}
    </main>
  );
}
