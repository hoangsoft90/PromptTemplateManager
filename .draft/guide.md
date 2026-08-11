# 📱 Prompt Template Manager — Hướng dẫn xuất bản Play Store & App Store

> Tài liệu này là **to-do checklist dành cho con người**. Mọi việc AI làm được đã làm xong
> (code, icon, AdMob SDK, test IDs, bundle web/android đều pass). Những mục dưới đây cần
> **tài khoản, tiền, thông tin cá nhân và quyết định kinh doanh** của bạn.

---

## 0. Trạng thái hiện tại của project (AI đã làm xong ✅)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| App code (MVP đầy đủ) | ✅ | Search → Fill → Copy, import/export, favorites, recent, backup, 8 samples |
| Icon & splash | ✅ | `assets/icon.png` (1024² gradient indigo + glyph `{{ }}`), adaptive icon, monochrome, favicon — đã verify pixel |
| AdMob SDK | ✅ | `react-native-google-mobile-ads@16.4.0`, config plugin trong `app.json` |
| Banner | ✅ | Neo đáy **Home + Settings + Detail**, adaptive |
| Interstitial | ✅ | Sau **mỗi 10 lần copy** (`AD_FREQUENCY_COPY = 10`) |
| App Open | ✅ | Khi app quay lại từ background (không hiện lúc mới mở); tối đa 1 lần/3 phút, không chồng lên interstitial |
| Rewarded + Shield | ✅ | Xem rewarded (~30s) → miễn interstitial **20 lần copy**; chỉ thưởng khi `EARNED_REWARD` |
| Non-personalized ads | ✅ | `requestNonPersonalizedAdsOnly: true` — không cần form consent GDPR |
| Web-safe | ✅ | Metro alias `stubs/react-native-google-mobile-ads.web.js`, web chạy không lỗi |
| Unit tests | ✅ | 28/28 pass · `tsc --noEmit` sạch · Android + Web bundle OK |

**Đang dùng TEST IDs** (Google test: `ca-app-pub-3940256099942544/...`) — app chạy được, hiện
quảng cáo test, **NHƯNG KHÔNG KIẾM TIỀN**. Phải thay bằng ID thật (Phần 1).

---

## 1. 🧾 Checklist Setup AdMob (test → production)

### 1.1 Tạo tài khoản & đăng ký app

- [ ] Đăng ký tài khoản Google AdMob tại <https://admob.google.com> (dùng Gmail chính — không đổi được sau này).
- [ ] Vào **Apps → Add app**: chọn **"App is already in Google Play / App Store"** nếu có, ngược lại **"Add manually"** (chưa có listing) → nhập tên app **Prompt Template Manager** + nền tảng.
- [ ] **Tạo 2 app riêng**: 1 cho **Android**, 1 cho **iOS** (AdMob coi mỗi nền tảng là 1 app).
- [ ] Với mỗi app, copy **App ID** (dạng `ca-app-pub-xxxxxxxxxxxx~yyyyyyyyyy`) → cất vào chỗ an toàn.

### 1.2 Tạo 6 Ad Unit ID

Với mỗi app (Android + iOS), vào **App → Ad units → Create ad unit**:

| # | Định dạng | Tên gợi ý | Dùng cho |
|---|---|---|---|
| 1 | **Banner** (adaptive) | `Banner_Home_Android` | Đáy màn Home |
| 2 | **Interstitial** | `Interstitial_Copy_Android` | Sau 15 lần copy |
| 3 | **Rewarded** | `Rewarded_Shield_Android` | Xem ad → shield 20 copy |
| 4 | **App Open** | `AppOpen_Android` | Mở lại app (background → foreground) |

→ Lặp lại cho iOS: tổng cộng **8 ad unit** (4 Android + 4 iOS).

### 1.3 Thay IDs vào code (bước DUY NHẤT cần sửa code)

Mở **`app.json`** → thay 2 chỗ (App ID):

```jsonc
"react-native-google-mobile-ads": {
  "androidAppId": "ca-app-pub-<THAY_THẬT>~<THAY_THẬT>",  // App ID app Android
  "iosAppId":     "ca-app-pub-<THAY_THẬT>~<THAY_THẬT>"   // App ID app iOS
}
```

Mở **`lib/ads.ts`** → thay 6 chỗ trong `AD_UNIT_IDS`:

