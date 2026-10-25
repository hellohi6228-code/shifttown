-- ShiftTown — restaurants, opportunities, bookings, quests.
--
-- Clients can only READ tables (filtered by row-level security).
-- Every write goes through a SECURITY DEFINER function below that checks the
-- caller, validates the booking rules and takes row locks, so two people can
-- never claim the same last spot and nobody can double-book themselves.
-- The same rules live in src/lib/rules.ts for instant feedback in the app.

create type kind as enum ('intro', 'training', 'shift');
create type booking_status as enum ('invited', 'pending', 'confirmed', 'declined', 'cancelled', 'attended', 'no_show');

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
  discoverable boolean not null default true,
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
  auto_confirm boolean not null default true,
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
  pay_cents int not null check (pay_cents >= 0),
  skills text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 200),
  deadline timestamptz not null,
  awards_point boolean not null default true,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours'),
  check (deadline <= starts_at),
  -- training and real shifts are always paid; points never replace wages
  check (kind = 'intro' or pay_cents > 0),
  -- last line of defense against overbooking
  check (filled >= 0 and filled <= openings)
);
create index on opportunities (restaurant_id, starts_at);
create index on opportunities (starts_at);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities (id) on delete cascade,
  candidate_id uuid not null references profiles (id) on delete cascade,
  status booking_status not null,
  source text not null default 'self' check (source in ('self', 'invite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bookings_one_live on bookings (opportunity_id, candidate_id)
  where status in ('invited', 'pending', 'confirmed', 'attended', 'no_show');
create index on bookings (candidate_id);

-- One row per completed qualifying quest, always tied to ONE restaurant.
-- There is deliberately no cross-restaurant score.
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

create table eligibility (
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  candidate_id uuid not null references profiles (id) on delete cascade,
  eligible boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, candidate_id)
);

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

create function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from restaurant_members where user_id = auth.uid())
$$;

create function require_uid() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  return auth.uid();
end $$;

create function opp_label(o opportunities) returns text
language sql stable as $$
  select (case when o.role = 'Any' then 'Intro' else o.role end) || ' · '
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

-- Same checks as check() in src/lib/rules.ts. Caller must hold the profile and opportunity locks.
create function assert_can_take(me profiles, o opportunities, via_invite boolean) returns void
language plpgsql stable set search_path = public as $$
declare
  missing text;
begin
  if o.cancelled then raise exception 'Cancelled'; end if;
  if now() >= o.starts_at then raise exception 'Started'; end if;
  if not via_invite and now() > o.deadline then raise exception 'Closed'; end if;
  if exists (
    select 1 from bookings
    where opportunity_id = o.id and candidate_id = me.id
      and status in ('invited', 'pending', 'confirmed', 'attended', 'no_show')
      and (not via_invite or status <> 'invited')
  ) then raise exception 'Booked'; end if;
  if o.kind = 'shift' and not exists (
    select 1 from eligibility where restaurant_id = o.restaurant_id and candidate_id = me.id and eligible
  ) then raise exception 'Intro first'; end if;
  select string_agg(s, ', ') into missing from unnest(o.skills) s where not s = any (me.skills);
  if missing is not null then raise exception 'Needs %', missing; end if;
  if exists (
    select 1 from bookings b join opportunities x on x.id = b.opportunity_id
    where b.candidate_id = me.id and b.status in ('pending', 'confirmed') and x.id <> o.id
      and tstzrange(x.starts_at, x.ends_at) && tstzrange(o.starts_at, o.ends_at)
  ) then raise exception 'Clashes with another booking'; end if;
  if o.filled >= o.openings then raise exception 'Full'; end if;
end $$;

