import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv() {
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Supabase env vars ausentes.");
  }
}

export function createServerSupabaseWithAccessToken(accessToken: string) {
  assertEnv();
  return createClient(supabaseUrl!, supabaseAnon!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function createServiceRoleSupabase() {
  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente para operação de storage assinada.");
  }
  return createClient(supabaseUrl, supabaseServiceRole);
}

export async function getUserFromAccessToken(accessToken: string) {
  const supabase = createServerSupabaseWithAccessToken(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error(error?.message || "Usuário não autenticado.");
  }
  return data.user;
}
