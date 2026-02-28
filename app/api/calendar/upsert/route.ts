import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { accessToken, task } = await req.json();

    if (!accessToken) return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
    if (!task) return NextResponse.json({ error: "Missing task" }, { status: 400 });

    // task precisa ter: title, due_date, google_event_id (opcional)
    const {
      title,
      description,
      due_date,
      due_time,
      reminder_minutes,
      recurrence_rule,
      google_event_id,
    } = task as {
      title: string;
      description?: string;
      due_date?: string; // "2026-02-17"
      due_time?: string | null; // "14:30"
      reminder_minutes?: number | null;
      recurrence_rule?: string | null; // "RRULE:FREQ=WEEKLY"
      google_event_id?: string | null;
    };

    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
    if (!due_date) return NextResponse.json({ error: "Missing due_date" }, { status: 400 });

    const eventBody: Record<string, unknown> = {
      summary: title,
      description: description || "",
    };

    const cleanDueTime = typeof due_time === "string" ? due_time.trim() : "";
    if (cleanDueTime) {
      const [hhRaw, mmRaw] = cleanDueTime.split(":");
      const hh = Number(hhRaw);
      const mm = Number(mmRaw);
      if (
        Number.isNaN(hh) ||
        Number.isNaN(mm) ||
        hh < 0 ||
        hh > 23 ||
        mm < 0 ||
        mm > 59
      ) {
        return NextResponse.json(
          { error: "Invalid due_time format. Use HH:MM (00-23:00-59)." },
          { status: 400 }
        );
      }

      const [yearRaw, monthRaw, dayRaw] = due_date.split("-");
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      const day = Number(dayRaw);
      if (
        Number.isNaN(year) ||
        Number.isNaN(month) ||
        Number.isNaN(day)
      ) {
        return NextResponse.json({ error: "Invalid due_date format" }, { status: 400 });
      }

      // Monta datetime local e envia em RFC3339 UTC (Google aceita de forma consistente)
      const startLocal = new Date(year, month - 1, day, hh, mm, 0, 0);
      if (Number.isNaN(startLocal.getTime())) {
        return NextResponse.json({ error: "Invalid start datetime" }, { status: 400 });
      }
      const endLocal = new Date(startLocal.getTime() + 60 * 60 * 1000);
      eventBody.start = { dateTime: startLocal.toISOString() };
      eventBody.end = { dateTime: endLocal.toISOString() };
    } else {
      const due = new Date(`${due_date}T00:00:00`);
      if (Number.isNaN(due.getTime())) {
        return NextResponse.json({ error: "Invalid due_date format" }, { status: 400 });
      }
      const end = new Date(due);
      end.setDate(end.getDate() + 1);
      const endDate = end.toISOString().slice(0, 10);
      eventBody.start = { date: due_date };
      // all-day: end eh exclusivo, precisa ser o dia seguinte
      eventBody.end = { date: endDate };
    }

    if (recurrence_rule && recurrence_rule.trim()) {
      eventBody.recurrence = [recurrence_rule.trim()];
    }

    if (typeof reminder_minutes === "number") {
      eventBody.reminders = {
        useDefault: false,
        overrides: [{ method: "popup", minutes: Math.max(0, reminder_minutes) }],
      };
    } else {
      eventBody.reminders = { useDefault: true };
    }

    const calendarId = "primary";

    // Se já tem event_id -> PATCH (update). Se não tem -> POST (create)
    if (google_event_id) {
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${google_event_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );

      const data = await r.json();
      if (!r.ok) {
        const googleMsg = String(data?.error?.message || "");
        const isInvalidStart = googleMsg.toLowerCase().includes("invalid start time");

        // Fallback para eventos legados inconsistentes: remove e recria.
        if (isInvalidStart) {
          const del = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${google_event_id}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!del.ok && del.status !== 404) {
            const delData = await del.json().catch(() => ({}));
            return NextResponse.json(
              { error: delData?.error?.message || "Falha ao limpar evento legado." },
              { status: del.status }
            );
          }

          const create = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventBody),
            }
          );
          const createData = await create.json().catch(() => ({}));
          if (!create.ok) {
            return NextResponse.json(
              { error: createData?.error?.message || "Falha ao recriar evento." },
              { status: create.status }
            );
          }
          return NextResponse.json({ eventId: createData.id });
        }

        return NextResponse.json({ error: data?.error?.message || data }, { status: r.status });
      }

      return NextResponse.json({ eventId: data.id });
    } else {
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );

      const data = await r.json();
      if (!r.ok) {
        return NextResponse.json({ error: data?.error?.message || data }, { status: r.status });
      }

      return NextResponse.json({ eventId: data.id });
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
