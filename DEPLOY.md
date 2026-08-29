# Deploying MessManager Mobile

This app is a pure–JS Expo project (SDK 54, no custom native code). You build it
in Expo's cloud with **EAS Build** — no Android Studio or Xcode, no Mac required.

Backend: it talks straight to the existing Supabase project. There is nothing to
deploy server-side. The Supabase URL + publishable key baked into
`src/lib/config.ts` are the same public ones the web app ships with, so a build
works out of the box.

---

## TL;DR — get an installable Android app

```bash
npm i -g eas-cli
eas login                       # free Expo account
eas init                        # writes extra.eas.projectId into app.json
eas build --profile preview --platform android
```

When the build finishes EAS gives you a URL + QR code. Open it on any Android
phone, download the `.apk`, install (allow "install unknown apps" once). Share
that same link with your mess members. Done.

Rebuild only when native code / SDK / `app.json` changes. Day-to-day JS fixes go
out over the air — see **Updates** below.

---

## One-time setup

| Step | Command | Notes |
|---|---|---|
| Install the CLI | `npm i -g eas-cli` | |
| Sign in | `eas login` | Create a free account at expo.dev if needed |
| Link the project | `eas init` | Adds `extra.eas.projectId` to `app.json` — commit it |
| (Android push, optional) | see **Push notifications** | Only if you want delivery while the app is closed |

`eas.json` (build profiles) is already in the repo:

- **development** – dev-client APK for debugging on device
- **preview** – release APK, internal distribution (share a link)
- **production** – Play Store `.aab`, auto-increments the version code

---

## Distribution options

### A. Direct APK (recommended for a private mess)

```bash
eas build --profile preview --platform android
```

Produces a signed `.apk`. Send the link / file to members; they sideload it.
No store account, no review, instant. Downsides: no auto-update from a store
(use EAS Update instead), and each phone must allow unknown-source installs.

### B. Google Play (closed or open testing)

1. Create a Play Console account (one-time \$25): <https://play.google.com/console>
2. Build an app bundle:
   ```bash
   eas build --profile production --platform android
   ```
3. Submit:
   ```bash
   eas submit --profile production --platform android
   ```
   First submit: create the app in Play Console, upload once manually, then
   `eas submit` works for later builds. Configure the service-account key when
   prompted (EAS walks you through it).
4. Use the **Internal testing** track to share with a small email list without a
   full store review, or **Production** for a public listing.

Play requires: a privacy policy URL, a completed *Data safety* form (the app
stores names / phone numbers / meal + payment data in Supabase), and a feature
graphic + screenshots.

### C. iOS

Needs the Apple Developer Program (\$99/yr). Then, from Windows:

```bash
eas build --profile production --platform ios     # cloud build, no Mac
eas submit --profile production --platform ios     # -> TestFlight / App Store
```

TestFlight is the easy path for a handful of testers.

---

## Updates (over-the-air, no rebuild)

`expo-updates` is configured via `runtimeVersion: { policy: "appVersion" }`.
After the first build, enable updates once:

```bash
eas update:configure
```

Then ship JS / asset changes to installed apps in seconds:

```bash
eas update --branch production --message "fix meal grid rounding"
```

The build profile's `channel` (`preview` / `production`) maps to the update
branch. Rules:

- **OTA is fine** for anything under `app/`, `src/`, styling, logic, images.
- **You must rebuild + redistribute** when you change the Expo SDK, add/remove a
  native module, or edit `app.json` native config (icons, permissions, plugins).
  Bump `version` in `app.json` first so the new runtime is separate.

---

## Push notifications in a standalone build

Two mechanisms exist in the app:

1. **Local notifications (works today, zero setup).** While the app is open or
   resumed it polls broadcasts + meal updates every 60 s and raises a local
   notification. This keeps working in a production build with no extra config —
   the `POST_NOTIFICATIONS` permission and notification icon are already wired in
   `app.json`.

2. **Remote push (optional, needs work).** `src/lib/push.ts` registers an Expo
   push token in a real build, but **nothing sends to it yet** — there is no
   server. For delivery while the app is fully closed you would need:
   - **Android:** a Firebase project → upload the FCM V1 service-account JSON to
     EAS (`eas credentials` → Android → *Google Service Account*).
   - **iOS:** APNs key (EAS generates it during the build if you let it).
   - A sender: e.g. a Supabase Edge Function triggered on `INSERT` into
     `notifications` / `broadcasts` that POSTs to `https://exp.host/--/api/v2/push/send`
     with the stored Expo tokens.

   Until that sender exists, ship with local notifications only.

---

## Pre-flight checklist

- [ ] `npm run typecheck` and `npm run test:settlement` pass
- [ ] `npx expo-doctor` clean
- [ ] `eas init` done, `extra.eas.projectId` committed
- [ ] Bump `expo.version` in `app.json` for a user-visible release
- [ ] Install the `preview` APK on a real phone and check: login (PBKDF2 works in
      release/Hermes), meal + bazar entry, Collect receipt PDF (`expo-print`),
      offline mode (airplane mode → cached data + banner), a local notification
- [ ] If targeting a different Supabase project, set `EXPO_PUBLIC_SUPABASE_URL` /
      `EXPO_PUBLIC_SUPABASE_KEY` (via `eas env:create` or a local `.env`) — these
      are inlined at build time
- [ ] For stores: privacy policy URL, screenshots, Play *Data safety* form

---

## Handy commands

```bash
eas build:list                       # build history + artifact links
eas build --profile preview -p android --local   # build on your machine (needs Android SDK)
eas update:list --branch production
eas channel:list
eas credentials                      # manage keystore / push keys
```
