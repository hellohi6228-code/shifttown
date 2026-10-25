# ShiftTown — Ithaca

Restaurant staffing for college towns, wrapped in a cozy isometric town.
Candidates explore an illustrated Ithaca, meet restaurants, unlock shifts and
earn restaurant-specific quest stars. Managers post intros and shifts, approve,
record attendance and invite people back.

One codebase → iOS (App Store), Android (Google Play) and a web PWA.
React + TypeScript + Tailwind, Capacitor for the native shells, Supabase
(Postgres + RLS) for data and identity.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 (phone-sized window works best).

**Try it on any phone:** https://hellohi6228-code.github.io/shifttown/ — the demo,
hosted on GitHub Pages. Update it with `npm run deploy:pages` (builds and pushes
`dist/` to the `gh-pages` branch).
With no Supabase keys the app runs in **demo mode**: data lives on the device and
everything is labelled `DEMO`.

| Demo code | What it does |
|---|---|
| `DEMO-NEW-1` (`-2`, `-3`) | Register a new restaurant (tap **🆕 New place** to prefill a Maps link) |
| `DEMO-GORGE` | Join the demo *Gorge Grill* as a manager (pending requests + attendance to record) |

Me → **DEMO** panel lets you play as a demo candidate or reset the data.

A full loop in under a minute: *Find shifts* → book the Gorge Grill intro →
Me → *My restaurant* → `DEMO-GORGE` → approve → ✓🔓 → 🍳 back to town →
quest celebration → shifts unlocked.

## No login

There are no accounts or passwords. The app uses the identity the phone already has:

- **iOS** — Sign in with Apple (the App Store Apple ID), one tap on first launch.
- **Android** — the Google account used for Google Play, picked up silently when
  possible (Credential Manager auto-select), otherwise one tap.

Both return an ID token that Supabase verifies (`signInWithIdToken`). Code: `src/auth/native.ts`.

## Connect Supabase

1. Create a project, run `supabase/migrations/0001_init.sql`.
2. Auth → Providers: enable **Apple** (Services ID + bundle `town.shift.ithaca`) and
   **Google** (Web + iOS client IDs; add the Android SHA-1 to the Google Cloud project).
3. Copy `.env.example` → `.env` and fill in the keys.
4. Issue a restaurant code from the SQL editor (codes are stored hashed, single use, 30 days):

   ```sql
   select admin_create_invite();                 -- new restaurant
   select admin_create_invite('<restaurant id>'); -- add a manager to one
   ```

## Store builds

```bash
npm run ios       # build, sync, open Xcode (macOS)
npm run android   # build, sync, open Android Studio
```

- iOS: `ios/App/App/App.entitlements` already enables Sign in with Apple; pick your
  team in Xcode → Signing.
- Android: set `VITE_GOOGLE_WEB_CLIENT_ID` before building.

## How it’s built

| Area | Where |
|---|---|
| Town map (pan / pinch / zoom, SVG, no 3D engine) | `src/components/TownMap.tsx`, `src/components/map/*` |
| Avatar + editor (pure SVG, CSS animations) | `src/components/Avatar.tsx`, `AvatarEditor.tsx` |
| Restaurant sheet + booking card | `src/components/RestaurantSheet.tsx`, `OppCard.tsx` |
| Calendars | `src/components/Calendar.tsx`, `screens/candidate/Plans.tsx`, manager `Schedule` |
| Candidate screens | `src/screens/candidate/*` |
| Manager screens | `src/screens/manager/*` |
| Booking / eligibility / matching / levels | `src/lib/rules.ts` (client) mirrored by `supabase/migrations/0001_init.sql` (server) |
| Backends | `src/data/localApi.ts` (demo), `src/data/supabaseApi.ts` (production) |

**Rules enforced on the server** (Postgres functions with row locks, tables read-only via RLS):
no double-booking a person, no overbooking an opening (`filled <= openings` is also a
CHECK constraint), shifts require manager-granted eligibility and listed skills,
training and shifts must be paid, attendance only from the day of the activity,
invite codes hashed and single-use, a restaurant only ever sees quest stars earned
at that restaurant.

**Matching** is rule-based and explainable: availability, distance from the
candidate’s chosen neighborhood (never an address), role, skills, clashes. No
school, demographic or neighborhood-quality signals.

**Levels** count finished quests (experience, not a rating). Badge criteria are shown
on tap. Stars are never converted to money and pay is always shown on every card.

Animations respect the OS “reduce motion” setting and can be switched off in Me → ✨ Motion.

## Tests

```bash
npm run test:sql   # 46 checks: runs the real migration in embedded Postgres (PGlite) as real client roles
npm run typecheck
```

## Not in this MVP

Payments/payroll, AI matching, a real-world map engine, editing posted shifts
(cancel + repost), push/email notifications (in-app only), expanding
`maps.app.goo.gl` short links (the manager confirms the pin instead — a Supabase
Edge Function with the Places API is the natural next step).
