# Working — Prompt Template Manager

Nhật ký làm việc — mỗi mục là gạch đầu dòng có ngày ISO `YYYY-MM-DD`. Dọn các mục đã xong quá 1–2 tuần (nội dung cũ đã có trong AgentMemory/ADR/openspec).

---

- [2026-08-13] Xong: **Rà soát navigation toàn diện** — fix Settings deep-link dead end (thêm `hasHistory` + back pill "← Back to library", giống Detail); dọn import `router` thừa trong `fill.tsx`/`edit.tsx`; `favorites.tsx` đổi `router.navigate('/(tabs)')` → `router.navigate('/')` (route thật, tránh warning không resolve). Xác nhận: mọi chỗ quay về đều dùng `safeBack()` (không có `router.back()` trực tiếp ngoài lib/navigation), web export không warning, 176/176 tests + tsc clean.

- [2026-08-13] Xong: **Test cooldown ads** — thêm `__tests__/adsCooldown.test.ts` (5 test) phủ `AppOpenAdManager.tryShow`: skip 30s sau cold start, tối đa 1 app open/3 phút, không stack lên interstitial vừa hiện, failed show không tiêu throttle, chưa load → false. Mock AdMob phát LOADED/CLOSED + fake timers (`jest.setSystemTime`). Full suite 176/176, tsc clean.

- [2026-08-12] Xong: **In-app Guidance & Onboarding** (task lớn) — `lib/onboarding/` (types, placement, storage, context, overlay), components `FeatureBadge`/`Tooltip`/`DisabledStateHelper`, wire vào root layout + tabs layout (first-run tour Search→FAB→Tabs) + Settings + PromptForm. OpenSpec change mới `add-in-app-guidance-onboarding` (planning complete, validate pass). 25 test mới, full suite 171/171, tsc clean.
- [2026-08-12] Xong: **Post-MVP build & ads config** — `TEST_ADS = true` trong `lib/config.ts` (mọi format dùng test unit IDs, skip consent gate khi test, sửa iOS app-open test ID, log lỗi load); `plugins/withCleartextTraffic.js` (HTTP mọi domain, áp dụng cả CI); xác nhận `targetSdkVersion 36`; fix 2 bug (sqlite `bulkInsert` duplicate-id guard, Detail toast 0-var "Copied!"). OpenSpec: cập nhật MVP change (spec ads TEST_ADS + tasks section 8 + design D9 đồng bộ interstitial 10→15).
- [2026-08-11] Xong: Khởi tạo hạ tầng phiên — tạo `AGENTS.md`, đọc `.plan/plan1_implementation_spec.md` v3 + toàn bộ openspec, xác nhận trạng thái MVP (mọi task `[x]` trừ 6.5, 146/146 tests, có APK local).

---

## Backlog / Việc chưa xong

- [ ] **6.5 Production build (EAS Build)**: chạy `eas build` chính thức cho Android (và iOS nếu có). APK local đã có nhưng được build trước các thay đổi mới (cleartext/ads/onboarding) → cần build lại để test.
- [ ] **Trước khi publish Play Store**: đổi `TEST_ADS = false` trong `lib/config.ts` + thay 4 iOS placeholder unit IDs bằng production IDs.
- [ ] `SectionHeader` là dead code (còn test nhưng không dùng sau khi đổi sang tab layout) — chờ quyết định xóa hay giữ.
