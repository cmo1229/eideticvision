-- ============================================================
--  Eidetic Vision — Migration 2: collaboration
--  Paste into: Supabase Dashboard → SQL Editor → Run
--  Adds: place_members, place_invites, accept-invite RPCs,
--  and extends RLS so invited members can see + contribute.
-- ============================================================

-- ---------- Members ----------
create table if not exists public.place_members (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'contributor' check (role in ('contributor','viewer')),
  created_at timestamptz not null default now(),
  unique (place_id, user_id)
);

alter table public.place_members enable row level security;

create policy "members read"
  on public.place_members for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.places p where p.id = place_id and p.owner_id = auth.uid())
    or exists (select 1 from public.places p where p.id = place_id and p.is_public)
  );

create policy "owner manages members"
  on public.place_members for insert
  with check (exists (select 1 from public.places p where p.id = place_id and p.owner_id = auth.uid()));

create policy "owner removes members"
  on public.place_members for delete
  using (exists (select 1 from public.places p where p.id = place_id and p.owner_id = auth.uid()));

-- ---------- Invites ----------
create table if not exists public.place_invites (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  inviter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'contributor' check (role in ('contributor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists invites_place_idx on public.place_invites (place_id);

alter table public.place_invites enable row level security;

create policy "invites managed by owner"
  on public.place_invites for all
  using (auth.uid() = inviter_id)
  with check (auth.uid() = inviter_id);

-- ---------- Extend place visibility to members ----------
drop policy "places read public or own" on public.places;
create policy "places read public or own or member"
  on public.places for select
  using (
    is_public = true
    or owner_id = auth.uid()
    or exists (select 1 from public.place_members pm where pm.place_id = places.id and pm.user_id = auth.uid())
  );

drop policy "memories read via place" on public.memories;
create policy "memories read via place"
  on public.memories for select
  using (
    exists (
      select 1 from public.places p
      where p.id = memories.place_id
        and (p.is_public
             or p.owner_id = auth.uid()
             or exists (select 1 from public.place_members pm where pm.place_id = p.id and pm.user_id = auth.uid()))
    )
  );

-- Contributors (not viewers) may add memories to places they belong to
drop policy "memories insert own place" on public.memories;
create policy "memories insert owner or contributor"
  on public.memories for insert
  with check (
    exists (
      select 1 from public.places p
      where p.id = memories.place_id
        and (
          p.owner_id = auth.uid()
          or exists (
            select 1 from public.place_members pm
            where pm.place_id = p.id and pm.user_id = auth.uid() and pm.role = 'contributor'
          )
        )
    )
  );

-- ---------- Invite RPCs ----------

-- Pre-sign-in preview: what is this invite? (no email enumeration — token required)
create or replace function public.get_invite_preview(p_token uuid)
returns json as $$
declare inv record;
begin
  select
    pi.email,
    pi.role,
    pi.status,
    p.name as place_name,
    coalesce(pr.display_name, split_part(u.email, '@', 1)) as inviter_name
  into inv
  from public.place_invites pi
  join public.places p on p.id = pi.place_id
  join auth.users u on u.id = pi.inviter_id
  left join public.profiles pr on pr.id = pi.inviter_id
  where pi.token = p_token;

  if not found then
    return null;
  end if;

  return json_build_object(
    'email', inv.email,
    'role', inv.role,
    'status', inv.status,
    'place_name', inv.place_name,
    'inviter_name', inv.inviter_name
  );
end;
$$ language plpgsql security definer;

grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

-- Accept: signed-in user whose email matches joins the place
create or replace function public.accept_invite(p_token uuid)
returns uuid as $$
declare
  inv record;
  uid uuid;
  user_email text;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'sign in required';
  end if;

  select email into user_email from auth.users where id = uid;

  select * into inv from public.place_invites where token = p_token for update;
  if not found then
    raise exception 'invite not found';
  end if;

  -- Idempotent: already accepted → just make sure membership exists
  if inv.status = 'accepted' then
    insert into public.place_members (place_id, user_id, role)
    values (inv.place_id, uid, inv.role)
    on conflict (place_id, user_id) do nothing;
    return inv.place_id;
  end if;

  if inv.status <> 'pending' then
    raise exception 'this invite is no longer pending';
  end if;

  if lower(inv.email) <> lower(user_email) then
    raise exception 'this invite was sent to another email address';
  end if;

  update public.place_invites
  set status = 'accepted', accepted_at = now()
  where id = inv.id;

  insert into public.place_members (place_id, user_id, role)
  values (inv.place_id, uid, inv.role)
  on conflict (place_id, user_id) do nothing;

  return inv.place_id;
end;
$$ language plpgsql security definer;

grant execute on function public.accept_invite(uuid) to authenticated;
