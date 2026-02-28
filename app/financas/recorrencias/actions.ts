"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, FinanceRecurrenceFreq, FinanceTransactionType } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type RecurringPayload = {
  accessToken: string;
  id?: string;
  title: string;
  type: FinanceTransactionType;
  account_id: string;
  category_id?: string | null;
  amount_cents: number;
  freq: FinanceRecurrenceFreq;
  interval_count: number;
  start_on: string;
  end_on?: string | null;
  timezone?: string;
  auto_create_days_ahead?: number;
  active?: boolean;
};

function signedAmount(type: FinanceTransactionType, amountCents: number) {
  const abs = Math.abs(amountCents);
  if (type === "income") return abs;
  if (type === "expense") return -abs;
  throw new Error("Recorrência de transferência não suportada nesta fase.");
}

function dateAtUtcStart(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addInterval(base: Date, freq: FinanceRecurrenceFreq, intervalCount: number) {
  const d = new Date(base.getTime());
  if (freq === "daily") d.setUTCDate(d.getUTCDate() + intervalCount);
  if (freq === "weekly") d.setUTCDate(d.getUTCDate() + intervalCount * 7);
  if (freq === "monthly") d.setUTCMonth(d.getUTCMonth() + intervalCount);
  if (freq === "yearly") d.setUTCFullYear(d.getUTCFullYear() + intervalCount);
  return d;
}

export async function createRecurringRuleAction(payload: RecurringPayload): Promise<ActionResult<{ id: string }>> {
  try {
    if (payload.type === "transfer") throw new Error("Transferência recorrente não suportada nesta fase.");
    if (payload.interval_count <= 0) throw new Error("Intervalo deve ser maior que zero.");
    if (payload.amount_cents <= 0) throw new Error("Valor deve ser maior que zero.");
    if (payload.end_on && payload.end_on < payload.start_on) throw new Error("Data final inválida.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const firstRun = dateAtUtcStart(payload.start_on).toISOString();
    const amount = signedAmount(payload.type, payload.amount_cents);

    const { data, error } = await supabase
      .from("finance_recurring_rules")
      .insert({
        user_id: user.id,
        title: payload.title.trim(),
        type: payload.type,
        account_id: payload.account_id,
        category_id: payload.category_id || null,
        amount_cents: amount,
        freq: payload.freq,
        interval_count: payload.interval_count,
        start_on: payload.start_on,
        end_on: payload.end_on || null,
        next_run_at: firstRun,
        timezone: payload.timezone || "UTC",
        auto_create_days_ahead: payload.auto_create_days_ahead ?? 0,
        active: payload.active ?? true,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/recorrencias");
    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar recorrência." };
  }
}

export async function updateRecurringRuleAction(payload: RecurringPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID da recorrência obrigatório.");
    if (payload.type === "transfer") throw new Error("Transferência recorrente não suportada nesta fase.");
    if (payload.interval_count <= 0) throw new Error("Intervalo deve ser maior que zero.");
    if (payload.amount_cents <= 0) throw new Error("Valor deve ser maior que zero.");
    if (payload.end_on && payload.end_on < payload.start_on) throw new Error("Data final inválida.");

    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const amount = signedAmount(payload.type, payload.amount_cents);
    const { error } = await supabase
      .from("finance_recurring_rules")
      .update({
        title: payload.title.trim(),
        type: payload.type,
        account_id: payload.account_id,
        category_id: payload.category_id || null,
        amount_cents: amount,
        freq: payload.freq,
        interval_count: payload.interval_count,
        start_on: payload.start_on,
        end_on: payload.end_on || null,
        timezone: payload.timezone || "UTC",
        auto_create_days_ahead: payload.auto_create_days_ahead ?? 0,
        active: payload.active ?? true,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/recorrencias");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar recorrência." };
  }
}

export async function deleteRecurringRuleAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_recurring_rules")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/recorrencias");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao excluir recorrência." };
  }
}

export async function runRecurringDueAction(payload: { accessToken: string }): Promise<ActionResult<{ generated: number }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: rules, error } = await supabase
      .from("finance_recurring_rules")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("next_run_at", { ascending: true });

    if (error) throw new Error(error.message);

    const now = new Date();
    let generated = 0;

    for (const rule of rules || []) {
      const horizon = new Date(now.getTime());
      horizon.setUTCDate(horizon.getUTCDate() + Number(rule.auto_create_days_ahead || 0));

      let cursor = new Date(rule.next_run_at);
      if (Number.isNaN(cursor.getTime())) continue;

      const endOn = rule.end_on ? dateAtUtcStart(rule.end_on) : null;

      while (cursor <= horizon) {
        const occurredOn = cursor.toISOString().slice(0, 10);
        if (endOn && cursor > endOn) break;

        const { error: txError } = await supabase.from("finance_transactions").insert({
          user_id: user.id,
          type: rule.type,
          account_id: rule.account_id,
          category_id: rule.category_id,
          recurring_rule_id: rule.id,
          amount_cents: rule.amount_cents,
          occurred_on: occurredOn,
          due_on: occurredOn,
          description: rule.title,
          notes: "Gerado automaticamente por recorrência",
          is_cleared: false,
        });
        if (txError) throw new Error(txError.message);

        generated += 1;
        cursor = addInterval(cursor, rule.freq, rule.interval_count);
      }

      const updateData: Record<string, string | null> = {
        next_run_at: cursor.toISOString(),
      };
      if (generated > 0) updateData.last_run_at = now.toISOString();

      const { error: updateError } = await supabase
        .from("finance_recurring_rules")
        .update(updateData)
        .eq("id", rule.id)
        .eq("user_id", user.id);
      if (updateError) throw new Error(updateError.message);
    }

    if (generated > 0) {
      revalidatePath("/financas");
      revalidatePath("/financas/transacoes");
      revalidatePath("/financas/recorrencias");
    }

    return { ok: true, data: { generated } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao processar recorrências." };
  }
}

