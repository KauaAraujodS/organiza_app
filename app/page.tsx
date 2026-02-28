import Link from "next/link";
import styles from "./home.module.css";
import type { CSSProperties } from "react";

function Card({
  href,
  title,
  value,
  icon,
  iconClassName,
  tone,
}: {
  href: string;
  title: string;
  value: string;
  icon: string;
  iconClassName?: string;
  tone: string;
}) {
  const style = { "--card-tone": tone } as CSSProperties;

  return (
    <Link
      href={href}
      className={styles.cardLink}
      style={style}
    >
      <div className={styles.cardRow}>
        <div className={styles.cardLead}>
          <div className={[styles.cardIcon, iconClassName || ""].join(" ").trim()}>
            {icon}
          </div>
          <div>
            <div className={styles.cardLabel}>{title}</div>
            <div className={styles.cardValue}>{value}</div>
          </div>
        </div>
        <div className={styles.arrow}>→</div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.headerTitle}>Dashboard</h1>
        <p className={styles.headerSubtitle}>Visão geral da sua organização pessoal</p>
      </div>

      <div className={styles.gridThree}>
        <Card href="/files" title="Arquivos" value="0" icon="📂" iconClassName={styles.iconBlue} tone="#0ea5e9" />
        <Card href="/tasks" title="Tarefas Pendentes" value="0" icon="☑" iconClassName={styles.iconGreen} tone="#22c55e" />
        <Card href="/passwords" title="Senhas" value="0" icon="🔒" iconClassName={styles.iconOrange} tone="#f97316" />
        <Card href="/calendar" title="Eventos" value="0" icon="🗓" iconClassName={styles.iconAmber} tone="#f59e0b" />
        <Card href="/financas" title="Saldo" value="R$ 0,00" icon="$" iconClassName={styles.iconTeal} tone="#14b8a6" />
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Tarefas Recentes</div>
          <div className={styles.panelText}>Nenhuma tarefa pendente</div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>Próximos Eventos</div>
          <div className={styles.panelText}>Nenhum evento próximo</div>
        </div>
      </div>
    </div>
  );
}
