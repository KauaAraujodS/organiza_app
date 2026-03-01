type MaybeRecord = Record<string, unknown> | null | undefined;

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function asBoolean(v: unknown) {
  return typeof v === "boolean" ? v : false;
}

export function getDisplayNameFromUser(user: { email?: string | null; user_metadata?: MaybeRecord }) {
  const meta = user.user_metadata || {};
  const preferred =
    asString(meta.display_name) ||
    asString(meta.full_name) ||
    asString(meta.name) ||
    asString(meta.user_name);

  if (preferred.trim()) return preferred.trim();
  if (user.email) return user.email.split("@")[0];
  return "Usuário";
}

export function getAvatarUrlFromUser(user: { user_metadata?: MaybeRecord }) {
  const meta = user.user_metadata || {};
  if (asBoolean(meta.hide_avatar)) return "";

  const raw =
    asString(meta.custom_avatar_data) ||
    asString(meta.picture) ||
    asString(meta.avatar_url);

  if (!raw.trim()) return "";
  return raw.trim();
}
