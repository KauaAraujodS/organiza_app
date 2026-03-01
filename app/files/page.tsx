"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EditDriveItemModal, { DriveEditValues } from "../api/ui/EditDriveItemModal";
import { getValidAccessToken } from "../lib/googleToken";
import { supabase } from "../lib/supabase";
import ModalShell from "../ui/ModalShell";
import styles from "./page.module.css";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  iconLink?: string;
};

type MetaRow = {
  drive_id: string;
  kind: "folder" | "file";
  name: string | null;
  parent_drive_id: string | null;
  color: string | null;
  is_locked: boolean | null;
  password_hash: string | null;
  author: string | null;
  priority: "Baixa" | "Média" | "Alta" | null;
  icon_emoji: string | null;
};

type DriveCardView = {
  item: DriveItem;
  icon: string;
  prio: string;
  cardBg: string;
  cardBorder: string;
  softBg: string;
  softBorder: string;
  author: string | null;
  locked: boolean;
};

type DesktopOpenPayload = {
  fileId: string;
  fileName: string;
  mimeType: string;
  accessToken: string;
  webViewLink?: string | null;
};

type DesktopOpenResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

declare global {
  interface Window {
    organizaDesktop?: {
      openDriveFile: (payload: DesktopOpenPayload) => Promise<DesktopOpenResult>;
    };
  }
}

const APP_FOLDER_NAME = "OrganizaApp";
const LS_TOKEN_KEY = "organiza_google_token";
const ROOT_CACHE_KEY = "organiza_drive_root_id";
const DRIVE_FOLDER_CACHE_TTL_MS = 45_000;
const driveFolderCache = new Map<
  string,
  { ts: number; items: DriveItem[]; metaMap: Record<string, MetaRow> }
>();

