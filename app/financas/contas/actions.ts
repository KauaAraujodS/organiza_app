"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, FinanceAccountType } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type AccountPayload = {
  accessToken: string;
  id?: string;
  name: string;
  type: FinanceAccountType;
  currency?: string;
  opening_balance_cents?: number;
  archived?: boolean;
};

export async function createAccountAction(payload: AccountPayload): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data, error } = await supabase
      .from("finance_accounts")
      .insert({
        user_id: user.id,
        name: payload.name.trim(),
        type: payload.type,
        currency: payload.currency || "BRL",
        opening_balance_cents: payload.opening_balance_cents || 0,
        archived: payload.archived || false,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas");
    revalidatePath("/financas/contas");

    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar conta." };
  }
}

export async function updateAccountAction(payload: AccountPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID da conta é obrigatório.");
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_accounts")
      .update({
        name: payload.name.trim(),
        type: payload.type,
        currency: payload.currency || "BRL",
        opening_balance_cents: payload.opening_balance_cents || 0,
        archived: payload.archived || false,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas");
    revalidatePath("/financas/contas");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar conta." };
  }
}

export async function deleteAccountAction(payload: {
  accessToken: string;
  id: string;
}): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { count, error: countError } = await supabase
      .from("finance_transactions")
      .select("id", { count: "exact", head: true })
      .eq("account_id", payload.id)
      .eq("user_id", user.id);

    if (countError) throw new Error(countError.message);
    if ((count || 0) > 0) {
      throw new Error("Não é possível remover conta com transações vinculadas.");
    }

    const { error } = await supabase
      .from("finance_accounts")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas");
    revalidatePath("/financas/contas");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao deletar conta." };
  }
}
