// Runs supabase/migrations against an in-process Postgres (PGlite) with a stubbed
// Supabase auth schema, then exercises the booking rules as real client roles.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const db = new PGlite()
let passed = 0
let failed = 0

const ok = (name, cond, detail = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '✓' : '✗'} ${name}${cond || !detail ? '' : `  → ${detail}`}`)
}

// Supabase-like environment
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`)
await db.exec(readFileSync(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8'))

/** Run SQL as a signed-in user (role authenticated + JWT sub). */
async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role authenticated`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
    return tx.query(sql, params)
  })
}
async function err(uid, sql, params = []) {
  try {
    await as(uid, sql, params)
    return null
  } catch (e) {
    return e.message
  }
}
const one = async (uid, sql, params) => (await as(uid, sql, params)).rows[0]

const [m1, m2, c1, c2] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
for (const u of [m1, m2, c1, c2]) await db.query('insert into auth.users (id) values ($1)', [u])
const profile = (u, name, skills = '{}') =>
  as(u, `insert into profiles (id, name, skills, slots, roles) values ($1, $2, $3, '{}', '{}')`, [u, name, skills])
await profile(m1, 'Manager One')
await profile(m2, 'Manager Two')
await profile(c1, 'Alex', '{Food handler}')
await profile(c2, 'Blake')

// ── registration ──
const code = (await db.query(`select admin_create_invite() as c`)).rows[0].c
const code2 = (await db.query(`select admin_create_invite() as c`)).rows[0].c
ok('candidate cannot mint invite codes', /permission denied/.test(await err(c1, `select admin_create_invite()`)))
ok('code check says new', (await one(m1, `select check_invite_code($1) as k`, [code.toLowerCase()])).k === 'new')
ok('bogus code is invalid', (await one(m1, `select check_invite_code('NOPE') as k`)).k === 'invalid')
const reg = (u, c, lat = 42.44, url = 'https://www.google.com/maps/place/Test+Diner/@42.44,-76.5,17z') =>
  as(u, `select register_restaurant($1, $2, 'Test Diner', '1 Main St', $3, -76.5, 'Diner', '🍔') as id`, [c, url, lat])
ok('non-Maps URL rejected', /Google Maps/.test(await err(m1, `select register_restaurant($1, 'https://evil.example', 'X Y', '', 42.44, -76.5, '', '')`, [code])))
ok('pin outside Ithaca rejected', /Outside/.test(await err(m1, `select register_restaurant($1, 'https://maps.app.goo.gl/abc', 'Far Away', '', 40.7, -74, '', '')`, [code])))
const rid = (await reg(m1, code)).rows[0].id
ok('restaurant registered', !!rid)
ok('code is single-use', /Code not valid/.test(await err(m2, `select register_restaurant($1, 'https://maps.app.goo.gl/x', 'Again', '', 42.44, -76.5, '', '')`, [code])))
const rid2 = (await reg(m2, code2, 42.43)).rows[0].id

// ── posting ──
const post = (u, kind, startSql, endSql, openings, pay, skills = '{}') =>
  as(u, `select post_opportunity($1, $2, 'Server', ${startSql}, ${endSql}, $3, $4, $5, '', ${startSql} - interval '1 minute', true) as id`, [rid, kind, openings, pay, skills])
ok('unpaid shift rejected', /paid/.test(await err(m1, `select post_opportunity($1, 'shift', 'Server', now() + interval '2 day', now() + interval '2 day 4 hour', 1, 0, '{}', '', now() + interval '1 day', true)`, [rid])))
ok('other manager cannot post here', /Not your restaurant/.test(await err(m2, `select post_opportunity($1, 'intro', 'Any', now() + interval '1 day', now() + interval '1 day 30 min', 1, 0, '{}', '', now() + interval '20 hour', true)`, [rid])))
ok('candidate cannot insert opportunities directly', !!(await err(c1, `insert into opportunities (restaurant_id, kind, role, starts_at, ends_at, openings, pay_cents, deadline) values ($1, 'shift', 'x', now() + interval '1 day', now() + interval '1 day 1 hour', 5, 100, now())`, [rid])))
const shift = (await post(m1, 'shift', `now() + interval '2 day'`, `now() + interval '2 day 4 hour'`, 1, 1800, '{Food handler}')).rows[0].id

// Intro starting in a minute (inserted directly so attendance can be recorded today).
const intro = (await db.query(`insert into opportunities (restaurant_id, kind, role, starts_at, ends_at, openings, pay_cents, deadline)
  values ($1, 'intro', 'Any', now() + interval '1 minute', now() + interval '31 minute', 1, 0, now() + interval '1 minute') returning id`, [rid])).rows[0].id

// ── stage 1: intro ──
ok('shift locked before intro', /Intro first/.test(await err(c1, `select book($1)`, [shift])))
ok('book intro → confirmed', (await one(c1, `select book($1) as s`, [intro])).s === 'confirmed')
ok('cannot book same intro twice', /Booked/.test(await err(c1, `select book($1)`, [intro])))
ok('second candidate cannot take the single spot', /Full/.test(await err(c2, `select book($1)`, [intro])))
const introBooking = (await one(m1, `select id from bookings where opportunity_id = $1`, [intro])).id
ok('other restaurant cannot record attendance', /Not your restaurant/.test(await err(m2, `select record_attendance($1, true, true)`, [introBooking])))
await as(m1, `select record_attendance($1, true, true)`, [introBooking])
ok('attendance recorded once', /Already recorded/.test(await err(m1, `select record_attendance($1, true, true)`, [introBooking])))
ok('quest point at this restaurant', (await one(c1, `select count(*)::int n from quests where restaurant_id = $1`, [rid])).n === 1)
ok('candidate now eligible', (await one(c1, `select eligible from eligibility where restaurant_id = $1 and candidate_id = $2`, [rid, c1])).eligible === true)
ok('candidate cannot self-grant eligibility', /permission denied/.test(await err(c2, `select write_eligible($1, $2, true)`, [rid, c2])))
ok('candidate cannot insert eligibility directly', !!(await err(c2, `insert into eligibility (restaurant_id, candidate_id, eligible) values ($1, $2, true)`, [rid, c2])))

// ── stage 2: shifts ──
ok('eligible candidate books shift', (await one(c1, `select book($1) as s`, [shift])).s === 'confirmed')
await as(m1, `select set_eligibility($1, $2, true)`, [rid, c2])
ok('missing skill blocks booking', /Needs Food handler/.test(await err(c2, `select book($1)`, [shift])))
await as(c2, `update profiles set skills = '{Food handler}' where id = $1`, [c2])
ok('two candidates cannot claim the same opening', /Full/.test(await err(c2, `select book($1)`, [shift])))
ok('filled never exceeds openings', /check constraint/.test(await db.query(`update opportunities set filled = 2 where id = $1`, [shift]).then(() => '', (e) => e.message)))
ok('candidate cannot edit filled count', (await as(c1, `update opportunities set filled = 0 where id = $1`, [shift])).affectedRows === 0)
ok('candidate cannot write bookings directly', !!(await err(c2, `insert into bookings (opportunity_id, candidate_id, status) values ($1, $2, 'confirmed')`, [shift, c2])))

const overlap = (await post(m1, 'shift', `now() + interval '2 day 1 hour'`, `now() + interval '2 day 5 hour'`, 3, 1800)).rows[0].id
ok('double-booking the same time blocked', /Clashes/.test(await err(c1, `select book($1)`, [overlap])))

const c1Shift = (await one(c1, `select id from bookings where opportunity_id = $1 and candidate_id = $2`, [shift, c1])).id
await as(c1, `select cancel_booking($1)`, [c1Shift])
ok('cancel frees the spot', (await one(c2, `select book($1) as s`, [shift])).s === 'confirmed')

// manual approval
await as(m1, `select set_auto_confirm($1, false)`, [rid])
const later = (await post(m1, 'shift', `now() + interval '3 day'`, `now() + interval '3 day 4 hour'`, 1, 1900)).rows[0].id
ok('request when approval required', (await one(c1, `select book($1) as s`, [later])).s === 'pending')
ok('pending request holds the spot', /Full/.test(await err(c2, `select book($1)`, [later])))
const pend = (await one(m1, `select id from bookings where opportunity_id = $1`, [later])).id
await as(m1, `select decide_booking($1, true)`, [pend])
ok('manager approves', (await one(c1, `select status from bookings where id = $1`, [pend])).status === 'confirmed')

// invites
const open3 = (await post(m1, 'shift', `now() + interval '4 day'`, `now() + interval '4 day 4 hour'`, 2, 1800)).rows[0].id
await as(m1, `select invite_candidate($1, $2)`, [open3, c1])
const inv = (await one(c1, `select id, status from bookings where opportunity_id = $1`, [open3]))
ok('invite created', inv.status === 'invited')
ok('invite notification sent', (await one(c1, `select count(*)::int n from notifications where kind = 'invite'`)).n === 1)
await as(c1, `select respond_invite($1, true)`, [inv.id])
ok('invite accepted → confirmed', (await one(c1, `select status from bookings where id = $1`, [inv.id])).status === 'confirmed')
ok('other restaurant cannot invite to this shift', /Not your restaurant/.test(await err(m2, `select invite_candidate($1, $2)`, [open3, c2])))
await as(m1, `select set_eligibility($1, $2, false)`, [rid, c2])
ok('cannot invite to a shift without eligibility', /intro/.test(await err(m1, `select invite_candidate($1, $2)`, [open3, c2])))

// ── restaurant-specific visibility ──
ok('manager sees own restaurant points', (await one(m1, `select count(*)::int n from quests`)).n === 1)
ok('other restaurant sees none of them', (await one(m2, `select count(*)::int n from quests`)).n === 0)
ok('candidates cannot see each other’s quests', (await one(c2, `select count(*)::int n from quests`)).n === 0)
ok('candidates cannot read other profiles', (await one(c2, `select count(*)::int n from profiles`)).n === 1)
ok('managers can read candidate profiles', (await one(m1, `select count(*)::int n from profiles where id = $1`, [c2])).n === 1)
ok('invite codes are unreadable', (await one(m1, `select count(*)::int n from invite_codes`)).n === 0)
ok('cannot read others’ notifications', (await one(c2, `select count(*)::int n from notifications where user_id = $1`, [c1])).n === 0)
ok('cannot spoof notifications', /permission denied/.test(await err(c2, `select notify($1, 'quest', 'fake')`, [c1])))
void rid2

// cancellation notifies booked people
await as(m1, `select cancel_opportunity($1)`, [open3])
ok('cancel notifies candidate', (await one(c1, `select count(*)::int n from notifications where kind = 'cancelled'`)).n === 1)
ok('cancel releases spots', (await one(m1, `select filled from opportunities where id = $1`, [open3])).filled === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
