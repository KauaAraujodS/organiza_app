"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceAccount, FinanceAttachment, FinanceCategory, FinanceDebt, FinanceTag, FinanceTransaction } from "../types";
import { getAccessTokenOrThrow, supabaseClient } from "@/app/lib/supabase/client";
import { deleteTransactionAction, getAttachmentSignedUrlAction } from "./actions";
import TransactionTable from "./TransactionTable";
import TransactionFormModal from "./TransactionFormModal";

const PAGE_SIZE = 120;

export default function FinanceTransactionsPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [tags, setTags] = useState<FinanceTag[]>([]);
  const [debts, setDebts] = useState<FinanceDebt[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ transaction_id: string; tag_id: string }>>([]);
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (offset = 0) => {
    setMsg("");
    const [accRes, catRes, tagRes, debtRes, txRes] = await Promise.all([
      supabaseClient
        .from("finance_accounts")
        .select("id,name,type,currency,opening_balance_cents,archived,created_at,updated_at,user_id")
        .eq("archived", false)
        .order("name"),
      supabaseClient
        .from("finance_categories")
        .select("id,name,kind,parent_id,color,icon,archived,created_at,updated_at,user_id")
        .eq("archived", false)
        .order("name"),
      supabaseClient
        .from("finance_tags")
        .select("id,name,color,created_at,updated_at,user_id")
        .order("name"),
      supabaseClient
        .from("finance_debts")
        .select("id,name,creditor,total_amount_cents,outstanding_cents,interest_rate_monthly,due_on,status,notes,created_at,updated_at,user_id")
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("finance_transactions")
        .select("id,user_id,type,account_id,category_id,transfer_group_id,recurring_rule_id,installment_group_id,installment_number,installment_total,debt_id,amount_cents,occurred_on,due_on,description,notes,is_cleared,created_at,updated_at")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ]);

    const err = accRes.error || catRes.error || tagRes.error || debtRes.error || txRes.error;
    if (err) {
      setMsg(err.message);
      return;
    }

    const txRows = (txRes.data || []) as FinanceTransaction[];
    const txIds = txRows.map((tx) => tx.id);

    const [txTagRes, attachmentRes] = txIds.length
      ? await Promise.all([
          supabaseClient
            .from("finance_transaction_tags")
            .select("transaction_id,tag_id")
            .in("transaction_id", txIds),
          supabaseClient
            .from("finance_attachments")
            .select("id,transaction_id,file_name,user_id,bucket,storage_path,mime_type,size_bytes,created_at")
            .in("transaction_id", txIds),
        ])
      : [
          { data: [], error: null } as { data: Array<{ transaction_id: string; tag_id: string }>; error: null },
          { data: [], error: null } as { data: FinanceAttachment[]; error: null },
        ];

    const relErr = txTagRes.error || attachmentRes.error;
    if (relErr) {
      setMsg(relErr.message);
      return;
    }

    if (offset === 0) {
      setAccounts((accRes.data || []) as FinanceAccount[]);
      setCategories((catRes.data || []) as FinanceCategory[]);
      setTags((tagRes.data || []) as FinanceTag[]);
      setDebts((debtRes.data || []) as FinanceDebt[]);
      setTransactions(txRows);
      setTagLinks((txTagRes.data || []) as Array<{ transaction_id: string; tag_id: string }>);
      setAttachments((attachmentRes.data || []) as FinanceAttachment[]);
    } else {
      setTransactions((prev) => [...prev, ...txRows]);
      setTagLinks((prev) => [...prev, ...((txTagRes.data || []) as Array<{ transaction_id: string; tag_id: string }>)]);
      setAttachments((prev) => [...prev, ...((attachmentRes.data || []) as FinanceAttachment[])]);
    }

    setHasMore(txRows.length === PAGE_SIZE);
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

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    void load(transactions.length).finally(() => setLoadingMore(false));
  }

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

      {hasMore ? (
        <div className={styles.row}>
          <button className={styles.ghostButton} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando..." : "Carregar mais transações"}
          </button>
        </div>
      ) : null}

      {msg ? <div className={styles.msg}>{msg}</div> : null}

      <TransactionFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => load(0)}
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
