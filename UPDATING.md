# Shipping an update to MessManager Mobile

Quick runbook for pushing a change to the installed app. For the full deploy
reference (stores, iOS, push, credentials) see [DEPLOY.md](DEPLOY.md).

Current setup: EAS CLI (`npx eas-cli`), signed in as `shahriyar_h10`. Build
profile **`preview`** → Android APK, internal distribution, update channel
**`preview`**, `versionCode` auto-increments. `runtimeVersion` follows
`expo.version` in `app.json` (currently **1.0.1**). `expo-updates` ships in the
app from 1.0.1 onward, so over-the-air updates work for any 1.0.1+ build.

---

## First: which path?

| You changed… | Path |
|---|---|
| Only JS/TS — screens, logic, `src/**`, text, styles, in-bundle images | **A — OTA** (no rebuild) |
| App icon / splash, `app.json` native config, permissions, a package with native code, the Expo SDK version | **B — Rebuild APK** |

Rule of thumb: if the change is visible only after a fresh binary is installed,
it's Path B. Everything else is Path A.

---

## Path A — JS-only change (over-the-air)

```bash
cd "c:/Users/shahr/Downloads/MessManager All versions/MessManager-mobile"

# 1. verify it compiles
npx tsc --noEmit

# 2. commit — do NOT bump version in app.json
git add -A
git commit -m "describe the change"

# 3. publish to the preview channel
npx eas-cli update --channel preview --message "describe the change"
```

Installed 1.0.1+ apps download it in the background and apply on the next cold
start (often the 2nd launch). Nothing to distribute.

> Keep `expo.version` unchanged here. `runtimeVersion` follows it, and an update
> only reaches builds on the same runtime (`1.0.1`). Bumping the version would
> strand every installed app until they get a new APK.

---

## Path B — native change (new APK)

```bash
cd "c:/Users/shahr/Downloads/MessManager All versions/MessManager-mobile"

# 1. verify
npx tsc --noEmit

# 2. bump the version in app.json:  "version": "1.0.1"  ->  "1.0.2"

# 3. commit
git add -A
git commit -m "describe the change"

# 4. build the Android APK (versionCode auto-increments)
npx eas-cli build --profile preview --platform android
```

Wait ~15–20 min for the cloud build. Then:

```bash
# 5. get the APK download URL
npx eas-cli build:list --platform android --limit 1
```

Send the `Application Archive URL` (ends in `.apk`) to your users. It installs
over the existing app — same signing key, so no uninstall needed.

---

## Status / troubleshooting

```bash
npx eas-cli whoami                        # confirm you're logged in
npx eas-cli build:list --limit 5          # recent builds
npx eas-cli build:view <build-id>         # one build's status + APK link + Logs URL
npx eas-cli channel:list                  # update channels
npx eas-cli update:list --branch preview  # OTA updates published
```

If a build errors: open the `Logs` URL from `build:view`, fix the cause,
re-commit, and re-run the build (step 4).

Optional any time: `git push` to back the commits up to GitHub. Not required —
EAS builds from your local commit, not from GitHub.

---

## Notes

- The app icon / splash can **only** change through Path B — OTA can never touch
  the launcher icon.
- Bump `expo.version` for every Path B build; leave it alone for Path A.
- The very first 1.0.1 APK had to be built (Path B) to get `expo-updates` into
  users' hands. From there, JS-only fixes are Path A.
