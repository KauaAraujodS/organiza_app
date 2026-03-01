"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceBudget, FinanceCategory, FinanceTransaction } from "../types";
import { formatMoneyFromCents, parseMoneyToCents, toDateInput } from "../utils";
import { supabaseClient, getAccessTokenOrThrow } from "@/app/lib/supabase/client";
import { createBudgetAction, deleteBudgetAction, updateBudgetAction } from "./actions";

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export default function FinanceBudgetsPage() {
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [limitValue, setLimitValue] = useState("1000,00");
  const [categoryId, setCategoryId] = useState("");

  const load = useCallback(async () => {
    setMsg("");
    const [budgetsRes, categoriesRes] = await Promise.all([
      supabaseClient.from("finance_budgets").select("*").order("period_start", { ascending: false }),
      supabaseClient.from("finance_categories").select("*").eq("archived", false).order("name"),
    ]);

    if (budgetsRes.error || categoriesRes.error) {
      setMsg(budgetsRes.error?.message || categoriesRes.error?.message || "Falha ao carregar dados.");
      return;
    }

    const budgetRows = (budgetsRes.data || []) as FinanceBudget[];
    setBudgets(budgetRows);
    setCategories((categoriesRes.data || []) as FinanceCategory[]);

    if (budgetRows.length === 0) {
      setTransactions([]);
      return;
    }

    const minDate = budgetRows.reduce((min, b) => (b.period_start < min ? b.period_start : min), budgetRows[0].period_start);
    const maxDate = budgetRows.reduce((max, b) => (b.period_end > max ? b.period_end : max), budgetRows[0].period_end);

    const txRes = await supabaseClient
      .from("finance_transactions")
      .select("*")
      .gte("occurred_on", minDate)
      .lte("occurred_on", maxDate);

    if (txRes.error) {
      setMsg(txRes.error.message);
      return;
    }

    setTransactions((txRes.data || []) as FinanceTransaction[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        void load();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!editingId) {
      setName("");
      setPeriodStart(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
      setPeriodEnd(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
      setLimitValue("1000,00");
      setCategoryId("");
      return;
    }

    const budget = budgets.find((b) => b.id === editingId);
    if (!budget) return;
    setName(budget.name);
    setPeriodStart(budget.period_start);
    setPeriodEnd(budget.period_end);
    setLimitValue(String((budget.amount_limit_cents / 100).toFixed(2)).replace(".", ","));
    setCategoryId(budget.category_id || "");
  }, [editingId, budgets]);

  const categoryNameById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const budgetSummaries = useMemo(() => {
    return budgets.map((budget) => {
      const realized = transactions
        .filter((tx) => {
          if (tx.amount_cents >= 0) return false;
          if (tx.occurred_on < budget.period_start || tx.occurred_on > budget.period_end) return false;
          if (budget.category_id && tx.category_id !== budget.category_id) return false;
          return true;
        })
        .reduce((acc, tx) => acc + Math.abs(tx.amount_cents), 0);

      const percent = budget.amount_limit_cents > 0 ? (realized / budget.amount_limit_cents) * 100 : 0;
      return { budget, realized, percent };
    });
  }, [budgets, transactions]);

  function saveBudget() {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = {
          accessToken,
          id: editingId || undefined,
          name,
          period_start: periodStart,
          period_end: periodEnd,
          amount_limit_cents: parseMoneyToCents(limitValue),
          category_id: categoryId || null,
        };

        const res = editingId ? await updateBudgetAction(payload) : await createBudgetAction(payload);
        if (!res.ok) throw new Error(res.error);

        setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar orçamento.");
      }
    });
  }

  function removeBudget(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteBudgetAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);

        if (editingId === id) setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir orçamento.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Orçamentos</h1>
        <p className={styles.subtitle}>Planejado vs realizado por período</p>
      </div>

      <FinanceTabs />

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>{editingId ? "Editar orçamento" : "Novo orçamento"}</h3>
        <div className={styles.col3}>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          <input className={styles.input} type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <input className={styles.input} type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          <input className={styles.input} value={limitValue} onChange={(e) => setLimitValue(e.target.value)} placeholder="Limite (R$)" />
          <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas categorias (despesas)</option>
            {categories
              .filter((c) => c.kind !== "income")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className={`${styles.row} ${styles.mt8}`}>
          <button className={styles.button} disabled={pending || !name.trim()} onClick={saveBudget}>
            {editingId ? "Atualizar" : "Criar"}
          </button>
          {editingId ? (
            <button className={styles.ghostButton} onClick={() => setEditingId(null)}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.grid}>
        {budgetSummaries.length === 0 ? (
          <div className={`${styles.card} ${styles.span12}`}>
            Nenhum orçamento criado.
          </div>
        ) : (
          budgetSummaries.map(({ budget, realized, percent }) => {
            const clamped = clampPercent(percent);
            const progressClass =
              clamped < 80
                ? styles.progressFill
                : clamped < 100
                  ? `${styles.progressFill} ${styles.progressFillWarning}`
                  : `${styles.progressFill} ${styles.progressFillDanger}`;

            return (
              <div key={budget.id} className={`${styles.card} ${styles.span6}`}>
                <div className={styles.header}>
                  <div>
                    <h3 className={styles.h0}>{budget.name}</h3>
                    <p className={styles.label}>
                      {new Date(`${budget.period_start}T00:00:00`).toLocaleDateString("pt-BR")} - {" "}
                      {new Date(`${budget.period_end}T00:00:00`).toLocaleDateString("pt-BR")}
                    </p>
                    <p className={styles.label}>
                      Categoria: {budget.category_id ? categoryNameById[budget.category_id] || "-" : "Todas"}
                    </p>
                  </div>
                  <div className={styles.row}>
                    <button className={styles.ghostButton} onClick={() => setEditingId(budget.id)}>Editar</button>
                    <button className={styles.ghostButton} onClick={() => removeBudget(budget.id)} disabled={pending}>Excluir</button>
                  </div>
                </div>

                <div className={styles.row}>
                  <span className={styles.label}>Planejado: {formatMoneyFromCents(budget.amount_limit_cents)}</span>
                  <span className={styles.label}>Realizado: {formatMoneyFromCents(realized)}</span>
                  <span className={styles.label}>{clamped.toFixed(1)}%</span>
                </div>

                <div className={`${styles.progressTrack} ${styles.mt8}`}>
                  <div
                    className={`${progressClass} ${styles.progressFillDynamic}`}
                    style={{ "--progress-width": `${Math.min(clamped, 100)}%` } as CSSProperties}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}
    </main>
  );
}
