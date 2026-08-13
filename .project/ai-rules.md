# AI Rules — Prompt Template Manager

Quy tắc làm việc của AI agent trong project này. **Đọc file này trước mọi phiên làm việc mới** và tuân thủ. Nó chắt lọc từ `AGENTS.md` (hạ tầng retrieval/memory chung) + `operating_rules.md` (rule kỹ thuật riêng) — hai file kia vẫn là nguồn chi tiết, file này là checklist hành động.

## 1. Trước khi bắt đầu phiên

1. Đọc tuần tự: `context.md` → `working.md` → `operating_rules.md` → `AGENTS.md` (nếu chưa có trong context).
2. Xem `openspec/changes/` — nếu có change đang mở, đọc `proposal.md`/`tasks.md` trước khi code.
3. Kiểm tra `git status` — xác định trạng thái chưa commit của phiên trước.

## 2. Trong khi làm việc

4. **Data layer**: mọi truy cập data qua `db/promptRepository` — không chạm SQL từ screen/hook. Non-DB pref qua `app_meta`, không AsyncStorage/MMKV.
5. **Native/Android**: không sửa `android/` trực tiếp (bị `expo prebuild` regenerate) — dùng config plugin trong `plugins/` + đăng ký `app.json`.
6. **Ads**: giữ `TEST_ADS = true` khi test; **phải đổi `false` + thay 4 iOS placeholder unit IDs trước khi publish** (mục tiêu kiếm tiền). Mọi ad call bọc try/catch.
7. **Onboarding components** (`Tooltip`/`DisabledStateHelper`/`FeatureBadge`) phải passthrough khi không có `OnboardingProvider`.
8. Trước khi báo "hoàn thành": `tsc --noEmit` + Jest (tối thiểu test liên quan) + `openspec validate --all` nếu đụng spec.

## 3. Build & Release (đã chốt)

9. **Build qua GitHub Actions, KHÔNG dùng EAS token**:
   - APK: `.github/workflows/build-apk.yml` (`expo prebuild --clean` + `gradle assembleRelease`)
   - AAB (Play Store): `.github/workflows/build-aab.yml` (`gradle bundleRelease`, keystore từ GitHub Secrets — `KEYSTORE_BASE64`/passwords/alias)
10. Release signing qua config plugin `plugins/withReleaseSigning.js` — no-op khi không có env signing (debug build an toàn). Keystore (`*.keystore`) **gitignored, không bao giờ commit/push**; mật khẩu không ghi vào file memory/skill.
11. Giữ `targetSdkVersion: 36` (Google Play yêu cầu API 36 từ 31/8/2026).

## 4. Bảo mật

12. **Tuyệt đối không lưu secret** (API key, token, password, keystore password, `.env` values) vào bất kỳ file nào được commit: memory files, openspec, skill, `.project/`. Chỉ ghi TÊN biến môi trường.
13. GitHub token (`ghp_...`) chỉ dùng qua env tạm thời lúc chạy lệnh — không lưu vào config git hay file.

## 5. Kết thúc phiên (bắt buộc)

14. Cập nhật ghi chú phiên vào `.project/session-YYYY-MM-DD.md` (danh sách thay đổi + quyết định + việc còn dang dở).
15. Cập nhật `working.md` (nhật ký ngắn, ISO date; dọn mục cũ >1-2 tuần).
16. Nếu có quyết định kiến trúc chính thức: tạo/update ADR (qua `manage_adr`).
17. Nếu task lớn (≥3 file / schema/API / OpenSpec có task riêng): chạy Code Review trước khi commit, rồi commit theo Conventional Commits. Task nhỏ sửa trực tiếp, không cần hook đầy đủ.

## 6. Quy ước

- Ngôn ngữ ghi chú: tiếng Việt (file nội bộ), code/UI copy: tiếng Anh.
- Ngày tháng format ISO `YYYY-MM-DD`.
- File nào cần đọc khi nghi ngờ: `.plan/plan1_implementation_spec.md` (source of truth gốc), `.draft/` (hướng dẫn build), `openspec/` (spec/design).
