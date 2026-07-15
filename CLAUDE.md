# CLAUDE.md

## 專案概述

Card Radar（抽卡機在哪！）— 台灣 IP 抽卡機 / 相卡機 / 快閃活動地點查詢網站。前端為純 HTML / CSS / JavaScript，2026/07 起從單一 `index.html` 拆分為 ES Modules（見下方「檔案結構」；純架構重構，不算功能版本迭代，未使用 vXX 編號），無資料庫、無 API 金鑰；v20 起新增一支 `api/share.js` Vercel Serverless Function（純粹是分享連結的 OG meta 用，不涉及資料庫或使用者資料）。

- 網站：https://cardradartw.vercel.app/
- Repo：https://github.com/romiajoin/taiwan-gacha-map
- Google Analytics：`G-1G91M8FLWQ`

---

## 技術架構

- 前端：純 HTML / CSS / JavaScript（ES Modules，見下方「檔案結構」）
- 地圖：Leaflet.js 1.9.4 + OpenStreetMap
- 資料來源：Google Sheet 公開 CSV（`/pub?gid=0&single=true&output=csv`）
- 圖片：Cloudinary（不用 Google Drive，有 CORS 問題）
- 部署：Vercel（push 至 GitHub 後自動部署，約 1 分鐘生效）
- Serverless Function：`api/share.js`（v20 新增，分享連結 OG meta 用，見下方「分享連結 OG Meta」）；專案根目錄需要有 `package.json`（哪怕內容幾乎是空的）Vercel 才會建置 `/api`
- 字體：Chiron GoRound TC（400/500/700）、Space Mono（統計數字）
- 訪客計數：counterapi.dev（`cardradartw/visits`，page view 計數）
- PWA：`manifest.json` + `sw.js`（v21 新增，見下方「PWA / 加到主畫面」）；圖示放在 `icons/`，路徑寫死在 `manifest.json` 跟 `index.html` 裡，改資料夾名稱要兩邊一起改

---

## 檔案結構（2026/07 拆分為 ES Modules）

```
index.html          # 進入點,<script type="module" src="js/xxx.js"> 依序載入
style.css            # 全部樣式,留在根目錄
js/
  main.js            # 核心協調：loadFromSheet／setView／applyFilters
  map.js             # 地圖核心：Leaflet／marker／cluster popup／桌面側邊欄／mobile bottom sheet(最大的模組)
  filters.js         # 篩選 UI：pill／dropdown／bottom sheet
  sort.js             # 排序 UI：按鈕／dropdown／bottom sheet + 定位權限
  grid.js             # 列表卡片渲染 + 排序邏輯（getEndDate/getEndingBadge/sortLocations）
  scroll.js           # #topBar（header/toolbar/filter-bar/訪客 banner）mobile 列表模式滑動隱藏/顯示（v26 新增）
  pwa.js              # A2HS banner／自動刷新／下拉刷新／Service Worker 註冊
  utils.js            # isStandaloneMode／getDeviceType（零依賴）
  visitor.js          # 訪客計數（零依賴）
api/share.js          # 不受影響,原本就是獨立檔案
```

**跨檔案依賴要注意**：這幾個模組之間互相 `import`，部分是循環依賴（例如 `main.js` 跟 `map.js` 互相 import 對方的東西）——這是刻意設計，函式宣告在 ES Modules 裡會在模組載入時就先掛好，不會因為互相 import 而抓不到，但**新增跨檔案呼叫時要留意這個限制**：
- 對方沒有 `export` 你要用的東西 → 模組圖直接連結失敗，全部 `<script type="module">` 拒絕執行（整站空白，不會有明確的畫面錯誤，只會在 console 看到 `does not provide an export named 'xxx'`）
- 共享的可變狀態（例如 `currentFiltered`、`allLocations`）**不能**在別的檔案直接重新賦值（`import` 進來的變數是唯讀的），只能讀取，或呼叫來源檔案提供的 setter（例如 `main.js` 的 `setCurrentFiltered()`）
- 物件內容的修改（例如 `filterState[key] = [...]`）不受這個限制，因為改的是物件屬性、不是重新指定整個變數

**改動前的檢查習慣**：改某個函式之前，先確認它現在在哪個檔案（可以直接 `grep -rn "function 函式名"` 8 個 js 檔案），不要預設還在 `main.js`；如果新增了跨檔案呼叫，記得幫來源檔案的宣告加 `export`，並在呼叫端補上對應的 `import`。

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

### 地圖 Marker 設計（v20 重做）
- 取代原本寫死的 🎰 emoji icon，改用 `L.divIcon` 自訂圓形 marker：抽卡機橘色、相卡機綠色，圖示沿用 type-badge 同一套 SVG path（`MARKER_ICON_SVG`）
- **同座標分組**：`renderMapLocations()` 先依 `${lat},${lng}` 把資料分組，同一組只建立一個 marker，右上角疊加數量角標（`.marker-count`），避免同一商場多台機器完全重疊互相遮蓋
- 混合類型（同座標同時有抽卡機+相卡機）退回用藍色 `var(--fill-blue)`，避免顏色語意打架
- 選中狀態：`.card-marker.selected .marker-pin` 放大＋加深陰影，由 `highlightMarker(loc)` 統一控制
- `.sidebar`（mobile bottom sheet）`z-index` 為 `2000`，故意設得比 Leaflet 內建的 `.leaflet-top`/`.leaflet-bottom`（預設 `z-index: 1000`）高，避免展開時被 zoom/attribution 控制項蓋住

### 單一地點 vs Cluster：兩條完全不同的互動路徑
**單一地點（該座標只有一台機器）**
- 不綁 Leaflet popup，點擊 marker 直接：mobile 開 bottom sheet 顯示詳情（高度依內容決定，見下方「Mobile Map Bottom Sheet」），desktop 在側邊欄顯示完整詳情
- 內容統一由 `buildDetailContentHtml(loc, { compact })` 產生，`compact` 目前兩邊都固定傳 `false`（曾經想拿 `compact:true` 做精簡版摘要卡，後來需求改成「矮高度時一樣是完整內容，只是裁切/縮到內容實際高度」，這個參數留著但暫時沒在用）

**Cluster（同座標多台機器）**
- 不分裝置，一律用浮動 Leaflet popup（`bindClusterPopup()`）顯示清單，清單項目優先顯示 IP（`character`），店名跟大標題重複時隱藏次要文字
- **popup 內容一定要一次組完整字串綁進 `bindPopup()`**，不要先綁空內容、開啟後才用 JS 塞資料——Leaflet 是用 `bindPopup()` 當下的內容去量測 popup 寬度，事後才塞的內容不會被納入計算；如果事後又呼叫 `popup.update()` 想重新量測，反而會把 `_contentNode.innerHTML` 蓋回最初綁定的（空的）字串，把剛塞進去的清單洗掉
- popup 大標題邏輯：店名（`name`）都一樣 → 顯示店名；不一樣 → 退回顯示場地（`venue`）；場地也沒有 → 用地址（`addr`）
- 標題與 close 按鈕包在同一個 `display:flex; align-items:center; justify-content:space-between` 的 row 裡，`.popup-close-btn` 用 inline `position:static` 蓋掉預設的 `position:absolute`，兩者才會真的垂直置中對齊（`position:absolute;top:4px` 只是碰巧接近，不保證對齊）
- 選了清單項目後 popup 保持開著（兩個平台都是），mobile 開 sheet 顯示詳情、desktop 在側邊欄顯示完整詳情

