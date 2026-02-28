-- Finance Module Schema (Fase 1 base + estruturas Fases 2-4)
-- Execute no SQL Editor do Supabase.

create extension if not exists pgcrypto;

-- =====================
-- Enums
-- =====================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_account_type') then
    create type public.finance_account_type as enum (
      'checking',
      'wallet',
      'savings',
      'credit_card',
      'cash',
      'investment'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_transaction_type') then
    create type public.finance_transaction_type as enum ('income', 'expense', 'transfer');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_category_kind') then
    create type public.finance_category_kind as enum ('income', 'expense', 'both');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_goal_status') then
    create type public.finance_goal_status as enum ('active', 'paused', 'completed', 'archived');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_recurrence_freq') then
    create type public.finance_recurrence_freq as enum ('daily', 'weekly', 'monthly', 'yearly');
  end if;
end$$;

-- =====================
-- Trigger helper
-- =====================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================
-- Core tables
-- =====================
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.finance_account_type not null,
  currency char(3) not null default 'BRL',
  opening_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lower(name))
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind public.finance_category_kind not null default 'expense',
  parent_id uuid null references public.finance_categories(id) on delete set null,
  color text null,
  icon text null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lower(name), coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

create table if not exists public.finance_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lower(name))
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.finance_transaction_type not null,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  category_id uuid null references public.finance_categories(id) on delete set null,
  transfer_group_id uuid null,
  recurring_rule_id uuid null,
  amount_cents bigint not null check (amount_cents <> 0),
  occurred_on date not null,
  due_on date null,
  description text null,
  notes text null,
  is_cleared boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'income' and amount_cents > 0) or
    (type = 'expense' and amount_cents < 0) or
    (type = 'transfer')
  ),
  check (
    (type = 'transfer' and transfer_group_id is not null) or
    (type <> 'transfer')
  )
);

create table if not exists public.finance_transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.finance_transactions(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id) on delete restrict,
  amount_cents bigint not null check (amount_cents <> 0),
  note text null,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_transaction_tags (
  transaction_id uuid not null references public.finance_transactions(id) on delete cascade,
  tag_id uuid not null references public.finance_tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (transaction_id, tag_id)
);

create table if not exists public.finance_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.finance_transactions(id) on delete cascade,
  bucket text not null default 'finance_attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text null,
  size_bytes bigint null,
  created_at timestamptz not null default now()
);

-- =====================
-- Phase 2+ structures (base)
-- =====================
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  period_start date not null,
  period_end date not null,
  amount_limit_cents bigint not null check (amount_limit_cents > 0),
  category_id uuid null references public.finance_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.finance_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type public.finance_transaction_type not null default 'expense',
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  category_id uuid null references public.finance_categories(id) on delete set null,
  amount_cents bigint not null check (amount_cents <> 0),
  freq public.finance_recurrence_freq not null,
  interval_count int not null default 1 check (interval_count > 0),
  start_on date not null,
  end_on date null,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz null,
  timezone text not null default 'UTC',
  auto_create_days_ahead int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_cents bigint not null check (target_cents > 0),
  saved_cents bigint not null default 0,
  target_date date null,
  status public.finance_goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================
-- Update triggers
-- =====================
drop trigger if exists trg_finance_accounts_updated_at on public.finance_accounts;
create trigger trg_finance_accounts_updated_at
before update on public.finance_accounts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_categories_updated_at on public.finance_categories;
create trigger trg_finance_categories_updated_at
before update on public.finance_categories
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_tags_updated_at on public.finance_tags;
create trigger trg_finance_tags_updated_at
before update on public.finance_tags
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_transactions_updated_at on public.finance_transactions;
create trigger trg_finance_transactions_updated_at
before update on public.finance_transactions
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_budgets_updated_at on public.finance_budgets;
create trigger trg_finance_budgets_updated_at
before update on public.finance_budgets
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_recurring_rules_updated_at on public.finance_recurring_rules;
create trigger trg_finance_recurring_rules_updated_at
before update on public.finance_recurring_rules
for each row execute function public.touch_updated_at();

drop trigger if exists trg_finance_goals_updated_at on public.finance_goals;
create trigger trg_finance_goals_updated_at
before update on public.finance_goals
for each row execute function public.touch_updated_at();

-- =====================
-- Split integrity checks
-- =====================
create or replace function public.validate_transaction_split_totals(tx_id uuid)
returns void
language plpgsql
as $$
declare
  tx_amount bigint;
  sum_splits bigint;
begin
  select amount_cents into tx_amount
  from public.finance_transactions
  where id = tx_id;

  if tx_amount is null then
    return;
  end if;

  select coalesce(sum(amount_cents), 0) into sum_splits
  from public.finance_transaction_splits
  where transaction_id = tx_id;

  if exists (
    select 1 from public.finance_transaction_splits where transaction_id = tx_id
  ) and sum_splits <> tx_amount then
    raise exception 'Split sum (% ) must match transaction amount (%)', sum_splits, tx_amount;
  end if;
