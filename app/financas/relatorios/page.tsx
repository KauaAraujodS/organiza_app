"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceCategory, FinanceTransaction } from "../types";
import { formatMoneyFromCents, monthRange } from "../utils";
import { supabaseClient } from "@/app/lib/supabase/client";

type TxLite = Pick<FinanceTransaction, "id" | "amount_cents" | "occurred_on" | "description" | "category_id">;

type PieSlice = {
  id: string;
  name: string;
  color: string;
  value: number;
  pct: number;
};

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function FinanceReportsPage() {
  const [transactions, setTransactions] = useState<TxLite[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setMsg("");
    const [txRes, catRes] = await Promise.all([
      supabaseClient
        .from("finance_transactions")
        .select("id,amount_cents,occurred_on,description,category_id")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseClient.from("finance_categories").select("*").eq("archived", false),
    ]);

    const err = txRes.error || catRes.error;
    if (err) {
      setMsg(err.message);
      return;
    }

    setTransactions((txRes.data || []) as TxLite[]);
    setCategories((catRes.data || []) as FinanceCategory[]);
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

  const categoryById = useMemo(
    () =>
      Object.fromEntries(
        categories.map((c) => [c.id, c])
      ),
    [categories]
  );

  const monthInfo = useMemo(() => {
    const { start, end } = monthRange(new Date());
    const monthRows = transactions.filter((tx) => tx.occurred_on >= start && tx.occurred_on <= end);
    const income = monthRows.filter((tx) => tx.amount_cents > 0).reduce((acc, tx) => acc + tx.amount_cents, 0);
    const expense = monthRows.filter((tx) => tx.amount_cents < 0).reduce((acc, tx) => acc + Math.abs(tx.amount_cents), 0);
    return { monthRows, income, expense };
  }, [transactions]);

  const pieData = useMemo(() => {
    const expenseByCategory: Record<string, number> = {};
    for (const tx of monthInfo.monthRows) {
      if (tx.amount_cents >= 0) continue;
      const key = tx.category_id || "uncategorized";
      expenseByCategory[key] = (expenseByCategory[key] || 0) + Math.abs(tx.amount_cents);
    }

    const total = Object.values(expenseByCategory).reduce((acc, v) => acc + v, 0);
    const ranked = Object.entries(expenseByCategory)
      .map(([id, value]) => {
        const category = id === "uncategorized" ? null : categoryById[id];
        return {
          id,
          name: category?.name || "Sem categoria",
          color: category?.color || "#64748b",
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
        } satisfies PieSlice;
      })
      .sort((a, b) => b.value - a.value);

    return { total, slices: ranked.slice(0, 6) };
  }, [monthInfo.monthRows, categoryById]);

  const pieGradient = useMemo(() => {
    if (pieData.slices.length === 0 || pieData.total <= 0) {
      return "conic-gradient(#1f2b3a 0deg 360deg)";
    }
    let cursor = 0;
    const stops = pieData.slices.map((slice) => {
      const span = (slice.value / pieData.total) * 360;
      const start = cursor;
      const end = cursor + span;
      cursor = end;
      return `${slice.color} ${start}deg ${end}deg`;
    });
    if (cursor < 360) {
      stops.push(`#1f2b3a ${cursor}deg 360deg`);
    }
    return `conic-gradient(${stops.join(",")})`;
  }, [pieData]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const key = monthKey(d);
      return {
        key,
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        income: 0,
        expense: 0,
      };
    });
    const map = Object.fromEntries(months.map((m) => [m.key, m]));
    for (const tx of transactions) {
      const d = new Date(`${tx.occurred_on}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      const bucket = map[key];
      if (!bucket) continue;
      if (tx.amount_cents > 0) bucket.income += tx.amount_cents;
      if (tx.amount_cents < 0) bucket.expense += Math.abs(tx.amount_cents);
    }
    const maxValue = Math.max(
      1,
      ...months.map((m) => Math.max(m.income, m.expense))
    );
    return { months, maxValue };
  }, [transactions]);

  const fixedInsights = useMemo(() => {
    const insights: string[] = [];
    const monthBalance = monthInfo.income - monthInfo.expense;
    const savingsRate = monthInfo.income > 0 ? (monthBalance / monthInfo.income) * 100 : 0;
    if (monthInfo.income === 0 && monthInfo.expense > 0) {
      insights.push("Este mês teve somente saídas. Revise despesas fixas e despesas não essenciais.");
    } else if (savingsRate < 10) {
      insights.push("Sua taxa de sobra no mês está baixa (menos de 10%). Tente reduzir a maior categoria de gasto.");
    } else {
      insights.push("Boa evolução: sua taxa de sobra está acima de 10% neste mês.");
    }

    if (pieData.slices.length > 0) {
      const top = pieData.slices[0];
      if (top.pct >= 35) {
        insights.push(`A categoria ${top.name} concentra ${top.pct.toFixed(1)}% dos gastos. Vale definir um limite mensal.`);
      } else {
        insights.push("Seus gastos estão distribuídos entre categorias, o que reduz concentração de risco.");
      }
    }

    const recentExpenses = transactions.filter((tx) => tx.amount_cents < 0).slice(0, 15);
    const avgExpense = recentExpenses.length
      ? recentExpenses.reduce((acc, tx) => acc + Math.abs(tx.amount_cents), 0) / recentExpenses.length
      : 0;
    if (avgExpense > 0) {
      insights.push(`Ticket médio das últimas saídas: ${formatMoneyFromCents(Math.round(avgExpense))}.`);
    }

    return insights;
  }, [monthInfo.income, monthInfo.expense, pieData.slices, transactions]);

  const topExpenses = useMemo(
    () => transactions.filter((tx) => tx.amount_cents < 0).slice(0, 8),
    [transactions]
  );

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Relatórios</h1>
        <p className={styles.subtitle}>Análise dos seus gastos, entradas e tendências</p>
      </div>

      <FinanceTabs />

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.span4}`}>
          <div className={styles.label}>Entradas no mês</div>
          <div className={`${styles.kpi} ${styles.textSuccess}`}>{formatMoneyFromCents(monthInfo.income)}</div>
        </div>
        <div className={`${styles.card} ${styles.span4}`}>
          <div className={styles.label}>Saídas no mês</div>
          <div className={`${styles.kpi} ${styles.textDanger}`}>{formatMoneyFromCents(monthInfo.expense)}</div>
        </div>
        <div className={`${styles.card} ${styles.span4}`}>
          <div className={styles.label}>Saldo do mês</div>
          <div className={`${styles.kpi} ${monthInfo.income - monthInfo.expense >= 0 ? styles.textSuccess : styles.textDanger}`}>
            {formatMoneyFromCents(monthInfo.income - monthInfo.expense)}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.span6}`}>
          <h3 className={styles.noTopMargin}>Gastos por categoria (pizza)</h3>
          <div className={`${styles.row} ${styles.rowCenter} ${styles.gap1}`}>
            <div
              className={styles.pieChart}
              style={{ "--pie-gradient": pieGradient } as CSSProperties}
            />
            <div className={styles.wFull}>
              {pieData.slices.length === 0 ? (
                <p className={styles.label}>Sem despesas no mês para montar o gráfico.</p>
              ) : (
                pieData.slices.map((slice) => (
                  <div key={slice.id} className={`${styles.row} ${styles.rowBetween} ${styles.mb6}`}>
                    <div className={styles.row}>
                      <span
                        className={styles.legendDot}
                        style={{ "--legend-color": slice.color } as CSSProperties}
                      />
                      <span>{slice.name}</span>
                    </div>
                    <span className={styles.label}>
                      {slice.pct.toFixed(1)}% ({formatMoneyFromCents(slice.value)})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.span6}`}>
          <h3 className={styles.noTopMargin}>Tendência dos últimos 6 meses</h3>
          <div className={`${styles.row} ${styles.rowEnd} ${styles.gap085}`}>
            {monthlyTrend.months.map((m) => (
              <div key={m.key} className={styles.trendCol}>
                <div className={styles.trendBarsWrap}>
                  <div
                    title={`Entradas: ${formatMoneyFromCents(m.income)}`}
                    className={`${styles.trendBar} ${styles.trendBarIncome}`}
                    style={{ "--trend-height": `${(m.income / monthlyTrend.maxValue) * 100}%` } as CSSProperties}
                  />
                  <div
                    title={`Saídas: ${formatMoneyFromCents(m.expense)}`}
                    className={`${styles.trendBar} ${styles.trendBarExpense}`}
                    style={{ "--trend-height": `${(m.expense / monthlyTrend.maxValue) * 100}%` } as CSSProperties}
                  />
                </div>
                <div className={`${styles.label} ${styles.mt6} ${styles.textCenter}`}>{m.label}</div>
              </div>
            ))}
          </div>
          <div className={`${styles.row} ${styles.mt12}`}>
            <span className={styles.badge}>
              <span className={styles.badgeColorDot} style={{ "--badge-color": "#22c55e" } as CSSProperties} />
              Entradas
            </span>
            <span className={styles.badge}>
              <span className={styles.badgeColorDot} style={{ "--badge-color": "#ef4444" } as CSSProperties} />
              Saídas
            </span>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.span6}`}>
          <h3 className={styles.noTopMargin}>Dicas para melhorar</h3>
          <ul className={`${styles.inlineList} ${styles.inlineListSpaced}`}>
            {fixedInsights.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
        <div className={`${styles.card} ${styles.span6}`}>
          <h3 className={styles.noTopMargin}>Maiores saídas recentes</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {topExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.label}>Sem saídas registradas.</td>
                  </tr>
                ) : (
                  topExpenses.map((tx) => (
                    <tr key={tx.id}>
                      <td>{new Date(`${tx.occurred_on}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td>{tx.description || "(sem descrição)"}</td>
                      <td>{tx.category_id ? categoryById[tx.category_id]?.name || "-" : "-"}</td>
                      <td className={styles.textDanger}>{formatMoneyFromCents(Math.abs(tx.amount_cents))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}
    </main>
  );
}
