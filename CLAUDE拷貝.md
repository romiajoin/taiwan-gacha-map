# CLAUDE.md

## 專案概述

Card Radar（抽卡機在哪！）— 台灣 IP 抽卡機 / 相卡機 / 快閃活動地點查詢網站。單一 `index.html`，無後端、無資料庫、無 API 金鑰。

- 網站：https://cardradartw.vercel.app/
- Repo：https://github.com/romiajoin/taiwan-gacha-map
- Google Analytics：`G-1G91M8FLWQ`

---

## 技術架構

- 前端：純 HTML / CSS / JavaScript（單一 `index.html`）
- 地圖：Leaflet.js 1.9.4 + OpenStreetMap
- 資料來源：Google Sheet 公開 CSV（`/pub?gid=0&single=true&output=csv`）
- 圖片：Cloudinary（不用 Google Drive，有 CORS 問題）
- 部署：Vercel（push 至 GitHub 後自動部署，約 1 分鐘生效）
- 字體：Chiron GoRound TC（400/500/700）、Space Mono（統計數字）

---

## 部署

```bash
./push.sh "說明改了什麼"
```

換電腦後需重新設定 remote URL：
```bash
git remote set-url origin https://romiajoin:TOKEN@github.com/romiajoin/taiwan-gacha-map.git
```
Token 只顯示一次，外洩需立即到 GitHub Settings 撤銷並重新產生。

---

## 工作方式（重要）

- **改動前先確認**：說明要改什麼、怎麼改，等確認後再動手
- **出錯後不要亂猜**：收到推回訊號要先問清楚，不要自行繼續修改
- **只改指定範圍**：改 A 不要動 B，除非明確說要一起改
- **layout / 動畫 bug 要先看截圖**：光看程式碼很難診斷視覺問題

---

## 關鍵技術筆記

- Leaflet popup 內的 click 事件需用 capture mode：`addEventListener('click', handler, true)`
- 卡片展開使用單一 delegated listener 綁在 `#grid`，不要在每張卡片重複綁事件
- Google Sheets CSV 網址格式：`/pub?gid=0&single=true&output=csv`（不是一般分享連結）
- 手機版 popup 需在 `map.once('moveend', ...)` 後才呼叫 `openPopup()`，否則 autoPan 無法正確計算
- 手機版 `autoPanPaddingBottomRight: [10, 280]`，為 drawer 260px + 20px buffer
- 手機版搜尋欄用 `font-size: 16px` + `transform: scale(0.875)` 防止 iOS Safari 點擊縮放
- 版面高度用 `100dvh` 而非 `100vh`，避免 Chrome mobile 網址列遮住 header

---

## 外部工具筆記

**Notion**
- fetch：用完整 URL（含 `?source=copy_link`）
- update：用裸 UUID `372feb89-ce7e-811c-9a4e-fac174a5691f` 作為 `page_id`
- 插入內容：用 `old_str`/`new_str` 鎖定標題文字作為錨點

**Figma**
- `get_design_context` 用 `fileKey: 2ZsVk3lz1VafzFInqbj8Ug`
- `nodeId` 用 `-` 分隔（例如 `658-472`），不是 `%3A`
- 操作前先切換到正確 page，再 append nodes

---

## 文件位置

| 文件 | 說明 |
|------|------|
| `README.md` | 功能介紹、技術架構、欄位規格 |
| `spec.md` | 完整功能規格與設計規格 |
| Notion | 設計迭代紀錄（V1 起） |