end;
$$;

create or replace function public.trg_validate_split_totals()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_transaction_split_totals(coalesce(new.transaction_id, old.transaction_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_finance_split_totals on public.finance_transaction_splits;
create constraint trigger trg_finance_split_totals
after insert or update or delete on public.finance_transaction_splits
deferrable initially deferred
for each row execute function public.trg_validate_split_totals();

-- =====================
-- Indexes
-- =====================
create index if not exists idx_finance_accounts_user_archived
  on public.finance_accounts(user_id, archived);

create index if not exists idx_finance_categories_user_parent
  on public.finance_categories(user_id, parent_id);

create index if not exists idx_finance_tags_user
  on public.finance_tags(user_id);

create index if not exists idx_finance_transactions_user_date
  on public.finance_transactions(user_id, occurred_on desc);

create index if not exists idx_finance_transactions_user_type_date
  on public.finance_transactions(user_id, type, occurred_on desc);

create index if not exists idx_finance_transactions_user_transfer_group
  on public.finance_transactions(user_id, transfer_group_id);

create index if not exists idx_finance_transactions_user_due
  on public.finance_transactions(user_id, due_on)
  where due_on is not null;

create index if not exists idx_finance_splits_tx
  on public.finance_transaction_splits(transaction_id);

create index if not exists idx_finance_tx_tags_user
  on public.finance_transaction_tags(user_id, transaction_id);

create index if not exists idx_finance_attachments_tx
  on public.finance_attachments(user_id, transaction_id, created_at desc);

create index if not exists idx_finance_recurring_next_run
  on public.finance_recurring_rules(user_id, next_run_at)
  where active = true;

create index if not exists idx_finance_budgets_period
  on public.finance_budgets(user_id, period_start, period_end);

create index if not exists idx_finance_goals_user_status
  on public.finance_goals(user_id, status);

-- =====================
-- RLS
-- =====================
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_tags enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_transaction_splits enable row level security;
alter table public.finance_transaction_tags enable row level security;
alter table public.finance_attachments enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_recurring_rules enable row level security;
alter table public.finance_goals enable row level security;

-- finance_accounts
drop policy if exists "finance_accounts_select_own" on public.finance_accounts;
create policy "finance_accounts_select_own"
on public.finance_accounts for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_accounts_insert_own" on public.finance_accounts;
create policy "finance_accounts_insert_own"
on public.finance_accounts for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_accounts_update_own" on public.finance_accounts;
create policy "finance_accounts_update_own"
on public.finance_accounts for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_accounts_delete_own" on public.finance_accounts;
create policy "finance_accounts_delete_own"
on public.finance_accounts for delete
to authenticated using (auth.uid() = user_id);

-- finance_categories
drop policy if exists "finance_categories_select_own" on public.finance_categories;
create policy "finance_categories_select_own"
on public.finance_categories for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_categories_insert_own" on public.finance_categories;
create policy "finance_categories_insert_own"
on public.finance_categories for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_categories_update_own" on public.finance_categories;
create policy "finance_categories_update_own"
on public.finance_categories for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_categories_delete_own" on public.finance_categories;
create policy "finance_categories_delete_own"
on public.finance_categories for delete
to authenticated using (auth.uid() = user_id);

-- finance_tags
drop policy if exists "finance_tags_select_own" on public.finance_tags;
create policy "finance_tags_select_own"
on public.finance_tags for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_tags_insert_own" on public.finance_tags;
create policy "finance_tags_insert_own"
on public.finance_tags for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_tags_update_own" on public.finance_tags;
create policy "finance_tags_update_own"
on public.finance_tags for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_tags_delete_own" on public.finance_tags;
create policy "finance_tags_delete_own"
on public.finance_tags for delete
to authenticated using (auth.uid() = user_id);

-- finance_transactions
drop policy if exists "finance_transactions_select_own" on public.finance_transactions;
create policy "finance_transactions_select_own"
on public.finance_transactions for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_transactions_insert_own" on public.finance_transactions;
create policy "finance_transactions_insert_own"
on public.finance_transactions for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_transactions_update_own" on public.finance_transactions;
create policy "finance_transactions_update_own"
on public.finance_transactions for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_transactions_delete_own" on public.finance_transactions;
create policy "finance_transactions_delete_own"
on public.finance_transactions for delete
to authenticated using (auth.uid() = user_id);

-- finance_transaction_splits
drop policy if exists "finance_transaction_splits_select_own" on public.finance_transaction_splits;
create policy "finance_transaction_splits_select_own"
on public.finance_transaction_splits for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_transaction_splits_insert_own" on public.finance_transaction_splits;
create policy "finance_transaction_splits_insert_own"
on public.finance_transaction_splits for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_transaction_splits_update_own" on public.finance_transaction_splits;
create policy "finance_transaction_splits_update_own"
on public.finance_transaction_splits for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_transaction_splits_delete_own" on public.finance_transaction_splits;
create policy "finance_transaction_splits_delete_own"
on public.finance_transaction_splits for delete
to authenticated using (auth.uid() = user_id);

-- finance_transaction_tags
drop policy if exists "finance_transaction_tags_select_own" on public.finance_transaction_tags;
create policy "finance_transaction_tags_select_own"
on public.finance_transaction_tags for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_transaction_tags_insert_own" on public.finance_transaction_tags;
create policy "finance_transaction_tags_insert_own"
on public.finance_transaction_tags for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_transaction_tags_delete_own" on public.finance_transaction_tags;
create policy "finance_transaction_tags_delete_own"
on public.finance_transaction_tags for delete
to authenticated using (auth.uid() = user_id);

-- finance_attachments
drop policy if exists "finance_attachments_select_own" on public.finance_attachments;
create policy "finance_attachments_select_own"
on public.finance_attachments for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_attachments_insert_own" on public.finance_attachments;
create policy "finance_attachments_insert_own"
on public.finance_attachments for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_attachments_delete_own" on public.finance_attachments;
create policy "finance_attachments_delete_own"
on public.finance_attachments for delete
to authenticated using (auth.uid() = user_id);

-- finance_budgets
drop policy if exists "finance_budgets_select_own" on public.finance_budgets;
create policy "finance_budgets_select_own"
on public.finance_budgets for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_budgets_insert_own" on public.finance_budgets;
create policy "finance_budgets_insert_own"
on public.finance_budgets for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_budgets_update_own" on public.finance_budgets;
create policy "finance_budgets_update_own"
on public.finance_budgets for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_budgets_delete_own" on public.finance_budgets;
create policy "finance_budgets_delete_own"
on public.finance_budgets for delete
to authenticated using (auth.uid() = user_id);

-- finance_recurring_rules
drop policy if exists "finance_recurring_rules_select_own" on public.finance_recurring_rules;
create policy "finance_recurring_rules_select_own"
on public.finance_recurring_rules for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_recurring_rules_insert_own" on public.finance_recurring_rules;
create policy "finance_recurring_rules_insert_own"
on public.finance_recurring_rules for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_recurring_rules_update_own" on public.finance_recurring_rules;
create policy "finance_recurring_rules_update_own"
on public.finance_recurring_rules for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_recurring_rules_delete_own" on public.finance_recurring_rules;
create policy "finance_recurring_rules_delete_own"
on public.finance_recurring_rules for delete
to authenticated using (auth.uid() = user_id);

-- finance_goals
drop policy if exists "finance_goals_select_own" on public.finance_goals;
create policy "finance_goals_select_own"
on public.finance_goals for select
to authenticated using (auth.uid() = user_id);

drop policy if exists "finance_goals_insert_own" on public.finance_goals;
create policy "finance_goals_insert_own"
on public.finance_goals for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "finance_goals_update_own" on public.finance_goals;
create policy "finance_goals_update_own"
on public.finance_goals for update
to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "finance_goals_delete_own" on public.finance_goals;
create policy "finance_goals_delete_own"
on public.finance_goals for delete
to authenticated using (auth.uid() = user_id);

-- =====================
-- Storage notes / policies (bucket: finance_attachments)
-- =====================
-- 1) Criar bucket manualmente no Supabase Storage:
--    - nome: finance_attachments
--    - private: true
--
-- 2) Policies no storage.objects:
--    (executar no SQL Editor após criar bucket)
--
-- drop policy if exists "finance_attachments_select_own_objects" on storage.objects;
-- create policy "finance_attachments_select_own_objects"
-- on storage.objects
-- for select
-- to authenticated
-- using (
--   bucket_id = 'finance_attachments'
--   and split_part(name, '/', 1) = auth.uid()::text
-- );
--
-- drop policy if exists "finance_attachments_insert_own_objects" on storage.objects;
-- create policy "finance_attachments_insert_own_objects"
-- on storage.objects
-- for insert
-- to authenticated
-- with check (
--   bucket_id = 'finance_attachments'
--   and split_part(name, '/', 1) = auth.uid()::text
-- );
--
-- drop policy if exists "finance_attachments_delete_own_objects" on storage.objects;
-- create policy "finance_attachments_delete_own_objects"
-- on storage.objects
-- for delete
-- to authenticated
-- using (
--   bucket_id = 'finance_attachments'
--   and split_part(name, '/', 1) = auth.uid()::text
-- );
