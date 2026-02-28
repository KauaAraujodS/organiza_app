"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { ActionResult, FinanceTransactionInput, FinanceTransactionSplitInput } from "../types";
import {
  createServerSupabaseWithAccessToken,
  createServiceRoleSupabase,
  getUserFromAccessToken,
} from "@/app/lib/supabase/server";

function normalizeSignedAmount(type: FinanceTransactionInput["type"], amountCents: number) {
  const v = Math.abs(amountCents);
  if (type === "income") return v;
  if (type === "expense") return -v;
  return -v;
}

function normalizeSplits(splits: FinanceTransactionSplitInput[] | undefined, signedAmount: number) {
  if (!splits || splits.length === 0) return [];
  const sign = signedAmount >= 0 ? 1 : -1;
  const normalized = splits.map((s) => ({
    category_id: s.category_id,
    amount_cents: Math.abs(s.amount_cents) * sign,
    note: s.note?.trim() || null,
  }));
  const sum = normalized.reduce((acc, cur) => acc + cur.amount_cents, 0);
  if (sum !== signedAmount) {
    throw new Error("A soma dos splits precisa ser igual ao valor total da transação.");
  }
  return normalized;
}

function addMonthsYmd(ymd: string, months: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

export async function createTransactionAction(
  payload: FinanceTransactionInput
): Promise<ActionResult<{ ids: string[]; transfer_group_id?: string }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    if (!payload.account_id) throw new Error("Conta de origem é obrigatória.");
    if (!payload.occurred_on) throw new Error("Data da transação é obrigatória.");
    if (!payload.amount_cents || payload.amount_cents <= 0) {
      throw new Error("Valor da transação deve ser maior que zero.");
    }

    const baseDescription = payload.description?.trim() || null;
    const notes = payload.notes?.trim() || null;

    if (payload.type === "transfer") {
      if (!payload.destination_account_id) {
        throw new Error("Conta de destino é obrigatória na transferência.");
      }
      if (payload.destination_account_id === payload.account_id) {
        throw new Error("Origem e destino precisam ser contas diferentes.");
      }
      if (payload.splits && payload.splits.length > 0) {
        throw new Error("Transferência não aceita split.");
      }

      const transferGroup = randomUUID();
      const amount = Math.abs(payload.amount_cents);

      const originInsert = {
        user_id: user.id,
        type: "transfer",
        account_id: payload.account_id,
        category_id: null,
        transfer_group_id: transferGroup,
        amount_cents: -amount,
        occurred_on: payload.occurred_on,
        due_on: payload.due_on || null,
        description: baseDescription || "Transferência (saída)",
        notes,
      };

      const destinationInsert = {
        user_id: user.id,
        type: "transfer",
        account_id: payload.destination_account_id,
        category_id: null,
        transfer_group_id: transferGroup,
        amount_cents: amount,
        occurred_on: payload.occurred_on,
        due_on: payload.due_on || null,
        description: baseDescription || "Transferência (entrada)",
        notes,
      };

      const { data, error } = await supabase
        .from("finance_transactions")
        .insert([originInsert, destinationInsert])
        .select("id");

      if (error) throw new Error(error.message);

      revalidatePath("/financas");
      revalidatePath("/financas/transacoes");

      return {
        ok: true,
        data: {
          ids: (data || []).map((r) => r.id as string),
          transfer_group_id: transferGroup,
        },
      };
    }

    const signedAmount = normalizeSignedAmount(payload.type, payload.amount_cents);
    const normalizedSplits = normalizeSplits(payload.splits, signedAmount);
    const installmentCount = Math.max(1, Math.floor(payload.installment_count || 1));

    if (installmentCount > 1 && normalizedSplits.length > 0) {
      throw new Error("Split não pode ser usado com parcelamento nesta fase.");
    }

    if (installmentCount > 1) {
      const installmentGroup = randomUUID();
      const totalAbs = Math.abs(signedAmount);
      const base = Math.floor(totalAbs / installmentCount);
      const remainder = totalAbs - base * installmentCount;
      const sign = signedAmount >= 0 ? 1 : -1;

      const rows = Array.from({ length: installmentCount }).map((_, idx) => {
        const installmentAbs = base + (idx < remainder ? 1 : 0);
        const installmentSigned = installmentAbs * sign;
        return {
          user_id: user.id,
          type: payload.type,
          account_id: payload.account_id,
          category_id: payload.category_id || null,
          debt_id: payload.debt_id || null,
          amount_cents: installmentSigned,
          occurred_on: addMonthsYmd(payload.occurred_on, idx),
          due_on: payload.due_on ? addMonthsYmd(payload.due_on, idx) : addMonthsYmd(payload.occurred_on, idx),
          description:
            `${baseDescription || "Lançamento"} (${idx + 1}/${installmentCount})`,
          notes,
          transfer_group_id: null,
          installment_group_id: installmentGroup,
          installment_number: idx + 1,
          installment_total: installmentCount,
        };
      });

      const { data: createdRows, error: insertError } = await supabase
        .from("finance_transactions")
        .insert(rows)
        .select("id");

      if (insertError) throw new Error(insertError.message);

      if (payload.tag_ids && payload.tag_ids.length > 0 && createdRows && createdRows.length > 0) {
        const relations = createdRows.flatMap((row) =>
          payload.tag_ids!.map((tagId) => ({
            transaction_id: row.id as string,
            tag_id: tagId,
            user_id: user.id,
          }))
        );
        const { error: tagError } = await supabase.from("finance_transaction_tags").insert(relations);
        if (tagError) throw new Error(tagError.message);
      }

      revalidatePath("/financas");
      revalidatePath("/financas/transacoes");

      return {
        ok: true,
        data: {
          ids: (createdRows || []).map((r) => r.id as string),
        },
      };
    }

    const insertData = {
      user_id: user.id,
      type: payload.type,
      account_id: payload.account_id,
      category_id: normalizedSplits.length > 0 ? null : payload.category_id || null,
      debt_id: payload.debt_id || null,
      amount_cents: signedAmount,
      occurred_on: payload.occurred_on,
      due_on: payload.due_on || null,
      description: baseDescription,
      notes,
      transfer_group_id: null,
      installment_group_id: null,
      installment_number: null,
      installment_total: null,
    };

    const { data: createdTx, error: txError } = await supabase
      .from("finance_transactions")
      .insert(insertData)
      .select("id")
      .single();

    if (txError) throw new Error(txError.message);

    if (normalizedSplits.length > 0) {
      const { error: splitError } = await supabase.from("finance_transaction_splits").insert(
        normalizedSplits.map((split) => ({
          user_id: user.id,
          transaction_id: createdTx.id,
          category_id: split.category_id,
          amount_cents: split.amount_cents,
          note: split.note,
        }))
      );
      if (splitError) throw new Error(splitError.message);
    }

    if (payload.tag_ids && payload.tag_ids.length > 0) {
      const { error: tagError } = await supabase.from("finance_transaction_tags").insert(
        payload.tag_ids.map((tagId) => ({
          transaction_id: createdTx.id,
          tag_id: tagId,
          user_id: user.id,
        }))
      );
      if (tagError) throw new Error(tagError.message);
    }

    revalidatePath("/financas");
    revalidatePath("/financas/transacoes");

    return { ok: true, data: { ids: [createdTx.id] } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao criar transação." };
  }
}