create function write_eligible(r uuid, c uuid, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  was boolean;
begin
  select eligible into was from eligibility where restaurant_id = r and candidate_id = c;
  insert into eligibility (restaurant_id, candidate_id, eligible, updated_by, updated_at)
  values (r, c, ok, auth.uid(), now())
  on conflict (restaurant_id, candidate_id) do update set eligible = ok, updated_by = auth.uid(), updated_at = now();
  if ok and not coalesce(was, false) then
    perform notify(c, 'eligible', '🔓 Shifts unlocked · ' || (select name from restaurants where id = r), null, null, r);
  end if;
end $$;

-- ───────────────────────── candidate actions ─────────────────────────

create function book(p_opp uuid) returns booking_status
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  me profiles;
  o opportunities;
  r restaurants;
  st booking_status;
  bid uuid;
begin
  -- lock order everywhere: profile, then opportunity
  select * into me from profiles where id = uid for update;
  if not found then raise exception 'Finish your profile first'; end if;
  select * into o from opportunities where id = p_opp for update;
  if not found then raise exception 'Not found'; end if;
  perform assert_can_take(me, o, false);
  select * into r from restaurants where id = o.restaurant_id;
  st := case when r.auto_confirm then 'confirmed' else 'pending' end;
  insert into bookings (opportunity_id, candidate_id, status) values (o.id, uid, st) returning id into bid;
  update opportunities set filled = filled + 1 where id = o.id;
  perform notify_managers(r.id, case when st = 'pending' then 'request' else 'booked' end, me.name || ' · ' || opp_label(o), o.id);
  if st = 'confirmed' then perform notify(uid, 'booked', r.name || ' · ' || opp_label(o), o.id, bid, r.id); end if;
  return st;
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

create function respond_invite(p_booking uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_uid();
  me profiles;
  b bookings;
  o opportunities;
begin
  select * into me from profiles where id = uid for update;
  select * into o from opportunities where id = (select opportunity_id from bookings where id = p_booking and candidate_id = uid) for update;
  if not found then raise exception 'Not found'; end if;
  select * into b from bookings where id = p_booking;
  if b.status <> 'invited' then raise exception 'Already answered'; end if;
  if p_accept then
    perform assert_can_take(me, o, true);
    update bookings set status = 'confirmed', updated_at = now() where id = b.id;
    update opportunities set filled = filled + 1 where id = o.id;
  else
    update bookings set status = 'declined', updated_at = now() where id = b.id;
  end if;
  perform notify_managers(o.restaurant_id, case when p_accept then 'accepted' else 'declined' end,
    me.name || case when p_accept then ' accepted · ' else ' declined · ' end || opp_label(o), o.id);
end $$;

create function read_notes() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read
$$;

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

create function set_auto_confirm(p_restaurant uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_restaurant) then raise exception 'Not your restaurant'; end if;
  update restaurants set auto_confirm = p_on where id = p_restaurant;
end $$;

create function post_opportunity(
  p_restaurant uuid, p_kind kind, p_role text, p_start timestamptz, p_end timestamptz, p_openings int,
  p_pay_cents int, p_skills text[], p_notes text, p_deadline timestamptz, p_awards_point boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  oid uuid;
begin
  perform require_uid();
  if not is_member(p_restaurant) then raise exception 'Not your restaurant'; end if;
  if p_start <= now() then raise exception 'Pick a future time'; end if;
  if p_kind <> 'intro' and p_pay_cents <= 0 then raise exception 'Training and shifts are paid'; end if;
  insert into opportunities (restaurant_id, kind, role, starts_at, ends_at, openings, pay_cents, skills, notes, deadline, awards_point)
  values (p_restaurant, p_kind, trim(p_role), p_start, p_end, p_openings, p_pay_cents, coalesce(p_skills, '{}'), left(coalesce(p_notes, ''), 200), p_deadline, p_awards_point)
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
    where opportunity_id = o.id and status in ('invited', 'pending', 'confirmed')
    returning id, candidate_id
  loop
    perform notify(b.candidate_id, 'cancelled', rname || ' cancelled ' || opp_label(o), o.id, b.id, o.restaurant_id);
  end loop;
  update opportunities set cancelled = true, filled = 0 where id = o.id;
end $$;

create function decide_booking(p_booking uuid, p_approve boolean) returns void
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
  update bookings set status = case when p_approve then 'confirmed'::booking_status else 'declined'::booking_status end, updated_at = now() where id = b.id;
  if not p_approve then update opportunities set filled = greatest(filled - 1, 0) where id = o.id; end if;
  perform notify(b.candidate_id, case when p_approve then 'approved' else 'declined' end,
    (select name from restaurants where id = o.restaurant_id) || ' · ' || opp_label(o), o.id, b.id, o.restaurant_id);
end $$;

create function record_attendance(p_booking uuid, p_attended boolean, p_eligible boolean default null) returns void
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
  if b.status <> 'confirmed' then raise exception 'Already recorded'; end if;
  if (now() at time zone 'America/New_York')::date < (o.starts_at at time zone 'America/New_York')::date then
    raise exception 'Not started yet';
  end if;
  select name into rname from restaurants where id = o.restaurant_id;
  update bookings set status = case when p_attended then 'attended'::booking_status else 'no_show'::booking_status end, updated_at = now() where id = b.id;
  if p_attended and o.awards_point then
    insert into quests (restaurant_id, candidate_id, booking_id, kind) values (o.restaurant_id, b.candidate_id, b.id, o.kind)
    on conflict (booking_id) do nothing;
    perform notify(b.candidate_id, 'quest', '+1 ⭐ ' || rname, o.id, b.id, o.restaurant_id);
  end if;
  if not p_attended then
    perform notify(b.candidate_id, 'noshow', 'Marked absent · ' || rname || ' · ' || opp_label(o), o.id, b.id, o.restaurant_id);
  end if;
  if p_attended and o.kind <> 'shift' and p_eligible is not null then
    perform write_eligible(o.restaurant_id, b.candidate_id, p_eligible);
  end if;
end $$;

create function set_eligibility(p_restaurant uuid, p_candidate uuid, p_eligible boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_restaurant) then raise exception 'Not your restaurant'; end if;
  perform write_eligible(p_restaurant, p_candidate, p_eligible);
end $$;

create function invite_candidate(p_opp uuid, p_candidate uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o opportunities;
  bid uuid;
begin
  select * into o from opportunities where id = p_opp for update;
  if not found or not is_member(o.restaurant_id) then raise exception 'Not your restaurant'; end if;
  if o.cancelled or now() >= o.starts_at then raise exception 'Too late'; end if;
  if not exists (select 1 from profiles where id = p_candidate) then raise exception 'Not found'; end if;
  if o.kind = 'shift' and not exists (
    select 1 from eligibility where restaurant_id = o.restaurant_id and candidate_id = p_candidate and eligible
  ) then raise exception 'Needs intro first'; end if;
  if exists (
    select 1 from bookings where opportunity_id = o.id and candidate_id = p_candidate and status in ('invited', 'pending', 'confirmed')
  ) then raise exception 'Already in'; end if;
  insert into bookings (opportunity_id, candidate_id, status, source) values (o.id, p_candidate, 'invited', 'invite') returning id into bid;
  perform notify(p_candidate, 'invite', (select name from restaurants where id = o.restaurant_id) || ' invited you · ' || opp_label(o), o.id, bid, o.restaurant_id);
end $$;

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
alter table eligibility enable row level security;
alter table notifications enable row level security;

-- Managers can see discoverable candidates and anyone who has booked with them.
create policy profiles_read on profiles for select to authenticated using (
  id = auth.uid()
  or (discoverable and is_manager())
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
create policy eligibility_read on eligibility for select to authenticated using (candidate_id = auth.uid() or is_member(restaurant_id));
create policy notifications_read on notifications for select to authenticated using (user_id = auth.uid());
-- invite_codes: no policies → unreadable by clients.

-- Supabase grants EXECUTE on new functions to anon/authenticated by default,
-- so internal helpers must be revoked from those roles explicitly.
revoke execute on function require_uid(), opp_label(opportunities),
  notify(uuid, text, text, uuid, uuid, uuid), notify_managers(uuid, text, text, uuid),
  assert_can_take(profiles, opportunities, boolean), write_eligible(uuid, uuid, boolean),
  admin_create_invite(uuid, int)
  from public, anon, authenticated;
-- used inside RLS policies
revoke execute on function is_member(uuid), is_manager() from public, anon;
grant execute on function is_member(uuid), is_manager() to authenticated;
revoke execute on function book(uuid), cancel_booking(uuid), respond_invite(uuid, boolean), read_notes(),
  check_invite_code(text), register_restaurant(text, text, text, text, double precision, double precision, text, text),
  set_auto_confirm(uuid, boolean), post_opportunity(uuid, kind, text, timestamptz, timestamptz, int, int, text[], text, timestamptz, boolean),
  cancel_opportunity(uuid), decide_booking(uuid, boolean), record_attendance(uuid, boolean, boolean),
  set_eligibility(uuid, uuid, boolean), invite_candidate(uuid, uuid)
  from public, anon;
grant execute on function book(uuid), cancel_booking(uuid), respond_invite(uuid, boolean), read_notes(),
  check_invite_code(text), register_restaurant(text, text, text, text, double precision, double precision, text, text),
  set_auto_confirm(uuid, boolean), post_opportunity(uuid, kind, text, timestamptz, timestamptz, int, int, text[], text, timestamptz, boolean),
  cancel_opportunity(uuid), decide_booking(uuid, boolean), record_attendance(uuid, boolean, boolean),
  set_eligibility(uuid, uuid, boolean), invite_candidate(uuid, uuid)
  to authenticated;
