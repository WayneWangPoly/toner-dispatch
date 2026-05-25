create table if not exists public.returned_consumables (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  item_description text not null,
  returned_date date not null default current_date,
  staff_name text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.returned_consumables enable row level security;

drop policy if exists "Authenticated users can read returned consumables" on public.returned_consumables;
create policy "Authenticated users can read returned consumables"
on public.returned_consumables
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert returned consumables" on public.returned_consumables;
create policy "Authenticated users can insert returned consumables"
on public.returned_consumables
for insert
to authenticated
with check (true);