**⚠️ `bindPopup()` 會自動註冊內建 click-to-toggle 監聽器，跟手動 `openPopup()` 會打架**
`Layer.bindPopup()` 第一次呼叫時，Leaflet 會自動幫該 layer 加上一個 `click` 監聽器（行為是「已開啟就關閉、沒開啟就打開」）。如果程式碼自己也在 `marker.on('click', ...)` 裡手動呼叫 `marker.openPopup()`，兩個監聽器會同時觸發：
- 第一次點擊：因為 `bindPopup()` 是在這次點擊事件處理過程中才呼叫的，Leaflet 內部監聽器陣列的長度是在 `fire()` 開始時就鎖定的，這次新加的監聽器「來不及」在本次事件觸發，所以只有手動呼叫的 `openPopup()` 生效，看起來正常
- 之後任何一次重新點擊同一個 marker：兩個監聽器都會觸發，手動呼叫先把 popup 打開，內建的 toggle 監聽器緊接著判斷「已經開啟了」把它關掉——結果是點擊「看起來沒反應」（其實是打開又立刻被關掉）
- **修法**：marker 建立當下就把 `bindPopup()` 綁好（不要等第一次點擊才延遲綁定），拿掉手動 `openPopup()` 呼叫，開合完全交給 Leaflet 內建行為處理

### Cluster Popup 定位補正（v18 沿用至今）
- Leaflet 原生 `autoPan` 在 `max-height` + `overflow-y: auto` 下量不準（CSS 套用前就計算高度），改用 `popupopen` + `requestAnimationFrame` 拿實際 render 後尺寸，再自行 `panBy` 補正——這段邏輯 v20 後只作用在 cluster popup 上（單一地點已經不走 Leaflet popup了）
- `autoPan: false` 於 `bindPopup` options
- 已知未解問題：手機版 cluster popup 打開後，跟下方 bottom sheet 有機率互相遮蓋，marker 位置太靠畫面下緣時要注意；v23 起點聚合 marker 會先把 sheet 收到 `peek`（見下方「Mobile Map Bottom Sheet」）大幅緩解了這個問題，但沒有做「扣掉 sheet 高度計算可視範圍」這種精確排除，極端情況仍可能發生

### 最後更新元素（三處）
- `#lastUpdated` — PC header（`.header-info`，Space Mono 14px）
- `#listLastUpdated` — Mobile list mode，位於 `#gridView` 內、`#grid` 上方，隨卡片捲動
- `#mapLastUpdated` — Mobile map mode，位於 `.map-scroll-wrapper` 內、`location-list` 上方，隨列表捲動
- 三處由 JS `forEach` 統一更新，內容相同（12px / weight 400 / fill-black / text-align center）

### Mobile Map Bottom Sheet（v20 重寫，v23 再次大改：改成內容驅動的共用三檔系統）
- Sidebar 從「固定顯示全部地點清單」改為 **marker 驅動**：`sheetLevel` 狀態機為 `'peek' | 'mid' | 'full' | 'content'`，`sheetLoc` 記錄目前顯示的那一筆（null 代表顯示列表）
- **三檔高度由列表跟詳情共用**（v23 改動核心，取代原本各自獨立的 `default`/`summary`/`full`）：
  - `peek`：裝置高 `0.12`（`SHEET_PEEK_RATIO`），只露出拉桿 + 卡片頂端一小截
  - `mid`：裝置高 `0.32`（`SHEET_MID_RATIO`）
  - `full`：動態計算，抓 `#filterBar` 的 `getBoundingClientRect().bottom + 8` 當上限，`window.innerHeight - 上限`，確保不會蓋住搜尋框/篩選器
- **預設狀態（`sheetLoc` 為 null）**：顯示可捲動的地點卡片列表（`buildSidebarListCardHtml` + `bindSidebarListCardEvents`，跟桌機、grid 共用同一套卡片渲染），取代 v20 版的提示文字
- **詳情內容依實際高度決定 sheet 高度**（`applyMobileDetailHeight(opts)`）：內容渲染後用雙層 `requestAnimationFrame` 量測 `#locationList.scrollHeight`（確保排版真的完成才量，同步量測拿到的數字不可靠），若量出的 `contentH + handleH < mid` 就縮到內容實際高度（`sheetLevel = 'content'`），撐得滿或更高就開在 `mid`（`sheetLevel = 'mid'`）；`contentH` 會用 `Math.max(..., peek 高度)` 設下限，避免量測異常時 sheet 塌到 0 或小到連拉桿都碰不到
- **`preferFull` 選項**（v24 新增）：`opts.preferFull = true` 時，若內容量落在 `mid`（需要使用者自己拖才能看完），改為貼合實際內容高度展開（不是撐死到 `full` 的固定高度，下面不會空白）；只有內容真的長到超過 `full` 的上限才封頂在 `full`（此時本來就得靠內部捲動看完）。目前只有「從分享連結進來的地圖模式」這條路徑傳 `preferFull: true`，其他入口維持原本的 `mid` 預設
- **拖曳上限依內容而定**：`sheetLevelsStack()` 在 `sheetLoc` 有值且 `sheetContentMaxHeight` 不是 null（短內容詳情）時回傳 `['peek','content']`，其餘情況（列表、或內容本身撐得滿 mid 的詳情）回傳 `['peek','mid','full']`；`initBottomSheet()` 的 touchmove 上限固定拿 `levels[levels.length-1]`，不是寫死 `full`——短內容詳情這樣才不會被拖到貼齊 header、底下留一大片空白
- **層級記憶**（`sheetReturnLevel`）：從列表點卡片進入詳情時記住當下層級（`fromListLevel`），關閉時回到這一層；從 marker/cluster popup 進入詳情不會設定/清除這個記憶——這樣即使先從列表進入，之後又在 popup 裡切換到其他機台/其他聚合點，關閉時仍會回到最一開始的列表層級。真正會清掉這個記憶、回到 `peek` 的入口只有：直接從 marker/popup 開始（沒有列表歷史）、點地圖空白處、篩選/搜尋條件改變
- `closeDetailPanel(forcePeek)`：新增 `forcePeek` 參數，篩選/搜尋改變時傳 `true`，無條件回 `peek`；X 按鈕、原生 popup 關閉則不傳，走 `sheetReturnLevel || 'peek'` 的一般邏輯
- 點聚合 marker：sheet 收到 `peek` 顯示列表，讓地圖空間空出來給 popup（`sheetLoc` 清空但**不清 `sheetReturnLevel`**，因為這只是暫時收合去露出選單，不算真正關閉）；popup 開合仍完全交給 Leaflet 原生 click-toggle，這裡只負責收合 sheet
- 點地圖空白處（v23 新增，原本僅桌機支援）：`sheetLoc` 或有 popup 開著時才觸發收合，單純瀏覽列表時點空白處不會打斷使用者手動拉開的高度
- 關閉詳情、回到列表時，捲動到**最後選中**那張卡片的位置（`lastSelectedLocId`，`scrollIntoView({block:'start'})`，對齊頂部）；這個變數每次選中都會更新，所以在 popup 裡切換過機台，最後捲到的是最後看的那一台，不是最初點的那一台。v23 中途試過「精確還原點擊當下的 scrollTop」，發現這只是還原了「巧合而已，跟卡片是否顯眼無關」的舊畫面，改回捲到卡片頂部才是真正要的行為
- **搜尋自動展開**：`applyFilters()` 記住篩選/搜尋前的層級（`priorLevel`），若原本是 `peek` 且結果 > 0 筆就展開到 `mid`，原本已經是 `mid`/`full` 則維持不動；另外追蹤搜尋關鍵字「從無到有／從有到無」的轉折（`prevSearchKw`/`sheetLevelBeforeSearch`），清空搜尋時還原成**搜尋開始前**的層級，不是搜尋期間自動展開後的層級（兩者在清空當下可能是同一個值，會混淆判斷，所以要分開追蹤）
- Cluster marker 不走 sheet：不分裝置一律用浮動 Leaflet popup，見上方「單一地點 vs Cluster」段落
- `renderMapLocations()` 資料重新渲染（篩選條件改變）時，開頭就呼叫 `closeDetailPanel(true)`，避免內容跟新資料對不上；篩選結果為 0 筆時改顯示「找不到符合的地點 இдஇ」
- Mobile 地圖模式的搜尋框/篩選器跟列表模式共用 `.toolbar`
- `map.invalidateSize()` 統一在高度變動的各個函式尾端呼叫（delay 320ms 等 transition 結束）
- Grid view 時側邊欄整個隱藏（`body:not(.map-view) .sidebar { display: none }`）
- `initBottomSheet()` 仍有防重複初始化（`handle.dataset.sheetInit`）
- CSS 上 `.sidebar` 的 class 層級曾殘留一條 `height: 98px` 死規則（跟緊接在旁邊「高度改由 JS 動態計算」的註解互相矛盾），v23 清掉

