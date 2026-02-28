"use client";

import { FormEvent, memo, useCallback, useEffect, useMemo, useState } from "react";
import { getValidAccessToken } from "../lib/googleToken";
import ModalShell from "../ui/ModalShell";
import styles from "./page.module.css";

type GoogleEvent = {
  id: string;
  summary: string;
  description?: string;
  htmlLink?: string;
  colorId?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color?: string;
  googleUrl?: string;
  description?: string;
};

const COLOR_OPTIONS = [
  { id: "1", label: "Lavanda", swatch: "#a78bfa" },
  { id: "2", label: "Sálvia", swatch: "#84cc16" },
  { id: "3", label: "Uva", swatch: "#8b5cf6" },
  { id: "4", label: "Flamingo", swatch: "#fb7185" },
  { id: "5", label: "Banana", swatch: "#facc15" },
  { id: "6", label: "Tangerina", swatch: "#f97316" },
  { id: "7", label: "Grafite", swatch: "#6b7280" },
  { id: "8", label: "Pavão", swatch: "#06b6d4" },
  { id: "9", label: "Azul", swatch: "#3b82f6" },
  { id: "10", label: "Verde", swatch: "#22c55e" },
  { id: "11", label: "Tomate", swatch: "#ef4444" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthLabel(d: Date) {
  const raw = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(" de ", " ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function colorFromId(colorId?: string) {
  const found = COLOR_OPTIONS.find((c) => c.id === colorId);
  return found?.swatch || "#7c3aed";
}

function parseGoogleEvents(items: GoogleEvent[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const it of items) {
    const startDateTime = it.start?.dateTime;
    const startDate = it.start?.date;
    if (!startDateTime && !startDate) continue;

    if (startDateTime) {
      const start = new Date(startDateTime);
      const end = new Date(it.end?.dateTime || startDateTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      out.push({
        id: it.id,
        title: it.summary || "(Sem título)",
        description: it.description || "",
        start: startDateTime,
        end: it.end?.dateTime || end.toISOString(),
        allDay: false,
        color: colorFromId(it.colorId),
        googleUrl: it.htmlLink,
      });
    } else if (startDate) {
      // All-day (Google geralmente usa end exclusivo; aqui já normalizamos para "dia seguinte 00:00")
      const start = new Date(`${startDate}T00:00:00`);
      if (Number.isNaN(start.getTime())) continue;
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      out.push({
        id: it.id,
        title: it.summary || "(Sem título)",
        description: it.description || "",
        start: `${startDate}T00:00:00`,
        end: `${formatYmd(end)}T00:00:00`,
        allDay: true,
        color: colorFromId(it.colorId),
        googleUrl: it.htmlLink,
      });
    }
  }
  return out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const EMPTY_EVENTS: CalendarEvent[] = [];

type DayCellProps = {
  date: Date;
  dayEvents: CalendarEvent[];
  selected: boolean;
  today: boolean;
  onSelectDate: (date: Date) => void;
};

const DayCell = memo(function DayCell({ date, dayEvents, selected, today, onSelectDate }: DayCellProps) {
  const handleClick = useCallback(() => onSelectDate(date), [date, onSelectDate]);
  const hasEvents = dayEvents.length > 0;
  const className = [
    styles.dayCell,
    selected ? styles.dayCellSelected : styles.dayCellDefault,
    today ? styles.dayCellToday : "",
    selected && today ? styles.dayCellTodaySelected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" onClick={handleClick} className={className}>
      {today ? <span className={styles.todayDot} aria-hidden="true" /> : null}
      <div className={styles.dayNumberWrap}>
        <span className={styles.dayNumber}>{date.getDate()}</span>
      </div>

      {hasEvents ? (
        <div className={styles.dayIndicators}>
          {dayEvents.slice(0, 2).map((ev) => (
            <div key={ev.id} className={styles.dayBar} style={{ backgroundColor: ev.color || "#a78bfa" }} />
          ))}
          {dayEvents.length > 2 ? <span className={styles.dayMore}>+{dayEvents.length - 2}</span> : null}
        </div>
      ) : null}
    </button>
  );
});

export default function CalendarPage() {
  const [monthRef, setMonthRef] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [guests, setGuests] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [colorId, setColorId] = useState("9");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);

  const monthStart = useMemo(() => new Date(monthRef.getFullYear(), monthRef.getMonth(), 1), [monthRef]);
  const monthEndExclusive = useMemo(() => new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1), [monthRef]);
  const todayYmd = useMemo(() => formatYmd(new Date()), []);

  // ✅ grid com preenchimento de vazios também no final (fecha a última semana)
  const dayCells = useMemo(() => {
    const arr: Array<Date | null> = [];
    const firstDay = new Date(monthRef.getFullYear(), monthRef.getMonth(), 1).getDay();
    const lastDay = new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 0).getDate();

    for (let i = 0; i < firstDay; i += 1) arr.push(null);
    for (let d = 1; d <= lastDay; d += 1) {
      arr.push(new Date(monthRef.getFullYear(), monthRef.getMonth(), d));
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [monthRef]);

  // ✅ eventsByDate agora marca TODOS os dias cobertos (multi-day e all-day)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    for (const e of events) {
      const start = new Date(e.start);
      const rawEnd = new Date(e.end || e.start);

      if (Number.isNaN(start.getTime()) || Number.isNaN(rawEnd.getTime())) continue;

      // Se end <= start, trata como evento no mesmo dia (não deixa "sumir")
      const endMs = rawEnd.getTime() <= start.getTime() ? start.getTime() : rawEnd.getTime();

      // end geralmente é "exclusivo" em all-day; -1ms inclui o último dia corretamente
      const lastInclusive = new Date(endMs - 1);

      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(lastInclusive.getFullYear(), lastInclusive.getMonth(), lastInclusive.getDate());

      while (cur <= last) {
        const ymd = formatYmd(cur);
        if (!map[ymd]) map[ymd] = [];
        map[ymd].push(e);
        cur.setDate(cur.getDate() + 1);
      }
    }

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }

    return map;
  }, [events]);

  const selectedYmd = formatYmd(selectedDate);
  const selectedEvents = eventsByDate[selectedYmd] || [];

  function resetCreateForm() {
    setTitle("");
    setDescription("");
    setGuests("");
    setAllDay(false);
    setStartDate(selectedYmd);
    setEndDate(selectedYmd);
    setStartTime("09:00");
    setEndTime("10:00");
    setColorId("9");
  }

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const accessToken = await getValidAccessToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const r = await fetch("/api/calendar/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          timeMin: monthStart.toISOString(),
          timeMax: monthEndExclusive.toISOString(),
          timezone,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Falha ao carregar calendário.");
      setEvents(parseGoogleEvents((data?.items || []) as GoogleEvent[]));
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Falha ao carregar calendário.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [monthEndExclusive, monthStart]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const goPreviousMonth = useCallback(() => {
    setMonthRef((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goNextMonth = useCallback(() => {
    setMonthRef((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const onSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const onOpenCreateModal = useCallback(() => {
    setStartDate(selectedYmd);
    setEndDate(selectedYmd);
    setOpenCreateModal(true);
  }, [selectedYmd]);

  useEffect(() => {
    if (selectedDate.getFullYear() !== monthRef.getFullYear() || selectedDate.getMonth() !== monthRef.getMonth()) {
      setSelectedDate(new Date(monthRef.getFullYear(), monthRef.getMonth(), 1));
    }
  }, [monthRef, selectedDate]);

  async function createEvent(e: FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!title.trim()) {
      setMsg("Título é obrigatório.");
      return;
    }
    if (!startDate || !endDate) {
      setMsg("Selecione data de início e fim.");
      return;
    }
    if (endDate < startDate) {
      setMsg("A data de fim precisa ser maior ou igual ao início.");
      return;
    }

    setSaving(true);
    try {
      const accessToken = await getValidAccessToken();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const attendeeList = guests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const r = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          event: {
            title: title.trim(),
            description: description.trim(),
            attendees: attendeeList,
            allDay,
            date: startDate,
            endDate,
            startTime,
            endTime,
            timezone,
            colorId,
          },
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Falha ao criar evento.");

      resetCreateForm();
      setOpenCreateModal(false);
      await loadEvents();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Falha ao criar evento.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(eventId: string) {
    setDeletingId(eventId);
    setMsg("");
    try {
      const accessToken = await getValidAccessToken();
      const r = await fetch("/api/calendar/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, eventId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Falha ao remover evento.");
      await loadEvents();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Falha ao remover evento.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Calendário</h1>
          <p className={styles.subtitle}>Organize seus compromissos e eventos</p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className={styles.primaryBtn}
          >
            <span>+</span>
            Novo Evento
          </button>
        </div>
      </div>

      <section className={styles.calendarCard}>
        <div className={styles.monthHeader}>
          <div className={styles.monthTitle}>{monthLabel(monthRef)}</div>

          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={goPreviousMonth}
              aria-label="Mês anterior"
            >
              <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              className={styles.navBtn}
              onClick={goNextMonth}
              aria-label="Próximo mês"
            >
              <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.weekHeader}>
          {WEEK_DAYS.map((w) => (
            <div key={w} className={styles.weekDay}>
              {w}
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {dayCells.map((d, idx) => {
            if (!d) {
              return <div key={`empty-${idx}`} className={styles.emptyDay} aria-hidden="true" />;
            }

            const ymd = formatYmd(d);
            const dayEvents = eventsByDate[ymd] || EMPTY_EVENTS;
            const selected = isSameDay(d, selectedDate);
            const today = ymd === todayYmd;

            return <DayCell key={ymd} date={d} dayEvents={dayEvents} selected={selected} today={today} onSelectDate={onSelectDate} />;
          })}
        </div>

        {loading ? <div className={styles.loading}>Carregando eventos...</div> : null}

        <div className={styles.eventsSection}>
          <div className={styles.eventsTitle}>Eventos em {selectedDate.toLocaleDateString("pt-BR")}</div>

          {selectedEvents.length === 0 ? (
            <div className={styles.emptyEvents}>Nenhum evento nesta data</div>
          ) : (
            <div className={styles.eventsList}>
              {selectedEvents.map((ev) => (
                <div key={ev.id} className={styles.eventCard}>
                  <div className={styles.eventStripe} style={{ backgroundColor: ev.color || "#52e38a" }} />

                  <div className={styles.eventBody}>
                    <div className={styles.eventName}>{ev.title}</div>
                    <div className={styles.eventTime}>
                      {ev.allDay
                        ? "Dia inteiro"
                        : new Date(ev.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteEvent(ev.id)}
                    disabled={deletingId === ev.id}
                    className={styles.deleteBtn}
                    aria-label="Excluir evento"
                    title="Excluir evento"
                  >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {msg ? <div className={styles.msg}>{msg}</div> : null}

      <ModalShell
        open={openCreateModal}
        onClose={() => {
          setOpenCreateModal(false);
          resetCreateForm();
        }}
        title="Novo evento"
        subtitle={`Data selecionada: ${selectedDate.toLocaleDateString("pt-BR")}`}
        maxWidthClass="max-w-xl"
        maxWidthPx={680}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setOpenCreateModal(false);
                resetCreateForm();
              }}
              className={styles.modalCancel}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="calendar-create-form"
              disabled={saving}
              className={styles.modalSubmit}
            >
              {saving ? "Salvando..." : "Criar evento"}
            </button>
          </>
        }
      >
        <form id="calendar-create-form" onSubmit={createEvent} className={styles.form}>
          <div className={styles.formInfo}>
            Evento em <strong>{startDate || selectedDate.toLocaleDateString("pt-BR")}</strong>
          </div>

          <div>
            <label className={styles.label}>Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              placeholder="Ex: Reunião de projeto"
            />
          </div>

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>Dia inteiro</span>
          </label>

          <div className={styles.twoCols}>
            <div>
              <label className={styles.label}>Data início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label}>Data fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          {!allDay ? (
            <div className={styles.twoCols}>
              <div>
                <label className={styles.label}>Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div>
                <label className={styles.label}>Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className={styles.label}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              placeholder="Detalhes do evento"
            />
          </div>

          <div className={styles.modalGrid}>
            <div>
              <label className={styles.label}>Convidados (emails separados por vírgula)</label>
              <input
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className={styles.input}
                placeholder="exemplo1@gmail.com, exemplo2@gmail.com"
              />
            </div>

            <div>
              <label className={styles.label}>Cor</label>
              <select value={colorId} onChange={(e) => setColorId(e.target.value)} className={styles.select}>
                {COLOR_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </ModalShell>
    </main>
  );
}
