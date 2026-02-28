// app/lib/googleToken.ts
export type GoogleTokenPayload = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

const KEY = "organiza_google_token";

export function saveGoogleToken(payload: GoogleTokenPayload) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function getGoogleToken(): GoogleTokenPayload | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleTokenPayload;
  } catch {
    return null;
  }
}

export function clearGoogleToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

type GoogleTok = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // epoch em segundos
};

const STORAGE_KEY = "organiza_google_token";

export async function getValidAccessToken(): Promise<string> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    throw new Error("Token do Google não encontrado. Faça login com Google novamente.");
  }

  const tok = JSON.parse(raw) as GoogleTok;

  const now = Math.floor(Date.now() / 1000);

  // válido com folga de 30s
  if (tok.accessToken && tok.expiresAt && tok.expiresAt > now + 30) {
    return tok.accessToken;
  }

  if (!tok.refreshToken) {
    throw new Error("Sem refreshToken. Faça logout e login com Google novamente.");
  }

  const res = await fetch("/api/google/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tok.refreshToken }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao renovar token");
  }

  const newTok: GoogleTok = {
    ...tok,
    accessToken: data.accessToken,
    expiresAt: now + Number(data.expiresIn),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newTok));
  return newTok.accessToken!;
}
