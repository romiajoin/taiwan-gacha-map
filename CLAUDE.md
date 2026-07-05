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
- 訪客計數：counterapi.dev（`cardradartw/visits`，page view 計數）

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
- **不要用 `sed -i` 處理含 SVG 的區塊**：會破壞 path data，改用 Python 或 str_replace

---

## 關鍵技術筆記

- Leaflet popup 內的 click 事件需用 capture mode：`addEventListener('click', handler, true)`
- 卡片展開使用單一 delegated listener 綁在 `#grid`，不要在每張卡片重複綁事件
- Google Sheets CSV 網址格式：`/pub?gid=0&single=true&output=csv`（不是一般分享連結）

### Popup 定位
- Leaflet 原生 `autoPan` 在 `max-height` + `overflow-y: auto` 下量不準（CSS 套用前就計算高度），改用 `popupopen` + `requestAnimationFrame` 拿實際 render 後尺寸，再自行 `panBy` 補正
- `popupAnchor: [0, -26]`（靜態值，tip 貼 icon 頂端，不再動態讀 `window.innerWidth`）
- `autoPan: false` 於 `bindPopup` options
- `.popup-close-btn` 使用 `position: absolute; top: 4px; right: 4px`（不能用負值，會被 `.leaflet-popup-content` 的 `overflow-y: auto` 裁切）

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

### 篩選系統（Filter Bar，v19 重構）
- 三個維度：機台類型（固定 `FILTER_CONFIG.fixedOptions`）、縣市（固定 `TW_CITY_ORDER` 22 縣市，不受資料是否存在影響，沒資料的縣市選了就是 0 筆）、IP（動態從資料 `new Set()` 去重取得）
- `filterState = { type: [], city: [], ip: [] }`，每個維度都是多選陣列，`applyFilters()` 用「每個維度都符合（陣列為空視為不限制）」做 AND，維度內部是 OR
- **桌面版**：pill 點擊展開錨定 popover（`.filter-panel`，`position: absolute`），選項即時套用、不需確認按鈕
- **手機版**：改用共用的 bottom sheet（`#filterSheet`），依 `data-key` 動態填入對應類別的選項，不是每個類別各自一個 sheet DOM
- 清除篩選：桌面版用 `margin-left` 接在最後一個 pill 右側（非 `margin-left: auto` 頂到最右）；手機版拆成 `.filter-scroll`（pill 可橫向捲動）+ 不隨捲動的清除連結

**⚠️ flex-wrap 容器量不出「換行後的實際寬度」**
`width: fit-content` 或 `width: max-content` 搭配 `flex-wrap: wrap` 時，瀏覽器算「內容自然寬度」是**假裝不換行**去加總所有子元素寬度的（CSS 規格如此，不是 bug），結果通常遠超過 `max-width`，導致容器永遠卡滿上限，看不出換行後實際只用到多少寬度。無法只用 CSS 解決，做法是量測後用 JS 手動設定 `width`：
```js
// 換行後用 offsetTop 分組成一列一列，取最寬那一列的實際寬度
function fitOptionsWidth(container) {
  container.style.width = '';
  const rows = new Map();
  Array.from(container.children).forEach(item => {
    const top = item.offsetTop;
    (rows.get(top) || rows.set(top, []).get(top)).push(item);
  });
  let maxRowWidth = 0;
  rows.forEach(rowItems => {
    const left = Math.min(...rowItems.map(i => i.offsetLeft));
    const right = Math.max(...rowItems.map(i => i.offsetLeft + i.offsetWidth));
    maxRowWidth = Math.max(maxRowWidth, right - left);
  });
  if (maxRowWidth > 0) container.style.width = Math.ceil(maxRowWidth) + 'px';
}
```
量測時機也要注意：目標元素必須是**已經 `display: block`（看得見）** 才量得到正確的 `offsetTop`/`offsetWidth`，量 `display: none` 的元素全部都是 0。桌面面板預設隱藏，量測前要先暫時強制 `display: block`、量完再切回去（見 `fitPanelWidth()`）；手機 sheet 則是先加上 `.show` class 讓它顯示、才呼叫量測函式，順序顛倒就會量到 0。

**面板/sheet 疊層順序**：手機版篩選 sheet 的 `z-index` 要蓋過地圖模式 sidebar（`.sidebar` 是 `z-index: 1000`），否則地圖模式下打開篩選會被 sidebar 蓋住。

### 裝置類型判斷：排版 vs 分析用途要分開
- `isMobileFilterLayout()`：`matchMedia('(max-width: 768px)')`，純粹決定「篩選要顯示 dropdown 還是 bottom sheet」，跟裝置無關，縮小桌面視窗也會觸發 mobile 排版（這是刻意的，排版本來就該跟著視窗寬度走）
- `getDeviceType()`：`matchMedia('(pointer: coarse)')`，判斷輸入裝置是否為觸控，給 GA 事件的 `device` 參數用。用寬度判斷裝置類型在分析上不準（縮小桌面視窗會被誤記為 mobile），所以 GA 相關的 `device` 一律用這個，不要沿用 `isMobileFilterLayout()`


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
- Type badge 使用 FILL1 版本（實心）
- Filter pill 的展開/收合用同一顆 `arrow_drop_down` icon + CSS `transform: rotate(180deg)` 切換，不是切換兩顆 icon（v18 以前的 filter chip 用兩顆 icon 切換 active 狀態，v19 改版後已不適用）
- 彈窗（地圖 popup / grid modal）資訊欄不使用 icon，純文字標籤

