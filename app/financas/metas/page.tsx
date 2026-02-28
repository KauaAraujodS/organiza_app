"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { formatMoneyFromCents, parseMoneyToCents, toDateInput } from "../utils";
import { getAccessTokenOrThrow, supabaseClient } from "@/app/lib/supabase/client";
import { createGoalAction, deleteGoalAction, updateGoalAction, addGoalContributionAction } from "./actions";
import { FinanceAccount } from "../types";

type Goal = {
  id: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  target_date: string | null;
  status: "active" | "paused" | "completed" | "archived";
};

export default function FinanceGoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetValue, setTargetValue] = useState("0,00");
  const [savedValue, setSavedValue] = useState("0,00");
  const [targetDate, setTargetDate] = useState(toDateInput());
  const [status, setStatus] = useState<Goal["status"]>("active");
  const [contributionAmountByGoal, setContributionAmountByGoal] = useState<Record<string, string>>({});
  const [contributionAccountByGoal, setContributionAccountByGoal] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setMsg("");
    const [goalsRes, accountsRes] = await Promise.all([
      supabaseClient.from("finance_goals").select("*").order("created_at", { ascending: false }),
      supabaseClient
        .from("finance_accounts")
        .select("*")
        .eq("archived", false)
        .neq("type", "credit_card")
        .order("name"),
    ]);

    const error = goalsRes.error || accountsRes.error;
    if (error) {
      setMsg(error.message);
      return;
    }

    setGoals((goalsRes.data || []) as Goal[]);
    setAccounts((accountsRes.data || []) as FinanceAccount[]);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!editingId) {
      setName("");
      setTargetValue("0,00");
      setSavedValue("0,00");
      setTargetDate(toDateInput());
      setStatus("active");
      return;
    }

    const goal = goals.find((g) => g.id === editingId);
    if (!goal) return;
    setName(goal.name);
    setTargetValue(String((goal.target_cents / 100).toFixed(2)).replace(".", ","));
    setSavedValue(String((goal.saved_cents / 100).toFixed(2)).replace(".", ","));
    setTargetDate(goal.target_date || "");
    setStatus(goal.status);
  }, [editingId, goals]);

  const totals = useMemo(() => {
    const target = goals.reduce((acc, g) => acc + g.target_cents, 0);
    const saved = goals.reduce((acc, g) => acc + g.saved_cents, 0);
    return { target, saved };
  }, [goals]);

  function save() {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = {
          accessToken,
          id: editingId || undefined,
          name,
          target_cents: parseMoneyToCents(targetValue),
          saved_cents: parseMoneyToCents(savedValue),
          target_date: targetDate || null,
          status,
        };

        const res = editingId ? await updateGoalAction(payload) : await createGoalAction(payload);
        if (!res.ok) throw new Error(res.error);

        setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar meta.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteGoalAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        if (editingId === id) setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir meta.");
      }
    });
  }

  function contribute(goal: Goal) {
    setMsg("");
    startTransition(async () => {
      try {
        const rawAmount = contributionAmountByGoal[goal.id] || "";
        const amountCents = parseMoneyToCents(rawAmount);
        const accountId = contributionAccountByGoal[goal.id] || accounts[0]?.id || "";
        if (!accountId) throw new Error("Cadastre uma conta para lançar aportes.");
        if (amountCents <= 0) throw new Error("Informe um valor de aporte maior que zero.");

        const accessToken = await getAccessTokenOrThrow();
        const res = await addGoalContributionAction({
          accessToken,
          goal_id: goal.id,
          account_id: accountId,
          amount_cents: amountCents,
          occurred_on: toDateInput(),
        });
        if (!res.ok) throw new Error(res.error);

        setContributionAmountByGoal((prev) => ({ ...prev, [goal.id]: "" }));
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao adicionar valor na meta.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Metas</h1>
        <p className={styles.subtitle}>Reserva, viagem e objetivos financeiros</p>
      </div>

      <FinanceTabs />

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.span6}`}>
          <div className={styles.label}>Objetivo total</div>
          <div className={styles.kpi}>{formatMoneyFromCents(totals.target)}</div>
        </div>
        <div className={`${styles.card} ${styles.span6}`}>
          <div className={styles.label}>Acumulado</div>
          <div className={`${styles.kpi} ${styles.textSuccess}`}>{formatMoneyFromCents(totals.saved)}</div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>{editingId ? "Editar meta" : "Nova meta"}</h3>
        <div className={styles.col3}>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          <input className={styles.input} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Meta total" />
          <input className={styles.input} value={savedValue} onChange={(e) => setSavedValue(e.target.value)} placeholder="Valor já guardado" />
          <input className={styles.input} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as Goal["status"])}>
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
            <option value="completed">Concluída</option>
            <option value="archived">Arquivada</option>
          </select>
        </div>

        <div className={`${styles.row} ${styles.mt8}`}>
          <button className={styles.button} disabled={pending || !name.trim()} onClick={save}>
            {editingId ? "Atualizar" : "Criar"}
          </button>
          {editingId ? <button className={styles.ghostButton} onClick={() => setEditingId(null)}>Cancelar edição</button> : null}
        </div>
      </div>

      <div className={styles.grid}>
        {goals.length === 0 ? (
          <div className={`${styles.card} ${styles.span12}`}>Nenhuma meta cadastrada.</div>
        ) : (
          goals.map((goal) => {
            const pct = goal.target_cents > 0 ? Math.min(100, (goal.saved_cents / goal.target_cents) * 100) : 0;
            return (
              <div key={goal.id} className={`${styles.card} ${styles.span6}`}>
                <div className={styles.header}>
                  <div>
                    <h3 className={styles.h0}>{goal.name}</h3>
                    <div className={styles.label}>Status: {goal.status}</div>
                    <div className={styles.label}>Meta: {formatMoneyFromCents(goal.target_cents)}</div>
                    <div className={styles.label}>Guardado: {formatMoneyFromCents(goal.saved_cents)}</div>
                  </div>
                  <div className={styles.row}>
                    <button className={styles.ghostButton} onClick={() => setEditingId(goal.id)}>Editar</button>
                    <button className={styles.ghostButton} onClick={() => remove(goal.id)} disabled={pending}>Excluir</button>
                  </div>
                </div>

                <div className={`${styles.progressTrack} ${styles.mt8}`}>
                  <div
                    className={`${styles.progressFill} ${styles.progressFillDynamic}`}
                    style={{ "--progress-width": `${pct}%` } as CSSProperties}
                  />
                </div>
                <div className={`${styles.label} ${styles.mt6}`}>{pct.toFixed(1)}%</div>

                <div className={`${styles.col3} ${styles.mt12}`}>
                  <div>
                    <label className={styles.label}>Conta de origem</label>
                    <select
                      className={styles.select}
                      value={contributionAccountByGoal[goal.id] || accounts[0]?.id || ""}
                      onChange={(e) =>
                        setContributionAccountByGoal((prev) => ({ ...prev, [goal.id]: e.target.value }))
                      }
                    >
                      {accounts.length === 0 ? <option value="">Sem contas</option> : null}
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Valor para adicionar</label>
                    <input
                      className={styles.input}
                      value={contributionAmountByGoal[goal.id] || ""}
                      onChange={(e) =>
                        setContributionAmountByGoal((prev) => ({ ...prev, [goal.id]: e.target.value }))
                      }
                      placeholder="Ex: 250,00"
                    />
                  </div>
                  <div className={`${styles.row} ${styles.rowEnd}`}>
                    <button
                      className={`${styles.button} ${styles.wFull}`}
                      onClick={() => contribute(goal)}
                      disabled={pending || accounts.length === 0}
                    >
                      Adicionar valor
                    </button>
                  </div>
                </div>
                <div className={`${styles.label} ${styles.mt8}`}>
                  Este aporte gera uma transação automática com categoria <strong>Meta</strong> e descrição com o nome da meta.
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
