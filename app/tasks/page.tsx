"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getValidAccessToken } from "../lib/googleToken";
import TaskConfigModal, {
  Priority,
  RecurrencePreset,
} from "../ui/TaskConfigModal";
import styles from "./page.module.css";

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null; // YYYY-MM-DD
  due_time: string | null; // HH:MM
  reminder_minutes: number | null;
  recurrence_rule: string | null;
  sync_google: boolean | null;
  google_event_id: string | null;
  done: boolean;
  created_at: string;
};

function formatDateBR(yyyyMmDd: string | null) {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function priorityPill(p: Priority) {
  if (p === "Alta") return styles.pillHigh;
  if (p === "Média") return styles.pillMedium;
  return styles.pillLow;
}

function recurrenceRuleFromPreset(
  preset: RecurrencePreset,
  customRule: string,
  recurrenceEndDate: string
): string | null {
  const until =
    recurrenceEndDate && /^\d{4}-\d{2}-\d{2}$/.test(recurrenceEndDate)
      ? `;UNTIL=${recurrenceEndDate.replaceAll("-", "")}T235959Z`
      : "";
  if (preset === "none") return null;
  if (preset === "daily") return `RRULE:FREQ=DAILY${until}`;
  if (preset === "weekly") return `RRULE:FREQ=WEEKLY${until}`;
  if (preset === "monthly") return `RRULE:FREQ=MONTHLY${until}`;
  if (preset === "yearly") return `RRULE:FREQ=YEARLY${until}`;
  const normalized = customRule.trim().toUpperCase();
  if (!normalized) return null;
  const base = normalized.startsWith("RRULE:") ? normalized : `RRULE:${normalized}`;
  if (!until || base.includes("UNTIL=") || base.includes("COUNT=")) return base;
  return `${base}${until}`;
}

function presetFromRecurrenceRule(rule: string | null): {
  preset: RecurrencePreset;
  custom: string;
} {
  if (!rule) return { preset: "none", custom: "" };
  const normalized = rule.trim().toUpperCase();
  if (normalized === "RRULE:FREQ=DAILY") return { preset: "daily", custom: "" };
  if (normalized === "RRULE:FREQ=WEEKLY") return { preset: "weekly", custom: "" };
  if (normalized === "RRULE:FREQ=MONTHLY") return { preset: "monthly", custom: "" };
  if (normalized === "RRULE:FREQ=YEARLY") return { preset: "yearly", custom: "" };
  return { preset: "custom", custom: rule };
}

function recurrenceEndFromRule(rule: string | null): string {
  if (!rule) return "";
  const up = rule.toUpperCase();
  const match = up.match(/UNTIL=(\d{8})T\d{6}Z/);
  if (!match?.[1]) return "";
  const y = match[1].slice(0, 4);
  const m = match[1].slice(4, 6);
  const d = match[1].slice(6, 8);
  return `${y}-${m}-${d}`;
}

function normalizeDueTime(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const match = v.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : "";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<"all" | "active" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Média");
  const [dueDate, setDueDate] = useState<string>(""); // YYYY-MM-DD
  const [useDefaultDate, setUseDefaultDate] = useState(true);
  const [dueTime, setDueTime] = useState<string>(""); // HH:MM
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string>("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [recurrencePreset, setRecurrencePreset] =
    useState<RecurrencePreset>("none");
  const [recurrenceCustom, setRecurrenceCustom] = useState("");
  const [syncGoogle, setSyncGoogle] = useState(false);
  const [googleEventId, setGoogleEventId] = useState<string | null>(null);
  const [formDone, setFormDone] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  async function load() {
    setMsg("");
    setLoading(true);

    let userData;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      userData = data;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Falha ao validar sessao.";
      setMsg(message);
      setLoading(false);
      return;
    }
    if (!userData.user) {
      setMsg("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,description,priority,due_date,due_time,reminder_minutes,recurrence_rule,sync_google,google_event_id,done,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    else setTasks((data ?? []) as Task[]);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const all = tasks.length;
    const active = tasks.filter((t) => !t.done).length;
    const done = tasks.filter((t) => t.done).length;
    return { all, active, done };
  }, [tasks]);

  const filtered = useMemo(() => {
    if (tab === "active") return tasks.filter((t) => !t.done);
    if (tab === "done") return tasks.filter((t) => t.done);
    return tasks;
  }, [tasks, tab]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPriority("Média");
    setDueDate(new Date().toISOString().slice(0, 10));
    setUseDefaultDate(true);
    setDueTime("");
    setReminderMinutes(null);
    setRecurrencePreset("none");
    setRecurrenceCustom("");
    setRecurrenceStartDate(new Date().toISOString().slice(0, 10));
    setRecurrenceEndDate("");
    setSyncGoogle(false);
    setGoogleEventId(null);
    setFormDone(false);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(t: Task) {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPriority((t.priority as Priority) ?? "Média");
    setDueDate(t.due_date ?? "");
    setUseDefaultDate(false);
    setDueTime(normalizeDueTime(t.due_time ?? ""));
    setReminderMinutes(t.reminder_minutes ?? null);
    const recurrence = presetFromRecurrenceRule(t.recurrence_rule ?? null);
    setRecurrencePreset(recurrence.preset);
    setRecurrenceCustom(recurrence.custom);
    setRecurrenceStartDate(t.due_date ?? "");
    setRecurrenceEndDate(recurrenceEndFromRule(t.recurrence_rule ?? null));
    setSyncGoogle(!!t.sync_google);
    setGoogleEventId(t.google_event_id ?? null);
    setFormDone(!!t.done);
    setOpen(true);
  }

  async function syncTaskWithGoogleCalendar(params: {
    taskId: string;
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    reminderMinutes: number | null;
    recurrenceRule: string | null;
    syncGoogle: boolean;
    googleEventId: string | null;
  }) {
    const {
      taskId,
      title: taskTitle,
      description: taskDescription,
      dueDate: taskDueDate,
      dueTime: taskDueTime,
      reminderMinutes: taskReminderMinutes,
      recurrenceRule: taskRecurrenceRule,
      syncGoogle: shouldSyncGoogle,
      googleEventId: currentEventId,
    } = params;

    if (shouldSyncGoogle && taskDueDate) {
      const accessToken = await getValidAccessToken();
      const upsertRes = await fetch("/api/calendar/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          task: {
            title: taskTitle,
            description: taskDescription,
            due_date: taskDueDate,
            due_time: taskDueTime || null,
            reminder_minutes: taskReminderMinutes,
            recurrence_rule: taskRecurrenceRule,
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            google_event_id: currentEventId,
          },
        }),
      });
      const upsertData = await upsertRes.json().catch(() => ({}));
      if (!upsertRes.ok) {
        throw new Error(upsertData?.error || "Erro ao sincronizar com Google Agenda.");
      }

      const newEventId = (upsertData?.eventId as string | undefined) ?? null;
      await supabase
        .from("tasks")
        .update({ google_event_id: newEventId, sync_google: true })
        .eq("id", taskId);
      setGoogleEventId(newEventId);
      return;
    }

    if (!shouldSyncGoogle && currentEventId) {
      const accessToken = await getValidAccessToken();
      const deleteRes = await fetch("/api/calendar/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, eventId: currentEventId }),
      });
      const deleteData = await deleteRes.json().catch(() => ({}));
      if (!deleteRes.ok) {
        throw new Error(deleteData?.error || "Erro ao remover evento da Agenda.");
      }

      await supabase
        .from("tasks")
        .update({ google_event_id: null, sync_google: false })
        .eq("id", taskId);
      setGoogleEventId(null);
    }
  }

  async function saveTask() {
    setMsg("");
    const cleanDueTime = normalizeDueTime(dueTime);
    const effectiveDueDate = useDefaultDate
      ? new Date().toISOString().slice(0, 10)
      : dueDate;
    const recurrenceStart = recurrencePreset === "none" ? "" : recurrenceStartDate;
    const recurrenceRule = recurrenceRuleFromPreset(
      recurrencePreset,
      recurrenceCustom,
      recurrenceEndDate
    );

    if (!title.trim()) {
      setMsg("Digite um título.");
      return;
    }
    if (title.trim().length < 3) {
      setMsg("Título precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (title.trim().length > 120) {
      setMsg("Título muito longo. Use até 120 caracteres.");
      return;
    }
    if (syncGoogle && !effectiveDueDate) {
      setMsg("Para sincronizar com Google Agenda, informe a data de vencimento.");
      return;
    }
    if (dueTime.trim() && !cleanDueTime) {
      setMsg("Hora inválida. Use o formato HH:MM.");
      return;
    }
    if (recurrencePreset === "custom" && !recurrenceRule) {
      setMsg("Informe uma RRULE válida na recorrência personalizada.");
      return;
    }
    if (recurrencePreset !== "none" && !recurrenceStart) {
      setMsg("Informe a data de início da recorrência.");
      return;
    }
    if (
      recurrencePreset !== "none" &&
      recurrenceEndDate &&
      recurrenceStart &&
      recurrenceEndDate < recurrenceStart
    ) {
      setMsg("A data de fim da recorrência deve ser maior ou igual ao início.");
      return;
    }

    let user;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      user = data.user;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Falha ao validar sessao.";
      setMsg(message);
      return;
    }
    if (!user) {
      setMsg("Você precisa estar logado.");
      return;
    }

    try {
      setSavingTask(true);
      if (!editingId) {
      // create
        const { data: created, error } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: title.trim(),
            description: description.trim() ? description.trim() : null,
            priority,
            due_date: (recurrenceStart || effectiveDueDate) ? (recurrenceStart || effectiveDueDate) : null,
            due_time: cleanDueTime || null,
            reminder_minutes: reminderMinutes,
            recurrence_rule: recurrenceRule,
            sync_google: syncGoogle,
            google_event_id: null,
            done: formDone,
          })
          .select("id")
          .single();

        if (error || !created?.id) {
          setMsg(error?.message || "Erro ao criar tarefa.");
          return;
        }

        await syncTaskWithGoogleCalendar({
          taskId: created.id as string,
          title: title.trim(),
          description: description.trim(),
          dueDate: recurrenceStart || effectiveDueDate || "",
          dueTime: cleanDueTime,
          reminderMinutes,
          recurrenceRule,
          syncGoogle,
          googleEventId: null,
        });
        if (syncGoogle && dueDate) {
          setMsg("Tarefa sincronizada com Google Agenda.");
        }
      } else {
      // update
      const { error } = await supabase
        .from("tasks")
        .update({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          priority,
          due_date: (recurrenceStart || effectiveDueDate) ? (recurrenceStart || effectiveDueDate) : null,
          due_time: cleanDueTime || null,
          reminder_minutes: reminderMinutes,
          recurrence_rule: recurrenceRule,
          sync_google: syncGoogle,
          done: formDone,
        })
        .eq("id", editingId);

      if (error) {
        setMsg(error.message);
        return;
      }
        await syncTaskWithGoogleCalendar({
          taskId: editingId,
          title: title.trim(),
          description: description.trim(),
          dueDate: recurrenceStart || effectiveDueDate || "",
          dueTime: cleanDueTime,
          reminderMinutes,
          recurrenceRule,
          syncGoogle,
          googleEventId,
        });
        if (syncGoogle && dueDate) {
          setMsg("Tarefa sincronizada com Google Agenda.");
        }
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Falha ao sincronizar com Google Agenda.";
      setMsg(message);
      return;
    } finally {
      setSavingTask(false);
    }

    setOpen(false);
    resetForm();
    load();
  }

  async function toggleDone(t: Task) {
    setMsg("");
    const { error } = await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id);
    if (error) setMsg(error.message);
    else load();
  }

  async function removeTask(task: Task) {
    setMsg("");
    try {
      if (task.google_event_id) {
        const accessToken = await getValidAccessToken();
        await fetch("/api/calendar/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, eventId: task.google_event_id }),
        });
      }
    } catch {
      // nao bloqueia exclusao local se falhar no Google
    }
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) setMsg(error.message);
    else load();
  }

  return (
    <main className={styles.main}>
      {/* header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Atividades</h1>
          <p className={styles.subtitle}>Gerencie suas tarefas e projetos</p>
        </div>

        <button
          onClick={openCreate}
          className={styles.primaryBtn}
        >
          <span className={styles.plus}>＋</span>
          Nova Tarefa
        </button>
      </div>

      {/* tabs + list container */}
      <div className={styles.panel}>
        <div className={styles.tabs}>
          <button
            onClick={() => setTab("all")}
            className={[
              styles.tabBtn,
              tab === "all" ? styles.tabBtnActive : "",
            ].join(" ")}
          >
            Todas ({counts.all})
          </button>

          <button
            onClick={() => setTab("active")}
            className={[
              styles.tabBtn,
              tab === "active" ? styles.tabBtnActive : "",
            ].join(" ")}
          >
            Ativas ({counts.active})
          </button>

          <button
            onClick={() => setTab("done")}
            className={[
              styles.tabBtn,
              tab === "done" ? styles.tabBtnActive : "",
            ].join(" ")}
          >
            Concluídas ({counts.done})
          </button>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.loadingCard}>
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyCard}>
              <div className={styles.emptyIcon}>
                ✓
              </div>
              <div className={styles.emptyText}>Nenhuma tarefa encontrada</div>
            </div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                className={styles.taskCard}
              >
                <button
                  onClick={() => toggleDone(t)}
                  className={[
                    styles.doneBtn,
                    t.done ? styles.doneBtnDone : "",
                  ].join(" ")}
                  title={t.done ? "Reabrir" : "Concluir"}
                >
                  {t.done ? "✔" : "○"}
                </button>

                <div className={styles.taskBody}>
                  <div className={styles.taskTop}>
                    <button onClick={() => openEdit(t)} className={styles.titleBtn} title="Editar">
                      <div className={[styles.taskTitle, t.done ? styles.taskTitleDone : ""].join(" ")}>{t.title}</div>
                      {t.description ? <div className={styles.taskDescription}>{t.description}</div> : null}
                    </button>

                    <div className={styles.taskActions}>
                      <button
                        onClick={() => openEdit(t)}
                        className={styles.iconBtn}
                        title="Editar"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => removeTask(t)}
                        className={[styles.iconBtn, styles.iconBtnDelete].join(" ")}
                        title="Excluir"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  <div className={styles.metaRow}>
                    <span
                      className={[
                        styles.pill,
                        styles.pillStrong,
                        priorityPill(t.priority),
                      ].join(" ")}
                    >
                      {t.priority}
                    </span>

                    {t.due_date ? (
                      <span className={styles.pill}>
                        📅 {formatDateBR(t.due_date)}
                      </span>
                    ) : null}
                    {t.due_time ? (
                      <span className={styles.pill}>
                        🕒 {t.due_time}
                      </span>
                    ) : null}
                    {t.recurrence_rule ? (
                      <span className={styles.pill}>
                        🔁 Recorrente
                      </span>
                    ) : null}
                    {t.google_event_id ? (
                      <span className={[styles.pill, styles.pillGoogle].join(" ")}>
                        🔄 Sincronizada
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}

          {msg ? <div className={styles.error}>{msg}</div> : null}
        </div>
      </div>

      <TaskConfigModal
        open={open}
        isEditing={!!editingId}
        taskTitle={title}
        description={description}
        priority={priority}
        dueDate={dueDate}
        useDefaultDate={useDefaultDate}
        dueTime={dueTime}
        recurrenceStartDate={recurrenceStartDate}
        recurrenceEndDate={recurrenceEndDate}
        reminderMinutes={reminderMinutes}
        recurrencePreset={recurrencePreset}
        recurrenceCustom={recurrenceCustom}
        done={formDone}
        syncGoogle={syncGoogle}
        googleEventId={googleEventId}
        saving={savingTask}
        message={msg}
        onTaskTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onPriorityChange={setPriority}
        onDueDateChange={setDueDate}
        onUseDefaultDateChange={(v) => {
          setUseDefaultDate(v);
          if (v) setDueDate(new Date().toISOString().slice(0, 10));
        }}
        onDueTimeChange={setDueTime}
        onRecurrenceStartDateChange={setRecurrenceStartDate}
        onRecurrenceEndDateChange={setRecurrenceEndDate}
        onReminderMinutesChange={setReminderMinutes}
        onRecurrencePresetChange={setRecurrencePreset}
        onRecurrenceCustomChange={setRecurrenceCustom}
        onDoneChange={setFormDone}
        onSyncGoogleChange={setSyncGoogle}
        onSubmit={saveTask}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      />
    </main>
  );
}
