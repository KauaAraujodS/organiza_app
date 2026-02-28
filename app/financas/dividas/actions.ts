"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, FinanceDebtStatus } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type DebtPayload = {
  accessToken: string;
  id?: string;
  name: string;
  creditor?: string;
  total_amount_cents: number;
  outstanding_cents: number;
  interest_rate_monthly?: number | null;
  due_on?: string | null;
  status?: FinanceDebtStatus;
  notes?: string;
};

export async function createDebtAction(payload: DebtPayload): Promise<ActionResult<{ id: string }>> {
  try {
    if (payload.total_amount_cents <= 0) throw new Error("Valor total deve ser maior que zero.");
    if (payload.outstanding_cents < 0) throw new Error("Saldo devedor inválido.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data, error } = await supabase
      .from("finance_debts")
      .insert({
        user_id: user.id,
        name: payload.name.trim(),
        creditor: payload.creditor?.trim() || null,
        total_amount_cents: payload.total_amount_cents,
        outstanding_cents: payload.outstanding_cents,
        interest_rate_monthly: payload.interest_rate_monthly ?? null,
        due_on: payload.due_on || null,
        status: payload.status || "open",
        notes: payload.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/dividas");
    revalidatePath("/financas/transacoes");
    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar dívida." };
  }
}

export async function updateDebtAction(payload: DebtPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID da dívida obrigatório.");
    if (payload.total_amount_cents <= 0) throw new Error("Valor total deve ser maior que zero.");
    if (payload.outstanding_cents < 0) throw new Error("Saldo devedor inválido.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_debts")
      .update({
        name: payload.name.trim(),
        creditor: payload.creditor?.trim() || null,
        total_amount_cents: payload.total_amount_cents,
        outstanding_cents: payload.outstanding_cents,
        interest_rate_monthly: payload.interest_rate_monthly ?? null,
        due_on: payload.due_on || null,
        status: payload.status || "open",
        notes: payload.notes?.trim() || null,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/dividas");
    revalidatePath("/financas/transacoes");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar dívida." };
  }
}

export async function deleteDebtAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { count, error: countError } = await supabase
      .from("finance_transactions")
      .select("id", { count: "exact", head: true })
      .eq("debt_id", payload.id)
      .eq("user_id", user.id);

    if (countError) throw new Error(countError.message);
    if ((count || 0) > 0) throw new Error("Dívida vinculada a transações não pode ser removida.");

    const { error } = await supabase
      .from("finance_debts")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/dividas");
    revalidatePath("/financas/transacoes");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao excluir dívida." };
  }
}
