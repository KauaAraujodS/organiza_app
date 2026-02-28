"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceAccount, FinanceCategory, FinanceRecurrenceFreq, FinanceRecurringRule, FinanceTransactionType } from "../types";
import { formatMoneyFromCents, parseMoneyToCents, toDateInput } from "../utils";
import { getAccessTokenOrThrow, supabaseClient } from "@/app/lib/supabase/client";
import {
  createRecurringRuleAction,
  deleteRecurringRuleAction,
  runRecurringDueAction,
  updateRecurringRuleAction,
} from "./actions";

const FREQ_OPTIONS: Array<{ value: FinanceRecurrenceFreq; label: string }> = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

export default function FinanceRecurringPage() {
  const [rules, setRules] = useState<FinanceRecurringRule[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<FinanceTransactionType>("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("0,00");
  const [freq, setFreq] = useState<FinanceRecurrenceFreq>("monthly");
  const [intervalCount, setIntervalCount] = useState("1");
  const [startOn, setStartOn] = useState(toDateInput());
  const [endOn, setEndOn] = useState("");
  const [daysAhead, setDaysAhead] = useState("0");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    setMsg("");
    const [rulesRes, accountsRes, categoriesRes] = await Promise.all([
      supabaseClient.from("finance_recurring_rules").select("*").order("next_run_at", { ascending: true }),
      supabaseClient.from("finance_accounts").select("*").eq("archived", false).order("name"),
      supabaseClient.from("finance_categories").select("*").eq("archived", false).order("name"),
    ]);

    const err = rulesRes.error || accountsRes.error || categoriesRes.error;
    if (err) {
      setMsg(err.message);
      return;
    }

    setRules((rulesRes.data || []) as FinanceRecurringRule[]);
    setAccounts((accountsRes.data || []) as FinanceAccount[]);
    setCategories((categoriesRes.data || []) as FinanceCategory[]);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    const id = setTimeout(() => {
      void runDue(true);
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingId) {
      setTitle("");
      setType("expense");
      setAccountId(accounts[0]?.id || "");
      setCategoryId("");
      setAmount("0,00");
      setFreq("monthly");
      setIntervalCount("1");
      setStartOn(toDateInput());
      setEndOn("");
      setDaysAhead("0");
      setActive(true);
      return;
    }

    const rule = rules.find((r) => r.id === editingId);
    if (!rule) return;
    setTitle(rule.title);
    setType(rule.type);
    setAccountId(rule.account_id);
    setCategoryId(rule.category_id || "");
    setAmount(String((Math.abs(rule.amount_cents) / 100).toFixed(2)).replace(".", ","));
    setFreq(rule.freq);
    setIntervalCount(String(rule.interval_count));
    setStartOn(rule.start_on);
    setEndOn(rule.end_on || "");
    setDaysAhead(String(rule.auto_create_days_ahead));
    setActive(rule.active);
  }, [editingId, rules, accounts]);

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.kind === "both" || c.kind === type),
    [categories, type]
  );

  async function runDue(silent = false) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await runRecurringDueAction({ accessToken });
        if (!res.ok) throw new Error(res.error);
        await load();

        if (!silent) {
          setMsg(`Recorrências processadas. Lançamentos gerados: ${res.data?.generated || 0}`);
        }
      } catch (e: unknown) {
        if (!silent) {
          setMsg(e instanceof Error ? e.message : "Falha ao processar recorrências.");
        }
      }
    });
  }

  function saveRule() {
    setMsg("");

    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = {
          accessToken,
          id: editingId || undefined,
          title,
          type,
          account_id: accountId,
          category_id: categoryId || null,
          amount_cents: parseMoneyToCents(amount),
          freq,
          interval_count: Number(intervalCount),
          start_on: startOn,
          end_on: endOn || null,
          auto_create_days_ahead: Number(daysAhead),
          active,
        };

        const res = editingId
          ? await updateRecurringRuleAction(payload)
          : await createRecurringRuleAction(payload);

        if (!res.ok) throw new Error(res.error);
        setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar recorrência.");
      }
    });
  }

  function removeRule(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteRecurringRuleAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        if (editingId === id) setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir recorrência.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recorrências</h1>
          <p className={styles.subtitle}>Regras automáticas com geração de lançamentos por next_run_at</p>
        </div>
        <button className={styles.button} disabled={pending} onClick={() => void runDue(false)}>
          {pending ? "Processando..." : "Rodar agora"}
        </button>
      </div>

      <FinanceTabs />

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>{editingId ? "Editar regra" : "Nova regra recorrente"}</h3>

        <div className={styles.col3}>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />

          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as FinanceTransactionType)}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>

          <input className={styles.input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" />

          <select className={styles.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Conta</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select className={styles.select} value={freq} onChange={(e) => setFreq(e.target.value as FinanceRecurrenceFreq)}>
            {FREQ_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <input className={styles.input} type="number" min={1} value={intervalCount} onChange={(e) => setIntervalCount(e.target.value)} placeholder="Intervalo" />
          <input className={styles.input} type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
          <input className={styles.input} type="date" value={endOn} onChange={(e) => setEndOn(e.target.value)} />

          <input className={styles.input} type="number" min={0} value={daysAhead} onChange={(e) => setDaysAhead(e.target.value)} placeholder="Gerar com antecedência (dias)" />
          <label className={styles.label}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativa
          </label>
        </div>

        <div className={`${styles.row} ${styles.mt8}`}>
          <button className={styles.button} disabled={pending || !title.trim()} onClick={saveRule}>
            {editingId ? "Atualizar" : "Criar"}
          </button>
          {editingId ? (
            <button className={styles.ghostButton} onClick={() => setEditingId(null)}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>Regras cadastradas</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Título</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Frequência</th>
                <th>Próxima execução</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nenhuma regra recorrente cadastrada.</td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.title}</td>
                    <td>{rule.type}</td>
                    <td>{formatMoneyFromCents(rule.amount_cents)}</td>
                    <td>{rule.freq} / {rule.interval_count}</td>
                    <td>{new Date(rule.next_run_at).toLocaleString("pt-BR")}</td>
                    <td>
                      <span className={styles.badge}>{rule.active ? "Ativa" : "Pausada"}</span>
                    </td>
                    <td>
                      <div className={styles.row}>
                        <button className={styles.ghostButton} onClick={() => setEditingId(rule.id)}>
                          Editar
                        </button>
                        <button className={styles.ghostButton} onClick={() => removeRule(rule.id)} disabled={pending}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}
    </main>
  );
}
