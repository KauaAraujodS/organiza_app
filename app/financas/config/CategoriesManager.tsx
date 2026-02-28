"use client";

import { CSSProperties, useEffect, useState, useTransition } from "react";
import styles from "../finance.module.css";
import { FinanceCategory } from "../types";
import { getAccessTokenOrThrow } from "@/app/lib/supabase/client";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "./actions";

const COLOR_PRESETS = [
  "#3b82f6",
  "#22c55e",
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

export default function CategoriesManager({
  categories,
  onReload,
}: {
  categories: FinanceCategory[];
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense" | "both">("expense");
  const [color, setColor] = useState("#3b82f6");
  const [parentId, setParentId] = useState<string>("");
  const [archived, setArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editingId) {
      setName("");
      setKind("expense");
      setColor("#3b82f6");
      setParentId("");
      setArchived(false);
      return;
    }
    const found = categories.find((c) => c.id === editingId);
    if (!found) return;
    setName(found.name);
    setKind(found.kind);
    setColor(found.color || "#3b82f6");
    setParentId(found.parent_id || "");
    setArchived(found.archived);
  }, [editingId, categories]);

  function submit() {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = { accessToken, id: editingId || undefined, name, kind, color, parent_id: parentId || null, archived };
        const res = editingId
          ? await updateCategoryAction(payload)
          : await createCategoryAction(payload);
        if (!res.ok) throw new Error(res.error);
        setEditingId(null);
        await onReload();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar categoria.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteCategoryAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        if (editingId === id) setEditingId(null);
        await onReload();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir categoria.");
      }
    });
  }

  const kindLabel: Record<"income" | "expense" | "both", string> = {
    income: "Receita",
    expense: "Despesa",
    both: "Ambas",
  };
  const selectableParents = categories.filter((c) => c.id !== editingId && !c.archived);

  return (
    <div className={styles.card}>
      <h3 className={styles.noTopMargin}>Categorias</h3>
      <p className={styles.label}>Crie categorias e subcategorias para organizar suas transações.</p>
      <div className={styles.formGrid}>
        <div>
          <label className={styles.label}>Nome da categoria</label>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alimentação" />
        </div>
        <div>
          <label className={styles.label}>Tipo</label>
          <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="both">Ambas</option>
          </select>
        </div>
        <div>
          <label className={styles.label}>Categoria pai (opcional)</label>
          <select className={styles.select} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nenhuma (categoria principal)</option>
            {selectableParents.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.fieldFull}>
          <label className={styles.label}>Cor</label>
          <div className={`${styles.swatchGrid} ${styles.mt6}`}>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Selecionar cor ${preset}`}
                className={`${styles.swatchButton} ${color === preset ? styles.swatchButtonActive : ""}`}
                style={{ "--badge-color": preset } as CSSProperties}
                onClick={() => setColor(preset)}
                data-color={preset}
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
              placeholder="#3b82f6"
            />
            <label className={`${styles.row} ${styles.nowrap}`}>
              <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
              <span className={styles.label}>Arquivada</span>
            </label>
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
              <th>Tipo</th>
              <th>Pai</th>
              <th>Cor</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.label}>Nenhuma categoria cadastrada.</td>
              </tr>
            ) : null}
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{kindLabel[c.kind]}</td>
                <td>{c.parent_id ? categories.find((parent) => parent.id === c.parent_id)?.name || "-" : "-"}</td>
                <td>
                  <span className={styles.badge}>
                    <span className={styles.badgeColorDot} style={{ "--badge-color": c.color || "#334155" } as CSSProperties} />
                    {c.color || "-"}
                  </span>
                </td>
                <td>{c.archived ? "Arquivada" : "Ativa"}</td>
                <td>
                  <div className={styles.row}>
                    <button className={styles.ghostButton} onClick={() => setEditingId(c.id)}>
                      Editar
                    </button>
                    <button className={styles.ghostButton} onClick={() => remove(c.id)} disabled={pending}>
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
