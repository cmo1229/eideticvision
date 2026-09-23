-- ============================================================
--  Eidetic Vision — Migration 4: member names
--  Paste into: Supabase Dashboard → SQL Editor → Run
--
--  The contributors list needs member display names, and two things
--  stopped that from ever working:
--
--   1. place_members has no foreign key to profiles, so PostgREST
--      cannot resolve the embed profiles(display_name) at all —
--      the query fails with PGRST200 and the list comes back empty.
--   2. profiles is readable only by its owner ("profiles select own"),
--      so even a correct join yields nothing for anyone else.
--
--  This function resolves both by joining with definer rights, and it
--  only returns rows for a place the caller can already read.
--
--  Safe to run more than once.
-- ============================================================

create or replace function public.get_place_members(p_place_id uuid)
returns table (user_id uuid, role text, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select
    pm.user_id,
    pm.role,
    coalesce(
      nullif(pr.display_name, ''),
      split_part(u.email, '@', 1),
      'someone'
    ) as display_name
  from public.place_members pm
  left join public.profiles pr on pr.id = pm.user_id
  left join auth.users u on u.id = pm.user_id
  where pm.place_id = p_place_id
    and public.can_read_place(p_place_id);
$$;

grant execute on function public.get_place_members(uuid) to authenticated;

notify pgrst, 'reload schema';
