import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken ausente" }, { status: 400 });
    }

    const client_id = process.env.GOOGLE_CLIENT_ID!;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET!;

    if (!client_id || !client_secret) {
      return NextResponse.json(
        { error: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados no .env.local" },
        { status: 500 }
      );
    }

    const body = new URLSearchParams({
      client_id,
      client_secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await r.json();

    if (!r.ok) {
      return NextResponse.json(
        { error: data?.error_description || data?.error || "Falha ao renovar token" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in, // segundos
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro inesperado no refresh" },
      { status: 500 }
    );
  }
}