```ts
export const AD_UNIT_IDS = {
  bannerAndroid:       'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #1 Android
  bannerIos:           'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #1 iOS
  interstitialAndroid: 'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #2 Android
  interstitialIos:     'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #2 iOS
  rewardedAndroid:     'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #3 Android
  rewardedIos:         'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #3 iOS
  appOpenAndroid:      'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #4 Android
  appOpenIos:          'ca-app-pub-<PUB>/<ADUNIT>', // Ad unit #4 iOS
};
```

> ⚠️ **Lưu ý quan trọng**: sau khi đổi App ID sang ID thật, **test ads sẽ không còn hiện**
> (AdMob chỉ phục vụ ads thật). Cách test trước khi lên store: giữ test IDs, build, xác minh
> banner/interstitial/rewarded hiện **"Test Ad"**, rồi mới đổi sang ID thật cho bản production.

### 1.4 Xác minh test ads

- [ ] Build dev (Phần 2), mở Home → banner đáy phải hiện **"Test Ad"**.
- [ ] Copy 10 lần (hoặc bấm **Watch a short ad** trong Settings) → dialog **"Want fewer ads?"** xuất hiện.
- [ ] Chọn **Watch ad** → rewarded test hiện → xem hết → Settings hiển thị shield **20**.
- [ ] Copy liên tục → shield giảm dần, interstitial **không** hiện khi còn shield.
- [ ] Copy thêm đến ngưỡng → interstitial test hiện.

---

## 2. 🔧 Build & chạy trên Android device

> **Bắt buộc**: AdMob là native module → **KHÔNG chạy trong Expo Go**. Cần dev build hoặc EAS Build.

### 2.1 Yêu cầu máy

| Công cụ | Cần cho | Hướng dẫn |
|---|---|---|
| Node.js ≥ 20 | mọi thứ | đã có |
| Android Studio + SDK | chạy trên máy | <https://developer.android.com/studio> |
| Android device (bật **Developer options → USB debugging**) | test thật | bật bằng cách bấm 7 lần vào "Build number" |
| Tài khoản Expo/EAS | build cloud + APK | `npx eas-cli login` |

### 2.2 Cách 1 — Dev build local (nhanh nhất để test, debug)

```bash
cd /home/hoangweb24/htdocs_apps/PromptTemplateManager

# (BẮT BUỘC trước khi build lần đầu — xem mục 2.4)
npx expo prebuild --platform android

# Cài app lên device đang cắm (USB) và chạy:
npx expo run:android
```

- Bản này là **debug**, chạy được ads test, gõ lệnh reload nhanh.
- Nếu máy chưa có Android SDK: cài Android Studio → mở SDK Manager → cài "Android SDK Platform 36" + "Build-Tools".

### 2.3 Cách 2 — EAS Build (release APK/AAB, chạy cả khi không có Android Studio)

```bash
cd /home/hoangweb24/htdocs_apps/PromptTemplateManager
npx eas-cli login                 # đăng nhập tài khoản Expo
npx eas-cli build:configure       # tạo eas.json (chọn Android nếu hỏi)
npx eas-cli build --platform android --profile preview   # → APK (cài tay, test)
npx eas-cli build --platform android --profile production # → AAB (nộp Play Store)
```

- Lần đầu EAS sẽ hỏi tạo **Android keystore** → chọn **Yes** (EAS quản lý, backup key để dành).
- File tải về: `.apk` (preview) / `.aab` (production) — link tải ở cuối log build.

### 2.4 ⚠️ Bước bắt buộc trước khi build: đặt Bundle ID / Package name

Project **chưa có** `android.package` và `ios.bundleIdentifier`. Đây là **ID vĩnh viễn**, không đổi
được sau khi lên store. Thêm vào `app.json`:

```jsonc
{
  "expo": {
    "android": { "package": "com.<tenban>.prompttemplate" },
    "ios":     { "bundleIdentifier": "com.<tenban>.prompttemplate" }
  }
}
```

> Gợi ý: `com.hoangweb.prompttemplate` (đổi theo tên miền bạn sở hữu). Cùng 1 ID cho cả 2 nền tảng.

### 2.5 Cài APK lên device

```bash
adb install -r path/to/app.apk    # device cắm USB (Developer options ON)
# hoặc: copy file APK sang máy → bấm mở → cho phép "Install unknown apps"
```

### 2.6 Test round-trip trên device

