-- ============================================================
--  Eidetic Vision — Migration 6: repair missing profiles
--  Paste into: Supabase Dashboard → SQL Editor → Run
--
--  handle_new_user() only fires on NEW signups. Any account created
--  before schema.sql was applied never got a profiles row, so
--  migration 5's backfill skipped it and it is invisible to profiles
--  forever — its handle is null and its places belong to nobody.
--
--  This creates the missing rows and gives them handles.
--
--  Safe to run more than once.
-- ============================================================

-- ---------- 1. Who is missing a profile right now ----------
select
  u.id,
  u.email,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at;

-- ---------- 2. Create the missing rows ----------
-- A handle must be unique, so collisions fall back to "base2",
-- "base3", … rather than failing the whole insert.
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at
  loop
    base := coalesce(
      nullif(regexp_replace(lower(split_part(r.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
      'user'
    );
    candidate := base;
    n := 1;
    while exists (
      select 1 from public.profiles p where lower(p.handle) = lower(candidate)
    ) loop
      n := n + 1;
      candidate := base || n::text;
    end loop;

    insert into public.profiles (id, display_name, handle)
    values (
      r.id,
      coalesce(nullif(split_part(r.email, '@', 1), ''), candidate),
      candidate
    )
    on conflict (id) do nothing;

    raise notice 'created profile % with handle %', r.id, candidate;
  end loop;
end $$;

-- ---------- 3. Every profile now has a handle ----------
-- Any rows still null were skipped by migration 5 too (e.g. a profile
-- whose auth.users row is gone). Report them rather than guessing.
update public.profiles
set handle = 'user' || substr(id::text, 1, 8)
where handle is null;

select handle, display_name, id from public.profiles order by handle;
