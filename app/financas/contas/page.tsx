"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceAccount } from "../types";
import { supabaseClient, getAccessTokenOrThrow } from "@/app/lib/supabase/client";
import { deleteAccountAction } from "./actions";
import AccountFormModal from "./AccountFormModal";
import Money from "../components/Money";

export default function FinanceAccountsPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabaseClient
      .from("finance_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setAccounts([]);
    } else {
      setAccounts((data || []) as FinanceAccount[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  function remove(id: string) {
    setMsg("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteAccountAction({ accessToken, id });
        if (!res.ok) throw new Error(res.error);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao remover conta.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Contas</h1>
            <p className={styles.subtitle}>Gerencie banco, carteira, poupança e cartões</p>
          </div>
          <button className={styles.button} onClick={() => { setEditing(null); setOpen(true); }}>
            + Nova conta
          </button>
        </div>
      </div>

      <FinanceTabs />

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Saldo inicial</th>
                <th>Moeda</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Carregando...</td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhuma conta cadastrada.</td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.type}</td>
                    <td><Money cents={a.opening_balance_cents} /></td>
                    <td>{a.currency}</td>
                    <td>
                      <div className={styles.row}>
                        <button className={styles.ghostButton} onClick={() => { setEditing(a); setOpen(true); }}>
                          Editar
                        </button>
                        <button className={styles.ghostButton} onClick={() => remove(a.id)} disabled={pending}>
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

      <AccountFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={load}
        editing={editing}
      />
    </main>
  );
}
