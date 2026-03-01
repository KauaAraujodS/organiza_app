import { NextResponse } from "next/server";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function nextDate(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function toIsoDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

export async function PATCH(req: Request) {
  try {
    const { accessToken, eventId, calendarId, event } = (await req.json()) as {
      accessToken?: string;
      eventId?: string;
      calendarId?: string;
      event?: {
        title?: string;
        description?: string;
        location?: string;
        allDay?: boolean;
        date?: string;
        endDate?: string;
        startTime?: string;
        endTime?: string;
        timezone?: string;
        attendees?: string[];
        colorId?: string;
        transparency?: "opaque" | "transparent";
        visibility?: "default" | "public" | "private" | "confidential";
        reminderMinutes?: number | null;
      };
    };

    if (!accessToken) {
      return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
    }
    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }
    if (!event?.title?.trim()) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }
    if (!event.date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const resolvedCalendarId = String(calendarId || "primary");
    const body: Record<string, unknown> = {
      summary: event.title.trim(),
      description: event.description?.trim() || "",
      location: event.location?.trim() || "",
    };

    if (event.colorId) body.colorId = event.colorId;
    if (event.transparency) body.transparency = event.transparency;
    if (event.visibility) body.visibility = event.visibility;
    if (Array.isArray(event.attendees) && event.attendees.length > 0) {
      body.attendees = event.attendees.map((email) => ({ email }));
    }

    if (event.allDay) {
      const endDate = event.endDate || event.date;
      body.start = { date: event.date };
      body.end = { date: nextDate(endDate) };
    } else {
      if (!event.startTime || !event.endTime) {
        return NextResponse.json(
          { error: "Missing startTime/endTime for timed event" },
          { status: 400 }
        );
      }
      const startDt = new Date(`${event.date}T${event.startTime}:00`);
      const endDt = new Date(`${event.endDate || event.date}T${event.endTime}:00`);
      if (
        Number.isNaN(startDt.getTime()) ||
        Number.isNaN(endDt.getTime()) ||
        endDt.getTime() <= startDt.getTime()
      ) {
        return NextResponse.json({ error: "Invalid start/end time" }, { status: 400 });
      }
      const tz = event.timezone || "UTC";
      const endDate = event.endDate || event.date;
      body.start = { dateTime: toIsoDateTime(event.date, event.startTime), timeZone: tz };
      body.end = { dateTime: toIsoDateTime(endDate, event.endTime), timeZone: tz };
    }

    if (typeof event.reminderMinutes === "number") {
      body.reminders = {
        useDefault: false,
        overrides: [{ method: "popup", minutes: Math.max(0, event.reminderMinutes) }],
      };
    } else {
      body.reminders = { useDefault: true };
    }

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(resolvedCalendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data?.error?.message || "Calendar update failed" }, { status: r.status });
    }
    return NextResponse.json({ event: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
