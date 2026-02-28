"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type BudgetPayload = {
  accessToken: string;
  id?: string;
  name: string;
  period_start: string;
  period_end: string;
  amount_limit_cents: number;
  category_id?: string | null;
};

export async function createBudgetAction(payload: BudgetPayload): Promise<ActionResult<{ id: string }>> {
  try {
    if (payload.amount_limit_cents <= 0) throw new Error("Valor do orçamento deve ser maior que zero.");
    if (payload.period_end < payload.period_start) throw new Error("Período inválido.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data, error } = await supabase
      .from("finance_budgets")
      .insert({
        user_id: user.id,
        name: payload.name.trim(),
        period_start: payload.period_start,
        period_end: payload.period_end,
        amount_limit_cents: payload.amount_limit_cents,
        category_id: payload.category_id || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/orcamentos");
    revalidatePath("/financas");
    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar orçamento." };
  }
}

export async function updateBudgetAction(payload: BudgetPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID do orçamento obrigatório.");
    if (payload.amount_limit_cents <= 0) throw new Error("Valor do orçamento deve ser maior que zero.");
    if (payload.period_end < payload.period_start) throw new Error("Período inválido.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_budgets")
      .update({
        name: payload.name.trim(),
        period_start: payload.period_start,
        period_end: payload.period_end,
        amount_limit_cents: payload.amount_limit_cents,
        category_id: payload.category_id || null,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/orcamentos");
    revalidatePath("/financas");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar orçamento." };
  }
}

export async function deleteBudgetAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_budgets")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/orcamentos");
    revalidatePath("/financas");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao excluir orçamento." };
  }
}

