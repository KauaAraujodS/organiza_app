import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();

  const accessToken = String(form.get("accessToken") || "");
  const parentId = String(form.get("parentId") || "root");
  const file = form.get("file") as File | null;

  if (!accessToken) return NextResponse.json({ error: "Missing accessToken" }, { status: 401 });
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  // multipart upload (metadata + binary)
  const metadata = {
    name: file.name,
    parents: [parentId || "root"],
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const multipartBody = Buffer.concat([
    Buffer.from(
      delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata)
    ),
    Buffer.from(
      delimiter +
        `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
    ),
    fileBuffer,
    Buffer.from(closeDelimiter),
  ]);

  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody as unknown as BodyInit,
    }
  );

  const data = await r.json();
  if (!r.ok) return NextResponse.json({ error: data }, { status: r.status });
  return NextResponse.json(data);
}
