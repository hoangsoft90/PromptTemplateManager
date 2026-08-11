# 🤖 Build APK bằng GitHub Actions (miễn phí, không cần EAS)

> **Trả lời nhanh: CÓ — hướng này hoàn toàn OK và là lựa chọn tốt** khi bạn muốn build APK
> để test nhanh trên máy thật mà không phụ thuộc vào EAS cloud (đang bị kẹt queue trên
> free tier) và không cần EXPO_TOKEN / tài khoản trả phí.
>
> Luồng: **GitHub Actions runner** → `expo prebuild` (tạo project native từ `app.json`) →
> `./gradlew assembleRelease` → upload APK lên **Artifacts** → bạn tải về cài lên máy.

---

## 1. Có nên dùng GitHub Actions không?

| Tiêu chí | GitHub Actions | EAS Build (cloud) |
|---|---|---|
| Chi phí | Miễn phí (repo **public**); repo private có 2.000 phút/tháng gói free | Free tier bị **xếp hàng chờ rất lâu** (đang kẹt `IN_QUEUE` ~30 phút+ chưa chạy) |
| Cần tài khoản | Chỉ cần GitHub account | Cần tài khoản Expo + token |
| Tự động mỗi lần push | ✅ (cấu hình trigger) | Phải chạy lệnh tay |
| APK ký bằng | **Debug keystore** (cài tay/test được) | Keystore riêng (có thể nộp store) |
| Nộp Play Store | ❌ (không tạo AAB + Play App Signing) | ✅ (`--profile production` → AAB) |

👉 **Kết luận**: dùng GitHub Actions để **build APK test**, đặc biệt lúc này (EAS free đang kẹt
queue). Khi nộp store vẫn dùng **EAS production** (tạo AAB + quản lý keystore + Play App Signing).

---

## 2. Điều kiện cần

- [ ] Repo đã push lên **GitHub** (workflow chỉ chạy khi repo nằm trên GitHub).
      ```bash
      git remote add origin git@github.com:<user>/prompt-template-manager.git
      git push -u origin main
      ```
- [ ] `google-services.json` **đã commit** (bắt buộc để prebuild gắn AdMob/Firebase) — ✅ đã có.
- [ ] `android/` **không commit** (đang gitignored — CI tự prebuild lại) — ✅ đúng.
- [ ] **Không cần secret nào** vì bản này ký bằng debug keystore (chỉ để test).

---

## 3. Workflow YAML (copy nguyên block này)

Tạo file `.github/workflows/build-apk.yml` trong repo:

```yaml
name: Build Android APK

on:
  workflow_dispatch:            # bấm nút "Run workflow" trong tab Actions để build thủ công
  push:
    branches: [main]            # hoặc bỏ nếu chỉ muốn build thủ công

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Setup Java (JDK 17 — bắt buộc cho Expo SDK 57 / RN 0.86)
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Setup Android SDK (nhận license + đủ build-tools)
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: npm ci

      - name: Generate native project (expo prebuild)
        run: npx expo prebuild --platform android --clean --no-install
        env:
          CI: '1'

      - name: Build release APK
        working-directory: android
        run: ./gradlew assembleRelease

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: prompt-template-manager-apk
          path: android/app/build/outputs/apk/release/app-release.apk
          if-no-files-found: error
```

> 💡 **Giải thích ngắn**
> - `expo prebuild --clean` sinh lại `android/` từ `app.json` (plugins AdMob, google-services.json,
>   proguard rule consent…) — chạy mỗi lần build nên không sợ "native cũ".
> - `assembleRelease` build **release APK** → `__DEV__ = false` → dùng **ad unit ID thật**
>   (banner/interstitial/rewarded/app-open real). Đúng thứ bạn cần kiểm tra.
> - APK được ký bằng **debug keystore** (mặc định của template) — cài tay lên máy thoải mái,
>   **không nộp Play Store** với key này.
> - Build lần đầu mất **~15–25 phút** (tải dependencies). Lần sau nhanh hơn nhờ Gradle cache
>   (thêm `gradle/gradle-build-action@v3` nếu muốn cache).

---

## 4. Cách lấy APK sau khi build

1. Mở repo trên GitHub → tab **Actions** → chọn workflow **"Build Android APK"**.
2. Vào run vừa chạy → kéo xuống mục **Artifacts** → tải `prompt-template-manager-apk`.
3. Giải nén → được `app-release.apk`.
4. Copy sang máy Android → bấm mở → cho phép **"Install unknown apps"** (hoặc `adb install -r app-release.apk` nếu cắm USB).

---

## 5. Checklist kiểm tra ads trên máy thật (bản release này)

> ⚠️ Bản **release** dùng **real ad IDs** → sẽ **không thấy chữ "Test Ad"**. AdMob chỉ trả
> ads thật. Nếu app mới đăng ký AdMob, ads có thể **chưa fill ngay** (1–2 ngày).

- [ ] Mở app → banner đáy Home/Settings/Detail hiện (nếu có ads fill).
- [ ] Copy 10 lần → dialog "Want fewer ads?" → chọn **Watch ad** → rewarded hiện.
- [ ] **Không thấy banner/ads?** → không phải lỗi code, nhiều khả năng do:
  - App AdMob mới chưa kích hoạt / chưa fill → chờ 1–2 ngày, theo dõi **AdMob console**.
  - Cách xác minh pipeline mà vẫn dùng bản này: vào **AdMob console → Privacy & messaging →
    Test devices** → thêm **device ID** của máy bạn (lấy trong log `Ad request`/`Test ad`) →
    máy đó sẽ nhận ads test ("Test Ad") dù dùng unit ID thật.
  - Xem log: `adb logcat | grep -iE "adrequest|admob|ump|consent"` để biết SDK có request không.
- [ ] Consent UMP: Việt Nam **ngoài EEA** → không hiện form consent (đúng). Nếu muốn test form,
      xem guide ở phần consent flow.

---

## 6. Lưu ý & hạn chế

- **Chỉ để test**: APK ký debug key → khi lên store phải build lại qua **EAS production** (AAB).
- **Runner minutes**: repo private gói free chỉ có 2.000 phút/tháng (1 build ~20 phút). Repo
  public thì **miễn phí không giới hạn**.
- **Không commit keystore/secret** vào repo. Bản này không cần vì dùng debug key.
- Nếu sau này cần **AAB + ký đúng** trong GH Actions: dùng `eas build --local --profile
  production` (cần `EXPO_TOKEN` đặt trong **GitHub Secrets**) — nhưng đơn giản nhất vẫn là
  `eas build` cloud cho bản store.

---

## 7. Tình trạng build EAS đang chạy (thời điểm viết)

- Một build EAS Android (`preview`, id `7a05a009-…`) đã gửi từ máy này nhưng đang **kẹt
  `IN_QUEUE`** trên free tier.
- Tùy chọn: để nó chạy xong làm phương án dự phòng (APK tải từ link EAS), hoặc hủy:
  ```bash
  npx eas-cli build:cancel 7a05a009-9a09-42b4-95d9-20c38fea635d
  ```
- Sau khi dùng xong, nên **thu hồi EXPO_TOKEN** đã dán trong chat (expo.dev → Account →
  Access Tokens → Revoke) vì token đã lộ trong hội thoại.

---

*Cập nhật: 2026-08-11 · Project: Prompt Template Manager (Expo SDK 57) · AdMob real IDs + UMP consent đã cấu hình.*