### GA4 自訂事件（v19）
| 事件名稱 | 觸發時機 | 參數 |
|---|---|---|
| `search_box_focus` | 點擊搜尋框（三個 input 各自觸發） | `source`（desktop_toolbar/mobile_toolbar/map） |
| `search` | 輸入關鍵字（debounce 800ms，共用 timer） | `search_term` |
| `filter_click` | 點擊篩選面板/sheet 裡的選項 | `filter_type`, `filter_value`, `filter_state`(on/off), `device` |
| `filter_panel_open` | 打開篩選 pill 的面板或 bottom sheet | `filter_type`, `device` |
| `filter_panel_close` | 使用者主動關閉面板/sheet（程式自動觸發的收合不算，見下方保護機制） | `filter_type`, `had_selection`, `device` |
| `filter_clear` | 點擊「清除篩選」且當下有套用中的篩選 | `device` |
| `filter_result` | `applyFilters()` 執行後（debounce 800ms，僅在有套用篩選時記錄） | `type`, `city`, `ip`（各自 join 成字串）, `result_count`, `device` |
| `view_toggle` | 切換列表 / 地圖（跳過初始化那次） | `view_mode`, `device` |
| `card_click` | 點擊機台卡片 | `machine_id`, `machine_name`, `machine_type`, `source`(map_list/grid) |
| `map_marker_click` | 直接點地圖上的機台圖示（跟透過清單點擊的 `card_click` 是不同路徑） | `machine_id`, `machine_type`, `device` |
| `gmaps_click` | 點擊「在 Google Maps 查看」連結 | `machine_id`, `source`(grid/map_popup/grid_modal/share_modal), `device` |
| `share_click` | 點擊分享按鈕 | `machine_id`, `source`(map_popup/grid_modal/share_modal) |
| `lightbox_open` | 點圖放大 | `machine_id`, `device` |
| `carousel_nav` | 輪播圖 prev/next（刻意不帶 machine_id，避免同一人滑多張洗版） | `direction`(prev/next) |
| `sheet_toggle` | 手機地圖模式手動拖拉 bottom sheet（切換地圖模式時的程式化重置不算） | `state`(open/peek) |
| `report_click` | 點擊回報表單連結 | — |

**追蹤時的保護機制**（避免程式自動觸發的行為污染數據）：
- `filter_result` / `filter_clear`：沒有套用任何篩選時不記錄（純搜尋、初始狀態、清除已經是空的都不算）
- `filter_panel_close`：`clearAllFilters()` 導致的關閉、視窗 `resize` 導致的自動收合，都透過 `skipTracking` 參數明確跳過
- `sheet_toggle`：只在 `initBottomSheet()` 裡真正的拖拉手勢分支觸發，`openSheet()`/`peekSheet()` function 本體不埋事件（因為切換地圖模式時也會呼叫這兩個 function，若埋在裡面會誤觸發）
- 所有自訂參數（`filter_type`、`source`、`device`、`result_count` 等）要在 GA4 後台「管理 → 自訂定義 → 自訂維度」手動註冊，才能在標準報表/Explore 查詢

**⚠️ `addEventListener` 直接傳函式參照的坑**：`addEventListener('click', someFn)` 會把 `event` 物件當作 `someFn` 的第一個參數傳入。如果 `someFn` 的第一個參數是拿來控制邏輯用的（例如 `skipTracking`），會被 `event` 物件（永遠 truthy）誤判，導致邏輯整個相反卻不會報錯。要嘛改用箭頭函式包一層再傳（`addEventListener('click', () => someFn())`），要嘛該參數不要放在第一位。

**`data-machine-id` 屬性**：grid 卡片、地圖 popup、詳情 modal 的容器上都有這個屬性，`lightbox_open` 事件靠 `e.target.closest('[data-machine-id]')` 反查回是哪個機台，不用在每個開圖的地方各自傳一次 id。

### 圖片 URL 處理
- `driveUrlToImage(url)`：Google Drive 連結轉換為 `thumbnail?id=...&sz=w800`（`uc?export=view` 已被 Google 封鎖）
- Cloudinary 連結加上 `/upload/w_800,q_auto,f_auto/` 最佳化參數
- 建議優先使用 Cloudinary，Drive 直連長期不穩定

### 訪客計數 Banner
- 位置：header 正上方，全寬，文字置中
- API：`GET https://api.counterapi.dev/v1/cardradartw/visits/up`（每次載入 +1）
- 計數方式：page view（非 unique visitor）
- API 失敗時 banner 靜默隱藏，不影響其他功能

### Header 順序（PC）
`最後更新時間 ｜ 回報表單 　[列表][地圖]`

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
