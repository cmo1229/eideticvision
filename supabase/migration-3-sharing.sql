-- ============================================================
--  Eidetic Vision — Migration 3: sharing
--  Paste into: Supabase Dashboard → SQL Editor → Run
--  Splits "readable by link" from "listed in /explore".
--
--  is_public  — anonymously readable (RLS). Unchanged meaning.
--  is_listed  — appears in the public archive directory.
--
--    private   : is_public=false, is_listed=false
--    link-only : is_public=true,  is_listed=false
--    listed    : is_public=true,  is_listed=true
-- ============================================================

alter table public.places add column if not exists is_listed boolean not null default false;

-- Preserve today's behaviour: everything public so far was listed.
update public.places set is_listed = true where is_public and not is_listed;

create index if not exists places_listed_idx on public.places (is_listed) where is_listed;

-- The directory now requires listing, not merely readability.
-- Column list and order must match schema.sql exactly.
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
where p.is_public and p.is_listed
group by p.id;

grant select on public.public_places to anon, authenticated;