### Desktop 地圖側邊欄（v20 新增，v23 預設內容改為真實列表）
- 固定寬 400px 常駐面板；**預設內容改為可捲動的地點卡片列表**（v23，取代原本的 `.sidebar-placeholder` 提示文字），跟手機版、grid 共用同一套卡片渲染（`buildSidebarListCardHtml`/`bindSidebarListCardEvents`）——側邊欄本身一直都在，只是內容在「列表」跟「完整詳情」之間切換
- 點單一地點 marker、側欄列表卡片，或 cluster marker 的浮動 popup 清單項目 → 側邊欄顯示完整詳情，popup 不會關閉
- 收回：點側邊欄 X，或點地圖空白處（`map.on('click', ...)`，marker 點擊不會冒泡上去，不會誤觸發）→ 換回列表，並捲動到最後選中那張卡片的位置（對齊頂部）
- 點了不同的單一地點 marker 之後又點回前一個，如果中間發生過「popup 已開啟但沒有明確關閉」的情況（例如先點 cluster 再點單一地點），要記得在單一地點分支呼叫 `map.closePopup()`，不然殘留的 cluster popup 會卡在「已開啟」狀態，導致之後點回那個 cluster marker 沒反應（見上方 bindPopup 那段的根本原因，這裡是同一個問題的另一種觸發路徑，多一層防呆）

### 篩選系統（Filter Bar，v19 重構）
- 三個維度：機台類型（固定 `FILTER_CONFIG.fixedOptions`）、縣市（固定 `TW_CITY_ORDER` 22 縣市，不受資料是否存在影響，沒資料的縣市選了就是 0 筆）、IP（動態從資料 `new Set()` 去重取得）
- `filterState = { type: [], city: [], ip: [] }`，每個維度都是多選陣列，`applyFilters()` 用「每個維度都符合（陣列為空視為不限制）」做 AND，維度內部是 OR
- **桌面版**：pill 點擊展開錨定 popover（`.filter-panel`，`position: absolute`），選項即時套用、不需確認按鈕
- **手機版**：改用共用的 bottom sheet（`#filterSheet`），依 `data-key` 動態填入對應類別的選項，不是每個類別各自一個 sheet DOM
- 清除篩選：v22 起改為單一 pill 各自清除——選取後 pill 右側 icon 從 chevron 換成清除（X）icon，`clearFilterKey(key)` 只清除該類別，不再有全域「清除篩選」按鈕/`clearAllFilters()`

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

**面板/sheet 疊層順序（v22 修正）**：手機版篩選/排序 sheet 原本 `z-index` 是 1100/1101，v20 把 mobile `.sidebar` 的 `z-index` 從 1000 提高到 2000（為了蓋過 Leaflet 內建控制項）之後，沒有同步調整篩選 sheet，導致地圖模式下打開篩選/排序會被 sidebar 蓋住——這個問題留在 code 裡整整兩個版本才發現。v22 把 `.filter-sheet-overlay`/`.filter-sheet`（篩選跟排序共用這組 class）的 `z-index` 提高到 2200/2201，蓋過 sidebar 也蓋過 A2HS banner（2100），確認排序/篩選是使用者當下主動觸發的 modal 互動，理論上該蓋過被動顯示的 banner。之後再新增任何 fixed 定位、疊在畫面上的 UI，記得先看這個檔案裡目前所有 `z-index` 的值，不要重複踩到同一個坑。

**IP 排序提示文字（v20）**：IP 選項用 `localeCompare(a, b, 'zh-Hant')` 排序，實測對中英數混合資料的結果是「數字開頭 → 中文依首字筆畫遞增 → 英文開頭殿後」（不是隨機或照輸入順序，只是肉眼不容易看出規律）。與其重新設計排序邏輯或加搜尋框（评估過覺得現階段太早），改成在 IP 篩選面板上方加一句提示文字說明排序規則：「依「數字 → 筆畫 → 英文」排序，可滑動尋找」。桌面版 popover（`.filter-panel`）跟手機版 bottom sheet（`#filterSheet`，透過 `#filterSheetHint`）是兩套獨立 DOM，這句提示要兩邊各自補一次，不會共用。

### 排序系統（Sort，v22 新增）
- 位於篩選 pill 列右側（`margin-left: 4px`，疊加 `.filter-bar` 原有的 `gap: 12px` 湊出 16px 間距），純文字＋chevron 樣式，跟 pill 外觀刻意做出區隔——排序永遠單選、沒有清除的概念，跟篩選的多選/可清除是不同的心智模型，用同一種 pill 樣式容易誤導使用者以為排序也能疊加
- `SORT_OPTIONS` 固定三個選項：`end_date_asc`（default）、`distance_asc`、`distance_desc`；桌面版 `#sortPanel` dropdown、手機版共用 `.filter-sheet` 這組 bottom sheet DOM（跟篩選共用同一套元件與 class，`#sortSheetOverlay`/`#sortSheet`），兩者互斥——開排序會收篩選，開篩選會收排序，`toggleDesktopSortPanel()`/`toggleDesktopPanel()` 跟 `openMobileSortSheet()`/`openMobileFilterSheet()` 互相呼叫對方的 close function
- `sortLocations(arr)`：
  - `end_date_asc`：沿用 `limited` 欄位（`"2026/07/01～2026/07/20"` 格式，取「～」後半段當結束日）比較，**無期限的常態機一律排最後**，彼此之間用 IP 名稱（`character` 欄位）`localeCompare('zh-Hant')` 排序（跟篩選 IP 選項同一套規則）——舊版曾經用 `getEnd()` 回傳固定 `9999/12/31` 當佔位值，這個寫法「近到遠」時剛好把無期限排最後，但如果曾經想加「遠到近」方向，同一個佔位值會讓無期限機台變成排最前面，邏輯是巧合對、不是設計對，v22 改成明確判斷 `null` 才是對的做法
  - `distance_asc`/`distance_desc`：Haversine 公式算直線距離（台灣範圍不需要更複雜的橢球模型），需要 `userCoords`（使用者座標）才能排，沒有座標時直接回傳原陣列不排序（防呆，理論上選這個選項前一定已經觸發過定位流程）
