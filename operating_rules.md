# Operating Rules — Prompt Template Manager

Rule RIÊNG của project này (không lặp lại nội dung đã có trong `AGENTS.md` hoặc `CLAUDE.md`).

## Dữ liệu & Storage

1. Mọi non-DB pref phải qua bảng `app_meta` (`getAppMeta`/`setAppMeta` từ `db/promptRepository`) — không thêm AsyncStorage/MMKV.
2. Mọi truy cập SQLite phải qua `db/promptRepository` — screen/hook tuyệt đối không chạm SQL trực tiếp.
3. Key `app_meta` dùng prefix có nghĩa, namespaced rõ ràng (vd: `onboarding:tooltip:<id>:seen`, `samples_loaded`, `ad_copy_count`) — tránh trùng lặp.

## Ads (AdMob)

4. `lib/config.ts` `TEST_ADS = true` → mọi format dùng Google test unit IDs + bỏ qua consent gate. **Phải đổi về `false` trước khi publish**.
5. iOS unit IDs hiện là placeholder (test IDs) — phải thay bằng production IDs thật trước khi submit App Store.
6. Mọi ad call phải bọc try/catch — ads không bao giờ được làm hỏng app; web = stub, không ads.

## Build & Native

7. Không sửa trực tiếp thư mục `android/` — nó bị `expo prebuild` regenerate. Thay đổi native phải là config plugin trong `plugins/` (vd: `withAdsPlayServicesFix.js`, `withCleartextTraffic.js`) và đăng ký trong `app.json`.
8. Giữ `compileSdkVersion: 36` / `targetSdkVersion: 36` (Google Play yêu cầu API 36 từ 31/8/2026).
9. Cleartext HTTP đang mở cho **mọi domain** (`network_security_config.xml` base-config) — đây là quyết định cố ý (app 100% on-device); nếu sau này kết nối server thật phải siết lại danh sách domain.

## Onboarding / In-app Guidance

10. Tooltip hiện đúng 1 lần/install — không spam khi lặp action. Tour chạy 1 lần, resume ở bước dở dang, Skip = kết thúc vĩnh viễn.
11. `DisabledStateHelper`/`Tooltip` phải hoạt động (passthrough) khi không có `OnboardingProvider` — không crash screen render standalone.
12. Storage keys của onboarding đều bắt đầu bằng `onboarding:` — không đặt key khác.

## Test

13. Test tối thiểu bắt buộc cho mọi thay đổi logic — không bao giờ bỏ qua dù thay đổi nhỏ.
14. RN jest View mock có `measureInWindow` no-op (callback không bao giờ chạy) — code đo kích thước phải có safety timeout; test dùng fake timers để advance.
15. Chạy `tsc --noEmit` + full Jest trước khi kết luận "hoàn thành".
