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
    { label: "Saldo total", value: <Money cents={totalBalance} className={styles.kpi} />, tone: styles.kpiNeutral },
    { label: "Entradas no mês", value: <Money cents={monthIncome} className={`${styles.kpi} ${styles.textSuccess}`} />, tone: styles.kpiSuccess },
    { label: "Saídas no mês", value: <Money cents={monthExpense} className={`${styles.kpi} ${styles.textDanger}`} />, tone: styles.kpiDanger },
    { label: "Total a pagar (cartões)", value: <Money cents={cardsDueTotal} className={`${styles.kpi} ${styles.textDanger}`} />, tone: styles.kpiDangerSoft },
    { label: "Próximos vencimentos", value: <span className={styles.kpi}>{upcomingCount}</span>, tone: styles.kpiNeutral },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card) => (
        <div key={card.label} className={`${styles.card} ${styles.kpiCard} ${card.tone}`}>
          <div className={styles.label}>{card.label}</div>
          {card.value}
        </div>
      ))}
    </div>
  );
}
