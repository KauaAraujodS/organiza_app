import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { accessToken, fileId, name } = await req.json();

  if (!accessToken) return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
  if (!fileId) return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );

  const data = await r.json();
  if (!r.ok) return NextResponse.json({ error: data }, { status: r.status });
  return NextResponse.json(data);
}