- **定位權限流程**：`requestUserLocation()` 包一層 Promise 呼叫 `navigator.geolocation.getCurrentPosition()`，`enableHighAccuracy: false`（找機台這種場景不需要，換取更快定位）、`maximumAge: 300000`（5 分鐘內快取位置可重用）；已知拒絕過的狀態存 `localStorage`（key: `geo_permission_denied`），下次點擊直接跳過 API 呼叫（因為 iOS Safari 拒絕過就不會再跳權限視窗，重複呼叫也沒用）
- **提示文案拆四種**（`GEO_ERROR_MESSAGES`），對應 `err.status`：已知拒絕過（本地判斷，不呼叫 API）／`denied`（本次拒絕）／`timeout`（逾時）／`unavailable`（裝置不支援或瀏覽器不支援 geolocation）——刻意不合併成一句「請確認定位權限」，因為逾時跟裝置不支援跟權限完全無關，合併文案會誤導使用者去翻手機設定
- 提示文字（`showSortHint()`）顯示位置：桌面 `#sortPanelHint`（dropdown 內、選項上方）、手機 `#sortSheetHint`（bottom sheet 內、選項上方），選單保持開啟不會自動收合，讓使用者看得到提示

### 裝置類型判斷：排版 vs 分析用途要分開
- `isMobileFilterLayout()`：`matchMedia('(max-width: 768px)')`，純粹決定「篩選要顯示 dropdown 還是 bottom sheet」，跟裝置無關，縮小桌面視窗也會觸發 mobile 排版（這是刻意的，排版本來就該跟著視窗寬度走）
- `isMobileMapLayout()`：`matchMedia('(max-width: 768px)')`，決定地圖模式要顯示桌機常駐側欄還是手機 bottom sheet；v23 起跟 `isMobileFilterLayout()` 統一使用同一個 768px 斷點（原本地圖是 640px、篩選是 768px 兩組不同斷點，各自獨立判斷，v23 合併成一組，同時刪除所有 640px 相關的 CSS media query）
- `getDeviceType()`：`matchMedia('(pointer: coarse)')`，判斷輸入裝置是否為觸控；v24 起同時結合 `isStandaloneMode()` 判斷是否為已安裝的 PWA，回傳四種值：`mobile`/`mobile_pwa`/`desktop`/`desktop_pwa`，給 GA 事件的 `device` 參數用。用寬度判斷裝置類型在分析上不準（縮小桌面視窗會被誤記為 mobile），所以 GA 相關的 `device` 一律用這個，不要沿用 `isMobileFilterLayout()`/`isMobileMapLayout()`
- `isStandaloneMode()`（v24 新增）：`matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`，是唯一的 standalone 判斷來源，`getDeviceType()` 與 A2HS banner 的 `isStandalone()`、`pwa_launch_mode` 事件都呼叫這一個，不要各自重複寫


- `#searchInput`（`.search-box-desktop`）：桌機列表模式，mobile 隱藏（`display: none`）
- `#searchInputMobile`（`.search-box-mobile`）：手機列表模式，`font-size: 16px` 防 iOS zoom，desktop 隱藏；**v20 起地圖模式也共用這一個**（原本 `body.map-view .toolbar {display:none}` 這條隱藏規則拿掉了）
- ~~`#mapSearchInput`~~：v20 已移除，連同 `#clearMapSearch`、`#mobileCountBadge` 一起刪掉，不要再找這幾個 id
- 兩個 input（`#searchInput`、`#searchInputMobile`）互相同步 value；`applyFilters()` 讀 `#searchInput` 的值
- 對應清除按鈕：`#clearSearch`、`#clearSearchMobile`，clear 時兩個 input 與按鈕一起清除

### Google Sheet 欄位（最新）
- A 欄為 `id`（手動流水號，分享連結用），其餘欄位從 B 開始：type, name, venue, city, addr, lat, lng, character, edition, perDraw, limited, hours, image, note
- lastUpdated 讀取位置：`firstRow[15]`（原為 `[14]`，id 欄加入後 +1）
- 新增資料時 id 欄手動填入，接續最大值 +1（不用公式，避免刪列後 id 重新計算導致分享連結失效）

### 分享單一地點（v20 大改：新增動態 OG Meta）
- 分享出去的網址從 `?id=<id>` 改成 `/api/share?id=<id>`（一支 Vercel Serverless Function，見下方「分享連結 OG Meta」）
- v24 起：在地圖模式分享時，`shareLocation()` 額外帶上 `&view=map`；`api/share.js` 白名單轉發 `view=map`（其他 query 參數一律丟棄）；頁面載入後若偵測到 `?id=` + `view=map`，切換到地圖模式並直接展開該機台詳情（desktop: `openDesktopSidebar`，mobile: `openMobileSheetSummary({ preferFull: true })`），不走原本的 `openGridModal()`
- **`?id=` 只在初次載入時處理一次**（`!silent` guard）：背景刷新/下拉刷新重複呼叫 `loadFromSheet()` 不會重跑這段邏輯，避免使用者關閉詳情後背景刷新又把它彈回來
- 找不到對應機台（已下架/刪除）時顯示 toast「這台機台的資訊已經下架囉」，並送出 `share_link_target_missing` GA 事件
- `showToast(msg)`：fixed 定位，bottom 80px，2 秒後自動消失

### 分享連結 OG Meta（v20 新增，`api/share.js`）
**為什麼需要**：LINE / Threads / Discord / Facebook 的爬蟲不會執行 JavaScript，只讀 HTML `<head>` 裡寫死的 `og:title`/`og:image`。原本分享連結直接指向 `index.html?id=xxx`，不管哪個機台，社群平台抓到的都是同一份寫死的預設 meta（網站 logo），縮圖永遠一樣。

**做法**：新增 `api/share.js`（Vercel Serverless Function，路徑用查詢字串 `?id=`，不是動態路由資料夾），流程：
1. 讀 `req.query.id`
2. 直接回傳一段固定內容的極簡 HTML：標題「抽卡機在哪！Card Radar」、描述「想找抽卡機 / 相卡機？來「抽卡機在哪！Card Radar」找找，快速掌握最新的機台資訊！」、圖片固定用網站根目錄的 `/og.png`（**不是**依機台動態換圖，每個機台分享出去縮圖都一樣）
3. `<script>location.replace('/?id=xxx')</script>` 把真人導回正常網站

**幾個容易踩的坑（都是這次實際炸過的）**：
- **不要用 `<meta http-equiv="refresh">` 做跳轉**：Facebook 的爬蟲會乖乖跟著 meta refresh 走，導致爬到跳轉後的首頁、抓到首頁的 meta 而不是我們寫的內容。只留 JS `location.replace()`，爬蟲不執行 JS 就不會跳走
- **`og:image:width` / `og:image:height` 一定要明確寫**，尤其 LINE 對這兩個標籤敏感，沒有時常常直接不顯示圖
- **動態路由資料夾 `api/share/[id].js` 這個寫法在這個專案上一直卡在 Vercel 路由規則裡 404**（`config.json` 裡的 `check:true` fallback 行為沒排除清楚，具體原因沒有完全查清楚），改用**查詢字串** `api/share.js?id=xxx` 之後就正常了，路由規則簡單很多、風險低很多。之後不要再改回動態路由資料夾這個寫法
- **專案一定要有 `package.json`**（哪怕內容幾乎是空的），不然 Vercel 會把整個專案當純靜態網站處理，完全不會建置 `/api` 底下的任何 serverless function，Functions 分頁永遠不會出現
- **`public/` 資料夾會讓 Vercel 誤判「這就是整個網站」**：如果 `index.html` 放在專案根目錄、`public/` 只是拿來放額外的靜態檔案（例如 `og.png`），Vercel 零設定判斷會把 `public/` 當成唯一輸出目錄，導致 `index.html` 完全消失、首頁變 404。必須到 Project Settings → Build and Deployment → Output Directory，手動 override 設成 `.`（代表專案根目錄）。**目前 `og.png` 已經搬到專案根目錄（不在 `public/` 裡）**，直接對應 `/og.png`，不要再放回 `public/`
- `vercel deploy --prebuilt --prod` 能跳過雲端建置、直接部署本機建置結果，除錯時很好用（能鎖定「是本機建置的問題還是雲端部署設定的問題」），但如果本機建置本身依賴的專案設定是錯的（例如上面 Output Directory 那個問題還沒修），會直接把錯的結果推上正式站，比正常的 GitHub 自動部署更危險——不需要深度除錯時盡量用 `git push` 走 GitHub 自動部署，不要習慣性用這個指令

