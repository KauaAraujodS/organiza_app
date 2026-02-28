-- Finance Module - Phase 3 migration
-- Execute após finance_schema.sql

create extension if not exists pgcrypto;

-- =====================
-- Transactions columns for installments/debts
-- =====================
alter table public.finance_transactions
  add column if not exists installment_group_id uuid null,
  add column if not exists installment_number int null,
  add column if not exists installment_total int null,
  add column if not exists debt_id uuid null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'finance_transactions_installment_check'
      and table_name = 'finance_transactions'
  ) then
    alter table public.finance_transactions
      add constraint finance_transactions_installment_check
      check (
        (installment_group_id is null and installment_number is null and installment_total is null)
        or
        (installment_group_id is not null and installment_number >= 1 and installment_total >= installment_number)
      );
  end if;
end$$;

-- =====================
-- Credit card profile
-- =====================
create table if not exists public.finance_credit_card_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  credit_limit_cents bigint null check (credit_limit_cents is null or credit_limit_cents > 0),
  best_purchase_day int null check (best_purchase_day is null or (best_purchase_day between 1 and 31)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id)
);

-- =====================
-- Debts
-- =====================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_debt_status') then
    create type public.finance_debt_status as enum ('open', 'renegotiated', 'paid', 'canceled');
  end if;
end$$;

create table if not exists public.finance_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  creditor text null,
  total_amount_cents bigint not null check (total_amount_cents > 0),
  outstanding_cents bigint not null check (outstanding_cents >= 0),
  interest_rate_monthly numeric(8,4) null,
  due_on date null,
  status public.finance_debt_status not null default 'open',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_transactions
  add constraint finance_transactions_debt_fk
  foreign key (debt_id) references public.finance_debts(id) on delete set null;

-- =====================
-- Triggers
-- =====================
drop trigger if exists trg_finance_credit_card_profiles_updated_at on public.finance_credit_card_profiles;
create trigger trg_finance_credit_card_profiles_updated_at
before update on public.finance_credit_card_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_debts_updated_at on public.finance_debts;
create trigger trg_finance_debts_updated_at
before update on public.finance_debts
for each row execute function public.touch_updated_at();

-- =====================
-- Indexes
-- =====================
create index if not exists idx_finance_credit_card_profiles_user
  on public.finance_credit_card_profiles(user_id, account_id);

create index if not exists idx_finance_debts_user_status
  on public.finance_debts(user_id, status, due_on);

create index if not exists idx_finance_transactions_installment_group
  on public.finance_transactions(user_id, installment_group_id);

create index if not exists idx_finance_transactions_debt
  on public.finance_transactions(user_id, debt_id);

-- =====================
-- RLS
-- =====================
alter table public.finance_credit_card_profiles enable row level security;
alter table public.finance_debts enable row level security;

drop policy if exists "finance_cc_profiles_select_own" on public.finance_credit_card_profiles;
create policy "finance_cc_profiles_select_own"
on public.finance_credit_card_profiles for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_cc_profiles_insert_own" on public.finance_credit_card_profiles;
create policy "finance_cc_profiles_insert_own"
on public.finance_credit_card_profiles for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_cc_profiles_update_own" on public.finance_credit_card_profiles;
create policy "finance_cc_profiles_update_own"
on public.finance_credit_card_profiles for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_cc_profiles_delete_own" on public.finance_credit_card_profiles;
create policy "finance_cc_profiles_delete_own"
on public.finance_credit_card_profiles for delete
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_debts_select_own" on public.finance_debts;
create policy "finance_debts_select_own"
on public.finance_debts for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_debts_insert_own" on public.finance_debts;
create policy "finance_debts_insert_own"
on public.finance_debts for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_debts_update_own" on public.finance_debts;
create policy "finance_debts_update_own"
on public.finance_debts for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_debts_delete_own" on public.finance_debts;
create policy "finance_debts_delete_own"
on public.finance_debts for delete
to authenticated using (auth.uid() = user_id);
