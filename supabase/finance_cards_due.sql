-- Finance - cartões: valor atual da fatura
-- Execute depois de finance_phase3.sql

alter table public.finance_credit_card_profiles
  add column if not exists current_due_cents bigint not null default 0
  check (current_due_cents >= 0);

