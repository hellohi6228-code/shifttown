-- ShiftTown — restaurants, training slots, shifts, bookings, check-in/out, reviews.
--
-- Clients can only READ tables (filtered by row-level security).
-- Every write goes through a SECURITY DEFINER function below that checks the
-- caller, validates the rules and takes row locks, so two people can never
-- claim the same last spot and nobody can double-book themselves.
-- The same rules live in src/lib/rules.ts for instant feedback in the app.
--
-- Flow: a store's training unlocks its shifts. Every request waits for the
-- restaurant to confirm. Candidate or restaurant checks in and out; checking
-- out finishes it (+1 quest point at that store, +1 XP for the store).

create type kind as enum ('training', 'shift');
create type booking_status as enum ('pending', 'confirmed', 'checked_in', 'done', 'declined', 'cancelled');

-- ───────────────────────── tables ─────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  look jsonb not null default '{}',
  -- neighborhood only; we never store a candidate's address
  area text not null default 'downtown',
  radius_mi numeric(4, 1) not null default 2.5 check (radius_mi between 0.5 and 10),
  slots text[] not null default '{}',
  roles text[] not null default '{}',
  skills text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  cuisine text not null default 'Restaurant' check (char_length(cuisine) <= 30),
  emoji text not null default '🍽️' check (char_length(emoji) <= 8),
  address text not null default '' check (char_length(address) <= 120),
  lat double precision not null check (lat between 42.415 and 42.462),
  lng double precision not null check (lng between -76.53 and -76.47),
  maps_url text not null,
  color text not null default '#FF8FB1',
  xp int not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table restaurant_members (
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (restaurant_id, user_id)
);
create index on restaurant_members (user_id);

-- Codes are stored hashed. restaurant_id null = registers a new restaurant;
-- set = adds another manager to an existing one.
create table invite_codes (
  code_hash text primary key,
  restaurant_id uuid references restaurants (id) on delete cascade,
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  kind kind not null,
  role text not null check (char_length(role) between 1 and 30),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  openings int not null check (openings between 1 and 50),
  filled int not null default 0,
  -- training and shifts are always paid; points never replace wages
  pay_cents int not null check (pay_cents > 0),
  skills text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 200),
  deadline timestamptz not null,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours'),
  check (deadline <= starts_at),
  -- last line of defense against overbooking
  check (filled >= 0 and filled <= openings)
);
create index on opportunities (restaurant_id, starts_at);
create index on opportunities (starts_at);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities (id) on delete cascade,
  candidate_id uuid not null references profiles (id) on delete cascade,
  status booking_status not null default 'pending',
  check_in_at timestamptz,
  check_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bookings_one_live on bookings (opportunity_id, candidate_id)
  where status in ('pending', 'confirmed', 'checked_in', 'done');
create index on bookings (candidate_id);

-- One row per finished training/shift, always tied to ONE restaurant.
create table quests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  candidate_id uuid not null references profiles (id) on delete cascade,
  booking_id uuid not null unique references bookings (id) on delete cascade,
  kind kind not null,
  created_at timestamptz not null default now()
);
create index on quests (candidate_id);
create index on quests (restaurant_id);

-- A restaurant's 1–5 star review of a finished training/shift.
create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  candidate_id uuid not null references profiles (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index on reviews (candidate_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  text text not null,
  opportunity_id uuid,
  booking_id uuid,
  restaurant_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);

-- ───────────────────────── helpers (not callable by clients) ─────────────────────────

create function is_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from restaurant_members where restaurant_id = r and user_id = auth.uid())
$$;

create function require_uid() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  return auth.uid();
end $$;

create function opp_label(o opportunities) returns text
language sql stable as $$
  select (case when o.kind = 'training' then 'Training' else o.role end) || ' · '
    || to_char(o.starts_at at time zone 'America/New_York', 'Dy Mon FMDD FMHH12:MI AM')
$$;

create function notify(u uuid, k text, t text, o uuid default null, b uuid default null, r uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, text, opportunity_id, booking_id, restaurant_id) values (u, k, t, o, b, r)
$$;