async function hashSecret(secret: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  const bytes = Array.from(new Uint8Array(buffer));
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

function isFolder(it: DriveItem) {
  return it.mimeType === "application/vnd.google-apps.folder";
}

function formatBytes(bytes?: string) {
  if (!bytes) return "";
  const n = Number(bytes);
  if (Number.isNaN(n)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function withAlpha(hex: string, alphaHex: string, fallback: string) {
  const h = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return `${h}${alphaHex}`;
  return fallback;
}

async function driveRequest<T>(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const resolvedToken = accessToken || (await getValidAccessToken());
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
      ...(init?.headers || {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      (data?.error?.message as string) ||
        (data?.error_description as string) ||
        `Drive error (${r.status})`
    );
  }
  return data as T;
}

export default function FilesPage() {
  const router = useRouter();
  const ensuredMetaIdsRef = useRef<Set<string>>(new Set());

  const [userId, setUserId] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string>("");

  const [appRootId, setAppRootId] = useState<string>("");
  const [folderId, setFolderId] = useState<string>(""); // pasta atual
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>(
    []
  );

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uiMsg, setUiMsg] = useState<string>("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<DriveItem | null>(null);
  const [unlockAction, setUnlockAction] = useState<"open-folder" | "open-file" | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DriveItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const [metaMap, setMetaMap] = useState<Record<string, MetaRow>>({});

  // Modal edição
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DriveItem | null>(null);
  const [editIsFolder, setEditIsFolder] = useState(false);
  const [editInitial, setEditInitial] = useState<DriveEditValues>({
    name: "",
    author: "",
    priority: "Média",
    color: "#7C3AED",
    isLocked: false,
    password: "",
    iconEmoji: "📁",
  });

  const deferredQuery = useDeferredValue(query);
  const filteredItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [deferredQuery, items]);

  const breadcrumbItems = useMemo(
    () =>
      folderStack.map((c, idx) => ({
        id: c.id,
        name: c.name,
        index: idx,
        isLast: idx === folderStack.length - 1,
      })),
    [folderStack]
  );

  const cardViews = useMemo<DriveCardView[]>(
    () =>
      filteredItems.map((it) => {
        const meta = metaMap[it.id];
        const color = meta?.color || "#7C3AED";
        return {
          item: it,
          icon: meta?.icon_emoji || (isFolder(it) ? "📁" : "📄"),
          prio: meta?.priority || "Média",
          cardBg: withAlpha(color, "35", "rgba(255,255,255,0.08)"),
          cardBorder: withAlpha(color, "8F", "rgba(255,255,255,0.18)"),
          softBg: withAlpha(color, "4A", "rgba(255,255,255,0.14)"),
          softBorder: withAlpha(color, "A0", "rgba(255,255,255,0.26)"),
          author: meta?.author || null,
          locked: !!meta?.is_locked,
        };
      }),
    [filteredItems, metaMap]
  );

  // ---------- Boot ----------
  useEffect(() => {
    (async () => {
      try {
        // 1) user do supabase
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const uid = data?.session?.user?.id || "";
        if (!uid) {
          router.push("/login");
          return;
        }
        setUserId(uid);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Falha ao validar sessao.";
        setUiMsg(message);
        router.push("/login");
        return;
      }

      // 2) access token do Google no localStorage
      const raw = localStorage.getItem(LS_TOKEN_KEY);
      if (!raw) {
        setUiMsg("Você precisa conectar com o Google (login).");
        router.push("/login");
        return;
      }
      try {
        const tok = JSON.parse(raw);
        if (!tok?.accessToken) throw new Error("Sem accessToken");
        setAccessToken(tok.accessToken as string);
      } catch {
        setUiMsg("Token do Google inválido. Faça login novamente.");
        router.push("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) garantir pasta OrganizaApp no Drive + listar raiz
  useEffect(() => {
    if (!userId || !accessToken) return;

    (async () => {
      try {
        setLoading(true);
        const root = await ensureAppRootFolder(accessToken);
        setAppRootId(root.id);
        setFolderId(root.id);
        setFolderStack([{ id: root.id, name: "Raiz" }]);
        await loadList(root.id, accessToken, userId);
      } catch (e: unknown) {
        setUiMsg(e instanceof Error ? e.message : "Erro ao inicializar Drive");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, accessToken]);

  // ---------- Drive helpers ----------
  async function ensureAppRootFolder(accessTokenX: string) {
    const cachedRootId = localStorage.getItem(ROOT_CACHE_KEY);
    if (cachedRootId) {
      try {
        const byId = await driveRequest<DriveItem>(
          accessTokenX,
          `https://www.googleapis.com/drive/v3/files/${cachedRootId}?fields=id,name,mimeType`
        );
        if (byId?.id && byId.mimeType === "application/vnd.google-apps.folder") {
          return byId;
        }
      } catch {
        localStorage.removeItem(ROOT_CACHE_KEY);
      }
    }

    // procurar pasta OrganizaApp na raiz do Drive
    const q =
      `mimeType='application/vnd.google-apps.folder' and ` +
      `name='${APP_FOLDER_NAME.replaceAll("'", "\\'")}' and trashed=false`;

    const search = await driveRequest<{
      files: DriveItem[];
    }>(
      accessTokenX,
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&fields=files(id,name,mimeType)`
    );

    if (search.files?.length) {
      localStorage.setItem(ROOT_CACHE_KEY, search.files[0].id);
      return search.files[0];
    }

    // criar pasta
    const created = await driveRequest<DriveItem>(
      accessTokenX,
      "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: APP_FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
        }),
      }
    );

    // criar meta no Supabase (root também)
    if (userId) {
      await supabase.from("drive_items").upsert(
        {
          user_id: userId,
          drive_id: created.id,
          kind: "folder",
          name: created.name,
          parent_drive_id: null,
          color: "#7C3AED",
          is_locked: false,
          password_hash: null,
          author: null,
          priority: "Média",
          icon_emoji: "📁",
        },
        { onConflict: "user_id,drive_id" }
      );
    }

    localStorage.setItem(ROOT_CACHE_KEY, created.id);
    return created;
  }

  async function loadMeta(ids: string[], uid: string): Promise<Record<string, MetaRow>> {
    if (!ids.length) {
      setMetaMap({});
      return {};
    }
    const { data, error } = await supabase
      .from("drive_items")
      .select(
        "drive_id,kind,name,parent_drive_id,color,is_locked,password_hash,author,priority,icon_emoji"
      )
      .eq("user_id", uid)
      .in("drive_id", ids);

    if (error) throw new Error(error.message);

    const mm: Record<string, MetaRow> = {};
    (data || []).forEach((row) => {
      const typedRow = row as MetaRow;
      mm[typedRow.drive_id] = typedRow;
      ensuredMetaIdsRef.current.add(typedRow.drive_id);
    });
    setMetaMap(mm);
    return mm;
  }

  async function ensureMissingMetaRows(list: DriveItem[], uid: string, parentId: string, parentColor: string) {
    if (!uid || list.length === 0) return;

    const missing = list.filter((it) => !ensuredMetaIdsRef.current.has(it.id));
    if (missing.length === 0) return;

    const baseRows = missing.map((it) => ({
      user_id: uid,
      drive_id: it.id,
      kind: isFolder(it) ? "folder" : "file",
      name: it.name,
      parent_drive_id: parentId,
      color: parentColor,
      is_locked: false,
      password_hash: null,
      author: null,
      priority: "Média",
      icon_emoji: isFolder(it) ? "📁" : "📄",
    }));

    const { error } = await supabase.from("drive_items").upsert(baseRows, {
      onConflict: "user_id,drive_id",
      ignoreDuplicates: true,
    });

    if (!error) {
      for (const row of baseRows) ensuredMetaIdsRef.current.add(row.drive_id);
    }
  }

  async function loadList(folderIdX: string, accessTokenX: string, uid: string) {
    const cacheKey = `${uid}:${folderIdX}`;
    const cached = driveFolderCache.get(cacheKey);
    const hasFreshCache = Boolean(cached && Date.now() - cached.ts < DRIVE_FOLDER_CACHE_TTL_MS);

    if (hasFreshCache && cached) {
      setItems(cached.items);
      setMetaMap(cached.metaMap);
    } else {
      setLoading(true);
    }
    setUiMsg("");

    try {
      const q = `'${folderIdX}' in parents and trashed=false`;

      const res = await driveRequest<{
        files: DriveItem[];
      }>(
        accessTokenX,
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          q
        )}&fields=files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,iconLink)&orderBy=folder,name`
      );

      const list = res.files || [];
      setItems(list);
      const ids = list.map((i) => i.id);
      const mm = await loadMeta(ids, uid);
      driveFolderCache.set(cacheKey, { ts: Date.now(), items: list, metaMap: mm });

      const parentColor = mm[folderIdX]?.color || metaMap[folderIdX]?.color || "#7C3AED";
      void ensureMissingMetaRows(list, uid, folderIdX, parentColor);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Actions ----------
  async function enterFolder(it: DriveItem) {
    if (!isFolder(it)) return;
    const nextId = it.id;
    setFolderId(nextId);
    setFolderStack((prev) => [...prev, { id: nextId, name: it.name }]);
    await loadList(nextId, accessToken, userId);
  }

  function openDriveLink(it: DriveItem) {
    if (it.webViewLink) {
      window.open(it.webViewLink, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(`https://drive.google.com/file/d/${it.id}/view`, "_blank");
  }

  function requireUnlock(it: DriveItem, action: "open-folder" | "open-file") {
    const meta = metaMap[it.id];
    if (!meta?.is_locked) return false;
    if (unlockedIds[it.id]) return false;
    setUnlockTarget(it);
    setUnlockAction(action);
    setUnlockPassword("");
    setUnlockError("");
    setUnlockOpen(true);
    return true;
  }

  async function goIntoFolder(it: DriveItem) {
    if (requireUnlock(it, "open-folder")) return;
    await enterFolder(it);
  }

  async function goToCrumb(index: number) {
    const crumb = folderStack[index];
    setFolderId(crumb.id);
    setFolderStack((prev) => prev.slice(0, index + 1));
    await loadList(crumb.id, accessToken, userId);
  }

  function openCreateFolderModal() {
    setNewFolderName("");
    setCreateFolderOpen(true);
  }

  async function createFolder(name: string) {
    setCreatingFolder(true);
    setUiMsg("");

    try {
      const created = await driveRequest<DriveItem>(
        accessToken,
        "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            mimeType: "application/vnd.google-apps.folder",
            parents: [folderId],
          }),
        }
      );

      await supabase.from("drive_items").upsert(
        {
          user_id: userId,
          drive_id: created.id,
          kind: "folder",
          name: created.name,
          parent_drive_id: folderId,
          color: metaMap[folderId]?.color || "#7C3AED",
          is_locked: false,
          password_hash: null,
          author: null,
          priority: "Média",
          icon_emoji: "📁",
        },
        { onConflict: "user_id,drive_id" }
      );
      ensuredMetaIdsRef.current.add(created.id);

      setUiMsg(`✅ Pasta criada: ${created.name}`);
      setCreateFolderOpen(false);
      setNewFolderName("");
      driveFolderCache.delete(`${userId}:${folderId}`);
      await loadList(folderId, accessToken, userId);
    } catch (e: unknown) {
      setUiMsg(`Erro ao criar pasta: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleCreateFolderSubmit() {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name);
  }

  async function uploadFile(file: File) {
    setLoading(true);
    setUiMsg("");

    try {
      const validAccessToken = await getValidAccessToken();
      setAccessToken(validAccessToken);

      const fd = new FormData();
      fd.set("accessToken", validAccessToken);
      fd.set("parentId", folderId || "root");
      fd.set("file", file);

      const uploadRes = await fetch("/api/drive/upload", {
        method: "POST",
        body: fd,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadData?.error?.error?.message || uploadData?.error?.message || "Erro no upload");
      }

      const created = uploadData as DriveItem;

      await supabase.from("drive_items").upsert(
        {
          user_id: userId,
          drive_id: created.id,
          kind: "file",
          name: created.name,
          parent_drive_id: folderId,
          color: metaMap[folderId]?.color || "#7C3AED",
          is_locked: false,
          password_hash: null,
          author: null,
          priority: "Média",
          icon_emoji: "📄",
        },
        { onConflict: "user_id,drive_id" }
      );
      ensuredMetaIdsRef.current.add(created.id);

      setUiMsg(`✅ Upload OK: ${created.name}`);
      driveFolderCache.delete(`${userId}:${folderId}`);
      await loadList(folderId, accessToken, userId);
    } catch (e: unknown) {
      setUiMsg(`Erro no upload: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(it: DriveItem) {
    const meta = metaMap[it.id];

    setEditTarget(it);
    setEditIsFolder(isFolder(it));

    setEditInitial({
      name: it.name,
      author: meta?.author || "",
      priority: meta?.priority || "Média",
      color: meta?.color || "#7C3AED",
      applyColorToChildren: isFolder(it),
      isLocked: !!meta?.is_locked,
      password: "", // não traz senha de volta
      iconEmoji: meta?.icon_emoji || (isFolder(it) ? "📁" : "📄"),
    });

    setEditOpen(true);
  }

  async function saveEdit(values: DriveEditValues) {
    if (!editTarget) return;

    // 1) renomear no Drive se mudou
    if (values.name.trim() && values.name.trim() !== editTarget.name) {
      const validAccessToken = await getValidAccessToken();
      const r = await fetch("/api/drive/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: validAccessToken,
          fileId: editTarget.id,
          name: values.name.trim(),
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          data?.error?.error?.message ||
            data?.error?.message ||
            "Erro ao renomear no Drive"
        );
      }
    }

    // 2) salvar metadados no Supabase
    const updatePayload: Record<string, string | boolean | null> = {
      name: values.name.trim(),
      author: values.author.trim() || null,
      priority: values.priority,
      color: values.color.trim(),
      is_locked: values.isLocked,
      icon_emoji: values.iconEmoji,
    };

    // Salva hash da senha para nao manter texto puro.
    if (values.isLocked && values.password.trim().length >= 4) {
      updatePayload.password_hash = await hashSecret(values.password.trim());
    }
    if (!values.isLocked) {
      updatePayload.password_hash = null;
    }

    const { data: updatedRows, error } = await supabase
      .from("drive_items")
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("drive_id", editTarget.id)
      .select("drive_id");

    if (error) throw new Error(error.message);
    if (!updatedRows || updatedRows.length === 0) {
      const fallbackInsert = {
        user_id: userId,
        drive_id: editTarget.id,
        kind: isFolder(editTarget) ? "folder" : "file",
        name: values.name.trim() || editTarget.name,
        parent_drive_id: folderId,
        color: values.color.trim(),
        is_locked: values.isLocked,
        password_hash: updatePayload.password_hash ?? null,
        author: values.author.trim() || null,
        priority: values.priority,
        icon_emoji: values.iconEmoji,
      };
      const { error: insertErr } = await supabase
        .from("drive_items")
        .upsert(fallbackInsert, { onConflict: "user_id,drive_id" });
      if (insertErr) throw new Error(insertErr.message);
    }

    // Se for pasta, propaga a cor para os filhos (recursivo).
    if (isFolder(editTarget) && values.applyColorToChildren) {
      let frontier = [editTarget.id];
      while (frontier.length) {
        const { data: children, error: childErr } = await supabase
          .from("drive_items")
          .select("drive_id")
          .eq("user_id", userId)
          .in("parent_drive_id", frontier);

        if (childErr) throw new Error(childErr.message);
        const childIds = (children || []).map((c) => String(c.drive_id));
        if (!childIds.length) break;

        const { error: updErr } = await supabase
          .from("drive_items")
          .update({ color: values.color.trim() })
          .eq("user_id", userId)
          .in("drive_id", childIds);
        if (updErr) throw new Error(updErr.message);

        frontier = childIds;
      }
    }

    // Atualiza mapa local para refletir imediatamente na UI.
    setMetaMap((prev) => {
      const current = prev[editTarget.id];
      return {
        ...prev,
        [editTarget.id]: {
          drive_id: editTarget.id,
          kind: isFolder(editTarget) ? "folder" : "file",
          name: values.name.trim() || editTarget.name,
          parent_drive_id: current?.parent_drive_id || folderId,
          color: values.color.trim(),
          is_locked: values.isLocked,
          password_hash:
            typeof updatePayload.password_hash === "string"
              ? updatePayload.password_hash
              : current?.password_hash || null,
          author: values.author.trim() || null,
          priority: values.priority,
          icon_emoji: values.iconEmoji,
        },
      };
    });

    // 3) recarregar listagem + meta
    driveFolderCache.delete(`${userId}:${folderId}`);
    await loadList(folderId, accessToken, userId);
  }

  async function openDrive(it: DriveItem) {
    if (requireUnlock(it, "open-file")) return;

    const desktop = window.organizaDesktop;
    if (!isFolder(it) && desktop?.openDriveFile) {
      try {
        const validAccessToken = await getValidAccessToken();
        const result = await desktop.openDriveFile({
          fileId: it.id,
          fileName: it.name,
          mimeType: it.mimeType || "",
          accessToken: validAccessToken,
          webViewLink: it.webViewLink || null,
        });

        if (result?.ok) return;

        if (result?.error) {
          setUiMsg(`Erro ao abrir no PC: ${result.error}. Abrindo no Drive...`);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "erro";
        setUiMsg(`Erro ao abrir no PC: ${message}. Abrindo no Drive...`);
      }
    }

    openDriveLink(it);
  }

  async function confirmUnlock() {
    if (!unlockTarget || !unlockAction) return;
    const meta = metaMap[unlockTarget.id];
    const expected = meta?.password_hash || "";
    if (!expected) {
      setUnlockError("Este item esta trancado sem senha configurada. Edite e defina uma senha.");
      return;
    }
    const hashedInput = await hashSecret(unlockPassword);
    const ok =
      expected.startsWith("sha256:")
        ? expected === hashedInput
        : expected === unlockPassword || expected === hashedInput;

    if (!ok) {
      setUnlockError("Senha incorreta.");
      return;
    }

    // Migra senha legada em texto puro para hash.
    if (!expected.startsWith("sha256:")) {
      await supabase
        .from("drive_items")
        .update({ password_hash: hashedInput })
        .eq("user_id", userId)
        .eq("drive_id", unlockTarget.id);
    }

    setUnlockedIds((prev) => ({ ...prev, [unlockTarget.id]: true }));
    setUnlockOpen(false);
    setUnlockError("");
    setUnlockPassword("");

    if (unlockAction === "open-folder") {
      await enterFolder(unlockTarget);
      return;
    }
    await openDrive(unlockTarget);
  }

  function askDelete(it: DriveItem) {
    setDeleteTarget(it);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingItem(true);
    setUiMsg("");

    try {
      await driveRequest<unknown>(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      await supabase
        .from("drive_items")
        .delete()
        .eq("user_id", userId)
        .eq("drive_id", deleteTarget.id);

      await supabase
        .from("drive_items")
        .delete()
        .eq("user_id", userId)
        .eq("parent_drive_id", deleteTarget.id);

      setUiMsg(`✅ Item removido: ${deleteTarget.name}`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      driveFolderCache.delete(`${userId}:${folderId}`);
      await loadList(folderId, accessToken, userId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "erro";
      setUiMsg(`Erro ao excluir item: ${message}`);
    } finally {
      setDeletingItem(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Gerenciador de Arquivos</h1>
        <p className={styles.subtitle}>Organize seus documentos, mídias e arquivos em geral.</p>
      </div>

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar arquivos..."
              className={styles.searchInput}
            />
            <div className={styles.crumbs}>
              Pasta atual:{" "}
              <span className={styles.crumbPath}>
                {breadcrumbItems.map((c) => (
                  <span key={c.id}>
                    <button
                      className={styles.crumbBtn}
                      onClick={() => goToCrumb(c.index)}
                      disabled={loading}
                      title="Ir para esta pasta"
                    >
                      {c.name}
                    </button>
                    {!c.isLast ? " / " : ""}
                  </span>
                ))}
              </span>{" "}
              <span className={styles.crumbMuted}>
                {appRootId ? "(OrganizaApp no Drive)" : ""}
              </span>
            </div>
          </div>

          <div className={styles.toolbarActions}>
            <button
              onClick={openCreateFolderModal}
              disabled={loading || creatingFolder || !folderId}
              className={styles.btnSecondary}
            >
              Nova Pasta
            </button>

            <label className={styles.btnPrimary}>
              Adicionar Arquivo
              <input
                type="file"
                className={styles.hiddenInput}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  uploadFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className={styles.listShell}>
          {loading ? (
            <div className={styles.state}>Carregando...</div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.state}>
              Nenhum arquivo encontrado
            </div>
          ) : (
            <div className={styles.scroll}>
              <div className={styles.grid}>
                {cardViews.map((view) => {
                  const it = view.item;
                  return (
                    <div
                      key={it.id}
                      className={styles.itemCard}
                      style={{ backgroundColor: view.cardBg, borderColor: view.cardBorder }}
                    >
                      <div className={styles.itemTop}>
                        <div className={styles.itemHeadRow}>
                          <div
                            className={styles.itemIconWrap}
                            style={{ background: view.softBg, borderColor: view.softBorder }}
                            title="Cor do item"
                          >
                            <span className={styles.itemIcon}>{view.icon}</span>
                          </div>
                          <div className={styles.itemMeta}>
                            <div className={styles.itemName}>{it.name}</div>
                            <div className={styles.itemType}>
                              {isFolder(it) ? "Pasta" : it.mimeType || "Arquivo"}
                            </div>
                          </div>
                        </div>

                        <div className={styles.chips}>
                          {!isFolder(it) && it.size ? (
                            <span
                              className={styles.chip}
                              style={{ backgroundColor: view.softBg, borderColor: view.softBorder }}
                            >
                              {formatBytes(it.size)}
                            </span>
                          ) : null}

                          <span
                            className={styles.chip}
                            style={{ backgroundColor: view.softBg, borderColor: view.softBorder }}
                          >
                            Prioridade: {view.prio}
                          </span>

                          {view.author ? (
                            <span
                              className={styles.chip}
                              style={{ backgroundColor: view.softBg, borderColor: view.softBorder }}
                            >
                              Autor: {view.author}
                            </span>
                          ) : null}

                          {view.locked ? (
                            <span
                              className={styles.chip}
                              style={{ backgroundColor: view.softBg, borderColor: view.softBorder }}
                            >
                              🔒 Trancado
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.itemActions}>
                        <button
                          onClick={() => {
                            if (isFolder(it)) {
                              void goIntoFolder(it);
                              return;
                            }
                            void openDrive(it);
                          }}
                          className={styles.openBtn}
                          style={{ backgroundColor: view.softBg, borderColor: view.softBorder }}
                        >
                          Abrir
                        </button>

                        <button
                          onClick={() => openEditModal(it)}
                          className={styles.iconBtn}
                          style={{ backgroundColor: view.softBg, borderColor: view.softBorder }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => askDelete(it)}
                          className={styles.deleteBtn}
                          title="Excluir"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {uiMsg ? (
          <div className={styles.message}>{uiMsg}</div>
        ) : null}
      </div>

      <EditDriveItemModal
        open={editOpen}
        title={editTarget?.name || ""}
        initial={editInitial}
        isFolder={editIsFolder}
        onClose={() => setEditOpen(false)}
        onSave={saveEdit}
      />

      <ModalShell
        open={createFolderOpen}
        title="Criar nova pasta"
        subtitle="Escolha um nome para organizar seus arquivos nesta pasta."
        onClose={() => setCreateFolderOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateFolderOpen(false)}
              className={styles.modalBtn}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateFolderSubmit}
              disabled={creatingFolder || !newFolderName.trim()}
              className={styles.modalPrimary}
            >
              {creatingFolder ? "Criando..." : "Criar pasta"}
            </button>
          </>
        }
      >
        <label className={styles.modalLabel}>Nome da pasta</label>
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreateFolderSubmit();
            }
          }}
          autoFocus
          placeholder="Ex.: Faculdade, Projetos, Contratos"
          className={styles.modalInput}
        />
      </ModalShell>

      <ModalShell
        open={unlockOpen}
        title="Item trancado"
        subtitle="Digite a senha para abrir este arquivo/pasta."
        onClose={() => setUnlockOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setUnlockOpen(false)}
              className={styles.modalBtn}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmUnlock}
              disabled={!unlockPassword}
              className={styles.modalPrimary}
            >
              Destrancar
            </button>
          </>
        }
      >
        <label className={styles.modalLabel}>Senha</label>
        <input
          value={unlockPassword}
          onChange={(e) => {
            setUnlockPassword(e.target.value);
            if (unlockError) setUnlockError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmUnlock();
            }
          }}
          autoFocus
          type="password"
          placeholder="Digite a senha"
          className={styles.modalInput}
        />
        {unlockTarget ? (
          <p className={styles.modalHint}>
            Item: <span className={styles.modalHintStrong}>{unlockTarget.name}</span>
          </p>
        ) : null}
        {unlockError ? <p className={styles.modalError}>{unlockError}</p> : null}
      </ModalShell>

      <ModalShell
        open={deleteOpen}
        title="Confirmar exclusao"
        subtitle={
          deleteTarget
            ? `Tem certeza que deseja excluir "${deleteTarget.name}"? Essa acao envia para a lixeira do Drive.`
            : "Tem certeza que deseja excluir este item?"
        }
        onClose={() => {
          if (deletingItem) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteTarget(null);
              }}
              disabled={deletingItem}
              className={styles.modalBtn}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deletingItem}
              className={styles.dangerBtn}
            >
              {deletingItem ? "Excluindo..." : "Excluir"}
            </button>
          </>
        }
      >
        <p className={styles.modalText}>
          Itens excluidos podem ser recuperados na lixeira do Google Drive.
        </p>
      </ModalShell>
    </div>
  );
}
