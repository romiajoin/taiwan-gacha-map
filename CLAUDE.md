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

### Popup 定位
- Leaflet 原生 `autoPan` 在 `max-height` + `overflow-y: auto` 下量不準（CSS 套用前就計算高度），改用 `popupopen` + `requestAnimationFrame` 拿實際 render 後尺寸，再自行 `panBy` 補正
- `popupAnchor: [0, -26]`（靜態值，tip 貼 icon 頂端，不再動態讀 `window.innerWidth`）
- `autoPan: false` 於 `bindPopup` options

### 最後更新元素（三處）
- `#lastUpdated` — PC header（`.header-info`，Space Mono 14px）
- `#listLastUpdated` — Mobile list mode，位於 `#gridView` 內、`#grid` 上方，隨卡片捲動
- `#mapLastUpdated` — Mobile map mode，位於 `.map-scroll-wrapper` 內、`location-list` 上方，隨列表捲動
- 三處由 JS `forEach` 統一更新，內容相同（12px / weight 400 / fill-black / text-align center）

### Mobile Map Bottom Sheet
- Sidebar 在 mobile 地圖模式下改為 `position: fixed; bottom: 0` 的 bottom sheet
- Peek state：`height: 154px`（handle + search row + 第一張卡片微露）
- Open state：`height: 50vh`（`.sidebar.sheet-open`）
- Touch drag 在 `.sheet-handle` 上：往上拖超過 50px → open，往下拖超過 50px → peek，放開自動 snap
- 切換至地圖模式時自動重置為 peek（`peekSheet()`）
- 搜尋框 focus **不**自動展開 sheet（已拿掉）
- Grid view 時隱藏 sidebar（`body:not(.map-view) .sidebar { display: none }`）
- 狀態切換後呼叫 `map.invalidateSize()`（delay 320ms 等 transition 結束）
- `initBottomSheet()` 有防重複初始化（`handle.dataset.sheetInit`）

### 搜尋框（三個 input，互相同步）
- `#searchInput`（`.search-box-desktop`）：桌機列表模式，mobile 隱藏（`display: none`）
- `#searchInputMobile`（`.search-box-mobile`）：手機列表模式，`font-size: 16px` 防 iOS zoom，desktop 隱藏
- `#mapSearchInput`：地圖模式 bottom sheet 內的搜尋框，`font-size: 16px` + `transform: scale(0.875)`
- 三個 input 互相同步 value；`applyFilters()` 讀 `#searchInput` 的值
- 對應清除按鈕：`#clearSearch`、`#clearSearchMobile`、`#clearMapSearch`，clear 時三個 input 與按鈕一起清除

### Google Sheet 欄位（最新）
- A 欄為 `id`（手動流水號，分享連結用），其餘欄位從 B 開始：type, name, venue, city, addr, lat, lng, character, edition, perDraw, limited, hours, image, note
- lastUpdated 讀取位置：`firstRow[15]`（原為 `[14]`，id 欄加入後 +1）
- 新增資料時 id 欄手動填入，接續最大值 +1（不用公式，避免刪列後 id 重新計算導致分享連結失效）

### 分享單一地點
- URL 格式：`?id=<id值>`（例如 `cardradartw.vercel.app/?id=42`）
- 頁面載入後、資料 fetch 完成時偵測 `URLSearchParams`，找到對應地點後自動開 `openGridModal()`
- `shareLocation(id)`：手機用 `navigator.share()`，桌機 fallback 至 `clipboard.writeText()` + toast
- `showToast(msg)`：fixed 定位，bottom 80px，2 秒後自動消失

### Icon 系統
- 全站使用 Material Symbols inline SVG（從 Google Fonts 下載 SVG 檔，`fill="#000000"` 改為 `fill="currentColor"`）
- Filter chip 和 view button 的 active/normal 狀態切換：同一元素放兩個 SVG（`chip-icon-outline` / `chip-icon-fill`），用 CSS display 控制
  ```css
  .chip-icon-fill { display: none; }
  .filter-chip.active .chip-icon-outline { display: none; }
  .filter-chip.active .chip-icon-fill { display: inline; }
  ```
- Type badge 使用 FILL1 版本（實心），filter chip 使用 FILL0（outline）normal + FILL1 active

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