export async function updateTransactionAction(
  payload: FinanceTransactionInput & { id: string }
): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: tx, error: txFetchError } = await supabase
      .from("finance_transactions")
      .select("id,type,transfer_group_id,installment_group_id")
      .eq("id", payload.id)
      .eq("user_id", user.id)
      .single();

    if (txFetchError) throw new Error(txFetchError.message);

    if (tx.type === "transfer") {
      throw new Error("Edição de transferência não suportada. Exclua e crie novamente.");
    }
    if (tx.installment_group_id) {
      throw new Error("Edição de parcelamento não suportada. Exclua e recrie o parcelamento.");
    }

    const signedAmount = normalizeSignedAmount(payload.type, payload.amount_cents);
    const normalizedSplits = normalizeSplits(payload.splits, signedAmount);

    const { error: updateError } = await supabase
      .from("finance_transactions")
      .update({
        type: payload.type,
        account_id: payload.account_id,
        category_id: normalizedSplits.length > 0 ? null : payload.category_id || null,
        amount_cents: signedAmount,
        debt_id: payload.debt_id || null,
        occurred_on: payload.occurred_on,
        due_on: payload.due_on || null,
        description: payload.description?.trim() || null,
        notes: payload.notes?.trim() || null,
      })
      .eq("id", payload.id)
      .eq("user_id", user.id);

    if (updateError) throw new Error(updateError.message);

    const { error: deleteSplitsError } = await supabase
      .from("finance_transaction_splits")
      .delete()
      .eq("transaction_id", payload.id)
      .eq("user_id", user.id);

    if (deleteSplitsError) throw new Error(deleteSplitsError.message);

    if (normalizedSplits.length > 0) {
      const { error: splitError } = await supabase.from("finance_transaction_splits").insert(
        normalizedSplits.map((split) => ({
          user_id: user.id,
          transaction_id: payload.id,
          category_id: split.category_id,
          amount_cents: split.amount_cents,
          note: split.note,
        }))
      );
      if (splitError) throw new Error(splitError.message);
    }

    const { error: deleteTagsError } = await supabase
      .from("finance_transaction_tags")
      .delete()
      .eq("transaction_id", payload.id)
      .eq("user_id", user.id);

    if (deleteTagsError) throw new Error(deleteTagsError.message);

    if (payload.tag_ids && payload.tag_ids.length > 0) {
      const { error: tagError } = await supabase.from("finance_transaction_tags").insert(
        payload.tag_ids.map((tagId) => ({
          transaction_id: payload.id,
          tag_id: tagId,
          user_id: user.id,
        }))
      );
      if (tagError) throw new Error(tagError.message);
    }

    revalidatePath("/financas");
    revalidatePath("/financas/transacoes");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao atualizar transação." };
  }
}

