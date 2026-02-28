"use client";

import { useEffect, useState, useTransition } from "react";
import ModalShell from "@/app/ui/ModalShell";
import styles from "../finance.module.css";
import { FinanceAccount, FinanceAccountType } from "../types";
import { createAccountAction, updateAccountAction } from "./actions";
import { getAccessTokenOrThrow } from "@/app/lib/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editing?: FinanceAccount | null;
};

const ACCOUNT_TYPES: Array<{ value: FinanceAccountType; label: string }> = [
  { value: "checking", label: "Conta corrente" },
  { value: "wallet", label: "Carteira" },
  { value: "savings", label: "Poupança" },
  { value: "credit_card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
  { value: "investment", label: "Investimento" },
];

export default function AccountFormModal({ open, onClose, onSuccess, editing }: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState<FinanceAccountType>(editing?.type || "checking");
  const [currency, setCurrency] = useState(editing?.currency || "BRL");
  const [openingBalance, setOpeningBalance] = useState(
    editing ? String((editing.opening_balance_cents / 100).toFixed(2)).replace(".", ",") : "0,00"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name || "");
    setType(editing?.type || "checking");
    setCurrency(editing?.currency || "BRL");
    setOpeningBalance(
      editing ? String((editing.opening_balance_cents / 100).toFixed(2)).replace(".", ",") : "0,00"
    );
    setError("");
  }, [editing, open]);

  async function submit() {
    setError("");
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const cents = Math.round(Number(openingBalance.replace(/\./g, "").replace(",", ".")) * 100);
        const payload = {
          accessToken,
          id: editing?.id,
          name,
          type,
          currency,
          opening_balance_cents: Number.isFinite(cents) ? cents : 0,
        };
        const result = editing
          ? await updateAccountAction(payload)
          : await createAccountAction(payload);
        if (!result.ok) throw new Error(result.error);
        onSuccess();
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Falha ao salvar conta.");
      }
    });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editing ? "Editar conta" : "Nova conta"}
      subtitle="Contas de banco, carteira, poupança ou cartão"
      maxWidthClass="max-w-lg"
      footer={
        <>
          <button className={styles.ghostButton} type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.button} type="button" onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className={styles.col2}>
        <div>
          <label className={styles.label}>Nome</label>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={styles.label}>Tipo</label>
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as FinanceAccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.label}>Moeda</label>
          <input className={styles.input} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </div>
        <div>
          <label className={styles.label}>Saldo inicial</label>
          <input className={styles.input} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0,00" />
        </div>
      </div>
      {error ? <p className={styles.msg}>{error}</p> : null}
    </ModalShell>
  );
}