### PWA 自動刷新 + 下拉刷新（v24 新增）
- **問題背景**：PWA standalone 模式沒有瀏覽器重整按鈕，使用者無法主動更新資料，只能 force quit 重開
- **自動刷新**：監聽 `document.visibilitychange` 與 `window.focus`（focus 當 iOS/in-app browser 的備援），回到前景時若距上次成功抓取（`lastFetchTime`）超過 `REFRESH_THROTTLE_MS`（30 分鐘）才真的打 API；`loadFromSheet({ silent: true, trigger: 'auto' })`
- **下拉刷新**：touch 手勢掛在 `#gridView`（列表模式的捲動容器），`scrollTop === 0` + 往下拉超過 60px（`PULL_TRIGGER_PX`）放開才觸發；視覺上用 `.ptr-indicator` / `.ptr-spinner` 顯示進度；`loadFromSheet({ silent: true, trigger: 'pull' })`，繞過節流（使用者主動操作不應被擋）
- **`silent` 模式**：不清空列表成「載入中」畫面，失敗時只用 toast 提示「更新失敗，請稍後再試」，不覆蓋使用者正在看的內容；初次載入不屬於 silent（`trigger: 'initial'`）
- **`!silent` guard on `?id=` handler**：`loadFromSheet()` 裡偵測分享連結的邏輯只在 `!silent` 時跑，避免背景刷新不斷把使用者已關掉的詳情彈窗重新彈出來
- **⚠️ v26.1 修正：spinner 卡住不轉、體感卡頓後直接收回**（bug 在 v26 期間發現並修好，但 v26 已經 push 上線、需要靠 `CACHE_VERSION` 再 bump 一次才能讓已快取的使用者拿到修好的檔案，詳見「Service Worker 快取版本管理」的 v26.1 條目）——根因是 `touchend` 觸發 loading 狀態時，`indicator.classList.add('loading')` 加上 CSS `animation: ptr-spin 0.7s linear infinite`（終點 `transform: rotate(360deg)`，沒寫 `from`）的**同一個 tick**，又呼叫 `setIndicatorHeight(PULL_TRIGGER_PX)` 把 spinner 的 inline `transform` 設成 `rotate(360deg)`——瀏覽器抓「animation 沒寫 from 時的隱含起點」是「動畫開始那一刻元素的當下計算值」，剛好也是 `360deg`，等於整段動畫是「從 360 度轉到 360 度」，視覺上完全不動；`loadFromSheet()` resolve 後 `.finally()` 拿掉 `.loading`、收回高度，體感就是「卡住不轉，然後直接收回」。修法：進入 loading 狀態時改成 `indicator.style.height = ...`（只設高度）+ `spinner.style.transform = ''`（清空殘留角度），讓 CSS animation 從乾淨的 `0deg` 起點開始轉，不呼叫會連帶設角度的 `setIndicatorHeight()`

### 排序後捲動重置（v24 新增）
- `applySortState()` 在 `renderGrid()` 之後，額外把 `#gridView`（列表模式）和 `.map-scroll-wrapper`（地圖模式側欄/sheet）的 `scrollTop` 重設為 0；排序＝重新給名次，捲動位置停在原地等於使用者看到的已經是不同排序下的名次，體驗上很混亂

### 無障礙 aria-label（v24 新增）
- 補上所有純圖示按鈕的 `aria-label`：`#btnGrid`/`#btnMap`（手機版文字被 CSS 隱藏）、`#clearSearch`/`#clearSearchMobile`、`.grid-modal-close`、兩個 `.popup-close-btn`（原本用裸 `✕` 字元）、三組情境的 carousel prev/next（各 2 個，共 6 個）
- 不影響任何邏輯或視覺；focus-visible 樣式留待後續補

### PWA / 加到主畫面（A2HS Banner，v21 新增）
- 檔案結構：`manifest.json`、`sw.js` 都要放**專案根目錄**（不能放子資料夾），因為 service worker 的作用範圍是它所在路徑以下，`register('/sw.js')` 預期它在根目錄；圖示放 `icons/`，路徑寫死在 `manifest.json` 跟 `index.html` 兩處，改資料夾名稱要兩邊一起改
- Maskable icon 安全區檢查：用 PIL 抓非背景色像素的 bounding box，確認四邊 margin 都 ≥ 畫布寬度的 10%（512px 畫布要 ≥51px）就算落在安全區內；這個專案的 logo 本身留白已經足夠，maskable 版直接沿用一般版本，沒有額外重新排版
- SVG 轉 PNG 工具選擇：環境內建的 `convert`（ImageMagick）沒有 `rsvg-convert` delegate 會直接失敗；改用 `pip install cairosvg --break-system-packages`可行，但**濾鏡效果支援不完整**（`feGaussianBlur`/`feColorMatrix` 這類陰影效果會被忽略），如果 icon 有陰影一定要保留，改用 Figma 直接 export PNG（Figma 會完整算 filter），不要用 SVG 原始檔轉

**顯示邏輯：互動門檻制，不靠瀏覽器/固定延遲判斷**
- 累計「查看詳情」次數（grid 詳情按鈕 `card_click` + 地圖上點**單一**機台 marker，`locs.length === 1` 那個分支，cluster 點擊不算）達 `VIEW_THRESHOLD = 3`，用 `localStorage`（key: `a2hsCardViews`）跨造訪永久累計；或單次瀏覽停留超過 `DWELL_MS = 20000`（20 秒），兩者達成其一即觸發，用 `window.a2hsRecordCardView()` 這個掛在 `window` 上的函式讓外部（grid/marker 的 click handler）呼叫
- Android 的**顯示時機**已經改成自己的互動門檻判斷，但**實際安裝動作**技術上仍然一定要先拿到瀏覽器發出的 `beforeinstallprompt` 事件物件才能呼叫 `.prompt()`，這點無法繞過；如果互動門檻已達成但事件還沒來，`tryTrigger()` 會先跳過，事件一到（`beforeinstallprompt` handler 裡）會再呼叫一次 `tryTrigger()` 補顯示
- 關閉退避：`localStorage`（key: `a2hsDismiss`）記 `{count, lastDismissed}`，關過 3 次永久不顯示，否則每次關閉後要間隔 14 天才再顯示；用次數+時間戳而不是單純布林值，是因為 iOS Safari 的 ITP 機制在超過 7 天沒有主動互動時可能清掉 localStorage，用累加式設計即使某次記錄遺失，最壞情況也只是使用者多看到幾次，不會出現「怎麼一直跳出來」的體驗災難

