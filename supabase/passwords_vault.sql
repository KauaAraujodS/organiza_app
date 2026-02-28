-- Password Vault (Supabase)
-- Execute no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.vault_master (
  user_id uuid primary key references auth.users(id) on delete cascade,
  salt text not null,
  verifier text not null,
  kdf_iterations integer not null default 310000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.password_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null,
  username text,
  url text,
  category text,
  password_ciphertext text not null,
  password_iv text not null,
  notes_ciphertext text,
  notes_iv text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vault_master_updated_at on public.vault_master;
create trigger trg_vault_master_updated_at
before update on public.vault_master
for each row execute function public.touch_updated_at();

drop trigger if exists trg_password_vault_updated_at on public.password_vault;
create trigger trg_password_vault_updated_at
before update on public.password_vault
for each row execute function public.touch_updated_at();

create index if not exists idx_password_vault_user_created
  on public.password_vault(user_id, created_at desc);

create index if not exists idx_password_vault_user_category
  on public.password_vault(user_id, category);

alter table public.vault_master enable row level security;
alter table public.password_vault enable row level security;

drop policy if exists "vault_master_select_own" on public.vault_master;
create policy "vault_master_select_own"
on public.vault_master
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "vault_master_insert_own" on public.vault_master;
create policy "vault_master_insert_own"
on public.vault_master
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "vault_master_update_own" on public.vault_master;
create policy "vault_master_update_own"
on public.vault_master
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "vault_master_delete_own" on public.vault_master;
create policy "vault_master_delete_own"
on public.vault_master
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "password_vault_select_own" on public.password_vault;
create policy "password_vault_select_own"
on public.password_vault
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "password_vault_insert_own" on public.password_vault;
create policy "password_vault_insert_own"
on public.password_vault
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "password_vault_update_own" on public.password_vault;
create policy "password_vault_update_own"
on public.password_vault
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "password_vault_delete_own" on public.password_vault;
create policy "password_vault_delete_own"
on public.password_vault
for delete
to authenticated
using (auth.uid() = user_id);