- [ ] Mở app → 8 mẫu seed hiện → tạo prompt mới → xuất hiện trong list.
- [ ] Search tiếng Việt: "ca phe" → tìm thấy "Cà phê".
- [ ] Fill & Copy → paste ra app khác (Zalo/Messenger/Gmail) → đúng template.
- [ ] Import/export file JSON.
- [ ] Ads: banner đáy Home/Settings/Detail hiện "Test Ad" → 10 copy → dialog rewarded/interstitial → tắt app rồi mở lại → App Open "Test Ad" (nếu đã qua 3 phút).

---

## 3. 🏪 Xuất bản Google Play (việc con người — ~2–3 ngày chờ review)

### 3.1 Tài khoản & chuẩn bị

- [ ] Trả **$25** đăng ký Google Play Developer: <https://play.google.com/console>
- [ ] Xác minh danh tính (có thể cần CMND/hộ chiếu) + đồng ý chính sách.
- [ ] **Viết Privacy Policy** (bắt buộc vì có ads): nêu rõ dùng AdMob, quảng cáo **không cá nhân hóa**,
      không thu thập dữ liệu nhạy cảm. Có thể dùng generator miễn phí (vd: freeprivacypolicy.com)
      và host lên GitHub Pages/Notion công khai → copy URL.

### 3.2 Tạo app & khai báo trong Play Console

- [ ] **Create app** → tên: `Prompt Template Manager`, ngôn ngữ, **Free**, app category (Productivity/Tools).
- [ ] **Tích vào "Contains ads"** (bắt buộc — không khai là bị gỡ).
- [ ] **Data safety form**: khai báo quảng cáo (Ads = Yes), không thu thập dữ liệu cá nhân (vì non-personalized);
      chia sẻ dữ liệu với bên thứ 3: chỉ "Advertising" — data type: "Device or other IDs".
- [ ] **Content rating**: trả lời bảng câu hỏi (app này → Everyone / Everyone 10+).
- [ ] **Target audience**: 18+ trở lên nếu có ads (hoặc chọn theo nội dung + bật ads).
- [ ] **App access**: mọi tính năng miễn phí, không cần đăng nhập → "All functionality is available without login".
- [ ] **Ads declaration** trong store listing.
- [ ] Upload **screenshots** (tối thiểu 2, khuyến nghị 8: 6.5" và 5.5"), **icon** (dùng `assets/icon.png`),
      **feature graphic** (1024×500 — tạo từ icon/gradient), **short & full description**.
- [ ] Set **Release tracks**: Production / Beta (Open/Closed testing). Gợi ý: nộp **Closed/Open testing trước**
      → review nhanh hơn rồi promote lên Production.

### 3.3 Nộp AAB & review

- [ ] Build AAB: `npx eas-cli build --platform android --profile production` (sau khi đã đổi real IDs).
- [ ] **App signing**: Play Console → Setup → App signing → chọn **Google Play App Signing** (mặc định, khuyên dùng);
      upload keystore EAS nếu được yêu cầu.
- [ ] Upload `.aab` vào **Production → Create new release** → điền release notes.
- [ ] Bấm **Send for review** → Google kiểm duyệt (~vài giờ đến 7 ngày, lần đầu lâu hơn).
- [ ] Nếu bị từ chối: đọc lý do trong email/console, sửa và nộp lại.

### 3.4 Sau khi lên Play

- [ ] Vào AdMob console → app Android → **App status: Live** → ads bắt đầu chạy thật (thường 1–2 ngày để lấp đầy).
- [ ] Theo dõi **AdMob dashboard**: eCPM, fill rate, earnings; tắt banner nếu CTR thấp làm giảm trải nghiệm.

---

## 4. 🍎 Xuất bản App Store (iOS — việc con người)

> Cần máy **macOS** để build iOS (hoặc dùng **EAS Build cloud** — chạy trên Mac của Expo, không cần máy Mac).

### 4.1 Tài khoản & chuẩn bị

- [ ] Trả **$99/năm** đăng ký **Apple Developer Program**: <https://developer.apple.com/programs/>
- [ ] Kích hoạt tài khoản (có thể mất vài ngày — đăng ký **sớm**).
- [ ] Chuẩn bị **Privacy Policy URL** (dùng chung với bản Android).

### 4.2 Cấu hình App Store Connect

- [ ] Vào <https://appstoreconnect.apple.com> → **My Apps → + → New App** → chọn bundle ID đã đặt
      (đảm bảo `ios.bundleIdentifier` trong `app.json` khớp).
