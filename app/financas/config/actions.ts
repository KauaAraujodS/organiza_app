"use server";

import { revalidatePath } from "next/cache";
import { ActionResult, FinanceCategoryKind } from "../types";
import { createServerSupabaseWithAccessToken, getUserFromAccessToken } from "@/app/lib/supabase/server";

type CategoryPayload = {
  accessToken: string;
  id?: string;
  name: string;
  kind: FinanceCategoryKind;
  parent_id?: string | null;
  color?: string | null;
  icon?: string | null;
  archived?: boolean;
};

type TagPayload = {
  accessToken: string;
  id?: string;
  name: string;
  color?: string | null;
};

export async function createCategoryAction(payload: CategoryPayload): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data, error } = await supabase
      .from("finance_categories")
      .insert({
        user_id: user.id,
        name: payload.name.trim(),
        kind: payload.kind,
        parent_id: payload.parent_id || null,
        color: payload.color || null,
        icon: payload.icon || null,
        archived: payload.archived || false,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/config");
    revalidatePath("/financas/transacoes");

    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar categoria." };
  }
}

export async function updateCategoryAction(payload: CategoryPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID da categoria obrigatório.");
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_categories")
      .update({
        name: payload.name.trim(),
        kind: payload.kind,
        parent_id: payload.parent_id || null,
        color: payload.color || null,
        icon: payload.icon || null,
        archived: payload.archived || false,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/config");
    revalidatePath("/financas/transacoes");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar categoria." };
  }
}

export async function deleteCategoryAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { count, error: countError } = await supabase
      .from("finance_transactions")
      .select("id", { count: "exact", head: true })
      .eq("category_id", payload.id)
      .eq("user_id", user.id);

    if (countError) throw new Error(countError.message);
    if ((count || 0) > 0) {
      throw new Error("Categoria com transações não pode ser removida.");
    }

    const { error } = await supabase
      .from("finance_categories")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/config");
    revalidatePath("/financas/transacoes");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao remover categoria." };
  }
}

export async function createTagAction(payload: TagPayload): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data, error } = await supabase
      .from("finance_tags")
      .insert({
        user_id: user.id,
        name: payload.name.trim(),
        color: payload.color || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/financas/config");
    revalidatePath("/financas/transacoes");

    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar tag." };
  }
}

export async function updateTagAction(payload: TagPayload): Promise<ActionResult> {
  try {
    if (!payload.id) throw new Error("ID da tag obrigatório.");
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_tags")
      .update({ name: payload.name.trim(), color: payload.color || null })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/config");
    revalidatePath("/financas/transacoes");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar tag." };
  }
}

export async function deleteTagAction(payload: { accessToken: string; id: string }): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { error } = await supabase
      .from("finance_tags")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/financas/config");
    revalidatePath("/financas/transacoes");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao remover tag." };
  }
}
