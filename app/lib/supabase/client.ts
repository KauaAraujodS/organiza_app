"use client";

import { supabase } from "../supabase";

export const supabaseClient = supabase;

export async function getAccessTokenOrThrow() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return token;
}