- [ ] Điền metadata: tên, subtitle, mô tả, từ khóa, category, **Content Rights**, **Rating**.
- [ ] **App Privacy** (bắt buộc): vào **App Privacy → Data Collection**:
  - [ ] **Advertising** = Yes (third-party ads: AdMob)
  - [ ] Data type: "**Device ID**" (IDFA) — purpose "Third-Party Advertising" + "Analytics"
  - [ ] Vì dùng **non-personalized ads** (`requestNonPersonalizedAdsOnly`), có thể chọn
        **"tracking = No"** → **không cần hiện ATT prompt** (đơn giản hơn nhiều).
- [ ] Upload screenshots: bắt buộc **6.9" (iPhone 16 Pro Max)** + **6.5"** hoặc theo máy bạn chụp được;
      icon 1024² (dùng `assets/icon.png`).
- [ ] Tạo **App Review information**: thông tin liên hệ + ghi chú "This app uses AdMob non-personalized ads; test account not required".

### 4.3 Build & upload iOS

```bash
cd /home/hoangweb24/htdocs_apps/PromptTemplateManager
npx eas-cli build --platform ios --profile production   # chạy trên Mac cloud của Expo
```

- [ ] Lần đầu EAS hỏi tạo **Apple Distribution Certificate** → **Yes** (EAS quản lý).
- [ ] Tải `.ipa` về hoặc để EAS upload thẳng lên App Store Connect.

### 4.4 TestFlight & submit

- [ ] Trong App Store Connect → **TestFlight** → thêm **App Store Connect Users** (email Apple ID) để test nội bộ.
- [ ] Mời 1–2 máy test → cài app qua TestFlight → kiểm tra vòng lặp copy + ads thật (đã đổi real IDs).
- [ ] **Submit for Review**: chọn bản build → điền "Export Compliance" (không dùng mã hóa → chọn exception
      nếu phù hợp) → bấm **Submit**.
- [ ] Review thường 1–2 ngày. Nếu bị từ chối vì ads: bổ sung ghi chú hoặc kiểm tra khai báo Privacy.

### 4.5 Sau khi lên App Store

- [ ] AdMob console → app iOS → **Live** → ads chạy.
- [ ] Lưu ý: iOS eCPM thường **cao hơn Android** (đặc biệt US/EU) → theo dõi để tối ưu tần suất.

---

## 5. ✅ Checklist tổng trước khi nộp lên store

| # | Việc | Phần |
|---|---|---|
| 1 | Đặt `android.package` + `ios.bundleIdentifier` trong `app.json` | 2.4 |
| 2 | Tài khoản AdMob + 2 app + 6 ad unit ID thật | 1.1–1.2 |
| 3 | Thay App IDs (app.json) + 6 ad unit (lib/ads.ts) | 1.3 |
| 4 | Test ads thật trên device (dev build / preview APK) | 2.6 |
| 5 | Privacy Policy URL công khai | 3.1 / 4.1 |
| 6 | Khai báo **Contains ads** / **Advertising** trong cả 2 console | 3.2 / 4.2 |
| 7 | Data safety (Play) + App Privacy (Apple) — non-personalized, no tracking | 3.2 / 4.2 |
| 8 | Screenshots + icon + description (tiếng Việt + tiếng Anh khuyến nghị) | 3.2 / 4.2 |
| 9 | Build production AAB + IPA với **real ad IDs** | 2.3 / 4.3 |
| 10 | Nộp review Play + Apple | 3.3 / 4.4 |

### 🔒 Chính sách Google cần nhớ (vi phạm = gỡ app + khóa AdMob)

- Không tự bấm ads / không khuyến khích người dùng bấm ads (cấm ghi "tap ads to support us").
- Không lạm dụng interstitial (đã cài 15 copy/lần + shield 20 — an toàn).
- Nội dung app sạch sẽ (không spam, không nội dung người lớn).
- Privacy Policy phải nêu đúng việc dùng AdMob.

---

## 6. 📈 Sau khi lên store (tuần đầu)

- [ ] Theo dõi AdMob dashboard mỗi ngày: **Match rate**, **eCPM**, **earnings**.
- [ ] Theo dõi Play Console / App Store Connect: crash reports (Crashlytics khuyến nghị thêm).
- [ ] Đọc review người dùng → cải thiện: tần suất interstitial, vị trí banner, thêm mẫu prompt mới.
- [ ] Xem xét: đổi `AD_FREQUENCY_COPY` (10) và `SHIELD_COPIES` (20) nếu tỉ lệ xem rewarded thấp.

---

*Cập nhật lần cuối: 2026-08-10 · Project: Prompt Template Manager (Expo SDK 57) · Test IDs đang hoạt động, real IDs cần thay trước khi build production.*
