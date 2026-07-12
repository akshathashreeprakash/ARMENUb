-- RESTAURANTS TABLE
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) not null,
  name text not null,
  slug text unique not null,
  logo_url text,
  theme jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- MENU ITEMS TABLE
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  name text not null,
  price text,
  description text,
  min_wait_time text,
  target_image_url text,
  mind_file_url text,
  model_url text,
  transform jsonb default '{}'::jsonb,
  ui_config jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table restaurants enable row level security;
alter table menu_items enable row level security;

create policy "Owners can manage their own restaurant"
  on restaurants for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Public can read restaurant basic info"
  on restaurants for select
  using (true);

create policy "Owners can manage their own menu items"
  on menu_items for all
  using (restaurant_id in (select id from restaurants where owner_user_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_user_id = auth.uid()));

create policy "Public can read all menu items"
  on menu_items for select
  using (true);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public)
values
  ('target-images', 'target-images', true),
  ('mind-files', 'mind-files', true),
  ('models', 'models', true);

-- STORAGE POLICIES
create policy "Public read access"
  on storage.objects for select
  using (bucket_id in ('target-images', 'mind-files', 'models'));

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check (bucket_id in ('target-images', 'mind-files', 'models') and auth.role() = 'authenticated');

create policy "Authenticated users can update own uploads"
  on storage.objects for update
  using (bucket_id in ('target-images', 'mind-files', 'models') and auth.role() = 'authenticated');

create policy "Authenticated users can delete own uploads"
  on storage.objects for delete
  using (bucket_id in ('target-images', 'mind-files', 'models') and auth.role() = 'authenticated');