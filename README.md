# MessManager Mobile

React Native (Expo) client for the MessManager web app. Talks to the **same
Supabase backend** — no API server, no schema changes. This is a native rebuild,
not a WebView wrapper.

Web app lives in `../Mess-Managements git`.

---

## Status

| Area | State |
|---|---|
| Expo SDK 54 (matches store Expo Go) | ✅ |
| Auth (member login, PBKDF2, session JWT) | ✅ working |
| Shared settlement logic (ported from `js/core/helpers.js`) | ✅ ported |
| Member dashboard (net payable, breakdown, mess stats, today, who-ate) | ✅ first screen |
| Meal log / Bazar log / Profile detail | 🔜 stubs |
| Manager screens | 🔜 not started |
| PDF export (receipts, settlement) | 🔜 not started (`expo-print`) |
| Superadmin | ❌ not planned for mobile |

---

## Run it (Expo Go)

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS). Sign in with
a member/manager account created in the web app.

> Pinned to **Expo SDK 54** to match the current App Store / Play Store Expo Go
> client. Uses only Expo Go–compatible modules (pure-JS crypto, no custom native
> code), so no dev build is required. When Expo Go ships a newer SDK, bump with
> `npx expo install expo@<version> && npx expo install --fix`.

---

## Architecture

```
app/                       expo-router screens
  _layout.tsx              providers + root stack
  index.tsx                auth-gated redirect
  login.tsx
  (tabs)/
    _layout.tsx            bottom tabs + auth guard
    index.tsx              Member dashboard  ← main ported screen
    meals.tsx bazar.tsx profile.tsx   stubs

src/
  core/                    PURE, portable logic — mirrors js/core/*
    format.ts              fmtTk, round2, month helpers  (from helpers.js)
    meals.ts               mealRowTotal / mealMemberTotal / mealPartsFromObj
    settlement.ts          calcMemberSettlement / calcPrevDueForMember
                           (only change: `members` is a param, not a global)
    types.ts               DB row shapes (from database.sql)
  lib/
    config.ts              Supabase URL/key, TTLs
    crypto.ts              PBKDF2-SHA-256 via @noble/hashes.
                           Verified byte-identical to the browser's
                           crypto.subtle output → hashes are cross-compatible.
    supabase.ts            anon client + mess-scoped getClient()  (from config.js)
    session.ts             AsyncStorage session   (from helpers.js localStorage)
    auth.ts                login() / signSessionJWT()   (from auth.js)
    db.ts                  dbGetAll etc.   (from db.js; sanitize() dropped — no HTML sink)
  context/AuthContext.tsx
  hooks/useMemberDashboard.ts   data load + settlement calc for the dashboard
  components/ui.tsx        Card, StatCard, ScreenScroll, …
  theme.ts                 tokens from css/01-variables.css + avatar palette
```

### Keeping logic in sync with the web app

`src/core/*` is a hand-port of `js/core/*`. When the settlement formula changes
on web, mirror it here. The functions are pure and deterministic — the intent is
to add a Jest suite with shared fixtures so drift is caught automatically
(**TODO**, next task).

---

## Known gaps / next steps

1. **Settlement parity tests** — fixture-based Jest suite comparing this port to
   known web outputs.
2. **Meal / Bazar logs** — port `js/member/pages.js` (absence range picker is the
   fiddly bit).
3. **Requests** — member meal/bazar/bill requests → `notifications` table.
4. **Manager mode** — dashboard, entry screens, approvals.
5. **PDF** — `expo-print` for the payment receipt and monthly settlement.
6. **Push** — broadcasts could map to Expo push notifications.
7. **Offline** — cache `dbGetAll` results (React Query + AsyncStorage persister).

---

## Notes

- Backend credentials in `src/lib/config.ts` are the same public ones the web app
  ships with. Override via `.env` (see `.env.example`).
- `.npmrc` sets `legacy-peer-deps=true` — the Expo / React 19 dependency tree
  has peer-range friction that this smooths over.
