-- ============================================================
--  Eidetic Vision — Supabase schema
--  Paste this whole file into: Supabase Dashboard → SQL Editor → New query
--  It creates: profiles, places, memories, RLS policies, storage buckets.
-- ============================================================

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles select own"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles insert own"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Places ----------
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text not null default '',
  description text not null default '',
  start_year int not null,
  end_year int not null,
  end_open boolean not null default false,
  cover_url text,
  splat_url text,
  splat_name text,
  splat_format text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists places_public_idx on public.places (is_public) where is_public;

alter table public.places enable row level security;

create policy "places read public or own"
  on public.places for select
  using (is_public = true or owner_id = auth.uid());
create policy "places insert own"
  on public.places for insert with check (owner_id = auth.uid());
create policy "places update own"
  on public.places for update using (owner_id = auth.uid());
create policy "places delete own"
  on public.places for delete using (owner_id = auth.uid());

-- ---------- Memories ----------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  contributor_name text not null default '',
  title text not null,
  story text not null default '',
  date text not null default '',
  year int not null,
  media_type text check (media_type in ('image','video')),
  media_url text,
  audio_url text,
  position_x double precision not null default 0.5,
  position_y double precision not null default 0.5,
  position_z double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists memories_place_idx on public.memories (place_id);

alter table public.memories enable row level security;

create policy "memories read via place"
  on public.memories for select
  using (
    exists (
      select 1 from public.places p
      where p.id = memories.place_id and (p.is_public or p.owner_id = auth.uid())
    )
  );
create policy "memories insert own place"
  on public.memories for insert with check (
    exists (
      select 1 from public.places p
      where p.id = memories.place_id and p.owner_id = auth.uid()
    )
  );
create policy "memories update own place"
  on public.memories for update using (
    exists (
      select 1 from public.places p
      where p.id = memories.place_id and p.owner_id = auth.uid()
    )
  );
create policy "memories delete own place"
  on public.memories for delete using (
    exists (
      select 1 from public.places p
      where p.id = memories.place_id and p.owner_id = auth.uid()
    )
  );

-- ---------- Public directory view (place + aggregate stats) ----------
create or replace view public.public_places as
select
  p.id,
  p.name,
  p.location,
  p.description,
  p.start_year,
  p.end_year,
  p.end_open,
  p.cover_url,
  (p.splat_url is not null) as has_capture,
  p.created_at,
  count(m.id)::int as memory_count,
  count(distinct m.contributor_name)::int as contributor_count
from public.places p
left join public.memories m on m.place_id = p.id
where p.is_public
group by p.id;

grant select on public.public_places to anon, authenticated;

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('splats', 'splats', true)
on conflict (id) do nothing;

-- Anyone signed in can upload under their own user-id folder
create policy "authenticated upload own folder"
  on storage.objects for insert
  with check (
    bucket_id in ('covers', 'splats')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read uploaded media (published places need public splats/covers)
create policy "public read media"
  on storage.objects for select
  using (bucket_id in ('covers', 'splats'));

-- Signed-in users may replace their own uploads
create policy "authenticated update own folder"
  on storage.objects for update
  using (
    bucket_id in ('covers', 'splats')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
