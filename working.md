# Working — Prompt Template Manager

Nhật ký làm việc — mỗi mục là gạch đầu dòng có ngày ISO `YYYY-MM-DD`. Dọn các mục đã xong quá 1–2 tuần (nội dung cũ đã có trong AgentMemory/ADR/openspec).

---

- [2026-08-13] Xong: **Fix ads/components bị che bởi system nav bar (edge-to-edge)** — targetSdk 36 bắt buộc edge-to-edge trên Android 15+ → mọi thanh `position: absolute; bottom: 0` nằm dưới system nav bar. Thêm `useSafeAreaInsets().bottom` cho: Detail `bottomBar` (banner + Edit/Delete), Fill `footer` (Cancel/Copy), Settings (bọc AdBanner), Import Preview `footer` (Cancel/Import). Tabs layout vốn đã đúng (dùng `insets.bottom`). Test import-preview bọc thêm `SafeAreaProvider` (expo-router cung cấp ở runtime). 176/176 tests + tsc clean.

- [2026-08-13] Xong: **Real-SQLite test + usePrompts catch** — thêm `__tests__/promptRepository.sqlite.test.ts` (4 test) chạy backend sqlite thật qua `node:sqlite` (mock `db/client.getDb` bằng adapter bắt chước expo-sqlite API). **Kết quả quan trọng: bug SQL ESCAPE (ghi trong backlog) là FALSE POSITIVE** — xác minh bằng `od -c` (file source có đúng 2 byte backslash → template literal tạo ra SQL `ESCAPE '\'` — đúng 1 ký tự, hợp lệ) + test thật chạy đúng; record cũ nhầm do JSON-escape transport khi đọc file. Search pipeline (normalize + escape `%`/`_` + ESCAPE + rank) xác nhận đúng trên SQLite thật. Bọc `catch` cho `usePrompts` effect search (clear results, không unhandled rejection) + thêm test fail-path. Full suite 181/181, tsc clean.

- [2026-08-13] Xong: **Rà soát navigation toàn diện** — fix Settings deep-link dead end (thêm `hasHistory` + back pill "← Back to library", giống Detail); dọn import `router` thừa trong `fill.tsx`/`edit.tsx`; `favorites.tsx` đổi `router.navigate('/(tabs)')` → `router.navigate('/')` (route thật, tránh warning không resolve). Xác nhận: mọi chỗ quay về đều dùng `safeBack()` (không có `router.back()` trực tiếp ngoài lib/navigation), web export không warning, 176/176 tests + tsc clean.

- [2026-08-13] Xong: **Test cooldown ads** — thêm `__tests__/adsCooldown.test.ts` (5 test) phủ `AppOpenAdManager.tryShow`: skip 30s sau cold start, tối đa 1 app open/3 phút, không stack lên interstitial vừa hiện, failed show không tiêu throttle, chưa load → false. Mock AdMob phát LOADED/CLOSED + fake timers (`jest.setSystemTime`). Full suite 176/176, tsc clean.

- [2026-08-12] Xong: **In-app Guidance & Onboarding** (task lớn) — `lib/onboarding/` (types, placement, storage, context, overlay), components `FeatureBadge`/`Tooltip`/`DisabledStateHelper`, wire vào root layout + tabs layout (first-run tour Search→FAB→Tabs) + Settings + PromptForm. OpenSpec change mới `add-in-app-guidance-onboarding` (planning complete, validate pass). 25 test mới, full suite 171/171, tsc clean.
- [2026-08-12] Xong: **Post-MVP build & ads config** — `TEST_ADS = true` trong `lib/config.ts` (mọi format dùng test unit IDs, skip consent gate khi test, sửa iOS app-open test ID, log lỗi load); `plugins/withCleartextTraffic.js` (HTTP mọi domain, áp dụng cả CI); xác nhận `targetSdkVersion 36`; fix 2 bug (sqlite `bulkInsert` duplicate-id guard, Detail toast 0-var "Copied!"). OpenSpec: cập nhật MVP change (spec ads TEST_ADS + tasks section 8 + design D9 đồng bộ interstitial 10→15).
- [2026-08-11] Xong: Khởi tạo hạ tầng phiên — tạo `AGENTS.md`, đọc `.plan/plan1_implementation_spec.md` v3 + toàn bộ openspec, xác nhận trạng thái MVP (mọi task `[x]` trừ 6.5, 146/146 tests, có APK local).

- [2026-08-13] Xong: **Cập nhật OpenSpec** cho khớp thực tế — tasks.md: 6.5 đổi từ "EAS Build" → GH Actions (`build-apk.yml` verified success ×2) + thêm section 9 (signed AAB workflow + `withReleaseSigning` plugin no-op, keystore gitignored & bí mật giữ ngoài repo, privacy policy trên gh-pages, `chplay.md` store listing); design.md: mitigation "EAS Build used for production" → GH Actions gradle. `openspec validate --all` pass.
- [2026-08-13] Xong: **Tạo `.project/`** — `ai-rules.md` (quy tắc làm việc AI, chắt lọc từ operating_rules + AGENTS.md) + `session-2026-08-13.md` (ghi chú phiên đầy đủ: privacy/gh-pages, code review, nav fixes, ads cooldown test, GH Actions APK/AAB, keystore, chplay, openspec).

---

## Backlog / Việc chưa xong

~~- [ ] 🔴 HIGH — Fix bug SQL ESCAPE~~ → **ĐÃ ĐÓNG: false positive** (xác minh `od -c` + real-SQLite test 2026-08-13 — file luôn có `ESCAPE '\\'` source = 1 backslash SQL, hợp lệ). Thay vào đó: real-SQLite test suite đã thêm (`promptRepository.sqlite.test.ts`) để khóa behavior này mãi mãi + `usePrompts` đã bọc catch.
- [ ] **AAB signed build** (workflow `build-aab.yml`) đang chạy lần đầu trên GH Actions — verify artifact + nộp Play Console với Play App Signing.
- [ ] **Commit `chplay.md`** (store listing draft, chưa push) — và cập nhật openspec 9.5 khi xong.
- [ ] **Trước khi publish Play Store**: đổi `TEST_ADS = false` trong `lib/config.ts` + thay 4 iOS placeholder unit IDs bằng production IDs.
- [ ] `SectionHeader` là dead code (còn test nhưng không dùng sau khi đổi sang tab layout) — chờ quyết định xóa hay giữ.
