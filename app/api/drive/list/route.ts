import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { accessToken, folderId } = await req.json();

  if (!accessToken) {
    return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
  }

  // Root no Drive é 'root'
  const parent = folderId || "root";

  const q = `'${parent}' in parents and trashed=false`;
  const fields =
    "files(id,name,mimeType,modifiedTime,createdTime,size,webViewLink,webContentLink,parents)";

  const url =
    `https://www.googleapis.com/drive/v3/files?` +
    new URLSearchParams({
      q,
      fields,
      pageSize: "200",
      orderBy: "folder,name",
      supportsAllDrives: "false",
    });

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await r.json();
  if (!r.ok) {
    return NextResponse.json({ error: data }, { status: r.status });
  }
  return NextResponse.json(data);
}
