import styles from "../finance.module.css";
import Money from "./Money";

export default function FinanceKpis({
  totalBalance,
  monthIncome,
  monthExpense,
  upcomingCount,
  cardsDueTotal,
}: {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  upcomingCount: number;
  cardsDueTotal: number;
}) {
  const cards = [
    { label: "Saldo total", value: <Money cents={totalBalance} className={styles.kpi} />, col: styles.span3 },
    { label: "Entradas no mês", value: <Money cents={monthIncome} className={`${styles.kpi} ${styles.textSuccess}`} />, col: styles.span3 },
    { label: "Saídas no mês", value: <Money cents={monthExpense} className={`${styles.kpi} ${styles.textDanger}`} />, col: styles.span3 },
    { label: "Total a pagar (cartões)", value: <Money cents={cardsDueTotal} className={`${styles.kpi} ${styles.textDanger}`} />, col: styles.span3 },
    { label: "Próximos vencimentos", value: <span className={styles.kpi}>{upcomingCount}</span>, col: styles.span3 },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <div key={card.label} className={`${styles.card} ${card.col}`}>
          <div className={styles.label}>{card.label}</div>
          {card.value}
        </div>
      ))}
    </div>
  );
}
