"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./finance.module.css";
import { monthRange } from "./utils";
import { FinanceAccount, FinanceCategory, FinanceCreditCardProfile, FinanceTransaction } from "./types";
import { supabaseClient } from "@/app/lib/supabase/client";
import FinanceTabs from "./components/FinanceTabs";
import FinanceKpis from "./components/FinanceKpis";
import RecentTransactions from "./components/RecentTransactions";

export default function FinanceDashboardPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [cardProfiles, setCardProfiles] = useState<FinanceCreditCardProfile[]>([]);
  const [monthRows, setMonthRows] = useState<Array<{ amount_cents: number; category_id: string | null; due_on: string | null }>>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setMsg("");
    const { start, end } = monthRange(new Date());

    const [accountsRes, categoriesRes, txRes, monthRes, cardsRes] = await Promise.all([
      supabaseClient
        .from("finance_accounts")
        .select("id,name,opening_balance_cents")
        .eq("archived", false),
      supabaseClient
        .from("finance_categories")
        .select("id,name")
        .eq("archived", false),
      supabaseClient
        .from("finance_transactions")
        .select("id,account_id,category_id,amount_cents,occurred_on,due_on,description,notes,type,is_cleared,created_at,updated_at,user_id,transfer_group_id,recurring_rule_id,installment_group_id,installment_number,installment_total,debt_id")
        .order("occurred_on", { ascending: false })
        .limit(30),
      supabaseClient
        .from("finance_transactions")
        .select("amount_cents,category_id,due_on")
        .gte("occurred_on", start)
        .lte("occurred_on", end),
      supabaseClient
        .from("finance_credit_card_profiles")
        .select("id,account_id,current_due_cents"),
    ]);

    const err = accountsRes.error || categoriesRes.error || txRes.error || monthRes.error || cardsRes.error;
    if (err) {
      setMsg(err.message);
      return;
    }

    setAccounts((accountsRes.data || []) as FinanceAccount[]);
    setCategories((categoriesRes.data || []) as FinanceCategory[]);
    setTransactions((txRes.data || []) as FinanceTransaction[]);
    setCardProfiles((cardsRes.data || []) as FinanceCreditCardProfile[]);

    setMonthRows((monthRes.data || []) as Array<{ amount_cents: number; category_id: string | null; due_on: string | null }>);
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

  const accountNameById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );

  const categoryNameById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const totalBalance = useMemo(() => {
    const opening = accounts.reduce((acc, a) => acc + a.opening_balance_cents, 0);
    const flow = transactions.reduce((acc, tx) => acc + tx.amount_cents, 0);
    return opening + flow;
  }, [accounts, transactions]);

  const monthIncome = useMemo(
    () => monthRows.filter((r) => r.amount_cents > 0).reduce((acc, r) => acc + r.amount_cents, 0),
    [monthRows]
  );
  const monthExpense = useMemo(
    () => monthRows.filter((r) => r.amount_cents < 0).reduce((acc, r) => acc + r.amount_cents, 0),
    [monthRows]
  );

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of monthRows) {
      if (r.amount_cents >= 0 || !r.category_id) continue;
      map[r.category_id] = (map[r.category_id] || 0) + Math.abs(r.amount_cents);
    }
    return Object.entries(map)
      .map(([id, total]) => ({ id, total, name: categoryNameById[id] || "Sem categoria" }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthRows, categoryNameById]);

  const upcoming = useMemo(() => {
    const today = new Date();
    const max = new Date(today);
    max.setDate(max.getDate() + 7);
    return monthRows.filter((r) => {
      if (!r.due_on || r.amount_cents >= 0) return false;
      const d = new Date(`${r.due_on}T00:00:00`);
      return d >= today && d <= max;
    }).length;
  }, [monthRows]);

  const totalCardsDue = useMemo(
    () => cardProfiles.reduce((acc, profile) => acc + (profile.current_due_cents || 0), 0),
    [cardProfiles]
  );

  const cardsDueByName = useMemo(
    () =>
      cardProfiles
        .map((profile) => ({
          id: profile.id,
          name: accountNameById[profile.account_id] || "Cartão sem nome",
          dueCents: profile.current_due_cents || 0,
        }))
        .sort((a, b) => b.dueCents - a.dueCents),
    [cardProfiles, accountNameById]
  );

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Finanças</h1>
        <p className={styles.subtitle}>Visão geral do seu fluxo financeiro</p>
      </div>

      <FinanceTabs />

      <FinanceKpis
        totalBalance={totalBalance}
        monthIncome={monthIncome}
        monthExpense={monthExpense}
        upcomingCount={upcoming}
        cardsDueTotal={totalCardsDue}
      />

      <div className={styles.insightGrid}>
        <div className={`${styles.card} ${styles.insightCard}`}>
          <h3 className={styles.noTopMargin}>Top categorias (mês)</h3>
          <ul className={styles.inlineList}>
            {topCategories.length === 0 ? (
              <li className={styles.label}>Sem despesas no mês.</li>
            ) : (
              topCategories.map((c) => (
                <li key={c.id}>
                  {c.name}: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.total / 100)}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={`${styles.card} ${styles.insightCard}`}>
          <h3 className={styles.noTopMargin}>Cartões para pagar</h3>
          {cardsDueByName.length === 0 ? (
            <p className={styles.label}>Nenhum cartão com valor de fatura informado.</p>
          ) : (
            <ul className={styles.inlineList}>
              {cardsDueByName.map((row) => (
                <li key={row.id}>
                  {row.name}:{" "}
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.dueCents / 100)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.transactionsBlock}>
        <RecentTransactions
          rows={transactions}
          accountNameById={accountNameById}
          categoryNameById={categoryNameById}
        />
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}
    </main>
  );
}