**⚠️ 最容易踩的坑：DOM 元素定義順序晚於 script，`getElementById` 拿到 `null` 且完全沒有錯誤訊息**
`a2hs-banner` 的 HTML 一度被放在主要 `<script>` 標籤**之後**（跟 `share-toast` 一起）。inline `<script>` 沒有 `defer`，瀏覽器解析到那一行會馬上執行，這時候後面（在原始碼順序上）才出現的 `a2hsBanner` 這個元素根本還沒被解析出來，`document.getElementById('a2hsBanner')` 拿到 `null`。因為程式碼裡剛好有 `if (!banner) return` 這種防呆判斷，導致「安靜地失敗」——不會顯示、也不會噴任何 console 錯誤，肉眼完全看不出原因，只能照抓 bug 的方式一路查到「兩者在原始碼中的相對順序」才會發現。**修法**：所有會被 script 用 `getElementById` 抓取的 DOM 元素，HTML 一定要放在對應 `<script>` 標籤**之前**（或者把整段查詢包進 `DOMContentLoaded`/`window.onload` 回呼裡延後執行，但這個專案選擇前者，改動範圍比較小）。

**Bottom sheet 疊層**：`.a2hs-banner` 的 `z-index` 是 `2100`，故意設得比手機地圖模式的 `.sidebar`（`z-index: 2000`）高，banner 永遠蓋在最上面，不管 sheet 展開到哪一層；曾經嘗試過動態計算 sheet 高度、讓 banner 貼在 sheet 上緣正上方（掛 4 個同步點：`setView`/`applySheetLevel`/`touchmove`/`resize`），後來確認「直接蓋在最上面」的體驗可以接受，改回這個簡單很多的做法，動態同步的程式碼已經整個移除

**平板版型**：`@media (min-width: 768px)` 固定寬度 `400px`、水平置中（`left: 50%; transform: translateX(-50%)`）、`bottom: 12px`；Android 平板不用額外判斷 UA（本來就含 `android` 字樣會觸發），iPad 因為 iPadOS 13+ 預設偽裝成 Mac UA，`isIos` 判斷抓不到，維持現狀不特別處理（等於 iPad 目前不會顯示這個 banner）

### Service Worker 快取版本管理（v22 修正）
- **根因**：`CACHE_VERSION` 從 v21 引入 SW 之後一直卡在 `'v1'`，從未跟著 release 更新過。SW 的清快取邏輯是「版本號改變時，`activate` 才會清掉舊的 cache」，版本號沒動，`SHELL_CACHE` 裡的 `index.html` 等殼層資源就一直是第一次快取時的舊版本，改版後使用者要手動清瀏覽記錄才看得到最新內容
- **疊加問題**：`sw.js` 本身沒有設定 no-cache header，可能被瀏覽器一般 HTTP cache 卡住，導致連「偵測 SW 檔案內容是否變化」這個瀏覽器內建機制都沒被觸發
- **修法**：
  1. `CACHE_VERSION` 改成對齊 release 版號（`'v24'`），之後每次 release 只要動到 `SHELL_ASSETS` 清單裡的檔案（`index.html`、`manifest.json`、`favicon.svg`，或更新 Leaflet CDN 版本號）就要同步 bump，維持整數格式（`v25`、`v26`...），不用語意化版本
  2. 新增 `vercel.json`，對 `/sw.js`、`/`、`/index.html` 都設 `Cache-Control: no-cache, no-store, must-revalidate`，確保瀏覽器每次都重新抓這幾個檔案去比對，不會被一般 HTTP cache 擋掉 SW 的更新偵測
  3. 因為 `sw.js` 本身已經 no-cache，之後只調整 `fetch` handler 內部邏輯（不影響 `SHELL_ASSETS` 清單）而不動 `CACHE_VERSION` 也沒關係——瀏覽器會自己偵測到 `sw.js` 檔案 byte 不同、觸發新版安裝
- **2026/07 補充（`CACHE_VERSION` 跟對外版本號脫鉤）**：`CACHE_VERSION` 判斷要不要 bump，只看「這次改動有沒有動到 `SHELL_ASSETS` 清單裡任一檔案的 bytes」，跟這次改動在語意上算不算一個值得對外公布的版本（README/Notion 那個 v24、v25）無關——即使是純架構重構、沒有任何使用者可見的功能變化（例如 2026/07 從單一 `index.html` 拆成 ES Modules，`index.html` 內容本身變了），只要動到 `SHELL_ASSETS`，`CACHE_VERSION` 一樣要 bump，不然已安裝 PWA 的舊使用者會持續吃到快取住的舊殼層。這次剛好兩邊都遞增到同一個數字（`v25`）純屬巧合，不代表兩套編號以後永遠對得上——`CACHE_VERSION` 是機械式開關，Notion/README 的版本號才是語意判斷
- **v26**：`index.html`（`#topBar` wrapper 結構）、`style.css`、`js/main.js` 都改了，`index.html` 在 `SHELL_ASSETS` 清單裡，因此 bump；`style.css`／`js/main.js`／新增的 `js/scroll.js` 本來就不在 `SHELL_ASSETS`，靠 catch-all 的 `cacheFirst` 規則自然重抓，不受影響但仍受惠於這次 bump（`activate` 會整組清掉舊版 `SHELL_CACHE`，這些檔案也會一起變成 cache miss，強制重新打網路抓最新版本）
- **v26.1**：`v26` 已經 push 上線之後，才發現並修好 `js/pwa.js` 下拉刷新 spinner 的 bug（見「PWA 自動刷新 + 下拉刷新」）——這代表已經有使用者的 `cardradar-shell-v26` 快取住了有 bug 的舊版 `pwa.js`，即使把修好的檔案 push 上去，`CACHE_VERSION` 字串沒變、快取名稱沒變，`cache-first` 還是會命中舊快取，不會重新抓。這次沒有對應的新對外版號（README/Notion 仍算 v26 這個 release 的一部分），純粹需要一個「沒出現過的新字串」去觸發 `activate` 清快取，因此用 `'v26.1'`——再次印證 `CACHE_VERSION` 是機械式開關，只看「需不需要讓已快取的使用者重新抓檔案」，跟對外版本號語意上算不算一個新版本無關
- 純資料更新（Google Sheet 內容變動）不受影響，本來就是走 `DATA_CACHE` 的 network-first

### 倒數 Badge（v23 新增）
- `getEndingBadge(loc)`/`getEndDate(loc)`：解析 `limited` 欄位（`"2026/06/24～2026/07/12"` 格式，取「～」後半段）算出結束日，跟今天比較天數差
- 只在結束日 3 天內顯示：今天結束 → 「最後一天」，明天 → 「倒數 2 天」，後天 → 「倒數 3 天」；超過 3 天或沒有 `limited` 欄位都不顯示（回傳 null，呼叫端直接不渲染）
- 顯示於 `.card-badge-row`，跟既有的 type-badge 同一個 flex row：type-badge 靠左、`.ending-badge` 靠右（`justify-content: space-between`）
- 背景 `#FFCF48`、黑字；中途討論過用紅色，最後定案黃色

### Icon 系統
- 全站使用 Material Symbols inline SVG（從 Google Fonts 下載 SVG 檔，`fill="#000000"` 改為 `fill="currentColor"`）
- Type badge 使用 FILL1 版本（實心）
- Filter pill 的展開/收合用同一顆 `arrow_drop_down` icon + CSS `transform: rotate(180deg)` 切換，不是切換兩顆 icon（v18 以前的 filter chip 用兩顆 icon 切換 active 狀態，v19 改版後已不適用）
- 彈窗（地圖 popup / grid modal）資訊欄不使用 icon，純文字標籤

