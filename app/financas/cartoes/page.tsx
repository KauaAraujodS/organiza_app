"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceAccount, FinanceCreditCardProfile } from "../types";
import { getAccessTokenOrThrow, supabaseClient } from "@/app/lib/supabase/client";
import { createCardProfileAction, deleteCardProfileAction, updateCardProfileAction } from "./actions";
import { formatMoneyFromCents, parseMoneyToCents } from "../utils";

export default function FinanceCardsPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [profiles, setProfiles] = useState<FinanceCreditCardProfile[]>([]);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [closingDay, setClosingDay] = useState("8");
  const [dueDay, setDueDay] = useState("15");
  const [limitValue, setLimitValue] = useState("0,00");
  const [currentDueValue, setCurrentDueValue] = useState("0,00");
  const [bestPurchaseDay, setBestPurchaseDay] = useState("");

  const load = useCallback(async () => {
    setMsg("");
    const [accRes, profileRes] = await Promise.all([
      supabaseClient.from("finance_accounts").select("*").eq("type", "credit_card").eq("archived", false).order("name"),
      supabaseClient.from("finance_credit_card_profiles").select("*").order("created_at", { ascending: false }),
    ]);

    const err = accRes.error || profileRes.error;
    if (err) {
      setMsg(err.message);
      return;
    }

    setAccounts((accRes.data || []) as FinanceAccount[]);
    setProfiles((profileRes.data || []) as FinanceCreditCardProfile[]);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!editingId) {
      setAccountId(accounts[0]?.id || "");
      setClosingDay("8");
      setDueDay("15");
      setLimitValue("0,00");
      setCurrentDueValue("0,00");
      setBestPurchaseDay("");
      return;
    }

    const profile = profiles.find((p) => p.id === editingId);
    if (!profile) return;
    setAccountId(profile.account_id);
    setClosingDay(String(profile.closing_day));
    setDueDay(String(profile.due_day));
    setLimitValue(String(((profile.credit_limit_cents || 0) / 100).toFixed(2)).replace(".", ","));
    setCurrentDueValue(String(((profile.current_due_cents || 0) / 100).toFixed(2)).replace(".", ","));
    setBestPurchaseDay(profile.best_purchase_day ? String(profile.best_purchase_day) : "");
  }, [editingId, profiles, accounts]);

  const accountNameById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
  const totalCardsDue = useMemo(
    () => profiles.reduce((acc, profile) => acc + (profile.current_due_cents || 0), 0),
    [profiles]
  );

  function save() {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const payload = {
          accessToken,
          id: editingId || undefined,
          account_id: accountId,
          closing_day: Number(closingDay),
          due_day: Number(dueDay),
          credit_limit_cents: parseMoneyToCents(limitValue),
          current_due_cents: parseMoneyToCents(currentDueValue),
          best_purchase_day: bestPurchaseDay ? Number(bestPurchaseDay) : null,
        };

        const res = editingId ? await updateCardProfileAction(payload) : await createCardProfileAction(payload);
        if (!res.ok) throw new Error(res.error);
        setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao salvar cartão.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteCardProfileAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        if (editingId === id) setEditingId(null);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao remover cartão.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div>
        <h1 className={styles.title}>Cartões</h1>
        <p className={styles.subtitle}>Fechamento, vencimento e limite do cartão</p>
      </div>

      <FinanceTabs />

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>Resumo de cartões</h3>
        <div className={styles.label}>Total geral para pagar nas faturas</div>
        <div className={`${styles.kpi} ${styles.textDanger}`}>{formatMoneyFromCents(totalCardsDue)}</div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>{editingId ? "Editar cartão" : "Novo cartão"}</h3>
        <p className={`${styles.label} ${styles.h0} ${styles.mb10}`}>
          Configure a regra da fatura para a conta cartão selecionada.
        </p>
        <div className={styles.col3}>
          <div>
            <label className={styles.label}>Conta cartão</label>
            <select className={styles.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Selecione a conta cartão</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            <p className={styles.label}>Conta de cartão criada na aba Contas.</p>
          </div>

          <div>
            <label className={styles.label}>Dia de fechamento</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
              placeholder="Ex: 8"
            />
            <p className={styles.label}>Dia que encerra a fatura do mês.</p>
          </div>

          <div>
            <label className={styles.label}>Dia de vencimento</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="Ex: 15"
            />
            <p className={styles.label}>Dia para pagamento da fatura.</p>
          </div>

          <div>
            <label className={styles.label}>Limite do cartão (opcional)</label>
            <input
              className={styles.input}
              value={limitValue}
              onChange={(e) => setLimitValue(e.target.value)}
              placeholder="Ex: 5000,00"
            />
            <p className={styles.label}>Use 0,00 se não quiser controlar limite.</p>
          </div>
          <div>
            <label className={styles.label}>Valor atual da fatura</label>
            <input
              className={styles.input}
              value={currentDueValue}
              onChange={(e) => setCurrentDueValue(e.target.value)}
              placeholder="Ex: 1250,90"
            />
            <p className={styles.label}>Quanto você precisa pagar neste cartão agora.</p>
          </div>

          <div>
            <label className={styles.label}>Melhor dia de compra (opcional)</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={31}
              value={bestPurchaseDay}
              onChange={(e) => setBestPurchaseDay(e.target.value)}
              placeholder="Ex: 9"
            />
            <p className={styles.label}>Dia recomendado para cair na próxima fatura.</p>
          </div>
        </div>
        <div className={`${styles.row} ${styles.mt8}`}>
          <button className={styles.button} disabled={pending || !accountId} onClick={save}>
            {editingId ? "Atualizar perfil" : "Criar perfil"}
          </button>
          {editingId ? (
            <button className={styles.ghostButton} onClick={() => setEditingId(null)}>Cancelar edição</button>
          ) : null}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>Perfis de cartão</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Conta</th>
                <th>Fechamento</th>
                <th>Vencimento</th>
                <th>Valor a pagar</th>
                <th>Limite</th>
                <th>Melhor dia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nenhum cartão configurado.</td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id}>
                    <td>{accountNameById[p.account_id] || "-"}</td>
                    <td>Dia {p.closing_day}</td>
                    <td>Dia {p.due_day}</td>
                    <td>{formatMoneyFromCents(p.current_due_cents || 0)}</td>
                    <td>{p.credit_limit_cents ? formatMoneyFromCents(p.credit_limit_cents) : "-"}</td>
                    <td>{p.best_purchase_day ? `Dia ${p.best_purchase_day}` : "-"}</td>
                    <td>
                      <div className={styles.row}>
                        <button className={styles.ghostButton} onClick={() => setEditingId(p.id)}>Editar</button>
                        <button className={styles.ghostButton} onClick={() => remove(p.id)} disabled={pending}>Excluir</button>
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
