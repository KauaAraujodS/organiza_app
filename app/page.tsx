import Link from "next/link";
import styles from "./home.module.css";

function Card({
  href,
  title,
  value,
  icon,
}: {
  href: string;
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className={styles.cardLink}
    >
      <div className={styles.cardRow}>
        <div className={styles.cardLead}>
          <div className={styles.cardIcon}>
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
        <Card href="/files" title="Arquivos" value="0" icon="📁" />
        <Card href="/tasks" title="Tarefas Pendentes" value="0" icon="✅" />
        <Card href="/passwords" title="Senhas" value="0" icon="🔒" />
        <Card href="/calendar" title="Eventos" value="0" icon="🗓️" />
        <Card href="/financas" title="Saldo" value="R$ 0,00" icon="💲" />
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
