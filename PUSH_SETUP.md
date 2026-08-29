# Instant push notifications — setup

The app code is done. What's left is infrastructure you have to wire up once
(Firebase, Supabase function, webhook) plus one new build.

**How it works:** a manager posts a broadcast / someone edits a meal → a row is
inserted into `broadcasts` or `notifications` → a Supabase trigger calls the
`send-push` edge function → it looks up every mess member's device token in
`push_tokens` and hands the list to Expo's push service → phones buzz, app
closed or not.

Until this is set up the app falls back to foreground + ~15-min background
polling (still works, just not instant).

---

## 1. Database — create the `push_tokens` table

Supabase Dashboard → **SQL Editor** → paste [supabase/push-notifications.sql](supabase/push-notifications.sql) → **Run**.

That creates `push_tokens` and (optionally) a trigger. Leave the trigger's
`app.send_push_*` settings unset for now — you'll set them in step 5, or use a
Dashboard Webhook instead (step 6).

---

## 2. Firebase project (Android delivery)

Expo's push service delivers to Android through **your** Firebase Cloud
Messaging project.

1. <https://console.firebase.google.com> → **Add project** (any name).
2. In the project → **Add app → Android**. Package name: `com.messmanager.mobile`.
3. Download **`google-services.json`** and drop it in the repo root
   (`MessManager-mobile/google-services.json`). It's git-ignored, and
   [app.config.js](app.config.js) picks it up automatically — nothing else to
   edit. (No file = build still works, Android push just stays off.)
4. Firebase → **Project settings → Service accounts → Generate new private key**
   → downloads a JSON.
5. Upload that JSON to EAS so Expo can call FCM:
   ```bash
   npx eas-cli credentials
   # Android → production/preview → Google Service Account
   #   → "Manage your Google Service Account Key for Push Notifications" → upload
   ```

*(iOS: needs an Apple Developer account; `eas credentials` generates the APNs
key for you. Skip if Android-only.)*

---

## 3. Deploy the edge function

```bash
# from the Mess-Managements repo that has the supabase/ CLI project,
# or: npm i -g supabase && supabase login && supabase link --project-ref <ref>
supabase functions deploy send-push --no-verify-jwt
```

The file to deploy is [supabase/functions/send-push/index.ts](supabase/functions/send-push/index.ts)
(copy it into your linked Supabase project's `supabase/functions/send-push/`).

---

## 4. Function secret

Pick a random string (`openssl rand -hex 16`), then:

```bash
supabase secrets set PUSH_HOOK_SECRET=<that-string>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

---

## 5. Fire the function on insert — pick ONE

### Option A — Dashboard Webhook (no SQL)

Dashboard → **Database → Webhooks → Create a new hook**, twice:

| Field | broadcasts hook | notifications hook |
|---|---|---|
| Table | `broadcasts` | `notifications` |
| Events | Insert | Insert |
| Type | Supabase Edge Functions | Supabase Edge Functions |
| Edge Function | `send-push` | `send-push` |
| HTTP Headers | `x-push-secret: <PUSH_HOOK_SECRET>` | same |

### Option B — SQL trigger (already in the .sql file)

Run in SQL Editor, with your project ref and the same secret:

```sql
alter database postgres set app.send_push_url    = 'https://<PROJECT-REF>.functions.supabase.co/send-push';
alter database postgres set app.send_push_secret = '<PUSH_HOOK_SECRET>';
```

The triggers `trg_send_push_broadcasts` / `trg_send_push_notifications` were
created by the .sql file and start working once these are set.

---

## 6. Build & distribute

Push config is native, so:

```bash
npx eas-cli build --profile preview --platform android
```

Send the new APK to users. On sign-in each device registers its Expo token into
`push_tokens`; sign-out removes it.

---

## Testing

- Insert a test broadcast from the manager UI on device A → device B (app
  closed) should get it within seconds.
- Function logs: Dashboard → Edge Functions → `send-push` → Logs. A successful
  call returns `{ "sent": N, "pruned": 0 }`.
- No notification? Check: token row exists in `push_tokens`, `google-services.json`
  package name matches, FCM key uploaded to EAS, webhook/trigger secret matches
  `PUSH_HOOK_SECRET`, notification permission granted on the device.

## Cost / limits

Expo push is free. FCM is free. The edge function runs within Supabase's free
tier for a mess-sized workload.
