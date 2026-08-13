# Project Context — Prompt Template Manager

Cập nhật lần cuối: 2026-08-12

## Tổng quan

App **Expo / React Native** (managed workflow) — thư viện prompt template cá nhân, 100% on-device, không cloud/backend/account. Core loop: **Search → Fill (nếu có biến) → Copy** (3 thao tác). Monetized bằng AdMob (Android + iOS), build release APK local + GitHub Actions.

## Tech stack

- **Framework**: Expo (managed), expo-router (file-based routing), React Native, TypeScript
- **Data**: expo-sqlite — 2 bảng `prompts` (có `search_normalized`) + `app_meta` (key/value), migration qua `PRAGMA user_version`
- **Ads**: react-native-google-mobile-ads v16 (banner/interstitial/rewarded/app-open), flag `TEST_ADS` trong `lib/config.ts`
- **Utils**: expo-clipboard, expo-haptics, expo-document-picker, expo-file-system, expo-sharing, expo-crypto
- **Test**: Jest + react-test-renderer (`__tests__/`, helpers trong `jest/testUtils.ts`)
- **OpenSpec**: CLI v1.8.0, schema spec-driven, changes trong `openspec/changes/`

## Cấu trúc thư mục chính

- `app/` — Expo Router routes: `(tabs)/` (Home/Favorites/Recent), `prompt/[id]/` (detail/edit/fill), `settings/`, root `_layout.tsx` (DB init + providers)
- `components/` — UI: PromptCard, PromptList, SearchBar, PromptForm, PreviewPane, VariableField, AdBanner, BackupReminderBanner, ImportPreviewList, ConfirmDialog, Toast, EmptyState, MissingState, FeatureBadge, Tooltip, DisabledStateHelper
- `db/` — SQLite: client, migrate, migrations/, promptRepository (đa nền tảng: `.shared.ts` / `.web.ts` / `.sqlite.ts`) — **bề mặt truy cập dữ liệu duy nhất**
- `hooks/` — usePrompts, useVariableForm, useBackupReminder, useAppOpenAd
- `lib/` — variableEngine, normalize, importExport, fileIO, importSession, samplePrompts, theme, ads, adGateStore, navigation, config, PromptsContext, onboarding/
- `plugins/` — Expo config plugins: withAdsPlayServicesFix, withCleartextTraffic
- `openspec/` — tài liệu thiết kế (changes/specs)
- Root-level memory files: `AGENTS.md` (quy trình đầy đủ) + `CLAUDE.md` (tóm tắt nhanh) + `context.md`/`working.md`/`operating_rules.md` (đọc tự động ở session start)

## Quyết định kiến trúc quan trọng

- **D1**: expo-sqlite + `app_meta` cho mọi non-DB pref (không AsyncStorage/MMKV)
- **D2**: `db/promptRepository` là bề mặt truy cập dữ liệu duy nhất (screens/hooks không chạm SQL)
- **D3**: variable engine là pure functions, luôn derive từ content
- **D4**: search = normalizeVietnamese + LIKE + JS ranking
- **D9**: AdMob — non-personalized only, TEST_ADS flag (mặc định test IDs), consent gate UMP (production), web = stub không ads
- **Onboarding**: root `OnboardingProvider` + single overlay, storage qua `app_meta` (MetaStore injected), seen-once/resume/skip rules

Chi tiết đầy đủ trong `openspec/changes/prompt-template-manager-mvp/design.md` (D1–D9) và `openspec/changes/add-in-app-guidance-onboarding/design.md`.

## Trạng thái hiện tại

- MVP hoàn thành (tất cả task trừ 6.5 Production build — đã có APK local nhưng chưa chạy EAS chính thức)
- Post-MVP: TEST_ADS, cleartext HTTP plugin, targetSdk 36, 2 bug fix đã xong
- In-app Guidance & Onboarding: hoàn thành (change openspec mới, planning complete)
- Test: 171/171 pass · `tsc --noEmit` clean · `openspec validate --all` pass

## Lưu ý đặc biệt

- `android/` được regenerate bởi `expo prebuild` — sửa native phải qua config plugin trong `plugins/`, không sửa trực tiếp
- Release APK: `apk/app-release.apk` (đã build trước các thay đổi mới nhất — cần build lại để test cleartext/ads)
- Trước khi publish: đổi `TEST_ADS = false` + thay iOS placeholder IDs bằng production IDs
