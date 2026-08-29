# MessManager Mobile

React Native (Expo) client for the MessManager web app. Talks to the **same
Supabase backend** — no API server, no schema changes. This is a native rebuild,
not a WebView wrapper.

Web app lives in `../Mess-Managements git`.

---

## Status — member **and** manager apps are feature-complete

Native Ionicons throughout (no emoji), platform ripple/press feedback + haptics,
grouped list rows, offline-aware data. Consistent colour language (day = blue,
night = amber). Tappable month-grid calendars on the meal / bazar entry screens
and the member bazar log; collapsible settlement breakdown + a floating
"today's meals" bubble on the member dashboard.

Notifications: a meal change by anyone raises a local push for **every** member;
any edit by a member or sub-manager shows in the manager's *Member Updates* feed.

| Area | State |
|---|---|
| Expo SDK 54 (matches store Expo Go) | ✅ |
| Auth — member/manager login, PBKDF2, session JWT, change password | ✅ |
| Shared settlement + collect logic (port of `js/core/*` + `profiles.js` + `collect.js`) | ✅ + parity test |
| **Member** — Dashboard, Meal Log (+ absence range + calendar), Bazar Log, Utility/Rent, Profile, Monthly Log, Mess Info | ✅ |
| **Broadcasts** — read feed with unread tracking + local push notification on new ones | ✅ |
| **Manager** — role switch, Dashboard, Meal/Bazar/Utility/Rent entry, Member Updates, Audit Log | ✅ |
| **Manager — Collect Payment** | waterfall split + **Return change** + **Mess owes** drawdown tables, carry-forward, receipt (text + PDF) | ✅ |
| **Manager — Members** | add / edit / remove, password reset, sub-manager roles, transfer manager | ✅ |
| **Manager — Analytics / Mess Fund / Broadcasts / Mess Rules** | ✅ |
| **Manager — Absence Calendar** | month grid of who's absent (attendance toggles + 0-meal days) + per-member summary | ✅ |
| **Manager — Month Close** | lock/unlock a month; all entry writes check the lock | ✅ |
| **Push notifications** | local notification when a new broadcast appears (poll on foreground/interval); Expo push token registered in dev/prod builds | ✅ (Expo Go: local only — see notes) |
| **Offline caching** | every mess-scoped list read is an AsyncStorage read-through cache; offline strip shows when serving stale data | ✅ |
| Chore roster | 🔜 (rarely used; `chores` table) |
| Superadmin | ❌ not planned for mobile |

### Tests

```bash
npm run typecheck        # tsc --noEmit
npm run test:settlement  # settlement-formula parity check (pure Node)
```

---

## Deploy / distribute

See **[DEPLOY.md](DEPLOY.md)** — EAS Build (cloud, no Android Studio / Mac) to a
sideloadable APK or the Play Store, plus over-the-air JS updates.

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
    memberActions.ts       member self-service writes + absence range
    managerActions.ts      manager entry writes (meals/bazar/rent/utility) + month-lock guard
    memberAdmin.ts         add/edit/remove member, roles, transfer manager
    collect.ts             loadCollectData, saveCollectRow, saveChangeRow, saveCreditRow
    push.ts                local broadcast notifications + push-token registration
    offline.ts             AsyncStorage read-through cache + connectivity
    announceRead.ts        unread broadcast tracking
  core/collect.ts, absence.ts, memberStats.ts, period.ts   pure ports
  context/AuthContext.tsx  isManager / viewMode / area
  hooks/                   useMessData, useMemberDashboard
  components/              ui.tsx, form.tsx, Icon.tsx (Ionicons), MemberGrid.tsx, Markdown.tsx, AppServices.tsx
  theme.ts                 tokens from css/01-variables.css + avatar palette
scripts/settlement-parity.ts   npm run test:settlement
```

### Keeping logic in sync with the web app

`src/core/*` is a hand-port of `js/core/*` + `js/manager/profiles.js` +
`collect.js`. When the settlement/collect formula changes on web, mirror it here
and update `scripts/settlement-parity.ts`. `npm run test:settlement` runs it in
plain Node.

---

## Notes

- Backend credentials in `src/lib/config.ts` are the same public ones the web app
  ships with. Override via `.env` (see `.env.example`).
- **Push notifications**: `src/lib/push.ts` polls broadcasts while the app is
  foregrounded (and on resume) and raises a *local* notification for anything
  new — this works in Expo Go. True background/remote push needs a dev or
  production build (an Expo push token is registered automatically when running
  outside Expo Go). No server component is required for the poll-based path.
- **Offline**: `src/lib/offline.ts` wraps every mess-scoped list read
  (`dbGetAll`, members, utility, broadcasts, mess rules) in an AsyncStorage
  read-through cache. On a failed fetch it serves the last cached copy and shows
  a thin "showing saved data" strip; the cache is wiped on sign-out.
- Chore roster is the only web feature not ported (low usage).
- `.npmrc` sets `legacy-peer-deps=true` — the Expo / React 19 dependency tree
  has peer-range friction that this smooths over.
