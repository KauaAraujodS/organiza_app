// app/lib/googleDrive.ts
export type GoogleToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // unix seconds
};

const TOKEN_KEY = "organiza_google_token";
const ORGANIZA_FOLDER_NAME = "OrganizaApp";

export function getGoogleTokenFromLocalStorage(): GoogleToken | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleToken;
  } catch {
    return null;
  }
}

/**
 * Busca (ou cria) a pasta "OrganizaApp" no Drive.
 */
export async function getOrCreateOrganizaRootFolderId(accessToken: string): Promise<string> {
  // 1) tenta achar
  const q = encodeURIComponent(
    `name='${ORGANIZA_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchRes.ok) {
    const text = await searchRes.text();
    throw new Error(`Falha ao buscar pasta no Drive: ${text}`);
  }

  const searchJson = await searchRes.json();
  const found = searchJson?.files?.[0];
  if (found?.id) return found.id as string;

  // 2) cria
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: ORGANIZA_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Falha ao criar pasta no Drive: ${text}`);
  }

  const createJson = await createRes.json();
  if (!createJson?.id) throw new Error("Drive não retornou o id da pasta criada.");
  return createJson.id as string;
}

/**
 * Faz upload de um arquivo pro Google Drive dentro de uma pasta (folderId).
 * Retorna id, name, mimeType, size.
 */
export async function uploadFileToDrive(params: {
  accessToken: string;
  file: File;
  folderId: string;
}): Promise<{ id: string; name: string; mimeType: string; size?: string }> {
  const { accessToken, file, folderId } = params;

  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileArrayBuffer = await file.arrayBuffer();
  const fileBlob = new Blob([fileArrayBuffer], { type: file.type || "application/octet-stream" });

  const multipartBody = new Blob(
    [
      delimiter,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
      fileBlob,
      closeDelimiter,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha no upload para o Drive: ${text}`);
  }

  return (await res.json()) as { id: string; name: string; mimeType: string; size?: string };
}

// app/lib/googleDrive.ts

export async function createDriveFolder(params: {
  accessToken: string;
  name: string;
  parentFolderId: string;
  colorRgb?: string; // por enquanto opcional (Drive tem folderColorRgb em alguns cenários)
}): Promise<{ id: string; name: string }> {
  const { accessToken, name, parentFolderId } = params;

  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao criar pasta no Drive: ${text}`);
  }

  return (await res.json()) as { id: string; name: string };
}

// app/lib/googleDrive.ts

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string; // vem como string
};

export async function listDriveFolderItems(params: {
  accessToken: string;
  folderId: string;
}): Promise<DriveItem[]> {
  const { accessToken, folderId } = params;

  // pega pastas e arquivos (exceto lixeira), ordena: pastas primeiro, depois por nome
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    "files(id,name,mimeType,createdTime,modifiedTime,size)"
  );
  const orderBy = encodeURIComponent("folder,name");

  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${orderBy}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao listar itens do Drive: ${text}`);
  }

  const data = (await res.json()) as { files?: DriveItem[] };
  return data.files ?? [];
}

export function isDriveFolder(item: DriveItem) {
  return item.mimeType === "application/vnd.google-apps.folder";
}