export async function deleteTransactionAction(payload: {
  accessToken: string;
  id: string;
}): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: tx, error: txError } = await supabase
      .from("finance_transactions")
      .select("id,transfer_group_id,installment_group_id")
      .eq("id", payload.id)
      .eq("user_id", user.id)
      .single();

    if (txError) throw new Error(txError.message);

    if (tx.transfer_group_id) {
      const { error: transferDeleteError } = await supabase
        .from("finance_transactions")
        .delete()
        .eq("transfer_group_id", tx.transfer_group_id)
        .eq("user_id", user.id);

      if (transferDeleteError) throw new Error(transferDeleteError.message);
    } else if (tx.installment_group_id) {
      const { error: installmentDeleteError } = await supabase
        .from("finance_transactions")
        .delete()
        .eq("installment_group_id", tx.installment_group_id)
        .eq("user_id", user.id);
      if (installmentDeleteError) throw new Error(installmentDeleteError.message);
    } else {
      const { error: deleteError } = await supabase
        .from("finance_transactions")
        .delete()
        .eq("id", payload.id)
        .eq("user_id", user.id);
      if (deleteError) throw new Error(deleteError.message);
    }

    revalidatePath("/financas");
    revalidatePath("/financas/transacoes");

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao excluir transação." };
  }
}

export async function uploadAttachmentAction(payload: {
  accessToken: string;
  transaction_id: string;
  file_name: string;
  mime_type?: string;
  base64_data: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: tx, error: txError } = await supabase
      .from("finance_transactions")
      .select("id")
      .eq("id", payload.transaction_id)
      .eq("user_id", user.id)
      .single();

    if (txError || !tx) throw new Error("Transação não encontrada para anexar arquivo.");

    const service = createServiceRoleSupabase();

    const cleanName = payload.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${payload.transaction_id}/${Date.now()}-${cleanName}`;
    const bytes = Buffer.from(payload.base64_data, "base64");

    const { error: uploadError } = await service.storage
      .from("finance_attachments")
      .upload(storagePath, bytes, {
        contentType: payload.mime_type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data, error: insertError } = await supabase
      .from("finance_attachments")
      .insert({
        user_id: user.id,
        transaction_id: payload.transaction_id,
        bucket: "finance_attachments",
        storage_path: storagePath,
        file_name: payload.file_name,
        mime_type: payload.mime_type || null,
        size_bytes: bytes.byteLength,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    revalidatePath("/financas/transacoes");

    return { ok: true, data: { id: data.id } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar anexo." };
  }
}

export async function getAttachmentSignedUrlAction(payload: {
  accessToken: string;
  attachment_id: string;
  expires_in?: number;
}): Promise<ActionResult<{ signed_url: string }>> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: attachment, error } = await supabase
      .from("finance_attachments")
      .select("id,bucket,storage_path")
      .eq("id", payload.attachment_id)
      .eq("user_id", user.id)
      .single();

    if (error || !attachment) throw new Error("Anexo não encontrado.");

    const service = createServiceRoleSupabase();
    const { data, error: signedError } = await service.storage
      .from(attachment.bucket)
      .createSignedUrl(attachment.storage_path, payload.expires_in || 300);

    if (signedError || !data?.signedUrl) throw new Error(signedError?.message || "Falha ao gerar URL assinada.");

    return { ok: true, data: { signed_url: data.signedUrl } };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao gerar URL do anexo." };
  }
}

export async function deleteAttachmentAction(payload: {
  accessToken: string;
  attachment_id: string;
}): Promise<ActionResult> {
  try {
    const user = await getUserFromAccessToken(payload.accessToken);
    const supabase = createServerSupabaseWithAccessToken(payload.accessToken);

    const { data: attachment, error: fetchError } = await supabase
      .from("finance_attachments")
      .select("id,bucket,storage_path")
      .eq("id", payload.attachment_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !attachment) throw new Error("Anexo não encontrado.");

    const service = createServiceRoleSupabase();
    const { error: removeStorageError } = await service.storage
      .from(attachment.bucket)
      .remove([attachment.storage_path]);

    if (removeStorageError) throw new Error(removeStorageError.message);

    const { error: deleteDbError } = await supabase
      .from("finance_attachments")
      .delete()
      .eq("id", payload.attachment_id)
      .eq("user_id", user.id);

    if (deleteDbError) throw new Error(deleteDbError.message);

    revalidatePath("/financas/transacoes");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao remover anexo." };
  }
}
