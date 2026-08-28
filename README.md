# MessManager Mobile

React Native (Expo) client for the MessManager web app. Talks to the **same
Supabase backend** — no API server, no schema changes. This is a native rebuild,
not a WebView wrapper.

Web app lives in `../Mess-Managements git`.

---

## Status — the **member app is feature-complete**

| Area | State |
|---|---|
| Expo SDK 54 (matches store Expo Go) | ✅ |
| Auth — member/manager login, PBKDF2, session JWT, change password | ✅ |
| Shared settlement logic (port of `js/core/helpers.js` + `profiles.js`) | ✅ + parity test |
| **Dashboard** — net payable, charge breakdown, mess stats, today, who-ate | ✅ |
| **Meal Log** — direct meal entry + notify, absence range, upcoming absences, month calendar | ✅ |
| **Bazar Log** — direct bazar entry + notify, month total, history | ✅ |
| **Utility/Rent** — record rent/utility payment + notify, payment history | ✅ |
| **My Profile** — period selector, balances, stats, meal history, recent months, "What I Owe" | ✅ |
| **Monthly Log** — full per-member settlement report, any month | ✅ |
| **Messages** — broadcasts + announcements feed, unread tracking | ✅ |
| **Mess Info** — WiFi / payment / rules (Markdown) / contacts | ✅ |
| **Manager — role switch** | manager lands on manager tabs; "View as member" toggle in More |
| **Manager — Dashboard** | meal/rate/bazar stats, rent + utility collection %, today's meals, bazar leaders, meal-share |
| **Manager — Meal Entry** | per-member day/night grid, absence badges, quick-fill, recent entries |
| **Manager — Bazar Entry** | per-member amount grid, day total, recent entries |
| **Manager — Utility Entry** | prepaid + postpaid bills per month, per-member payment tracking with carry-forward credit |
| **Manager — Room Rent** | per-member due/paid/status/notes, auto-status, mark-all-paid, history |
| **Manager — Member Updates** | activity feed of member self-service edits, mark seen |
| **Manager — Audit Log** | category filter + search + pagination |
| Manager — Collect Payment + receipt | 🔜 next phase |
| Manager — Members CRUD / roles | 🔜 next phase (read-only roster for now) |
| Manager — Monthly Log PDF, Meal Rate Chart, Mess Fund, compose | 🔜 next phase |
| Superadmin | ❌ not planned for mobile |

### Tests

```bash
npm run typecheck        # tsc --noEmit
npm run test:settlement  # settlement-formula parity check (pure Node)
```

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
    _layout.tsx            bottom tabs (Dashboard / Meals / Bazar / Utility-Rent / More)
    index.tsx              Dashboard
    meals.tsx              Meal Log  (entry + absence range + month calendar)
    bazar.tsx              Bazar Log
    payments.tsx           Utility & Rent  (record payment + history)
    more.tsx               menu -> the screens below
  profile.tsx              My Profile  (period selector, What I Owe)
  monthly-log.tsx          Monthly Log  (per-member settlement, any month)
  messages.tsx             Messages  (broadcasts + announcements)
  mess-info.tsx            Mess Info  (WiFi / payment / rules / contacts)
  change-password.tsx

src/
  core/                    PURE, portable logic — mirrors js/core/* + profiles.js
    format.ts              fmtTk, round2, month helpers
    meals.ts               meal totals + memberMonthCalendar
    settlement.ts          calcMemberSettlement / calcPrevDueForMember  (members is a param)
    memberStats.ts         getMemberStats / getUtilityBalance / getPrevMonthMealBalance
    period.ts              profile period filtering (getFilteredData …)
    types.ts               DB row shapes (from database.sql)
  lib/
    config.ts              Supabase URL/key, TTLs
    crypto.ts              PBKDF2-SHA-256 via @noble/hashes — byte-identical to
                           the browser's crypto.subtle, so hashes cross-verify
    supabase.ts            anon client + mess-scoped getClient()
    session.ts             AsyncStorage session
    auth.ts                login / signSessionJWT / changePassword
    db.ts                  all reads + writes  (from db.js + db-ext.js; no sanitize())
    memberActions.ts       saveMyMeal / saveMyBazar / saveMyPayment / absence range
    announceRead.ts        unread-message tracking
  context/AuthContext.tsx
  hooks/                   useMessData, useMemberDashboard
  components/              ui.tsx, form.tsx (Button/Field/DateField/MonthYearField/…), Markdown.tsx
  theme.ts                 tokens from css/01-variables.css + avatar palette
scripts/settlement-parity.ts   npm run test:settlement
```

### Keeping logic in sync with the web app

`src/core/*` is a hand-port of `js/core/*` + `js/manager/profiles.js`. When the
settlement formula changes on web, mirror it here and update
`scripts/settlement-parity.ts`. `npm run test:settlement` runs it in plain Node.

---

## Next phase — manager mode

Everything a **member** does is built. Still to port (all manager-only):

1. **Manager dashboard** — ring charts, heatmap, rent status, member comparison.
2. **Entry screens** — meal / bazar / utility / rent (all-member grids).
3. **Collect Payment** — the payment-allocation engine in `js/manager/collect.js`
   (~2k lines) + printable receipt via `expo-print`.
4. **Notifications** — approve / reject member update requests.
5. **Members** — add / edit / remove, password reset, roles, transfer.
6. **Reports** — Monthly Log PDF, Meal Rate Chart, Audit Log, Mess Fund.
7. **Compose** — post announcements / broadcasts, edit Mess Rules & chores.
8. **Push** — broadcasts → Expo push notifications.
9. **Offline** — cache `dbGetAll` results (React Query + AsyncStorage persister).

---

## Notes

- Backend credentials in `src/lib/config.ts` are the same public ones the web app
  ships with. Override via `.env` (see `.env.example`).
- `.npmrc` sets `legacy-peer-deps=true` — the Expo / React 19 dependency tree
  has peer-range friction that this smooths over.
