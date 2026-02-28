"use server";

import { revalidatePath } from "next/cache";
import { ActionResult } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type GoalPayload = {
  accessToken: string;
  id?: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  target_date?: string | null;
  status?: "active" | "paused" | "completed" | "archived";
};

type GoalContributionPayload = {
  accessToken: string;
  goal_id: string;
  account_id: string;
  amount_cents: number;
  occurred_on?: string;
};

export async function createGoalAction(payload: GoalPayload): Promise<ActionResult<{ id: string }>> {
  try {
    if (payload.target_cents <= 0) throw new Error("Meta deve ser maior que zero.");
    if (payload.saved_cents < 0) throw new Error("Valor salvo inválido.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data, error } = await supabase
      .from("finance_goals")
      .insert({
        user_id: user.id,
        name: payload.name.trim(),
        target_cents: payload.target_cents,
        saved_cents: payload.saved_cents,
        target_date: payload.target_date || null,
        status: payload.status || "active",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/metas");
    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar meta." };
  }
}

export async function updateGoalAction(payload: GoalPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID da meta obrigatório.");
    if (payload.target_cents <= 0) throw new Error("Meta deve ser maior que zero.");
    if (payload.saved_cents < 0) throw new Error("Valor salvo inválido.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_goals")
      .update({
        name: payload.name.trim(),
        target_cents: payload.target_cents,
        saved_cents: payload.saved_cents,
        target_date: payload.target_date || null,
        status: payload.status || "active",
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/metas");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar meta." };
  }
}

export async function deleteGoalAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_goals")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/metas");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao remover meta." };
  }
}

export async function addGoalContributionAction(payload: GoalContributionPayload): Promise<ActionResult> {
  try {
    if (!payload.goal_id) throw new Error("Meta inválida.");
    if (!payload.account_id) throw new Error("Selecione uma conta de origem.");
    if (!Number.isInteger(payload.amount_cents) || payload.amount_cents <= 0) {
      throw new Error("Valor do aporte deve ser maior que zero.");
    }

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const [goalRes, accountRes] = await Promise.all([
      supabase
        .from("finance_goals")
        .select("id,name,saved_cents,target_cents,status")
        .eq("id", payload.goal_id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("finance_accounts")
        .select("id,type,archived")
        .eq("id", payload.account_id)
        .eq("user_id", user.id)
        .single(),
    ]);

    if (goalRes.error || !goalRes.data) throw new Error("Meta não encontrada.");
    if (accountRes.error || !accountRes.data) throw new Error("Conta não encontrada.");
    if (accountRes.data.archived) throw new Error("Conta arquivada não pode receber lançamentos.");

    const { data: existingCategory } = await supabase
      .from("finance_categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", "Meta")
      .eq("archived", false)
      .limit(1)
      .maybeSingle();

    let categoryId = existingCategory?.id || null;

    if (!categoryId) {
      const { data: insertedCategory, error: categoryError } = await supabase
        .from("finance_categories")
        .insert({
          user_id: user.id,
          name: "Meta",
          kind: "both",
          color: "#8b5cf6",
          icon: "target",
          archived: false,
        })
        .select("id")
        .single();

      if (categoryError || !insertedCategory) throw new Error(categoryError?.message || "Falha ao criar categoria Meta.");
      categoryId = insertedCategory.id;
    }

    const occurredOn = payload.occurred_on || new Date().toISOString().slice(0, 10);

    const { error: txError } = await supabase.from("finance_transactions").insert({
      user_id: user.id,
      type: "expense",
      account_id: payload.account_id,
      category_id: categoryId,
      amount_cents: -payload.amount_cents,
      occurred_on: occurredOn,
      description: `Aporte para meta: ${goalRes.data.name}`,
      notes: `Aporte manual de ${payload.amount_cents} centavos na meta ${goalRes.data.name}`,
      is_cleared: true,
    });

    if (txError) throw new Error(txError.message);

    const newSaved = goalRes.data.saved_cents + payload.amount_cents;
    const nextStatus =
      goalRes.data.status === "archived"
        ? "archived"
        : newSaved >= goalRes.data.target_cents
          ? "completed"
          : "active";

    const { error: updateGoalError } = await supabase
      .from("finance_goals")
      .update({
        saved_cents: newSaved,
        status: nextStatus,
      })
      .eq("id", payload.goal_id)
      .eq("user_id", user.id);

    if (updateGoalError) throw new Error(updateGoalError.message);

    revalidatePath("/financas/metas");
    revalidatePath("/financas/transacoes");
    revalidatePath("/financas");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao adicionar valor na meta." };
  }
}
