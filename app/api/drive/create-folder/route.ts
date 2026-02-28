import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { accessToken, parentId, name } = await req.json();

  if (!accessToken) return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const body = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId || "root"],
  };

  const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) return NextResponse.json({ error: data }, { status: r.status });
  return NextResponse.json(data);
}
