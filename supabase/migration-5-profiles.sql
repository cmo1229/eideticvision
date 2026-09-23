-- ============================================================
--  Eidetic Vision — Migration 5: public profiles
--  Paste into: Supabase Dashboard → SQL Editor → Run
--
--  Adds a public handle to profiles and a read path for a profile
--  plus that person's publicly listed places.
--
--  profiles is readable only by its owner ("profiles select own"),
--  so profiles are exposed through a definer-rights function that
--  returns nothing but the public fields, and only places that are
--  both is_public and is_listed. No directory, no listing of users.
--
--  Safe to run more than once.
-- ============================================================

-- ---------- Handle ----------
alter table public.profiles add column if not exists handle text;

-- Backfill: email prefix, sanitised, de-duplicated by creation order.
with ranked as (
  select
    p.id,
    coalesce(
      nullif(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
      'user'
    ) as base,
    row_number() over (
      partition by coalesce(
        nullif(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
        'user'
      )
      order by p.created_at, p.id
    ) as rn
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.handle is null
)
update public.profiles p
set handle = case when r.rn = 1 then r.base else r.base || r.rn::text end
from ranked r
where p.id = r.id;

create unique index if not exists profiles_handle_key
  on public.profiles (lower(handle)) where handle is not null;

-- ---------- New users get a handle too ----------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(
      nullif(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
      'user'
    ) || substr(new.id::text, 1, 4)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ---------- A public profile + that person's listed places ----------
create or replace function public.get_public_profile(p_handle text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'handle', pr.handle,
    'display_name', coalesce(nullif(pr.display_name, ''), pr.handle),
    'places', coalesce((
      select json_agg(json_build_object(
        'id', pl.id,
        'name', pl.name,
        'location', pl.location,
        'description', pl.description,
        'start_year', pl.start_year,
        'end_year', pl.end_year,
        'end_open', pl.end_open,
        'cover_url', pl.cover_url,
        'has_capture', (pl.splat_url is not null),
        'memory_count', (select count(*) from public.memories m where m.place_id = pl.id),
        'contributor_count', (select count(distinct m.contributor_name) from public.memories m where m.place_id = pl.id)
      ) order by pl.created_at desc)
      from public.places pl
      where pl.owner_id = pr.id
        and pl.is_public
        and pl.is_listed
    ), '[]'::json)
  )
  from public.profiles pr
  where lower(pr.handle) = lower(p_handle);
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ---------- Members now carry a handle, so names can link to profiles ----------
create or replace function public.get_place_members(p_place_id uuid)
returns table (user_id uuid, role text, display_name text, handle text)
language sql
security definer
set search_path = public
stable
as $$
  select
    pm.user_id,
    pm.role,
    coalesce(nullif(pr.display_name, ''), split_part(u.email, '@', 1), 'someone') as display_name,
    pr.handle
  from public.place_members pm
  left join public.profiles pr on pr.id = pm.user_id
  left join auth.users u on u.id = pm.user_id
  where pm.place_id = p_place_id
    and public.can_read_place(p_place_id);
$$;

grant execute on function public.get_place_members(uuid) to authenticated;

notify pgrst, 'reload schema';
