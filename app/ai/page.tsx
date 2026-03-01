 "use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getDisplayNameFromUser } from "../lib/profile";
import styles from "./page.module.css";

const roadmapItems = [
  {
    title: "Planejamento semanal inteligente",
    text: "A IA vai sugerir prioridades da semana com base em tarefas e eventos.",
    status: "Em implementacao",
  },
  {
    title: "Resumo automatico diario",
    text: "Visao rapida de prazos, compromissos e pendencias relevantes do dia.",
    status: "Em implementacao",
  },
  {
    title: "Insights financeiros contextualizados",
    text: "Leitura de gastos por categoria com recomendacoes praticas de ajuste.",
    status: "Proxima fase",
  },
];

export default function AiPage() {
  const [displayName, setDisplayName] = useState("você");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      setDisplayName(getDisplayNameFromUser(user));
    })();
  }, []);

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.badge}>Assistente IA | Modulo em implementacao</div>
        <h1 className={styles.title}>Estamos construindo esta area</h1>
        <p className={styles.subtitle}>
          Esta tela ainda nao esta pronta para uso final. O objetivo e entregar uma IA util para planejamento
          pessoal com contexto real do seu app, sem quebrar suas rotinas atuais.
        </p>
        <p className={styles.subtitle}>Quando estiver pronta, a IA vai te chamar por <strong>{displayName}</strong>.</p>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.primaryBtn} disabled>
            Em desenvolvimento
          </button>
          <span className={styles.helper}>Sem executar automacoes e sem alterar seus dados por enquanto.</span>
        </div>

        <div className={styles.infoGrid}>
          <article className={styles.infoCard}>
            <h2 className={styles.infoTitle}>O que vai fazer</h2>
            <p className={styles.infoText}>Organizar tarefas, calendario e financas em sugestoes praticas.</p>
          </article>
          <article className={styles.infoCard}>
            <h2 className={styles.infoTitle}>Status atual</h2>
            <p className={styles.infoText}>Fluxos de IA e interface estao em implementacao incremental.</p>
          </article>
          <article className={styles.infoCard}>
            <h2 className={styles.infoTitle}>Importante</h2>
            <p className={styles.infoText}>Nenhuma acao automatica sera aplicada sem sua confirmacao.</p>
          </article>
        </div>
      </section>

      <section className={styles.grid}>
        {roadmapItems.map((item) => (
          <article key={item.title} className={styles.card}>
            <div className={styles.cardGlow} />
            <div className={styles.cardTop}>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <span className={styles.statusPill}>{item.status}</span>
            </div>
            <p className={styles.cardText}>{item.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
