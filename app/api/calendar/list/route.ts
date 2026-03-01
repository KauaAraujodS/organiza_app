import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { accessToken, timeMin, timeMax, timezone, includeAllCalendars, maxResults } = (await req.json()) as {
      accessToken?: string;
      timeMin?: string;
      timeMax?: string;
      timezone?: string;
      includeAllCalendars?: boolean;
      maxResults?: number;
    };

    if (!accessToken) {
      return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
    }
    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: "Missing timeMin/timeMax" }, { status: 400 });
    }

    const safeMaxResults = Math.min(Math.max(Number(maxResults) || 400, 1), 1000);

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: String(safeMaxResults),
      timeMin,
      timeMax,
      fields:
        "items(id,summary,description,htmlLink,colorId,start,end,status),nextPageToken",
    });
    if (timezone) params.set("timeZone", timezone);

    const fetchEvents = async (calendarId: string, calendarSummary?: string) => {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error?.message || `Calendar list failed (${calendarId})`);
      }
      const items = (data?.items || []) as Array<Record<string, unknown>>;
      return items.map((item) => ({
        ...item,
        calendarId,
        calendarSummary: calendarSummary || null,
      }));
    };

    if (!includeAllCalendars) {
      const items = await fetchEvents("primary", "Agenda principal");
      return NextResponse.json({ items });
    }

    try {
      const calendarListRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,summaryOverride,selected),nextPageToken",
        {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        }
      );
      const calendarListData = await calendarListRes.json().catch(() => ({}));
      if (!calendarListRes.ok) {
        throw new Error(calendarListData?.error?.message || "Calendar list (all) failed");
      }

      const calendars = ((calendarListData?.items || []) as Array<Record<string, unknown>>)
        .filter((cal) => cal?.id && cal?.selected !== false)
        .map((cal) => ({
          id: String(cal.id),
          summary: String(cal.summaryOverride || cal.summary || "Calendário"),
        }))
        .slice(0, 10);

      const results: Array<Array<Record<string, unknown>>> = [];
      for (let i = 0; i < calendars.length; i += 4) {
        const batch = calendars.slice(i, i + 4);
        const partial = await Promise.all(batch.map((cal) => fetchEvents(cal.id, cal.summary)));
        results.push(...partial);
      }
      const merged = results.flat();

      return NextResponse.json({ items: merged });
    } catch {
      // fallback seguro para não quebrar UX se o token não tiver permissão de calendarList
      const items = await fetchEvents("primary", "Agenda principal");
      return NextResponse.json({ items });
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
