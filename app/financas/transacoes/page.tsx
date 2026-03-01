"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceAccount, FinanceAttachment, FinanceCategory, FinanceDebt, FinanceTag, FinanceTransaction } from "../types";
import { getAccessTokenOrThrow, supabaseClient } from "@/app/lib/supabase/client";
import { deleteTransactionAction, getAttachmentSignedUrlAction } from "./actions";
import TransactionTable from "./TransactionTable";
import TransactionFormModal from "./TransactionFormModal";

export default function FinanceTransactionsPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [tags, setTags] = useState<FinanceTag[]>([]);
  const [debts, setDebts] = useState<FinanceDebt[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ transaction_id: string; tag_id: string }>>([]);
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setMsg("");
    const [accRes, catRes, tagRes, debtRes, txRes, txTagRes, attachmentRes] = await Promise.all([
      supabaseClient.from("finance_accounts").select("*").eq("archived", false).order("name"),
      supabaseClient.from("finance_categories").select("*").eq("archived", false).order("name"),
      supabaseClient.from("finance_tags").select("*").order("name"),
      supabaseClient.from("finance_debts").select("*").order("created_at", { ascending: false }),
      supabaseClient
        .from("finance_transactions")
        .select("*")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseClient.from("finance_transaction_tags").select("transaction_id,tag_id"),
      supabaseClient.from("finance_attachments").select("*"),
    ]);

    const err = accRes.error || catRes.error || tagRes.error || debtRes.error || txRes.error || txTagRes.error || attachmentRes.error;
    if (err) {
      setMsg(err.message);
      return;
    }

    setAccounts((accRes.data || []) as FinanceAccount[]);
    setCategories((catRes.data || []) as FinanceCategory[]);
    setTags((tagRes.data || []) as FinanceTag[]);
    setDebts((debtRes.data || []) as FinanceDebt[]);
    setTransactions((txRes.data || []) as FinanceTransaction[]);
    setTagLinks((txTagRes.data || []) as Array<{ transaction_id: string; tag_id: string }>);
    setAttachments((attachmentRes.data || []) as FinanceAttachment[]);
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

  const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const tagById = Object.fromEntries(tags.map((t) => [t.id, t]));

  const tagsByTransaction = tagLinks.reduce<Record<string, FinanceTag[]>>((acc, link) => {
    if (!acc[link.transaction_id]) acc[link.transaction_id] = [];
    const tag = tagById[link.tag_id];
    if (tag) acc[link.transaction_id].push(tag);
    return acc;
  }, {});

  const attachmentsByTransaction = attachments.reduce<Record<string, FinanceAttachment[]>>((acc, att) => {
    if (!acc[att.transaction_id]) acc[att.transaction_id] = [];
    acc[att.transaction_id].push(att);
    return acc;
  }, {});

  function remove(tx: FinanceTransaction) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await deleteTransactionAction({ accessToken, id: tx.id });
        if (!res.ok) throw new Error(res.error);
        await load();
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao excluir transação.");
      }
    });
  }

  function openAttachment(attachmentId: string) {
    startTransition(async () => {
      try {
        const accessToken = await getAccessTokenOrThrow();
        const res = await getAttachmentSignedUrlAction({ accessToken, attachment_id: attachmentId, expires_in: 300 });
        if (!res.ok || !res.data?.signed_url) throw new Error(res.error || "Falha ao abrir anexo.");
        window.open(res.data.signed_url, "_blank", "noopener,noreferrer");
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Falha ao abrir anexo.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Transações</h1>
            <p className={styles.subtitle}>Entradas, saídas, transferências, split e anexos</p>
          </div>
          <button className={styles.button} onClick={() => { setEditing(null); setOpen(true); }}>
            + Nova transação
          </button>
        </div>
      </div>

      <FinanceTabs />

      <TransactionTable
        rows={transactions.map((t) => ({
          ...t,
          accounts: accountById[t.account_id] ? { name: accountById[t.account_id].name } : null,
          categories: t.category_id && categoryById[t.category_id] ? { name: categoryById[t.category_id].name } : null,
        }))}
        tagsByTransaction={tagsByTransaction}
        attachmentsByTransaction={attachmentsByTransaction}
        onEdit={(tx) => {
          setEditing(tx);
          setOpen(true);
        }}
        onDelete={remove}
        onOpenAttachment={openAttachment}
      />

      {msg ? <div className={styles.msg}>{msg}</div> : null}

      <TransactionFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={load}
        accounts={accounts}
        categories={categories}
        tags={tags}
        debts={debts}
        editing={editing}
      />

      {pending ? <div className={styles.label}>Processando...</div> : null}
    </main>
  );
}
