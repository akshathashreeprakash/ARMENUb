# Migration Instructions for New Supabase Project

**Target Project:** `dzprhxmvffmemmlpkgkb`
**URL:** https://dzprhxmvffmemmlpkgkb.supabase.co

## Step 1: Run This SQL in Your New Project's SQL Editor

Go to: Supabase Dashboard → SQL Editor → New Query

Paste and run the following:

```sql
-- STEP 1: Create Tables
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) not null,
  name text not null,
  slug text unique not null,
  logo_url text,
  theme jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists menu_items (
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

-- STEP 2: Enable Row Level Security
alter table restaurants enable row level security;
alter table menu_items enable row level security;

-- STEP 3: Create RLS Policies
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

-- STEP 4: Create Storage Buckets
insert into storage.buckets (id, name, public)
values
  ('target-images', 'target-images', true),
  ('mind-files', 'mind-files', true),
  ('models', 'models', true)
on conflict (id) do nothing;

-- STEP 5: Create Storage Policies
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
```

## Step 2: Get Your User ID

After signing up/logging in to your app with the new project, run:

```sql
SELECT id FROM auth.users;
```

Copy that UUID - you'll need it for Step 3.

## Step 3: Insert Your Data

Run this (replace `YOUR_USER_ID` with the UUID from Step 2):

```sql
-- Insert restaurant
INSERT INTO restaurants (id, owner_user_id, name, slug, logo_url, theme, created_at)
VALUES (
  '370411be-b928-4098-89b3-6ea664f845aa',
  'YOUR_USER_ID',  -- REPLACE THIS
  'moksha morsel',
  'moksha-morsel',
  null,
  '{}',
  '2026-07-04 18:33:40.216335+00'
);

-- Insert menu item
INSERT INTO menu_items (id, restaurant_id, name, price, description, min_wait_time, target_image_url, mind_file_url, model_url, transform, ui_config, created_at)
VALUES (
  '69f317b5-8d3b-4ff0-9d53-899f069e87a0',
  '370411be-b928-4098-89b3-6ea664f845aa',
  'Banana',
  '$5',
  'A fruity delicacy',
  '10-25 min',
  'https://dzprhxmvffmemmlpkgkb.supabase.co/storage/v1/object/public/target-images/370411be-b928-4098-89b3-6ea664f845aa/69f317b5-8d3b-4ff0-9d53-899f069e87a0/target.jpg',
  null,
  'https://dzprhxmvffmemmlpkgkb.supabase.co/storage/v1/object/public/models/370411be-b928-4098-89b3-6ea664f845aa/69f317b5-8d3b-4ff0-9d53-899f069e87a0/model.glb',
  '{"scale":1,"position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0}}',
  '[{"id":"9bc47351-9286-4de7-81ba-691357f5e145","type":"wait-time","style":{"color":"#171717","border":false,"opacity":100,"padding":12,"fontSize":16,"textAlign":"center","background":"glass","fontWeight":"500","borderRadius":12},"zIndex":0,"content":"15-20 min","visible":true,"position":{"x":50,"y":50}},{"id":"efc75c20-a3a5-4c28-809d-e4c0e1005ce4","type":"button","style":{"color":"#171717","border":false,"opacity":100,"padding":12,"fontSize":16,"textAlign":"center","background":"glass","fontWeight":"500","borderRadius":12},"zIndex":1,"content":"Order Now","visible":true,"position":{"x":50,"y":50}}]',
  '2026-07-04 18:41:20.913147+00'
);
```

## Step 4: Download Files from Old Project & Upload to New

Download these files:

1. **Target Image:**
   https://wxjcaltizrhdovxdutze.supabase.co/storage/v1/object/public/target-images/370411be-b928-4098-89b3-6ea664f845aa/69f317b5-8d3b-4ff0-9d53-899f069e87a0/target.jpg

2. **3D Model:**
   https://wxjcaltizrhdovxdutze.supabase.co/storage/v1/object/public/models/370411be-b928-4098-89b3-6ea664f845aa/69f317b5-8d3b-4ff0-9d53-899f069e87a0/model.glb

Then upload them to your NEW project's storage:

1. Go to: **Storage → target-images → Create folder** → `370411be-b928-4098-89b3-6ea664f845aa/69f317b5-8d3b-4ff0-9d53-899f069e87a0`
2. Upload `target.jpg` to that folder

3. Go to: **Storage → models → Create folder** → `370411be-b928-4098-89b3-6ea664f845aa/69f317b5-8d3b-4ff0-9d53-899f069e87a0`
4. Upload `model.glb` to that folder

## Step 5: Verify

Your .env is now updated to the new project. Rebuild the app:

```bash
npm run build
```

Then test in the browser - your data should appear from the new project!
