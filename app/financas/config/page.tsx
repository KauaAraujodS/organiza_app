"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../finance.module.css";
import FinanceTabs from "../components/FinanceTabs";
import { FinanceCategory, FinanceTag } from "../types";
import { supabaseClient } from "@/app/lib/supabase/client";
import CategoriesManager from "./CategoriesManager";
import TagsManager from "./TagsManager";

export default function FinanceConfigPage() {
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [tags, setTags] = useState<FinanceTag[]>([]);
  const [msg, setMsg] = useState("");
  const totals = useMemo(() => {
    const activeCategories = categories.filter((c) => !c.archived).length;
    const archivedCategories = categories.filter((c) => c.archived).length;
    return {
      categories: categories.length,
      activeCategories,
      archivedCategories,
      tags: tags.length,
    };
  }, [categories, tags]);

  const load = useCallback(async () => {
    setMsg("");
    const [catRes, tagRes] = await Promise.all([
      supabaseClient.from("finance_categories").select("*").order("name", { ascending: true }),
      supabaseClient.from("finance_tags").select("*").order("name", { ascending: true }),
    ]);

    if (catRes.error) setMsg(catRes.error.message);
    if (tagRes.error) setMsg((prev) => prev || tagRes.error!.message);

    setCategories((catRes.data || []) as FinanceCategory[]);
    setTags((tagRes.data || []) as FinanceTag[]);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Configurações Financeiras</h1>
        <p className={styles.subtitle}>Categorias, subcategorias e tags</p>
      </div>

      <FinanceTabs />
      <div className={styles.card}>
        <h3 className={styles.noTopMargin}>Como funciona</h3>
        <p className={styles.label}>Aqui você organiza a estrutura das suas transações.</p>
        <p className={styles.label}>Categorias classificam entradas e saídas. Tags ajudam a filtrar e comparar gastos.</p>
      </div>

      <div className={styles.kpiGrid}>
        <div className={`${styles.card} ${styles.kpiCard} ${styles.kpiNeutral}`}>
          <div className={styles.label}>Categorias totais</div>
          <div className={styles.kpi}>{totals.categories}</div>
        </div>
        <div className={`${styles.card} ${styles.kpiCard} ${styles.kpiSuccess}`}>
          <div className={styles.label}>Categorias ativas</div>
          <div className={`${styles.kpi} ${styles.textSuccess}`}>{totals.activeCategories}</div>
        </div>
        <div className={`${styles.card} ${styles.kpiCard} ${styles.kpiDangerSoft}`}>
          <div className={styles.label}>Categorias arquivadas</div>
          <div className={styles.kpi}>{totals.archivedCategories}</div>
        </div>
        <div className={`${styles.card} ${styles.kpiCard} ${styles.kpiNeutral}`}>
          <div className={styles.label}>Tags</div>
          <div className={styles.kpi}>{totals.tags}</div>
        </div>
      </div>

      <div className={styles.col2}>
        <CategoriesManager categories={categories} onReload={load} />
        <TagsManager tags={tags} onReload={load} />
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}
    </main>
  );
}
