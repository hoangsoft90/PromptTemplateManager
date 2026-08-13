---
name: gh-actions-apk-build
description: Build the Prompt Template Manager Android APK (and AAB) on GitHub Actions via the existing build-apk workflow — no EAS token needed. Use when the user asks to build an APK/AAB, rebuild after code changes, or re-run the GH Actions build for this repo. Repo: https://github.com/hoangsoft90/PromptTemplateManager.
---

# GH Actions APK build — Prompt Template Manager

Build the Android APK/AAB on GitHub Actions **without EAS** (no EXPO_TOKEN).
The workflow runs `expo prebuild` + `gradlew assembleRelease` directly on the
CI runner and uploads the APK as an artifact.

## The repo

- **GitHub repo:** `https://github.com/hoangsoft90/PromptTemplateManager`
- **Local remote (origin):** already set to the same URL.
- **Workflow file:** `.github/workflows/build-apk.yml` (committed, name "Build Android APK").
- **Trigger:** auto-runs on `push` to `main`; also `workflow_dispatch` (manual).

## Token (IMPORTANT — never hardcode)

The user provides a `gh_token` per session (classic PAT, `ghp_...`). Do **not**
write the token into any file, skill, memory, or commit — it is a secret.

Use it only via the environment variable for the command you run:

```bash
export GH_TOKEN=<token-provided-by-user>
```

## Build flow (agent steps)

1. **Preflight** (before pushing):
   - `npx tsc --noEmit` clean and `npx jest` green (all tests pass).
   - `.gitignore` must keep `/android`, `/ios`, `.expo/`, `dist/`, `apk/`
     ignored — the CI regenerates the native project itself, never commit
     the `android/` folder.
   - Make sure `google-services.json` (AdMob config) IS committed.
2. **Commit + push** to `main`:
   ```bash
   git push https://$GH_TOKEN@github.com/hoangsoft90/PromptTemplateManager.git main
   ```
   Pushing to `main` auto-triggers the workflow. (Or use
   `gh workflow run build-apk.yml --repo hoangsoft90/PromptTemplateManager` for manual.)
3. **Watch the run** (build takes ~15–25 min first time, ~10 min cached):
   ```bash
   export GH_TOKEN=<token>
   gh run list --repo hoangsoft90/PromptTemplateManager --limit 3
   gh run watch <run-id> --repo hoangsoft90/PromptTemplateManager --exit-status
   ```
4. **Get the APK**: when the run succeeds, download the artifact:
   ```bash
   gh run download <run-id> --repo hoangsoft90/PromptTemplateManager --dir apk/
   ```
   The APK is `apk/app-release.apk` (debug-signed release build — fine for
   sideloading/tests, NOT for Play Store).

## Known build gotchas

- **Kotlin metadata mismatch** (play-services-ads compiled with newer Kotlin):
  fixed by the committed config plugin `plugins/withAdsPlayServicesFix.js`
  pinning `play-services-ads:24.2.0`. If the build regresses, verify that
  plugin is still registered in `app.json` `plugins`.
- **Do not bump `kotlinVersion`** — Kotlin 2.3.x crashes
  `react-native-safe-area-context` (type-checker bug). Keep the pin fix.
- **Release build uses real ad IDs?** No — `lib/config.ts` `TEST_ADS = true`
  makes every format use Google test unit IDs even in release APKs. Flip to
  `false` + real iOS IDs only for the store submission build.
- AAB for Play Store is NOT produced by this workflow (only APK). For AAB,
  use `eas build --profile production` (requires user's EAS account), or
  extend this workflow with `./gradlew bundleRelease` + signing.
