"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import ModalShell from "@/app/ui/ModalShell";
import styles from "../finance.module.css";
import {
  FinanceAccount,
  FinanceCategory,
  FinanceDebt,
  FinanceTag,
  FinanceTransaction,
  FinanceTransactionInput,
} from "../types";
import { parseMoneyToCents, toDateInput } from "../utils";
import { getAccessTokenOrThrow } from "@/app/lib/supabase/client";
import { createTransactionAction, updateTransactionAction, uploadAttachmentAction } from "./actions";
import AttachmentUpload from "./AttachmentUpload";

type SplitRow = { category_id: string; amount: string };

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

export default function TransactionFormModal({
  open,
  onClose,
  onSuccess,
  accounts,
  categories,
  tags,
  debts,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  tags: FinanceTag[];
  debts: FinanceDebt[];
  editing?: FinanceTransaction | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [type, setType] = useState<FinanceTransactionInput["type"]>("expense");
  const [amount, setAmount] = useState("0,00");
  const [occurredOn, setOccurredOn] = useState(toDateInput());
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [debtId, setDebtId] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [enableSplit, setEnableSplit] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);

  const categoryOptions = useMemo(
    () => categories.filter((c) => !c.archived && (c.kind === "both" || c.kind === type || type === "transfer")),
    [categories, type]
  );

  useEffect(() => {
    if (!open) return;

    setType(editing?.type || "expense");
    setAmount(
      editing ? String((Math.abs(editing.amount_cents) / 100).toFixed(2)).replace(".", ",") : "0,00"
    );
    setOccurredOn(editing?.occurred_on || toDateInput());
    setAccountId(editing?.account_id || accounts[0]?.id || "");
    setDestinationAccountId("");
    setCategoryId(editing?.category_id || "");
    setDescription(editing?.description || "");
    setNotes(editing?.notes || "");
    setSelectedTags([]);
    setDebtId(editing?.debt_id || "");
    setInstallmentCount("1");
    setEnableSplit(false);
    setSplits([]);
    setAttachments([]);
    setError("");
  }, [open, editing, accounts]);

  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function submit() {
    setError("");

    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const amountCents = parseMoneyToCents(amount);
        if (amountCents <= 0) throw new Error("Valor precisa ser maior que zero.");

        const payload: FinanceTransactionInput = {
          accessToken,
          type,
          amount_cents: amountCents,
          occurred_on: occurredOn,
          account_id: accountId,
          destination_account_id: type === "transfer" ? destinationAccountId : undefined,
          category_id: type !== "transfer" && !enableSplit ? categoryId || undefined : undefined,
          debt_id: type !== "transfer" ? debtId || undefined : undefined,
          installment_count: type !== "transfer" ? Number(installmentCount) : undefined,
          description,
          notes,
          tag_ids: selectedTags,
          splits:
            type !== "transfer" && enableSplit
              ? splits.map((s) => ({
                  category_id: s.category_id,
                  amount_cents: parseMoneyToCents(s.amount),
                }))
              : undefined,
        };

        const result = editing
          ? await updateTransactionAction({ ...payload, id: editing.id })
          : await createTransactionAction(payload);

        if (!result.ok) throw new Error(result.error);

        const transactionId = result.data?.ids?.[0];
        if (!editing && transactionId && attachments.length > 0) {
          for (const file of attachments) {
            const arrBuffer = await file.arrayBuffer();
            const base64 = arrayBufferToBase64(arrBuffer);
            const uploadResult = await uploadAttachmentAction({
              accessToken,
              transaction_id: transactionId,
              file_name: file.name,
              mime_type: file.type,
              base64_data: base64,
            });
            if (!uploadResult.ok) throw new Error(uploadResult.error);
          }
        }

        await onSuccess();
        onClose();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Falha ao salvar transação.");
      }
    });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editing ? "Editar transação" : "Nova transação"}
      subtitle="Entrada, saída, transferência, split e anexos"
      maxWidthClass="max-w-2xl"
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
      <div className={styles.col3}>
        <div>
          <label className={styles.label}>Tipo</label>
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as FinanceTransactionInput["type"])}>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
            <option value="transfer">Transferência</option>
          </select>
        </div>
        <div>
          <label className={styles.label}>Valor</label>
          <input className={styles.input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className={styles.label}>Data</label>
          <input className={styles.input} type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </div>
      </div>

      <div className={styles.col2}>
        <div>
          <label className={styles.label}>Conta origem</label>
          <select className={styles.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {type === "transfer" ? (
          <div>
            <label className={styles.label}>Conta destino</label>
            <select className={styles.select} value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)}>
              <option value="">Selecione</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div>
            <label className={styles.label}>Categoria</label>
            <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={enableSplit}>
              <option value="">Sem categoria</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {type !== "transfer" ? (
        <div className={styles.col2}>
          <div>
            <label className={styles.label}>Vincular dívida (opcional)</label>
            <select className={styles.select} value={debtId} onChange={(e) => setDebtId(e.target.value)}>
              <option value="">Sem vínculo</option>
              {debts
                .filter((d) => d.status !== "paid" && d.status !== "canceled")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={styles.label}>Parcelas</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={60}
              value={installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div>
        <label className={styles.label}>Descrição</label>
        <input className={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label className={styles.label}>Observações</label>
        <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {type !== "transfer" ? (
        <div className={styles.card}>
          <div className={styles.row}>
            <label className={styles.label}>
              <input type="checkbox" checked={enableSplit} onChange={(e) => setEnableSplit(e.target.checked)} /> Split por categorias
            </label>
            {enableSplit ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setSplits((prev) => [...prev, { category_id: "", amount: "0,00" }])}
              >
                + Adicionar linha
              </button>
            ) : null}
          </div>

          {enableSplit ? (
            <div className={styles.col2}>
              {splits.map((split, idx) => (
                <div key={`${split.category_id}-${idx}`} className={styles.row}>
                  <select
                    className={styles.select}
                    value={split.category_id}
                    onChange={(e) =>
                      setSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, category_id: e.target.value } : p)))
                    }
                  >
                    <option value="">Categoria</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.input}
                    value={split.amount}
                    onChange={(e) =>
                      setSplits((prev) => prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p)))
                    }
                    placeholder="0,00"
                  />
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className={styles.label}>Tags</label>
        <div className={styles.row}>
          {tags.map((tag) => (
            <label key={tag.id} className={styles.badge}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.id)}
                onChange={() => toggleTag(tag.id)}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </div>

      {!editing ? <AttachmentUpload onFilesChange={setAttachments} /> : null}

      {error ? <p className={styles.msg}>{error}</p> : null}
    </ModalShell>
  );
}