### GA4 自訂事件（v19 起，v21 新增 PWA / 加到主畫面相關事件，v22 新增排序/定位相關事件，v23 新增 sheet 自動展開／關閉方式追蹤，v24 新增 PWA 刷新/分享連結追蹤、getDeviceType 擴充為 PWA 感知）
| 事件名稱 | 觸發時機 | 參數 |
|---|---|---|
| `search_box_focus` | 點擊搜尋框（兩個 input 各自觸發） | `source`（desktop_toolbar/mobile_toolbar；v23 文件曾誤記 map 這個值，程式碼中實際不存在，v24 已修正）, `device` |
| `search` | 輸入關鍵字（debounce 800ms，共用 timer） | `search_term`, `device` |
| `filter_click` | 點擊篩選面板/sheet 裡的選項 | `filter_type`, `filter_value`, `filter_state`(on/off), `device` |
| `filter_panel_open` | 打開篩選 pill 的面板或 bottom sheet | `filter_type`, `device` |
| `filter_panel_close` | 使用者主動關閉面板/sheet（程式自動觸發的收合不算，見下方保護機制） | `filter_type`, `had_selection`, `device` |
| `filter_clear` | 點擊篩選 pill 上的清除（X）icon，且該類別當下有套用中的篩選（v22 起從全域「清除篩選」按鈕改為單一 pill 各自清除，`clearFilterKey(key)`） | `filter_type`, `device` |
| `filter_result` | `applyFilters()` 執行後（debounce 800ms，僅在有套用篩選時記錄） | `type`, `city`, `ip`（各自 join 成字串）, `result_count`, `device` |
| `view_toggle` | 切換列表 / 地圖（跳過初始化那次） | `view_mode`, `device` |
| `card_click` | 點擊機台卡片 | `machine_id`, `machine_name`, `machine_type`, `source`(map_sidebar_list/map_cluster_popup/grid), `device` |
| `map_marker_click` | 直接點地圖上的機台圖示（跟透過清單點擊的 `card_click` 是不同路徑） | `machine_id`, `machine_type`, `device` |
| `gmaps_click` | 點擊「在 Google Maps 查看」連結 | `machine_id`, `source`(grid/map_popup/grid_modal/share_modal), `device` |
| `share_click` | 點擊分享按鈕（v24 補上 `device`；v23 文件曾誤記 source 含 map_popup，實際值是 map_detail_panel） | `machine_id`, `source`(grid_modal/share_modal/map_detail_panel), `device` |
| `lightbox_open` | 點圖放大 | `machine_id`, `device` |
| `carousel_nav` | 輪播圖 prev/next（刻意不帶 machine_id，避免同一人滑多張洗版；v24 補上 `device`） | `direction`(prev/next), `device` |
| `sheet_toggle` | 手機地圖模式手動拖拉 bottom sheet（切換地圖模式時的程式化重置不算；v24 補上 `device`） | `state`(v23 起為 peek/mid/full/content，取代原本的 open/peek), `device` |
| `sheet_auto_expand`（v23） | 搜尋/篩選出結果，`applyFilters()` 判斷 sheet 原本在 peek 就自動展開到 mid 的那一刻 | `device` |
| `detail_panel_close`（v23） | 使用者主動關閉詳情面板/sheet；`closeDetailPanel(forcePeek, method)` 的 `method` 參數決定觸發位置 | `method`(x_button/empty_map_tap/popup_native_close), `device` |
| `report_click` | 點擊回報表單連結（v24 補上 `device`） | `device` |
| `auto_refresh`（v24） | 回到前景後通過節流門檻（距上次抓取超過 30 分鐘）、真的觸發背景刷新 | `device` |
| `pull_to_refresh`（v24） | 列表模式下拉超過 60px 放開手指、真的觸發刷新 | `device` |
| `data_refresh_error`（v24） | 靜默刷新失敗（auto 或 pull 觸發，初次載入失敗走另一套流程，不算） | `trigger`(auto/pull), `device` |
| `share_link_opened`（v24） | 分享連結的 `?id=` 成功對應到真實機台 | `machine_id`, `view`(map/grid), `device` |
| `share_link_target_missing`（v24） | 分享連結的 `?id=` 找不到對應機台（已下架/刪除） | `machine_id`, `device` |
| `a2hs_engagement_met`（v21） | 累計查看詳情達 3 次，或單次停留超過 20 秒（兩者擇一） | `reason`(cumulative_views/dwell_time), `platform` |
| `a2hs_banner_shown`（v21） | 加到主畫面 banner 實際顯示 | `platform`(android/ios_safari/ios_in_app) |
| `a2hs_banner_dismissed`（v21） | 使用者關閉 banner | `reason`(close_x/ack) |
| `a2hs_prompt_result`（v21） | Android 原生安裝視窗的使用者選擇 | `outcome`(accepted/dismissed), `platform`(固定 android) |
| `pwa_installed`（v21） | `appinstalled` 觸發（PWA 安裝完成） | `platform`, `source`(a2hs_banner/native_browser_ui) |
| `pwa_launch_mode`（v21） | 每次頁面載入判斷 standalone/browser 開啟 | `mode`(standalone/browser) |
| `sort_change`（v22） | 選擇排序方式並實際套用（距離排序需等定位成功才觸發，選了但定位失敗不算） | `sort_key`(end_date_asc/distance_asc/distance_desc), `device` |
| `geo_permission_result`（v22） | 距離排序觸發 `navigator.geolocation` 定位請求後取得結果的當下 | `geo_result`(granted/denied/timeout/unavailable), `device` |

**追蹤時的保護機制**（避免程式自動觸發的行為污染數據）：
- `filter_result` / `filter_clear`：沒有套用任何篩選時不記錄（純搜尋、初始狀態、清除已經是空的都不算）
- `filter_panel_close`：`clearAllFilters()` 導致的關閉、視窗 `resize` 導致的自動收合，都透過 `skipTracking` 參數明確跳過
- `sheet_toggle`：只在 `initBottomSheet()` 裡真正的拖拉手勢分支（`touchend`）觸發，且只在層級真的改變時才記錄；程式化的高度變動（`applySheetLevel()` 被搜尋展開、篩選重置、關閉詳情等邏輯呼叫）不埋事件，避免這些自動觸發污染數據
- `sheet_auto_expand`（v23）：只在「原本在 peek、且這次篩選/搜尋有結果」這個分支觸發；已經在 mid/full 時篩選/搜尋不會觸發（維持原本高度，也不記錄）
- `detail_panel_close`（v23）：`closeDetailPanel(forcePeek, method)` 只有在**沒有** `forcePeek`、**有** `method`、且 `sheetLoc` 非空（真的正在看某台機台詳情）時才記錄；篩選/搜尋改變觸發的 `forcePeek` 重置、或根本沒開任何東西時點空白處，都不算數，避免跟 `filter_result` 那類事件重複計數同一次操作
- `geo_permission_result`（v22）：只有實際呼叫 `navigator.geolocation.getCurrentPosition()` 才會觸發。已知拒絕過（`localStorage` 的 `geo_permission_denied`）之後直接顯示提示、不再呼叫 API，這種情況不會產生事件——這代表這個事件反映的是「呼叫嘗試次數」的授權率，不是「不重複使用者」的授權率，兩者會有落差
- 所有自訂參數（`filter_type`、`source`、`device`、`result_count` 等）要在 GA4 後台「管理 → 自訂定義 → 自訂維度」手動註冊，才能在標準報表/Explore 查詢；v23 新增的 `sheet_auto_expand`（無自訂參數，只有標準的 `device`）、`detail_panel_close` 的 `method` 都還沒註冊，見下方「待註冊清單」

