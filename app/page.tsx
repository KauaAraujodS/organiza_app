"use client";

import Link from "next/link";
import styles from "./home.module.css";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { getValidAccessToken } from "./lib/googleToken";

type GoogleDashboardEvent = {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
};

type DashboardCacheShape = {
  ts: number;
  filesCount: number;
  pendingTasksCount: number;
  passwordsCount: number;
  eventsCount: number;
  financeBalanceCents: number;
  recentTasks: Array<{ id: string; title: string; due_date: string | null }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    startDateTime: string | null;
    allDayDate: string | null;
  }>;
};

const DASHBOARD_CACHE_KEY = "organiza_dashboard_cache_v1";
const DASHBOARD_CACHE_TTL_MS = 90_000;

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
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [filesCount, setFilesCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [passwordsCount, setPasswordsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [financeBalanceCents, setFinanceBalanceCents] = useState(0);

  const [recentTasks, setRecentTasks] = useState<Array<{
    id: string;
    title: string;
    due_date: string | null;
  }>>([]);

  const [upcomingEvents, setUpcomingEvents] = useState<
    Array<{
      id: string;
      title: string;
      startDateTime: string | null;
      allDayDate: string | null;
    }>
  >([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DashboardCacheShape;
      if (!parsed?.ts || Date.now() - parsed.ts > DASHBOARD_CACHE_TTL_MS) return;

      setFilesCount(parsed.filesCount || 0);
      setPendingTasksCount(parsed.pendingTasksCount || 0);
      setPasswordsCount(parsed.passwordsCount || 0);
      setEventsCount(parsed.eventsCount || 0);
      setFinanceBalanceCents(parsed.financeBalanceCents || 0);
      setRecentTasks(parsed.recentTasks || []);
      setUpcomingEvents(parsed.upcomingEvents || []);
      setLoading(false);
    } catch {
      // cache invalido: ignora
    }
  }, []);

  const formatMoney = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getSession();
      if (userError) throw userError;
      if (!userData.session?.user) {
        setLoading(false);
        return;
      }

      const calendarPromise = (async () => {
        try {
          const accessToken = await getValidAccessToken();
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const timeMin = new Date();
          const timeMax = new Date();
          timeMax.setDate(timeMax.getDate() + 45);

        const calendarRes = await fetch("/api/calendar/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            timezone,
            includeAllCalendars: true,
            maxResults: 250,
          }),
        });
          const calendarData = await calendarRes.json().catch(() => ({}));
          if (!calendarRes.ok) {
            throw new Error(String(calendarData?.error || "Falha ao carregar Google Agenda."));
          }

          const items = (calendarData?.items || []) as GoogleDashboardEvent[];
          const mapped = items.map((ev) => ({
            id: ev.id,
            title: ev.summary || "(Sem título)",
            startDateTime: ev.start?.dateTime || null,
            allDayDate: ev.start?.date || null,
          }));
          return mapped;
        } catch {
          return [] as Array<{
            id: string;
            title: string;
            startDateTime: string | null;
            allDayDate: string | null;
          }>;
        }
      })();

      const [
        filesCountRes,
        pendingTasksCountRes,
        passwordsCountRes,
        recentTasksRes,
        financeAccountsRes,
        financeTransactionsRes,
      ] = await Promise.all([
        supabase.from("drive_items").select("*", { head: true, count: "exact" }),
        supabase.from("tasks").select("*", { head: true, count: "exact" }).eq("done", false),
        supabase.from("password_vault").select("*", { head: true, count: "exact" }),
        supabase
          .from("tasks")
          .select("id,title,due_date")
          .eq("done", false)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("finance_accounts").select("opening_balance_cents").eq("archived", false),
        supabase.from("finance_transactions").select("amount_cents"),
      ]);

      const firstError =
        filesCountRes.error ||
        pendingTasksCountRes.error ||
        passwordsCountRes.error ||
        recentTasksRes.error ||
        financeAccountsRes.error ||
        financeTransactionsRes.error;

      if (firstError) {
        setMsg(firstError.message);
        setLoading(false);
        return;
      }

      setFilesCount(filesCountRes.count || 0);
      setPendingTasksCount(pendingTasksCountRes.count || 0);
      setPasswordsCount(passwordsCountRes.count || 0);
      setRecentTasks(
        (recentTasksRes.data || []) as Array<{
          id: string;
          title: string;
          due_date: string | null;
        }>
      );

      const opening =
        (financeAccountsRes.data || []).reduce(
          (acc, row) => acc + Number(row.opening_balance_cents || 0),
          0
        ) || 0;

      const flow =
        (financeTransactionsRes.data || []).reduce(
          (acc, row) => acc + Number(row.amount_cents || 0),
          0
        ) || 0;

      setFinanceBalanceCents(opening + flow);
      const mappedEvents = await calendarPromise;
      setEventsCount(mappedEvents.length);
      setUpcomingEvents(mappedEvents.slice(0, 5));

      const cachePayload: DashboardCacheShape = {
        ts: Date.now(),
        filesCount: filesCountRes.count || 0,
        pendingTasksCount: pendingTasksCountRes.count || 0,
        passwordsCount: passwordsCountRes.count || 0,
        eventsCount: mappedEvents.length,
        financeBalanceCents: opening + flow,
        recentTasks: (recentTasksRes.data || []) as Array<{
          id: string;
          title: string;
          due_date: string | null;
        }>,
        upcomingEvents: mappedEvents.slice(0, 5),
      };
      sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cachePayload));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function formatDate(date: string | null) {
    if (!date) return "-";
    const parsed = new Date(`${date}T00:00:00`);
    return parsed.toLocaleDateString("pt-BR");
  }

  function formatEventMeta(event: {
    startDateTime: string | null;
    allDayDate: string | null;
  }) {
    if (event.startDateTime) {
      const dt = new Date(event.startDateTime);
      return `${dt.toLocaleDateString("pt-BR")} - ${dt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    if (event.allDayDate) return formatDate(event.allDayDate);
    return "-";
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.headerTitle}>Dashboard</h1>
        <p className={styles.headerSubtitle}>Visão geral da sua organização pessoal</p>
      </div>

      <div className={styles.gridThree}>
        <Card
          href="/files"
          title="Arquivos"
          value={loading ? "..." : String(filesCount)}
          icon="📂"
          iconClassName={styles.iconBlue}
          tone="#0ea5e9"
        />
        <Card
          href="/tasks"
          title="Tarefas Pendentes"
          value={loading ? "..." : String(pendingTasksCount)}
          icon="☑"
          iconClassName={styles.iconGreen}
          tone="#22c55e"
        />
        <Card
          href="/passwords"
          title="Senhas"
          value={loading ? "..." : String(passwordsCount)}
          icon="🔒"
          iconClassName={styles.iconOrange}
          tone="#f97316"
        />
        <Card
          href="/calendar"
          title="Eventos"
          value={loading ? "..." : String(eventsCount)}
          icon="🗓"
          iconClassName={styles.iconAmber}
          tone="#f59e0b"
        />
        <Card
          href="/financas"
          title="Saldo"
          value={loading ? "..." : formatMoney.format(financeBalanceCents / 100)}
          icon="$"
          iconClassName={styles.iconTeal}
          tone="#14b8a6"
        />
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Tarefas Recentes</div>
          {recentTasks.length === 0 ? (
            <div className={styles.panelText}>Nenhuma tarefa pendente</div>
          ) : (
            <ul className={styles.panelList}>
              {recentTasks.map((task) => (
                <li key={task.id} className={styles.panelItem}>
                  <span>{task.title}</span>
                  <span className={styles.panelItemMeta}>{formatDate(task.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>Próximos Eventos</div>
          {upcomingEvents.length === 0 ? (
            <div className={styles.panelText}>Nenhum evento próximo</div>
          ) : (
            <ul className={styles.panelList}>
              {upcomingEvents.map((event) => (
                <li key={event.id} className={styles.panelItem}>
                  <span>{event.title}</span>
                  <span className={styles.panelItemMeta}>{formatEventMeta(event)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {msg ? <div className={styles.panelText}>{msg}</div> : null}
    </div>
  );
}
