"use client";

import styles from "../finance.module.css";
import { FinanceAttachment, FinanceTag, FinanceTransaction } from "../types";
import Money from "../components/Money";

type TxRow = FinanceTransaction & {
  accounts?: { name: string } | null;
  categories?: { name: string } | null;
};

export default function TransactionTable({
  rows,
  tagsByTransaction,
  attachmentsByTransaction,
  onEdit,
  onDelete,
  onOpenAttachment,
}: {
  rows: TxRow[];
  tagsByTransaction: Record<string, FinanceTag[]>;
  attachmentsByTransaction: Record<string, FinanceAttachment[]>;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
  onOpenAttachment: (attachmentId: string) => void;
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.noTopMargin}>Transações</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Conta</th>
              <th>Categoria</th>
              <th>Tags</th>
              <th>Anexos</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>Nenhuma transação cadastrada.</td>
              </tr>
            ) : (
              rows.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(`${tx.occurred_on}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td>{tx.description || "-"}</td>
                  <td>{tx.accounts?.name || "-"}</td>
                  <td>{tx.categories?.name || "-"}</td>
                  <td>
                    <div className={styles.row}>
                      {(tagsByTransaction[tx.id] || []).map((tag) => (
                        <span key={tag.id} className={styles.badge}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className={styles.row}>
                      {(attachmentsByTransaction[tx.id] || []).map((att) => (
                        <button
                          key={att.id}
                          className={styles.ghostButton}
                          type="button"
                          onClick={() => onOpenAttachment(att.id)}
                        >
                          {att.file_name}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Money
                      cents={tx.amount_cents}
                      className={tx.amount_cents < 0 ? styles.textDanger : styles.textSuccess}
                    />
                  </td>
                  <td>
                    <div className={styles.row}>
                      <button className={styles.ghostButton} onClick={() => onEdit(tx)}>Editar</button>
                      <button className={styles.ghostButton} onClick={() => onDelete(tx)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
