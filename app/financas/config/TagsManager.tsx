"use client";

import { CSSProperties, useEffect, useState, useTransition } from "react";
import styles from "../finance.module.css";
import { FinanceTag } from "../types";
import { getAccessTokenOrThrow } from "@/app/lib/supabase/client";
import { createTagAction, deleteTagAction, updateTagAction } from "./actions";

const COLOR_PRESETS = [
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#eab308",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#64748b",
  "#84cc16",
];

export default function TagsManager({ tags, onReload }: { tags: FinanceTag[]; onReload: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editingId) {
      setName("");
      setColor("#22c55e");
      return;
    }
    const found = tags.find((t) => t.id === editingId);
    if (!found) return;
    setName(found.name);
    setColor(found.color || "#22c55e");
  }, [editingId, tags]);

  function submit() {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = { accessToken, id: editingId || undefined, name, color };
        const res = editingId ? await updateTagAction(payload) : await createTagAction(payload);
        if (!res.ok) throw new Error(res.error);
        setEditingId(null);
        await onReload();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar tag.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteTagAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        if (editingId === id) setEditingId(null);
        await onReload();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir tag.");
      }
    });
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.noTopMargin}>Tags</h3>
      <p className={styles.label}>Use tags para cruzar análises nos relatórios (ex: trabalho, casa, viagem).</p>
      <div className={styles.formGrid}>
        <div>
          <label className={styles.label}>Nome da tag</label>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem" />
        </div>
        <div className={styles.fieldFull}>
          <label className={styles.label}>Cor da tag</label>
          <div className={`${styles.swatchGrid} ${styles.mt6}`}>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Selecionar cor ${preset}`}
                className={`${styles.swatchButton} ${color === preset ? styles.swatchButtonActive : ""}`}
                style={{ "--badge-color": preset } as CSSProperties}
                onClick={() => setColor(preset)}
              />
            ))}
          </div>
          <div className={`${styles.colorRow} ${styles.mt8}`}>
            <input
              type="color"
              className={styles.colorPicker}
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              className={`${styles.input} ${styles.colorHexInput}`}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#22c55e"
            />
          </div>
        </div>
      </div>
      <div className={`${styles.row} ${styles.mt8}`}>
        <button className={styles.button} onClick={submit} disabled={pending || !name.trim()}>
          {editingId ? "Atualizar" : "Criar"}
        </button>
        {editingId ? (
          <button className={styles.ghostButton} onClick={() => setEditingId(null)}>
            Cancelar edição
          </button>
        ) : null}
      </div>

      <div className={`${styles.tableWrap} ${styles.tableTop}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 ? (
              <tr>
                <td colSpan={3} className={styles.label}>Nenhuma tag cadastrada.</td>
              </tr>
            ) : null}
            {tags.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <span className={styles.badge}>
                    <span className={styles.badgeColorDot} style={{ "--badge-color": t.color || "#334155" } as CSSProperties} />
                    {t.color || "-"}
                  </span>
                </td>
                <td>
                  <div className={styles.row}>
                    <button className={styles.ghostButton} onClick={() => setEditingId(t.id)}>
                      Editar
                    </button>
                    <button className={styles.ghostButton} onClick={() => remove(t.id)} disabled={pending}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg ? <p className={styles.msg}>{msg}</p> : null}
    </div>
  );
}
