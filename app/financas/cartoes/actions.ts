"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type CardProfilePayload = {
  accessToken: string;
  id?: string;
  account_id: string;
  closing_day: number;
  due_day: number;
  credit_limit_cents?: number | null;
  current_due_cents?: number;
  best_purchase_day?: number | null;
};

function validateDay(v: number, field: string) {
  if (!Number.isInteger(v) || v < 1 || v > 31) {
    throw new Error(`${field} deve estar entre 1 e 31.`);
  }
}

function validateMoney(v: number, field: string) {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${field} deve ser um valor válido maior ou igual a zero.`);
  }
}

export async function createCardProfileAction(payload: CardProfilePayload): Promise<ActionResult<{ id: string }>> {
  try {
    validateDay(payload.closing_day, "Fechamento");
    validateDay(payload.due_day, "Vencimento");
    validateMoney(payload.current_due_cents ?? 0, "Valor da fatura");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: account, error: accountError } = await supabase
      .from("finance_accounts")
      .select("id,type")
      .eq("id", payload.account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) throw new Error("Conta não encontrada.");
    if (account.type !== "credit_card") throw new Error("A conta selecionada precisa ser do tipo cartão.");

    const { data, error } = await supabase
      .from("finance_credit_card_profiles")
      .insert({
        user_id: user.id,
        account_id: payload.account_id,
        closing_day: payload.closing_day,
        due_day: payload.due_day,
        credit_limit_cents: payload.credit_limit_cents ?? null,
        current_due_cents: payload.current_due_cents ?? 0,
        best_purchase_day: payload.best_purchase_day ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/cartoes");
    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar perfil de cartão." };
  }
}

export async function updateCardProfileAction(payload: CardProfilePayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID do perfil obrigatório.");
    validateDay(payload.closing_day, "Fechamento");
    validateDay(payload.due_day, "Vencimento");
    validateMoney(payload.current_due_cents ?? 0, "Valor da fatura");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_credit_card_profiles")
      .update({
        account_id: payload.account_id,
        closing_day: payload.closing_day,
        due_day: payload.due_day,
        credit_limit_cents: payload.credit_limit_cents ?? null,
        current_due_cents: payload.current_due_cents ?? 0,
        best_purchase_day: payload.best_purchase_day ?? null,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/cartoes");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar perfil de cartão." };
  }
}

export async function deleteCardProfileAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_credit_card_profiles")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/cartoes");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao remover perfil de cartão." };
  }
}
