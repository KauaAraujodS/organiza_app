import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { accessToken, timeMin, timeMax, timezone } = (await req.json()) as {
      accessToken?: string;
      timeMin?: string;
      timeMax?: string;
      timezone?: string;
    };

    if (!accessToken) {
      return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
    }
    if (!timeMin || !timeMax) {
      return NextResponse.json({ error: "Missing timeMin/timeMax" }, { status: 400 });
    }

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "2500",
      timeMin,
      timeMax,
    });
    if (timezone) params.set("timeZone", timezone);

    const calendarId = "primary";
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json({ error: data?.error?.message || "Calendar list failed" }, { status: r.status });
    }

    return NextResponse.json({ items: data?.items ?? [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

