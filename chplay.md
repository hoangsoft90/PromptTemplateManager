# 🏪 Google Play Console — Hồ sơ đăng tải Prompt Template Manager

> Tài liệu đầy đủ thông tin để điền lên **Google Play Console**. Nội dung store listing (App Name / Short / Full Description) viết bằng **tiếng Anh** — chuẩn ASO, đúng ngôn ngữ UI của app, tiếp cận thị trường global để tối ưu AdMob revenue. Phần hướng dẫn/checklist viết tiếng Việt.

**Thông tin thật của app** (đã xác minh từ codebase, không bịa):

| Mục | Giá trị |
|---|---|
| Tên app | Prompt Template Manager |
| Package | `com.hoangweb.prompttemplate` |
| Chức năng chính | Thư viện prompt template cá nhân 100% on-device: Search → Fill (nếu có biến) → Copy |
| Đối tượng | AI power users, dân văn phòng, dev, nhà sáng tạo nội dung — người thường xuyên gõ lặp lại prompt cho ChatGPT/Claude/Gemini |
| Privacy Policy | https://hoangsoft90.github.io/PromptTemplateManager/ |
| Email liên hệ | haibasoftware@gmail.com |
| Ads | AdMob, non-personalized only |
| Data | 100% on-device (SQLite local), không account, không backend, không cloud sync |

---

## 1. Main Store Listing

### App Name (≤ 30 ký tự)

```
Prompt Template Manager
```
*(23 ký tự — có chứa từ khóa "Template" + "Manager", đúng chuẩn ASO, dưới giới hạn 30)*

### Short Description (≤ 80 ký tự)

```
Reusable AI prompt library. Search, fill {{variables}}, copy — 100% on-device.
```
*(79 ký tự — đủ 3 từ khóa chính: prompt library, variables, on-device)*

### Full Description (≤ 4000 ký tự)

```
📝 Turn your repeated AI instructions into reusable prompt templates.

Stop typing the same long prompts over and over. Prompt Template Manager is a
private, 100% on-device library for the prompts you use most — built for
ChatGPT, Claude, Gemini and any AI tool you copy text into.

✨ How it works — Search → Fill → Copy in seconds:
• 🔍 Search without accents — type "da nang" and find "Đà Nẵng". Vietnamese
  diacritics are ignored automatically.
• 🧩 Fill & Copy — templates with {{variables}} become a simple form. Fill in
  your values once, tap copy, done.
• ⚡ Quick Copy — zero-variable prompts copy instantly with one tap.
• ⭐ Favorites & Recent — pin what matters, re-use what you use often.

🎁 Built for AI power users:
• 8 ready-made templates to start (Code Reviewer, Email Writer, Summarizer...)
• Create your own templates with {{variable}} syntax in seconds
• Live preview while you fill — see the final prompt before you copy
• Unfinished variable warnings so you never save a broken template
• Full-text search across titles and content

🔒 Your data stays yours:
• 100% on-device — no account, no sign-up, no cloud, no backend
• JSON backup & restore — export your library, import it on any device
• Your prompts never leave your device

📦 No subscriptions. No paywall. Free forever.

Download now and turn your best prompts into reusable templates.
```

*(~1.250 ký tự — dưới giới hạn 4000, đủ từ khóa: prompt, template, AI, copy, search, variables, on-device, backup)*

---

## 2. Store Settings

### Category

```
Productivity
```
*(Gợi ý: "Productivity" phù hợp nhất — tool cá nhân cho người làm việc; không chọn "Tools" vì cạnh tranh generic hơn)*

### 5 Tags (≤ 20 ký tự / tag)

```
prompt, template, ai, productivity, writing
```

| Tag | Lý do |
|---|---|
| `prompt` | Từ khóa chính của app |
| `template` | Từ khóa chính thứ 2 (có trong App Name) |
| `ai` | Đúng đối tượng AI power user |
| `productivity` | Khớp category, người tìm công cụ làm việc |
| `writing` | Nhóm use-case chính (email, content, blog) |

---

## 3. Graphics & Assets

### 4 Screenshots — Mẫu text / ý tưởng hiển thị

> Quy cách: tối thiểu 2 ảnh bắt buộc, khuyến nghị 4-8. Kích thước chuẩn Play: tối thiểu 320px, khuyến nghị **1080×1920 (9:16)** hoặc 1080×2340. Chụp từ máy thật hoặc simulator với nội dung gợi ý bên dưới. UI app hiện hỗ trợ light mode.

**Screenshot 1 — Home / Search (ấn tượng đầu tiên)**
- Màn hình: Home với search bar đang gõ "da nang"
- Kết quả: card "Đà Nẵng travel guide" hiện lên (chứng minh search không dấu)
- Overlay text: `Search without accents — "da nang" finds "Đà Nẵng"`

**Screenshot 2 — Fill & Copy (điểm khác biệt cốt lõi)**
- Màn hình: Fill & Copy với form các biến ({{tone}}, {{topic}}, {{recipient}}) đã điền sẵn
- Preview pane hiển thị prompt đã render hoàn chỉnh
- Overlay text: `Fill {{variables}} once → Copy the final prompt in seconds`

