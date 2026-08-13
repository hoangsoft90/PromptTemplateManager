# CLAUDE.md — Prompt Template Manager

Hướng dẫn nhanh cho Claude Code. File đầy đủ & quy trình chi tiết: **`AGENTS.md`** (đọc trước). Memory files: **`context.md`**, **`working.md`**, **`operating_rules.md`** (cùng ở project root — đọc tự động ở session start).

## Project này là gì

App **Expo / React Native** — thư viện prompt template cá nhân, 100% on-device, không cloud/backend. Core loop: **Search → Fill (nếu có biến) → Copy**. Kiếm tiền qua AdMob (Android + iOS). Thiết kế theo **OpenSpec** (`openspec/`).

## Lệnh quan trọng

```bash
npx tsc --noEmit        # typecheck
npx jest                # full test suite (hiện 171 tests)
openspec validate --all # validate specs/changes
npx expo run:android    # dev build (test ads/onboarding trên phone)
```

## Quy tắc chốt (chi tiết: operating_rules.md)

1. **`TEST_ADS = true`** trong `lib/config.ts` → mọi format dùng test unit IDs + bỏ qua consent gate. **Phải đổi `false` + thay iOS placeholder IDs trước khi publish.**
2. Mọi non-DB pref qua **`app_meta`** (`db/promptRepository`) — không AsyncStorage/MMKV.
3. **Không sửa `android/` trực tiếp** (bị `expo prebuild` regenerate) — sửa native qua config plugin trong `plugins/` + `app.json`.
4. Giữ `targetSdkVersion: 36` (Google Play yêu cầu từ 31/8/2026).
5. Onboarding components (`Tooltip`/`DisabledStateHelper`) phải passthrough khi không có `OnboardingProvider`.

## Kiến trúc nhanh

- `app/` — routes (Expo Router): `(tabs)/` (Home/Favorites/Recent), `prompt/[id]/` (detail/edit/fill), `settings/`, root layout (DB init + providers)
- `db/` — SQLite: `promptRepository` (đa nền tảng) là bề mặt truy cập **duy nhất**
- `lib/` — variableEngine, normalize, importExport, ads (TEST_ADS), adGateStore, onboarding/, PromptsContext, theme
- `components/` — PromptCard, PromptForm, AdBanner, FeatureBadge, Tooltip, DisabledStateHelper, ...
- `plugins/` — config plugins: withAdsPlayServicesFix, withCleartextTraffic
- `openspec/` — thiết kế: MVP change (`prompt-template-manager-mvp`) + onboarding change (`add-in-app-guidance-onboarding`)

## Trạng thái hiện tại (xem working.md để biết chi tiết)

- MVP hoàn thành (trừ 6.5 EAS build chính thức)
- Post-MVP: TEST_ADS, cleartext HTTP, targetSdk 36, 2 bug fix — xong
- In-app Guidance & Onboarding — xong (171/171 tests, tsc clean, openspec validate pass)
- Repo đã có commits (code nền), nhưng **các thay đổi phiên này chưa commit**: AGENTS.md, CLAUDE.md, memory files, openspec mới, onboarding, TEST_ADS, cleartext plugin
