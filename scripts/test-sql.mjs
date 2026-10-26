// Runs supabase/migrations against an in-process Postgres (PGlite) with a stubbed
// Supabase auth schema, then exercises the rules as real client roles.
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
const post = (u, r, kind, startSql, endSql, openings, pay, skills = '{}') =>
  as(u, `select post_opportunity($1, $2, 'Server', ${startSql}, ${endSql}, $3, $4, $5, '', ${startSql} - interval '1 minute') as id`, [r, kind, openings, pay, skills])
ok('unpaid training rejected', /Add pay/.test(await err(m1, `select post_opportunity($1, 'training', '', now() + interval '2 day', now() + interval '2 day 1 hour', 1, 0, '{}', '', now() + interval '1 day')`, [rid])))
ok('other manager cannot post here', /Not your restaurant/.test(await err(m2, `select post_opportunity($1, 'training', '', now() + interval '1 day', now() + interval '1 day 30 min', 1, 1600, '{}', '', now() + interval '20 hour')`, [rid])))
ok('candidate cannot insert opportunities directly', !!(await err(c1, `insert into opportunities (restaurant_id, kind, role, starts_at, ends_at, openings, pay_cents, deadline) values ($1, 'shift', 'x', now() + interval '1 day', now() + interval '1 day 1 hour', 5, 100, now())`, [rid])))
const shift = (await post(m1, rid, 'shift', `now() + interval '2 day'`, `now() + interval '2 day 4 hour'`, 1, 1800, '{Food handler}')).rows[0].id
const t2 = (await one(m1, `select post_opportunity($1, 'training', 'whatever', now() + interval '3 day', now() + interval '3 day 30 min', 2, 1600, '{}', '', now() + interval '2 day') as id`, [rid])).id
ok('training slot is stored as Training', (await one(m1, `select role from opportunities where id = $1`, [t2])).role === 'Training')

// Training starting in a minute (inserted directly so check-in is open now).
const training = (await db.query(`insert into opportunities (restaurant_id, kind, role, starts_at, ends_at, openings, pay_cents, deadline)
  values ($1, 'training', 'Training', now() + interval '1 minute', now() + interval '31 minute', 1, 1600, now() + interval '1 minute') returning id`, [rid])).rows[0].id

// ── training unlocks the store ──
ok('shift locked before training', /Training first/.test(await err(c1, `select book($1)`, [shift])))
await as(c1, `select book($1)`, [training])
const tb = (await one(c1, `select id, status from bookings where opportunity_id = $1`, [training]))
ok('request waits for the restaurant', tb.status === 'pending')
ok('cannot request the same slot twice', /Booked/.test(await err(c1, `select book($1)`, [training])))
ok('second candidate cannot take the single spot', /Full/.test(await err(c2, `select book($1)`, [training])))
ok('cannot check in before confirmed', /Not confirmed/.test(await err(c1, `select check_in($1)`, [tb.id])))
ok('other restaurant cannot confirm', /Not your restaurant/.test(await err(m2, `select confirm_booking($1, true)`, [tb.id])))
await as(m1, `select confirm_booking($1, true)`, [tb.id])
ok('stranger cannot check someone in', /Not yours/.test(await err(c2, `select check_in($1)`, [tb.id])))
await as(c1, `select check_in($1)`, [tb.id])
ok('candidate checked in', (await one(c1, `select status, check_in_at is not null as t from bookings where id = $1`, [tb.id])).t === true)
ok('restaurant notified of check-in', (await one(m1, `select count(*)::int n from notifications where kind = 'checkin'`)).n === 1)
ok('cannot review before check-out', /Not finished/.test(await err(m1, `select review_candidate($1, 5)`, [tb.id])))
await as(m1, `select check_out($1)`, [tb.id])
ok('restaurant checked them out', (await one(c1, `select status from bookings where id = $1`, [tb.id])).status === 'done')
ok('quest point at this restaurant', (await one(c1, `select count(*)::int n from quests where restaurant_id = $1`, [rid])).n === 1)
ok('store unlocked notification', (await one(c1, `select count(*)::int n from notifications where kind = 'unlocked'`)).n === 1)
ok('restaurant earned XP', (await one(m1, `select xp from restaurants where id = $1`, [rid])).xp === 1)
ok('no second training once unlocked', /Done/.test(await err(c1, `select book((select id from opportunities where kind = 'training' and role = 'Training' and restaurant_id = $1 and starts_at > now() + interval '2 day'))`, [rid])))

