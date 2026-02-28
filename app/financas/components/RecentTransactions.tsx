import { FinanceTransaction } from "../types";
import styles from "../finance.module.css";
import Money from "./Money";

export default function RecentTransactions({
  rows,
  accountNameById,
  categoryNameById,
}: {
  rows: FinanceTransaction[];
  accountNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.noTopMargin}>Transações recentes</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Conta</th>
              <th>Categoria</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.label}>
                  Nenhuma transação cadastrada.
                </td>
              </tr>
            ) : (
              rows.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(`${tx.occurred_on}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td>{tx.description || "(sem descrição)"}</td>
                  <td>{accountNameById[tx.account_id] || "-"}</td>
                  <td>{tx.category_id ? categoryNameById[tx.category_id] || "-" : "-"}</td>
                  <td>
                    <Money
                      cents={tx.amount_cents}
                      className={tx.amount_cents < 0 ? styles.textDanger : styles.textSuccess}
                    />
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