**v24 待完成清單**（GA4 後台「管理 → 自訂定義 → 自訂維度」）：
- `method`（`detail_panel_close` 專用，v23 起）：全新參數，尚未在 GA4 後台註冊
- `view`（`share_link_opened` 專用）：全新參數，尚未在 GA4 後台註冊
- `trigger`（`data_refresh_error` 專用）：全新參數，尚未在 GA4 後台註冊
- `device` 維度說明文字待更新：v24 起值從 mobile/desktop 擴充為 mobile/mobile_pwa/desktop/desktop_pwa，GA4 後台自訂維度的說明文字需手動更新
- `Sheet 狀態`（`state`）說明文字待更新：目前後台還寫舊的 open/peek，應改為 peek/mid/full/content
- `觸發來源`（`source`）說明文字待更新：目前後台列出的 source 值有部分已過時（如 map_popup、map_list），需修正為實際值

**⚠️ `addEventListener` 直接傳函式參照的坑**：`addEventListener('click', someFn)` 會把 `event` 物件當作 `someFn` 的第一個參數傳入。如果 `someFn` 的第一個參數是拿來控制邏輯用的（例如 `skipTracking`），會被 `event` 物件（永遠 truthy）誤判，導致邏輯整個相反卻不會報錯。要嘛改用箭頭函式包一層再傳（`addEventListener('click', () => someFn())`），要嘛該參數不要放在第一位。

**`data-machine-id` 屬性**：grid 卡片、地圖 popup、詳情 modal 的容器上都有這個屬性，`lightbox_open` 事件靠 `e.target.closest('[data-machine-id]')` 反查回是哪個機台，不用在每個開圖的地方各自傳一次 id。

### 圖片 URL 處理
- `driveUrlToImage(url)`：Google Drive 連結轉換為 `thumbnail?id=...&sz=w800`（`uc?export=view` 已被 Google 封鎖）
- Cloudinary 連結加上 `/upload/w_800,q_auto,f_auto/` 最佳化參數
- 建議優先使用 Cloudinary，Drive 直連長期不穩定

### 訪客計數 Banner
- 位置：`#topBar` 內、header 正上方，全寬，文字置中；v26 起併入 `#topBar`，mobile 列表模式下跟 header/toolbar/filter-bar 一起滑動隱藏/顯示（見下方「#topBar 滑動隱藏（v26 新增）」）
- API：`GET https://api.counterapi.dev/v1/cardradartw/visits/up`（每次載入 +1）
- 計數方式：page view（非 unique visitor）；曾討論過要不要用 `localStorage` 旗標做「同一瀏覽器不重複計」，結論是不做——現有語意就是「次數」而非嚴謹去重，真要看 unique visitor 直接查 GA4 後台的「使用者數」即可，不必為了公開 banner 多背一套邏輯
- API 失敗時 banner 靜默隱藏，不影響其他功能
- **⚠️ v22 修正：曾被 SW 誤快取導致數字凍結**——`sw.js` 的 `fetch` handler 裡，`isDataRequest`／`isImageRequest` 都判斷不到的請求會全部掉進最後的 catch-all，用 `cacheFirst(request, SHELL_CACHE)` 處理，counter API 也符合這個條件，導致第一次呼叫後就被快取住，之後每次 refresh 都拿到快取的舊回應，人數永遠不會增加。修法是新增 `isNoCacheRequest(url)`，判斷 `url.hostname === 'api.counterapi.dev'`，符合的請求直接 `fetch(request)` 繞過快取，不進 `cacheFirst`

### #topBar 滑動隱藏（v26 新增）
- **範圍**：header + toolbar + `#filterBar` + 訪客計數 banner 包成 `#topBar` 一個 wrapper；只在 `max-width: 768px` **且** `body:not(.map-view)`（列表模式）生效——地圖模式下 `#topBar` 維持原本 static flow，`position`／高度完全不受影響，因為 `map.js` 的 mobile bottom sheet `full` 高度是動態貼齊 filter-bar 下緣算出來的（見「Mobile Map Bottom Sheet」），改動這個會牽一髮動全身
- **實作方式**：`#topBar` 在生效範圍內改 `position: fixed; top:0`，用 `transform: translateY(-100%)` 做隱藏，而不是 `max-height` 動畫——`max-height` 過渡時，畫面高度會先跟著實際內容走、直到動畫值低於內容高度才「突然」開始收合，觀感是「捲了一段才卡一下才開始消失」，`transform` 沒有這個問題
- **滑動判斷邏輯**（`js/scroll.js`，監聽 `#gridView` 的 `scroll`，不是 window scroll，因為捲動容器是 `#gridView` 本身）：
  - 往下滑：累積 delta 超過 `HIDE_THRESHOLD`（8px）才隱藏，避免手抖誤觸
  - 往上滑：delta 一有負值就立刻顯示，不設門檻（對應「哪怕滑一點點」的需求）
  - 捲動位置在 `TOP_SAFE_ZONE`（頂部 24px）內一律強制顯示，避免捲到頂端時因為零星 delta 抖動
- **`#gridView` 的 `padding-top`**：因為 `#topBar` 變成 `fixed`（脫離文件流），`#gridView` 要保留對應高度避免第一批卡片被蓋住，寫成 `calc(12px + var(--top-bar-height, 0px))`；`--top-bar-height` 這個 CSS variable 由 `js/scroll.js` 動態量測 `#topBar.getBoundingClientRect().height` 寫入，**不是寫死的數字**
  - **量測時機的坑**：訪客計數 banner 是非同步出現的（`visitor.js` 抓到人數後才把 `display:none` 打開），如果只在 `resize` 時重新量測，banner 突然跳出來的那一瞬間高度會沒跟上、內容被蓋住一小段。改用 `ResizeObserver` 直接盯 `#topBar` 本身的尺寸變化，banner 出現、螢幕旋轉、未來任何內容變動都會自動觸發重新量測，不用為每個成因各自補監聽
- **`setView()` 切換時**：呼叫 `resetTopBarScrollState()`（`js/scroll.js` export），確保切到地圖模式或切回列表時 bar 狀態一定重置成可見、高度重新量測乾淨，不會殘留「切換前恰好處於隱藏狀態」的殘影
- **z-index**：`#topBar` 用 `250`，比 header 原本的 `200` 高一點但遠低於 filter/sort sheet（2200/2201）跟各種 modal（9999+），不會蓋過那些主動觸發的互動層，見「面板/sheet 疊層順序」段落，之後新增 fixed 定位元素記得先看這裡列的所有 z-index 值
- **mobile 列表模式間距（v26 調整）**：filter-bar 底部到第一張卡片的距離，從原本 `.filter-bar` 的 `padding-bottom: 12px` + `#gridView` 的 `padding-top: 12px` 疊加成 24px，改成只留 `#gridView` 自己的 12px——`body:not(.map-view) .filter-bar { padding-bottom: 0; }`，只在列表模式生效，地圖模式的 `.filter-bar` 維持原本 12px（`full` sheet 高度計算依賴這個值，不能動）
- **GA**：評估過不加新事件——這是捲動手勢驅動的連續 UI 動畫，跟現有事件（`view_toggle`、`card_click` 等）對應「明確使用者意圖」的性質不同，硬加會產生大量低價值事件，還會排擠 GA4 免費額度裡真正重要事件的採樣

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