create function notify_managers(r uuid, k text, t text, o uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, text, opportunity_id, restaurant_id)
  select user_id, k, t, o, r from restaurant_members where restaurant_id = r
$$;

/** A store is unlocked for a candidate once they finish its training. */
create function is_unlocked(r uuid, c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b join opportunities o on o.id = b.opportunity_id
    where b.candidate_id = c and b.status = 'done' and o.restaurant_id = r and o.kind = 'training'
  )
$$;

-- Same checks as check() in src/lib/rules.ts. Caller must hold the profile and opportunity locks.
create function assert_can_take(me profiles, o opportunities) returns void
language plpgsql stable set search_path = public as $$
declare
  missing text;
begin
  if o.cancelled then raise exception 'Cancelled'; end if;
  if now() >= o.starts_at then raise exception 'Started'; end if;
  if now() > o.deadline then raise exception 'Closed'; end if;
  if exists (
    select 1 from bookings where opportunity_id = o.id and candidate_id = me.id and status in ('pending', 'confirmed', 'checked_in', 'done')
  ) then raise exception 'Booked'; end if;
  if o.kind = 'training' and is_unlocked(o.restaurant_id, me.id) then raise exception 'Done'; end if;
  if o.kind = 'shift' and not is_unlocked(o.restaurant_id, me.id) then raise exception 'Training first'; end if;
  select string_agg(s, ', ') into missing from unnest(o.skills) s where not s = any (me.skills);
  if missing is not null then raise exception 'Needs %', missing; end if;
  if exists (
    select 1 from bookings b join opportunities x on x.id = b.opportunity_id
    where b.candidate_id = me.id and b.status in ('pending', 'confirmed', 'checked_in') and x.id <> o.id
      and tstzrange(x.starts_at, x.ends_at) && tstzrange(o.starts_at, o.ends_at)
  ) then raise exception 'Busy then'; end if;
  if o.filled >= o.openings then raise exception 'Full'; end if;
end $$;

-- ───────────────────────── candidate actions ─────────────────────────

