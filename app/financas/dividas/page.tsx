"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceDebt, FinanceDebtStatus } from "../types";
import { formatMoneyFromCents, parseMoneyToCents, toDateInput } from "../utils";
import { getAccessTokenOrThrow, supabaseClient } from "@/app/lib/supabase/client";
import { createDebtAction, deleteDebtAction, updateDebtAction } from "./actions";

const STATUS_OPTIONS: Array<{ value: FinanceDebtStatus; label: string }> = [
  { value: "open", label: "Aberta" },
  { value: "renegotiated", label: "Renegociada" },
  { value: "paid", label: "Quitada" },
  { value: "canceled", label: "Cancelada" },
];
const STATUS_LABEL: Record<FinanceDebtStatus, string> = {
  open: "Aberta",
  renegotiated: "Renegociada",
  paid: "Quitada",
  canceled: "Cancelada",
};

export default function FinanceDebtsPage() {
  const [debts, setDebts] = useState<FinanceDebt[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creditor, setCreditor] = useState("");
  const [totalValue, setTotalValue] = useState("0,00");
  const [outstandingValue, setOutstandingValue] = useState("0,00");
  const [interest, setInterest] = useState("");
  const [dueOn, setDueOn] = useState(toDateInput());
  const [status, setStatus] = useState<FinanceDebtStatus>("open");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setMsg("");
    const { data, error } = await supabaseClient
      .from("finance_debts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      return;
    }

    setDebts((data || []) as FinanceDebt[]);
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
      setCreditor("");
      setTotalValue("0,00");
      setOutstandingValue("0,00");
      setInterest("");
      setDueOn(toDateInput());
      setStatus("open");
      setNotes("");
      return;
    }

    const debt = debts.find((d) => d.id === editingId);
    if (!debt) return;
    setName(debt.name);
    setCreditor(debt.creditor || "");
    setTotalValue(String((debt.total_amount_cents / 100).toFixed(2)).replace(".", ","));
    setOutstandingValue(String((debt.outstanding_cents / 100).toFixed(2)).replace(".", ","));
    setInterest(debt.interest_rate_monthly != null ? String(debt.interest_rate_monthly) : "");
    setDueOn(debt.due_on || "");
    setStatus(debt.status);
    setNotes(debt.notes || "");
  }, [editingId, debts]);

  const totals = useMemo(() => {
    const total = debts.reduce((acc, d) => acc + d.total_amount_cents, 0);
    const outstanding = debts.reduce((acc, d) => acc + d.outstanding_cents, 0);
    return { total, outstanding };
  }, [debts]);

  function save() {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = {
          accessToken,
          id: editingId || undefined,
          name,
          creditor,
          total_amount_cents: parseMoneyToCents(totalValue),
          outstanding_cents: parseMoneyToCents(outstandingValue),
          interest_rate_monthly: interest ? Number(interest) : null,
          due_on: dueOn || null,
          status,
          notes,
        };

        const res = editingId ? await updateDebtAction(payload) : await createDebtAction(payload);
        if (!res.ok) throw new Error(res.error);

        setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar dívida.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteDebtAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        if (editingId === id) setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir dívida.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Dívidas</h1>
        <p className={styles.subtitle}>Controle de saldos devedores e status</p>
      </div>

      <FinanceTabs />

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>Como funciona</h3>
        <p className={styles.label}><strong>1)</strong> Preencha os dados da dívida no formulário abaixo.</p>
        <p className={styles.label}><strong>2)</strong> Clique em <strong>Criar dívida</strong> para salvar.</p>
        <p className={styles.label}><strong>3)</strong> Use <strong>Editar</strong> ou <strong>Excluir</strong> na lista para manter atualizado.</p>
        <p className={styles.label}><strong>Total contratado</strong> = valor original da dívida.</p>
        <p className={styles.label}><strong>Saldo devedor</strong> = quanto ainda falta pagar hoje.</p>
        <p className={styles.label}>
          Status: <strong>Aberta</strong> (ativa), <strong>Renegociada</strong> (condições alteradas),{" "}
          <strong>Quitada</strong> (paga), <strong>Cancelada</strong> (desconsiderada).
        </p>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.span6}`}>
          <div className={styles.label}>Total contratado</div>
          <div className={styles.kpi}>{formatMoneyFromCents(totals.total)}</div>
        </div>
        <div className={`${styles.card} ${styles.span6}`}>
          <div className={styles.label}>Saldo devedor</div>
          <div className={`${styles.kpi} ${styles.textDanger}`}>{formatMoneyFromCents(totals.outstanding)}</div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>{editingId ? "Editar dívida" : "Nova dívida"}</h3>
        <div className={styles.col3}>
          <div>
            <label className={styles.label}>Nome da dívida</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Empréstimo Banco X" />
            <p className={styles.helpText}>Nome fácil para identificar essa dívida.</p>
          </div>
          <div>
            <label className={styles.label}>Credor</label>
            <input className={styles.input} value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Ex: Nubank, Itaú, Loja Y" />
            <p className={styles.helpText}>Pessoa, banco ou empresa para quem você deve.</p>
          </div>
          <div>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as FinanceDebtStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className={styles.helpText}>Situação atual da dívida.</p>
          </div>
          <div>
            <label className={styles.label}>Valor total contratado</label>
            <input className={styles.input} value={totalValue} onChange={(e) => setTotalValue(e.target.value)} placeholder="Ex: 12000,00" />
            <p className={styles.helpText}>Valor inicial acordado ao contratar.</p>
          </div>
          <div>
            <label className={styles.label}>Saldo devedor atual</label>
            <input className={styles.input} value={outstandingValue} onChange={(e) => setOutstandingValue(e.target.value)} placeholder="Ex: 8500,00" />
            <p className={styles.helpText}>Quanto falta pagar neste momento.</p>
          </div>
          <div>
            <label className={styles.label}>Juros mensal (%) - opcional</label>
            <input className={styles.input} value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Ex: 2,35" />
            <p className={styles.helpText}>Taxa de juros ao mês, se existir.</p>
          </div>
          <div>
            <label className={styles.label}>Data de vencimento</label>
            <input className={styles.input} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            <p className={styles.helpText}>Data limite de pagamento da dívida.</p>
          </div>
        </div>
        <label className={`${styles.label} ${styles.mt8}`}>Observações</label>
        <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações importantes sobre negociação e pagamento" />
        <p className={styles.helpText}>Use para registrar detalhes de acordo, parcelas ou contato.</p>

        <div className={`${styles.row} ${styles.mt8}`}>
          <button className={styles.button} disabled={pending || !name.trim()} onClick={save}>
            {editingId ? "Atualizar dívida" : "Criar dívida"}
          </button>
          {editingId ? (
            <button className={styles.ghostButton} onClick={() => setEditingId(null)}>Cancelar edição</button>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>Lista de dívidas</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Credor</th>
                <th>Status</th>
                <th>Valor contratado</th>
                <th>Saldo devedor</th>
                <th>Vencimento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {debts.length === 0 ? (
                <tr><td colSpan={7}>Nenhuma dívida cadastrada.</td></tr>
              ) : (
                debts.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.creditor || "-"}</td>
                    <td><span className={styles.badge}>{STATUS_LABEL[d.status]}</span></td>
                    <td>{formatMoneyFromCents(d.total_amount_cents)}</td>
                    <td>{formatMoneyFromCents(d.outstanding_cents)}</td>
                    <td>{d.due_on ? new Date(`${d.due_on}T00:00:00`).toLocaleDateString("pt-BR") : "-"}</td>
                    <td>
                      <div className={styles.row}>
                        <button className={styles.ghostButton} onClick={() => setEditingId(d.id)}>Editar</button>
                        <button className={styles.ghostButton} onClick={() => remove(d.id)} disabled={pending}>Excluir</button>
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
