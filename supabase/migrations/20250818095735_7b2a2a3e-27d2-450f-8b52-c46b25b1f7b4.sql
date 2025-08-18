
-- 1) Create customer_accounts table
create table if not exists public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  name text not null default '',
  phone text,
  date_of_birth date,
  avatar_url text,
  bio text,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  profile_completion_percentage integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_accounts is 'Customer profile records keyed by auth user_id. Email is intentionally NOT stored here to reduce exposure.';

-- 2) Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_accounts_updated_at on public.customer_accounts;
create trigger set_customer_accounts_updated_at
before update on public.customer_accounts
for each row execute function public.set_updated_at();

-- 3) RLS: enable and add policies
alter table public.customer_accounts enable row level security;

-- Allow row owner to read their own account
drop policy if exists "customer can read own account" on public.customer_accounts;
create policy "customer can read own account"
  on public.customer_accounts
  for select
  using (auth.uid() = user_id);

-- Allow row owner to insert their own account
drop policy if exists "customer can insert own account" on public.customer_accounts;
create policy "customer can insert own account"
  on public.customer_accounts
  for insert
  with check (auth.uid() = user_id);

-- Allow row owner to update their own account
drop policy if exists "customer can update own account" on public.customer_accounts;
create policy "customer can update own account"
  on public.customer_accounts
  for update
  using (auth.uid() = user_id);

-- Public can read reviewer names: only rows referenced by active reviews.
-- Note: This allows selecting those rows; to minimize data exposure, we intentionally
-- keep customer_accounts free of emails. The app only selects 'name' in joins.
drop policy if exists "public can read reviewer names (active reviews only)" on public.customer_accounts;
create policy "public can read reviewer names (active reviews only)"
  on public.customer_accounts
  for select
  using (
    exists (
      select 1
      from public.product_reviews pr
      where pr.customer_id = customer_accounts.id
        and pr.status = 'active'
    )
  );
