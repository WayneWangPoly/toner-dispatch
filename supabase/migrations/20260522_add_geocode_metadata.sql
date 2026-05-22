alter table public.dispatch_orders
  add column if not exists geocode_status text,
  add column if not exists geocode_source text,
  add column if not exists geocode_formatted_address text,
  add column if not exists geocode_place_id text,
  add column if not exists geocode_location_type text,
  add column if not exists geocoded_at timestamptz,
  add column if not exists manual_location_override boolean default false;

alter table public.equipment_master
  add column if not exists geocode_status text,
  add column if not exists geocode_source text,
  add column if not exists geocode_formatted_address text,
  add column if not exists geocode_place_id text,
  add column if not exists geocode_location_type text,
  add column if not exists geocoded_at timestamptz,
  add column if not exists manual_location_override boolean default false;