create function book(p_opp uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  me profiles;
  o opportunities;
begin
  -- lock order everywhere: profile, then opportunity
  select * into me from profiles where id = uid for update;
  if not found then raise exception 'Finish your profile first'; end if;
  select * into o from opportunities where id = p_opp for update;
  if not found then raise exception 'Not found'; end if;
  perform assert_can_take(me, o);
  insert into bookings (opportunity_id, candidate_id) values (o.id, uid);
  update opportunities set filled = filled + 1 where id = o.id;
  perform notify_managers(o.restaurant_id, 'request', me.name || ' · ' || opp_label(o), o.id);
end $$;

create function cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  b bookings;
  o opportunities;
begin
  select * into o from opportunities where id = (select opportunity_id from bookings where id = p_booking and candidate_id = uid) for update;
  if not found then raise exception 'Not found'; end if;
  select * into b from bookings where id = p_booking;
  if b.status not in ('pending', 'confirmed') then raise exception 'Nothing to cancel'; end if;
  if now() >= o.starts_at then raise exception 'Already started'; end if;
  update bookings set status = 'cancelled', updated_at = now() where id = b.id;
  update opportunities set filled = greatest(filled - 1, 0) where id = o.id;
  perform notify_managers(o.restaurant_id, 'withdrawn', (select name from profiles where id = uid) || ' cancelled · ' || opp_label(o), o.id);
end $$;

create function read_notes() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read
$$;

-- ───────────────────────── candidate or restaurant ─────────────────────────

create function check_in(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  b bookings;
  o opportunities;
  by_candidate boolean;
begin
  select * into o from opportunities where id = (select opportunity_id from bookings where id = p_booking) for update;
  if not found then raise exception 'Not found'; end if;
  select * into b from bookings where id = p_booking;
  by_candidate := b.candidate_id = uid;
  if not by_candidate and not is_member(o.restaurant_id) then raise exception 'Not yours'; end if;
  if b.status <> 'confirmed' then raise exception 'Not confirmed'; end if;
  if now() < o.starts_at - interval '1 hour' then raise exception 'Opens 1 hour before'; end if;
  if by_candidate and now() > o.ends_at then raise exception 'Too late'; end if;
  update bookings set status = 'checked_in', check_in_at = now(), updated_at = now() where id = b.id;
  if by_candidate then
    perform notify_managers(o.restaurant_id, 'checkin', (select name from profiles where id = uid) || ' checked in · ' || opp_label(o), o.id);
  else
    perform notify(b.candidate_id, 'checkin', 'Checked in · ' || (select name from restaurants where id = o.restaurant_id), o.id, b.id, o.restaurant_id);
  end if;
end $$;

create function check_out(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  b bookings;
  o opportunities;
  rname text;
  by_candidate boolean;
begin
  select * into o from opportunities where id = (select opportunity_id from bookings where id = p_booking) for update;
  if not found then raise exception 'Not found'; end if;
  select * into b from bookings where id = p_booking;
  by_candidate := b.candidate_id = uid;
  if not by_candidate and not is_member(o.restaurant_id) then raise exception 'Not yours'; end if;
  if b.status <> 'checked_in' then raise exception 'Check in first'; end if;
  if by_candidate and now() > o.ends_at + interval '12 hours' then raise exception 'Too late'; end if;
  update bookings set status = 'done', check_out_at = now(), updated_at = now() where id = b.id;
  update restaurants set xp = xp + 1 where id = o.restaurant_id returning name into rname;
  insert into quests (restaurant_id, candidate_id, booking_id, kind) values (o.restaurant_id, b.candidate_id, b.id, o.kind)
  on conflict (booking_id) do nothing;
  if o.kind = 'training' then
    perform notify(b.candidate_id, 'unlocked', '🔓 ' || rname || ' unlocked', o.id, b.id, o.restaurant_id);
  else
    perform notify(b.candidate_id, 'quest', '+1 ⭐ ' || rname, o.id, b.id, o.restaurant_id);
  end if;
  if by_candidate then
    perform notify_managers(o.restaurant_id, 'checkout', (select name from profiles where id = uid) || ' checked out · ' || opp_label(o), o.id);
  end if;
end $$;

-- ───────────────────────── restaurant actions ─────────────────────────

create function check_invite_code(p_code text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c invite_codes;
begin
  select * into c from invite_codes where code_hash = encode(sha256(convert_to(upper(trim(p_code)), 'UTF8')), 'hex');
  if not found or c.uses >= c.max_uses or c.expires_at < now() then return 'invalid'; end if;
  return case when c.restaurant_id is null then 'new' else 'join' end;
end $$;

create function register_restaurant(
  p_code text, p_maps_url text, p_name text, p_address text,
  p_lat double precision, p_lng double precision, p_cuisine text, p_emoji text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  c invite_codes;
  rid uuid;
begin
  select * into c from invite_codes where code_hash = encode(sha256(convert_to(upper(trim(p_code)), 'UTF8')), 'hex') for update;
  if not found or c.uses >= c.max_uses or c.expires_at < now() then raise exception 'Code not valid'; end if;
  if c.restaurant_id is not null then
    insert into restaurant_members (restaurant_id, user_id) values (c.restaurant_id, uid) on conflict do nothing;
    if found then update invite_codes set uses = uses + 1 where code_hash = c.code_hash; end if;
    return c.restaurant_id;
  end if;
  if p_maps_url !~* '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+/|maps\.app\.goo\.gl/|goo\.gl/maps/)' then
    raise exception 'Use a Google Maps link';
  end if;
  if char_length(trim(p_name)) not between 2 and 60 then raise exception 'Check the name'; end if;
  if not (p_lat between 42.415 and 42.462 and p_lng between -76.53 and -76.47) then raise exception 'Outside the Ithaca map'; end if;
  insert into restaurants (name, cuisine, emoji, address, lat, lng, maps_url, color, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_cuisine), ''), 'Restaurant'), coalesce(nullif(p_emoji, ''), '🍽️'),
          left(trim(p_address), 120), p_lat, p_lng, trim(p_maps_url),
          (array['#FF8FB1','#6EC6FF','#FFD25A','#5CC49E','#B79CFF','#FFB38A','#7FD3E8','#A8E07A'])[1 + (select count(*) from restaurants) % 8],
          uid)
  returning id into rid;
  insert into restaurant_members (restaurant_id, user_id) values (rid, uid);
  update invite_codes set uses = uses + 1 where code_hash = c.code_hash;
  return rid;
end $$;

create function post_opportunity(
  p_restaurant uuid, p_kind kind, p_role text, p_start timestamptz, p_end timestamptz,
  p_openings int, p_pay_cents int, p_skills text[], p_notes text, p_deadline timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  oid uuid;
begin
  perform require_uid();
  if not is_member(p_restaurant) then raise exception 'Not your restaurant'; end if;
  if p_start <= now() then raise exception 'Pick a future time'; end if;
  if coalesce(p_pay_cents, 0) <= 0 then raise exception 'Add pay'; end if;
  insert into opportunities (restaurant_id, kind, role, starts_at, ends_at, openings, pay_cents, skills, notes, deadline)
  values (p_restaurant, p_kind, case when p_kind = 'training' then 'Training' else trim(p_role) end, p_start, p_end, p_openings,
          p_pay_cents, coalesce(p_skills, '{}'), left(coalesce(p_notes, ''), 200), p_deadline)
  returning id into oid;
  return oid;
end $$;

create function cancel_opportunity(p_opp uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o opportunities;
  b record;
  rname text;
begin
  select * into o from opportunities where id = p_opp for update;
  if not found or not is_member(o.restaurant_id) then raise exception 'Not your restaurant'; end if;
  if o.cancelled then return; end if;
  select name into rname from restaurants where id = o.restaurant_id;
  for b in
    update bookings set status = 'cancelled', updated_at = now()
    where opportunity_id = o.id and status in ('pending', 'confirmed')
    returning id, candidate_id
  loop
    perform notify(b.candidate_id, 'cancelled', rname || ' cancelled ' || opp_label(o), o.id, b.id, o.restaurant_id);
  end loop;
  update opportunities set cancelled = true,
    filled = (select count(*) from bookings where opportunity_id = o.id and status in ('pending', 'confirmed', 'checked_in', 'done'))
  where id = o.id;
end $$;

create function confirm_booking(p_booking uuid, p_yes boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  o opportunities;
begin
  perform require_uid();
  select * into o from opportunities where id = (select opportunity_id from bookings where id = p_booking) for update;
  if not found or not is_member(o.restaurant_id) then raise exception 'Not your restaurant'; end if;
  select * into b from bookings where id = p_booking;
  if b.status <> 'pending' then raise exception 'Already handled'; end if;
  update bookings set status = case when p_yes then 'confirmed'::booking_status else 'declined'::booking_status end, updated_at = now() where id = b.id;
  if not p_yes then update opportunities set filled = greatest(filled - 1, 0) where id = o.id; end if;
  perform notify(b.candidate_id, case when p_yes then 'confirmed' else 'declined' end,
    (select name from restaurants where id = o.restaurant_id) || ' · ' || opp_label(o), o.id, b.id, o.restaurant_id);
end $$;

create function review_candidate(p_booking uuid, p_stars int) returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  o opportunities;
  rname text;
begin
  perform require_uid();
  select * into o from opportunities where id = (select opportunity_id from bookings where id = p_booking) for update;
  if not found or not is_member(o.restaurant_id) then raise exception 'Not your restaurant'; end if;
  select * into b from bookings where id = p_booking;
  if b.status <> 'done' then raise exception 'Not finished yet'; end if;
  if p_stars not between 1 and 5 then raise exception '1 to 5 stars'; end if;
  if exists (select 1 from reviews where booking_id = b.id) then raise exception 'Already reviewed'; end if;
  insert into reviews (booking_id, restaurant_id, candidate_id, stars, created_by) values (b.id, o.restaurant_id, b.candidate_id, p_stars, auth.uid());
  update restaurants set xp = xp + 1 where id = o.restaurant_id returning name into rname;
  perform notify(b.candidate_id, 'review', repeat('★', p_stars) || ' from ' || rname, o.id, b.id, o.restaurant_id);
end $$;

/** Level (all finished quests) and review average for people who booked with my restaurants. */
create function candidate_stats() returns table (candidate_id uuid, quests int, rating numeric, reviews int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct b.candidate_id from bookings b join opportunities o on o.id = b.opportunity_id
    where is_member(o.restaurant_id)
  )
  select m.candidate_id,
    (select count(*)::int from quests q where q.candidate_id = m.candidate_id),
    (select round(avg(r.stars), 2) from reviews r where r.candidate_id = m.candidate_id),
    (select count(*)::int from reviews r where r.candidate_id = m.candidate_id)
  from mine m
$$;

-- Run from the SQL editor (service role) to issue a code; returns the plain code once.
create function admin_create_invite(p_restaurant uuid default null, p_max_uses int default 1) returns text
language plpgsql security definer set search_path = public as $$
declare
  code text := 'ITH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
begin
  insert into invite_codes (code_hash, restaurant_id, max_uses) values (encode(sha256(convert_to(code, 'UTF8')), 'hex'), p_restaurant, p_max_uses);
  return code;
end $$;

-- ───────────────────────── access control ─────────────────────────

alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table restaurant_members enable row level security;
alter table invite_codes enable row level security;
alter table opportunities enable row level security;
alter table bookings enable row level security;
alter table quests enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;

-- Restaurants only see people who booked with them.
create policy profiles_read on profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from bookings b join opportunities o on o.id = b.opportunity_id where b.candidate_id = profiles.id and is_member(o.restaurant_id))
);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy restaurants_read on restaurants for select to authenticated using (true);
create policy members_read on restaurant_members for select to authenticated using (user_id = auth.uid() or is_member(restaurant_id));
create policy opportunities_read on opportunities for select to authenticated using (true);
create policy bookings_read on bookings for select to authenticated using (
  candidate_id = auth.uid() or exists (select 1 from opportunities o where o.id = opportunity_id and is_member(o.restaurant_id))
);
-- A restaurant only ever sees quest points earned at that restaurant.
create policy quests_read on quests for select to authenticated using (candidate_id = auth.uid() or is_member(restaurant_id));
create policy reviews_read on reviews for select to authenticated using (candidate_id = auth.uid() or is_member(restaurant_id));
create policy notifications_read on notifications for select to authenticated using (user_id = auth.uid());
-- invite_codes: no policies → unreadable by clients.

-- Supabase grants EXECUTE on new functions to anon/authenticated by default,
-- so internal helpers must be revoked from those roles explicitly.
revoke execute on function require_uid(), opp_label(opportunities),
  notify(uuid, text, text, uuid, uuid, uuid), notify_managers(uuid, text, text, uuid),
  is_unlocked(uuid, uuid), assert_can_take(profiles, opportunities), admin_create_invite(uuid, int)
  from public, anon, authenticated;
-- used inside RLS policies
revoke execute on function is_member(uuid) from public, anon;
grant execute on function is_member(uuid) to authenticated;
revoke execute on function book(uuid), cancel_booking(uuid), read_notes(), check_in(uuid), check_out(uuid),
  check_invite_code(text), register_restaurant(text, text, text, text, double precision, double precision, text, text),
  post_opportunity(uuid, kind, text, timestamptz, timestamptz, int, int, text[], text, timestamptz),
  cancel_opportunity(uuid), confirm_booking(uuid, boolean), review_candidate(uuid, int), candidate_stats()
  from public, anon;
grant execute on function book(uuid), cancel_booking(uuid), read_notes(), check_in(uuid), check_out(uuid),
  check_invite_code(text), register_restaurant(text, text, text, text, double precision, double precision, text, text),
  post_opportunity(uuid, kind, text, timestamptz, timestamptz, int, int, text[], text, timestamptz),
  cancel_opportunity(uuid), confirm_booking(uuid, boolean), review_candidate(uuid, int), candidate_stats()
  to authenticated;