**Screenshot 3 — Template Editor (tạo template)**
- Màn hình: Editor với content chứa `{{variable}}` + nút Save
- Có thể thêm nút "Paste & Create"
- Overlay text: `Turn any repeated instruction into a reusable template`

**Screenshot 4 — Backup / Privacy (tạo niềm tin)**
- Màn hình: Settings với mục "Export backup"
- Overlay text: `100% on-device. Export & restore your library anytime — no account needed`

### Feature Graphic (1024×500)

✅ **Đã tạo sẵn** (đúng ý tưởng này):
- `marketing/feature-graphic.png` — **1024×500**, sẵn sàng upload thẳng lên Play Console
- `marketing/feature-graphic.svg` — bản nguồn (chỉnh sửa được, tái xuất PNG)

Thiết kế: nền gradient indigo (#4F46E5 → #6366F1, đúng màu primary), brand
block trái (logo {{ }} + tên app chữ trắng đậm), giữa là chuỗi loop vẽ vector
🔍 → {{ }} → ⧉ (search → fill → copy), tagline "Search • Fill • Copy —
100% on-device". Nội dung nằm gọn trong vùng an toàn trung tâm (không chạm
top 1/3 và bottom 1/4 theo guideline Play).

> Muốn đổi màu/chữ: sửa `marketing/feature-graphic.svg` rồi render lại bằng
> `sharp` (`node -e "require('sharp')('marketing/feature-graphic.svg').png().toFile('marketing/feature-graphic.png')"`).

### App Icon (512×512 — dùng chung cho Play)

✅ **Đã tạo sẵn** (scale từ `assets/icon.png` 1024² gradient indigo + glyph {{ }}):
- `marketing/icon.png` — **512×512**, sẵn sàng upload thẳng lên Play Console

---

## 4. App Content Checklist

Checklist ngắn các mục cần hoàn thành trên Play Console **trước khi nộp**:

```markdown
## Trước khi nộp — MUST (code)

- [ ] Đổi `TEST_ADS = false` trong `lib/config.ts` (đang true = test ads,
      KHÔNG kiếm tiền)
- [ ] Thay 4 iOS placeholder unit IDs bằng production IDs (nếu nộp iOS sau)
- [ ] Build production AAB: `npx eas-cli build --platform android --profile production`
      (workflow GH Actions chỉ tạo APK debug-signed — KHÔNG nộp APK này lên store)

## Play Console — Store listing

- [ ] App Name: "Prompt Template Manager"
- [ ] Short Description + Full Description (copy từ mục 1)
- [ ] Category: Productivity + 5 tags
- [ ] 4 Screenshots (1080×1920) + Feature Graphic (1024×500) + Icon
- [ ] Ngôn ngữ listing: English (thêm Vietnamese làm ngôn ngữ phụ nếu muốn)

## Play Console — App content (bắt buộc, sai = bị từ chối/gỡ)

- [ ] **Privacy Policy URL**: https://hoangsoft90.github.io/PromptTemplateManager/
      (đã host sẵn trên gh-pages — dán URL này vào)
- [ ] **Contains ads**: KHÔNG — tích "Yes, the app contains ads" (bắt buộc vì AdMob)
- [ ] **Data Safety form**:
      - Data collected: Device or other IDs (YES — AdMob dùng device identifiers)
      - Data shared: Device or other IDs (YES, với third-party = Google/AdMob,
        mục đích Advertising)
      - Không thu thập: vị trí, danh bạ, ảnh, âm thanh, tin nhắn, thông tin tài
        chính, y tế, tình dục, tương tác cá nhân...
      - Encryption: NO (không có truyền dữ liệu của user)
      - Data deletion: NO cơ chế web (data chỉ nằm trên thiết bị — ghi rõ trong
        mô tả Data Safety rằng user xóa bằng cách xóa app)
- [ ] **Content Rating**: trả lời questionnaire → dự kiến "Everyone" (không có
      nội dung nhạy cảm; nếu ads hiển thị nội dung đa dạng, có thể chọn
      "Everyone 10+" cho an toàn)
- [ ] **Target audience**: 18+ nếu có ads theo chính sách (hoặc chọn theo
      rating + khai ads)
- [ ] **App Access**: "All functionality is available without login" (app không
      có account)
- [ ] **Ads declaration**: khai AdMob, non-personalized

## Sau khi nộp

- [ ] Theo dõi AdMob console: eCPM, fill rate (1-2 ngày đầu có thể chưa fill)
- [ ] Kiểm tra crash reports (Play Console → Android vitals)
```

---

## Ghi chú thêm

- **Ads policy**: app dùng non-personalized ads (`requestNonPersonalizedAdsOnly: true`) — không cần GDPR consent form riêng, nhưng vẫn phải khai "Contains ads" + Data Safety.
- **targetSdkVersion 36**: đã cấu hình sẵn (Google Play yêu cầu API 36 từ 31/8/2026) — không hạ xuống.
- **APK vs AAB**: nộp **AAB** (`.aab`) qua EAS production, không nộp APK debug-signed từ GH Actions.
- **Cleartext HTTP**: đang mở cho mọi domain (cố ý, app on-device) — không ảnh hưởng review vì app không gọi server; nếu sau này thêm backend phải siết lại.
