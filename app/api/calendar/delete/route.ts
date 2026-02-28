import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { accessToken, eventId } = await req.json();

    if (!accessToken) return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
    if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

    const calendarId = "primary";

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!r.ok && r.status !== 404) {
      const data = await r.json().catch(() => ({}));
      return NextResponse.json({ error: data?.error?.message || data }, { status: r.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
