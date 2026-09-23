-- ============================================================
--  Eidetic Vision — Migration 7: profiles show contributions
--  Paste into: Supabase Dashboard → SQL Editor → Run
--
--  Two gaps the first version left:
--
--   1. get_public_profile only listed places you own, so a
--      contributor's profile was a dead end even though they had
--      clearly been part of something. It now also lists places you
--      contributed to — still only ones that are is_public AND
--      is_listed, so nothing private can leak. Each entry carries
--      "owned" so the page can say which is which.
--
--   2. get_place_members only returned invited members, so an owner
--      never appeared in their own contributors list and could not
--      be reached by clicking. The owner is now included.
--
--  Return types are unchanged, so "create or replace" is enough —
--  no drop, and therefore no destructive-operation warning.
--
--  Safe to run more than once.
-- ============================================================

-- ---------- A public profile + every listed place they're part of ----------
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
        'owned', (pl.owner_id = pr.id),
        'memory_count', (select count(*) from public.memories m where m.place_id = pl.id),
        'contributor_count', (select count(distinct m.contributor_name) from public.memories m where m.place_id = pl.id)
      ) order by pl.created_at desc)
      from public.places pl
      where pl.is_public
        and pl.is_listed
        and (
          pl.owner_id = pr.id
          or exists (
            select 1 from public.place_members pm
            where pm.place_id = pl.id
              and pm.user_id = pr.id
          )
        )
    ), '[]'::json)
  )
  from public.profiles pr
  where lower(pr.handle) = lower(p_handle);
$$;

-- ---------- Contributors include the owner ----------
create or replace function public.get_place_members(p_place_id uuid)
returns table (user_id uuid, role text, display_name text, handle text)
language sql
security definer
set search_path = public
stable
as $$
  with people as (
    select pm.user_id, pm.role
    from public.place_members pm
    where pm.place_id = p_place_id

    union all

    -- the keeper, unless they already hold a membership row
    select pl.owner_id, 'owner'
    from public.places pl
    where pl.id = p_place_id
      and not exists (
        select 1 from public.place_members pm2
        where pm2.place_id = p_place_id
          and pm2.user_id = pl.owner_id
      )
  )
  select
    people.user_id,
    people.role,
    coalesce(nullif(pr.display_name, ''), split_part(u.email, '@', 1), 'someone') as display_name,
    pr.handle
  from people
  left join public.profiles pr on pr.id = people.user_id
  left join auth.users u on u.id = people.user_id
  where public.can_read_place(p_place_id)
  order by (people.role = 'owner') desc;
$$;

notify pgrst, 'reload schema';