// ── reviews ──
ok('review must be 1–5', /1 to 5/.test(await err(m1, `select review_candidate($1, 9)`, [tb.id])))
ok('other restaurant cannot review', /Not your restaurant/.test(await err(m2, `select review_candidate($1, 5)`, [tb.id])))
await as(m1, `select review_candidate($1, 4)`, [tb.id])
ok('one review per booking', /Already reviewed/.test(await err(m1, `select review_candidate($1, 5)`, [tb.id])))
ok('review gives restaurant XP', (await one(m1, `select xp from restaurants where id = $1`, [rid])).xp === 2)
ok('candidate sees their review', (await one(c1, `select stars from reviews`)).stars === 4)
const st = await one(m1, `select * from candidate_stats() where candidate_id = $1`, [c1])
ok('restaurant sees level, rating and count', st.quests === 1 && Number(st.rating) === 4 && st.reviews === 1, JSON.stringify(st))
ok('stats only for people who booked with you', (await as(m2, `select * from candidate_stats()`)).rows.length === 0)

// ── shifts ──
await as(c1, `select book($1)`, [shift])
const sb = (await one(c1, `select id from bookings where opportunity_id = $1`, [shift])).id
ok('shift hidden behind training for others', /Training first/.test(await err(c2, `select book($1)`, [shift])))
// Give Blake a finished training and the skill, so only capacity stands in the way.
await db.query(`insert into bookings (opportunity_id, candidate_id, status) values ($1, $2, 'done')`, [training, c2])
await as(c2, `update profiles set skills = '{Food handler}' where id = $1`, [c2])
ok('two candidates cannot claim the same opening', /Full/.test(await err(c2, `select book($1)`, [shift])))
ok('filled never exceeds openings', /check constraint/.test(await db.query(`update opportunities set filled = 2 where id = $1`, [shift]).then(() => '', (e) => e.message)))
ok('candidate cannot edit filled count', (await as(c1, `update opportunities set filled = 0 where id = $1`, [shift])).affectedRows === 0)
ok('candidate cannot write bookings directly', !!(await err(c2, `insert into bookings (opportunity_id, candidate_id, status) values ($1, $2, 'confirmed')`, [shift, c2])))
ok('candidate cannot mark themselves done', (await as(c1, `update bookings set status = 'done' where id = $1`, [sb])).affectedRows === 0)
await as(m1, `select confirm_booking($1, true)`, [sb])
ok('shift check-in not open yet', /Opens 1 hour before/.test(await err(c1, `select check_in($1)`, [sb])))
const overlap = (await post(m1, rid, 'shift', `now() + interval '2 day 1 hour'`, `now() + interval '2 day 5 hour'`, 3, 1800)).rows[0].id
ok('double-booking the same time blocked', /Busy/.test(await err(c1, `select book($1)`, [overlap])))
await as(c1, `select cancel_booking($1)`, [sb])
ok('cancel frees the spot', (await one(m1, `select filled from opportunities where id = $1`, [shift])).filled === 0)

// ── decline ──
const later = (await post(m1, rid, 'shift', `now() + interval '4 day'`, `now() + interval '4 day 4 hour'`, 1, 1900)).rows[0].id
await as(c1, `select book($1)`, [later])
const lb = (await one(m1, `select id from bookings where opportunity_id = $1`, [later])).id
await as(m1, `select confirm_booking($1, false)`, [lb])
ok('declined frees the spot', (await one(m1, `select filled from opportunities where id = $1`, [later])).filled === 0)

// ── restaurant-specific visibility ──
ok('manager sees own restaurant points', (await one(m1, `select count(*)::int n from quests`)).n === 1)
ok('other restaurant sees none of them', (await one(m2, `select count(*)::int n from quests`)).n === 0)
ok('candidates cannot see each other’s quests', (await one(c2, `select count(*)::int n from quests`)).n === 0)
ok('candidates cannot read other profiles', (await one(c2, `select count(*)::int n from profiles`)).n === 1)
ok('restaurant sees people who booked with it', (await one(m1, `select count(*)::int n from profiles where id = $1`, [c1])).n === 1)
ok('restaurant cannot see people who did not', (await one(m2, `select count(*)::int n from profiles where id = $1`, [c1])).n === 0)
ok('invite codes are unreadable', (await one(m1, `select count(*)::int n from invite_codes`)).n === 0)
ok('cannot read others’ notifications', (await one(c2, `select count(*)::int n from notifications where user_id = $1`, [c1])).n === 0)
ok('cannot spoof notifications', /permission denied/.test(await err(c2, `select notify($1, 'quest', 'fake')`, [c1])))
void rid2

// cancellation notifies booked people
const open3 = (await post(m1, rid, 'shift', `now() + interval '5 day'`, `now() + interval '5 day 4 hour'`, 2, 1800)).rows[0].id
await as(c1, `select book($1)`, [open3])
await as(m1, `select cancel_opportunity($1)`, [open3])
ok('cancel notifies candidate', (await one(c1, `select count(*)::int n from notifications where kind = 'cancelled'`)).n === 1)
ok('cancel releases spots', (await one(m1, `select filled from opportunities where id = $1`, [open3])).filled === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
