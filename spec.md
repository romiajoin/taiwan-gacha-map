# 抽卡機在哪！Card Radar — 規格文件

**網站網址：** https://cardradartw.vercel.app/  
**GitHub Repo：** https://github.com/romiajoin/taiwan-gacha-map  
**最後更新：** 2026/07/11（v22）

---

## 專案概述

社群共建的台灣抽卡機 / IP 快閃活動查詢網站，資料由管理者維護於 Google Sheet，網站自動讀取並顯示。

---

## 技術架構

| 項目 | 工具 |
|------|------|
| 前端 | 純 HTML / CSS / JavaScript（單一 index.html） |
| 地圖套件 | Leaflet.js 1.9.4（OpenStreetMap 底圖，免費） |
| 資料來源 | Google Sheet（發布為公開 CSV） |
| 圖片託管 | Cloudinary |
| 網站託管 | Vercel（免費） |
| PWA | manifest.json + Service Worker（split caching，v21 新增） |
| 字體 | Chiron GoRound TC（400/500/700）、Space Mono（統計數字）|
| 訪客計數 | counterapi.dev |
| 數據分析 | Google Analytics 4（GA4） |

**不需要後端、不需要資料庫、不需要 API 金鑰。**

---

## Google Sheet 欄位規格

| 欄 | 欄位 | 說明 | 必填 |
|----|------|------|------|
| A | id | 流水號，分享連結用（手動填入，勿用公式） | ✅ |
| B | 類型 | 機台類型（抽卡機 / 相卡機） | ✅ |
| C | 店名 | 活動或地點名稱 | ✅ |
| D | 場地 | 所在建築或商場（如：三創生活 7F） | ❌ |
| E | 縣市 | 縣市名稱（如：台北市） | ❌ |
| F | 地址 | 詳細地址（含縣市） | ✅ |
| G | 緯度 | 數字，用於地圖定位 | ✅ |
| H | 經度 | 數字，用於地圖定位 | ✅ |
| I | 期間限定 | 活動日期（如：2026/05/29～2026/07/23） | ❌ |
| J | IP | 熱門角色或 IP 名稱 | ❌ |
| K | 圖片 | Cloudinary 網址（多張用逗號分隔） | ❌ |
| L | 彈數 | 如：第一彈,第二彈 | ❌ |
| M | 一抽張數 | 如：2張 | ❌ |
| N | 備註 | 補充說明 | ❌ |
| O | 營業時間 | 如：週一至週日 11:00–22:00 | ❌ |

> 緯度經度可以用 Google Maps 點地點後取得。  
> 欄位為空時，對應資訊不顯示，不影響版面。

---

## 功能規格

### 訪客計數 Banner
- 位置：header 正上方，全寬橫幅
- 文字：「已經有 N 人來找過抽卡機」，置中顯示
- 數字樣式：Space Mono Bold
- 顏色：`--fill-blue`（文字與數字）、`--fill-blue-8`（背景）
- 資料來源：counterapi.dev（`cardradartw/visits`），page view 計數（每次載入 +1）
- API 失敗時靜默隱藏，不影響其他功能
- v22 修正：曾被 Service Worker 誤快取導致數字凍結（`sw.js` catch-all 規則把 counter API 也當成殼層資源快取），改為指定該請求繞過快取、每次都真的打網路，詳見 `CLAUDE.md`

### Header
- 右側由左至右：最後更新時間 ｜ 回報表單 　[列表][地圖]
- 回報表單：灰色文字（`--fill-gray`），hover 變藍，`target="_blank"` 開新分頁
- View Toggle：768px 以下隱藏文字標籤，只顯示 icon；padding 調整為 `8px 10px`

### GA4 自訂事件追蹤
| 事件名稱 | 觸發時機 | 參數 |
|---|---|---|
| `search_box_focus` | 點擊搜尋框 | `source` |
| `search` | 輸入關鍵字（debounce 800ms） | `search_term` |
| `filter_click` | 點擊篩選面板/sheet 裡的選項 | `filter_type`, `filter_value`, `filter_state`, `device` |
| `filter_panel_open` / `filter_panel_close` | 打開/主動關閉篩選面板或 sheet | `filter_type`, `had_selection`（close 才有）, `device` |
| `filter_clear` | 點擊篩選 pill 上的清除（X）icon，且該類別當下有套用中的篩選（v22 起從全域清除按鈕改為單一 pill 各自清除） | `filter_type`, `device` |
| `filter_result` | 篩選結果更新（debounce 800ms） | `type`, `city`, `ip`, `result_count`, `device` |
| `view_toggle` | 切換列表 / 地圖 | `view_mode`, `device` |
| `card_click` | 點擊機台卡片 | `machine_id`, `machine_name`, `machine_type`, `source` |
| `map_marker_click` | 直接點地圖圖示 | `machine_id`, `machine_type`, `device` |
| `gmaps_click` | 點擊 Google Maps 連結 | `machine_id`, `source`, `device` |
| `share_click` | 點擊分享按鈕 | `machine_id`, `source` |
| `lightbox_open` | 點圖放大 | `machine_id`, `device` |
| `carousel_nav` | 輪播圖切換 | `direction` |
| `sheet_toggle` | 手機地圖模式拖拉 bottom sheet | `state` |
| `report_click` | 點擊回報表單連結 | — |
| `a2hs_engagement_met` | 累計查看詳情達 3 次，或單次停留超過 20 秒（v21） | `reason`, `platform` |
| `a2hs_banner_shown` | 加到主畫面 banner 顯示（v21） | `platform` |
| `a2hs_banner_dismissed` | 關閉加到主畫面 banner（v21） | `reason` |
| `a2hs_prompt_result` | Android 原生安裝視窗的使用者選擇（v21） | `outcome`, `platform` |
| `pwa_installed` | PWA 安裝完成（v21） | `platform`, `source` |
| `pwa_launch_mode` | 每次載入判斷 standalone/browser 開啟（v21） | `mode` |
| `sort_change` | 選擇排序方式並實際套用（v22） | `sort_key`, `device` |
| `geo_permission_result` | 距離排序觸發定位請求後取得結果（v22） | `geo_result`, `device` |

詳細觸發規則與防誤觸機制見 `CLAUDE.md`。

### 分享單一地點
- URL 格式：`cardradartw.vercel.app/api/share?id=<id>`（v20 改為經過 serverless function，見下方「分享連結 OG Meta」；不是直接指向 `?id=<id>` 了）
- 地圖 popup、詳情側邊欄/sheet、grid modal 各有一個分享按鈕
- 手機：`navigator.share()` 跳出原生分享選單
- 桌機：`clipboard.writeText()` + toast 提示「已複製連結！」
- 真人點擊分享連結後會先短暫經過 `/api/share`，立刻被導回 `/?id=<id>`，資料載入後偵測 `?id=` 參數，自動開對應地點的 grid modal——使用者體感上跟原本一樣，不會感覺到多一層跳轉

### 分享連結 OG Meta（v20 新增）
- 社群平台（LINE / Threads / Discord / Facebook）的爬蟲不執行 JavaScript，只讀 `<head>` 裡的 `og:title`/`og:image`，所以分享連結改指向一支 serverless function（`api/share.js`），固定回傳同一組內容：
  - 標題：「抽卡機在哪！Card Radar」
  - 描述：「想找抽卡機 / 相卡機？來「抽卡機在哪！Card Radar」找找，快速掌握最新的機台資訊！」
  - 圖片：固定 `/og.png`（1200×630），**不會**依機台換圖
- 真人訪客會被 JS `location.replace()` 導回正常網站；**不用** `<meta http-equiv="refresh">`（Facebook 爬蟲會跟著跳走，抓到跳轉後頁面的 meta 而不是我們寫的內容）
- 部署上需要專案根目錄有 `package.json`、`og.png` 放在根目錄（不是 `public/`），細節見 `CLAUDE.md`

### PWA / 加到主畫面（A2HS Banner，v21 新增）
- **manifest.json**：`name`/`short_name`、`theme_color: #0066FF`、`background_color: #F2F2F7`、`display: standalone`；圖示 `icon-192.png`/`icon-512.png`/`icon-maskable-512.png`（maskable 沿用一般版本，logo 本身留白已在安全區內）、另加 `apple-touch-icon.png`
- **Service Worker（`sw.js`）**：靜態殼層 cache-first、Google Sheets CSV network-first（離線時 fallback 快取）、Cloudinary 圖片與地圖圖磚 cache-first，用版本號 cache name 管理更新；v22 修正 `CACHE_VERSION` 長期卡在 `v1` 未更新的問題（改版後需清瀏覽記錄才看得到最新內容），改為對齊 release 版號並搭配 `vercel.json` 的 no-cache header，詳見 `CLAUDE.md`
- **顯示時機**：累計「查看詳情」次數（grid 詳情 + 地圖單一 marker）達 3 次（跨造訪永久累計，存 `localStorage`），或單次瀏覽停留超過 20 秒，兩者擇一觸發；不依賴瀏覽器自身的 `beforeinstallprompt` 時機判斷或 iOS 固定延遲
- **平台差異**：Android 按鈕觸發原生安裝流程（仍受限於瀏覽器何時發出 `beforeinstallprompt`）；iOS + Safari 顯示教學文案；iOS + 非 Safari（LINE/IG/FB 內嵌瀏覽器）先引導「用 Safari 開啟」
- **關閉退避**：關過 3 次永久不再顯示，每次關閉後間隔 14 天才再問一次
- **版位**：手機 `bottom: 12px`、左右各留 10px；平板（≥768px）固定寬 400px 置中；`z-index: 2100`，蓋過手機地圖模式 bottom sheet（`2000`）

### 地圖（23.6N, 121.0E），預設縮放層級 8
- 地標圖示（v20 重做）：自訂圓形 `L.divIcon`，抽卡機橘色、相卡機綠色，圖示沿用 type-badge 同一套 SVG；不再是 🎰 emoji
- 同座標多台機器共用一個 marker，右上角顯示數量角標
- 點單一地點 marker → **不會**跳出 Leaflet popup，改成 mobile 開 bottom sheet、desktop 在側邊欄顯示詳情
- 點同座標多機（cluster）marker → 跳出浮動 Leaflet popup 顯示清單，選其中一項才顯示完整詳情
- 桌機版 popup（僅 cluster 會用到）`max-height` 依內容撐開，`maxWidth: 420`

### 彈窗（cluster popup、地圖側邊欄/sheet 詳情、列表模式詳情彈窗）
內容一致，顯示以下資訊（有資料才顯示）：
1. 店名（粗體標題，右上角固定 ✕ 關閉按鈕，跟 badge 同一個 flex row 垂直置中）
2. 期間限定（圓角框）
3. 資訊欄（純文字標籤，無 icon）：場地、地址、IP、彈數、一抽張數、營業時間、備註
4. 前往 Google Maps 查看 →（藍色連結）
5. 圖片（width: 100%，height: auto，依原始比例顯示；多張支援輪播）

cluster popup（同座標多機清單）另外有一層：先顯示「這裡有 N 台機器」清單，清單項目優先顯示 IP、店名相同時隱藏重複的次要文字，選了其中一項才會顯示上面這份完整內容。

### 列表模式（Grid View）
- 格狀排版（手機 1 欄、桌機響應式多欄）
- 卡片半透明背景 `rgba(235,235,245,0.16)`，hover 顯示黃色邊框
- Tags：白色文字 + 白色邊框 + 半透明背景
- 「詳情」按鈕：青色實心 `#00c2a8`，黑色文字，↗ 圖示，點擊開啟彈窗

### 地圖模式詳情面板（v20 重做，取代原本「側邊欄列表」）
**桌面版**
- 固定寬 400px（原本 360px），**常駐顯示**，不是點了才出現
- 預設內容是提示文字「點選地圖上的圖示，查看機台詳細資訊」
- 點單一地點 marker，或 cluster popup 清單裡的項目 → 顯示該筆完整詳情
- 收回：點面板上的 X，或點地圖空白處 → 換回提示文字（面板本身不會消失/隱藏）

**手機版（bottom sheet）**
- 不再「一直顯示全部地點清單」，改成三段高度：`default`（提示文字，固定矮高度）→ `summary`（點了地點後的摘要卡，固定矮高度）→ `full`（拖 handle 展開，動態計算高度、不會蓋住上方篩選列）
- `summary` 跟 `full` 顯示的是同一份完整內容，差別只在 sheet 高度（矮的只露出頂部，靠內部捲動裁掉多的部分）
- 往下滑最低只會停在 `summary`（或沒選地點時的 `default`），不會自動消失，只有點 X 才整個收回
- 搜尋框/篩選器跟列表模式共用同一組元件，不再有地圖模式專屬的搜尋框

### 篩選
- 三個篩選維度，各自一個 dropdown pill：機台類型、縣市、IP，均為多選
- **桌面版**：點 pill 在下方展開錨定 popover 面板，選項為 chip，點擊即時套用（無需確認按鈕）；已選 1 項時 pill 直接顯示該值全名，選 2 項以上顯示「類別 (n)」
- **手機版**：改用 bottom sheet（標題「{類別}篩選」+ 右上角關閉鈕），header 固定不隨選項列表捲動；選項區塊整包置中、內部每列靠左對齊
- 縣市選項固定顯示全部 22 個（`TW_CITY_ORDER` 自訂順序），不受目前資料是否涵蓋該縣市影響；IP、機台類型選項則是動態去重
- IP 選項上方有一行排序說明：「依「數字 → 筆畫 → 英文」排序，可滑動尋找」（v20 新增，排序邏輯本身沒變，只是補上說明文字）
- 篩選 pill 選取後（`.active`）右側 icon 從 chevron 換成清除（X）icon，點擊只清除該 pill 所屬類別的篩選值（v22 起改為單一 pill 各自清除，不再有全域「清除篩選」按鈕）
- 篩選與搜尋同時作用（交集）
- 篩選結果為 0 筆時，地圖模式的詳情面板會顯示「找不到符合的地點」（v20 補回，改版時一度遺漏）
- 類型 Badge 顯示於：列表卡片左上角、詳情 Modal、地圖 Popup（樣式與篩選 UI 無關，維持原本設計）
  - 抽卡機：背景 `#00c2a8`，黑字，`border-radius: 4px`，icon：Material Symbols playing_cards（FILL1）
  - 相卡機：背景 `#ffcf48`，黑字，`border-radius: 4px`，icon：Material Symbols photo_camera（FILL1）

### 排序（v22 新增）
- 位於篩選 pill 列右側，與 pill 間隔 16px，純文字＋chevron（無 pill 外框），單選
- **桌面版**：點擊展開錨定 dropdown；**手機版**：文字換行為兩行（類別／方向），點擊開 bottom sheet；兩者互斥，開一個會自動收合另一個以及篩選面板/sheet
- 三個選項：結束日期近到遠（default）、距離近到遠、距離遠到近
- **結束日期排序**：有結束日期的機台依日期排序，無期限的常態機一律排最後，彼此之間依 IP 名稱（`localeCompare('zh-Hant')`）排序
- **距離排序**：Haversine 公式計算直線距離，需先取得使用者定位（`navigator.geolocation`）；已拒絕過的授權狀態存 `localStorage`（`geo_permission_denied`），之後不會再重複觸發瀏覽器權限彈窗，直接顯示提示文字
- 定位失敗時依原因顯示不同提示：已知拒絕過／本次拒絕／逾時／裝置不支援，四種文案分開，避免使用者誤判問題出在哪

### 搜尋
- 搜尋框可搜尋：店名、地址、縣市、IP 角色、場地
- 即時過濾，不需按 Enter
- 地圖模式（不分手機/桌機）：搜尋框跟列表模式共用同一組元件跟位置，不再有地圖模式專屬的搜尋框（v20 移除）
- 列表模式手機版：`#searchInputMobile`（`.search-box-mobile`，`font-size: 16px` 防 iOS zoom）
- 列表模式桌機版：`#searchInput`（`.search-box-desktop`）

### 最後更新資訊
- PC header：`#lastUpdated`（`.header-info`，Space Mono 14px，fill-black）
- Mobile list mode：`#listLastUpdated`，位於 `#gridView` 內、卡片上方，隨卡片捲動（12px / weight 400 / text-align center）
- ~~Mobile map mode `#mapLastUpdated`~~：v20 移除（地圖模式詳情面板改版後，這排資訊沒有合適的位置放，整個拿掉了）

### 地點數量顯示
- Toolbar：`74 個地點`（數字青色 `#00c2a8`，20px bold；「個地點」文字同為 20px regular）
- 地圖手機版列表區右側

---

## RWD（響應式設計）

| 裝置 | 版面 |
|------|------|
| 桌機（>640px） | Header + Toolbar + 主內容區（Grid 或 Map+Sidebar 並排） |
| 手機（≤640px） | Header + 主內容區（地圖全螢幕 + 底部 bottom sheet） |

### 手機版地圖模式
- Toolbar（搜尋框）跟列表模式共用，不再隱藏（v20 起地圖模式也會顯示）
- Filter bar（機台類型 / 縣市 / IP dropdown pill）顯示於地圖上方，pill 列可橫向捲動，清除篩選固定不隨捲動
- 篩選/排序面板改為 bottom sheet 呈現，`z-index: 2200`/`2201`，蓋過下方的 sidebar bottom sheet（`z-index: 2000`）；v22 修正前兩者疊層順序相反，篩選/排序 sheet 曾被地圖 sidebar 蓋住，見 `CLAUDE.md`
- 地圖：`flex: 1` 佔滿整個內容區高度
- 詳情面板（bottom sheet）：`position: fixed; bottom: 0`，疊在地圖上方，`z-index: 2000`（蓋過 Leaflet 內建控制項）
  - **`default` state**（預設，沒選任何地點）：固定矮高度，顯示提示文字
  - **`summary` state**（點了地點後）：固定矮高度，顯示完整詳情內容，靠捲動裁掉超出範圍的部分（視覺上只露出頂部）
  - **`full` state**（往上拖 handle 展開）：動態計算高度（不超過篩選列下緣），顯示同一份完整詳情內容
  - 內部結構由上至下：
    1. `.sheet-handle`（drag handle pill，觸控熱區上下各 16px padding）
    2. `.map-scroll-wrapper`（`flex: 1; overflow-y: auto`）
       - `.location-list`（依狀態顯示提示文字或完整詳情，動態塞入 innerHTML）

---

## 設計規格

| 項目 | 值 |
|------|-----|
| 背景深色 | `#1C1C1E` |
| 次背景 | `#2C2C2E` |
| 卡片背景 | `#3A3A3C` |
| 文字色 | `#f0eeff` |
| 灰色文字 | `#8892b0` |
| 主色（黃） | `#ffcf48` |
| 強調色（青） | `#00c2a8` |
| 粉紅（舊 accent） | `#ff4d8d` |

### Header
- 背景：`#1C1C1E`（無底線）
- Logo：圓形圖片 32px
- 標題字重：700
- 最後更新文字：白色

### Toolbar
- 背景：`rgba(60,60,67,0.08)`（`--fill-gray-8`）
- 搜尋框（PC）：`flex: 1`（佔滿寬度）、`border-radius: 9999px`、半透明灰底
- 搜尋框（Mobile map sidebar）：`.map-search-row` 獨立元件，`border-radius: 999px`，count badge 在 pill 外
- 搜尋 icon：Material Symbols search SVG
- 清除按鈕：Material Symbols cancel（FILL1）SVG，有輸入時顯示
- Placeholder 顏色：`rgba(60,60,67,0.64)`（`--fill-gray-64`）
- 搜尋框修復 webkit autofill 藍底（inset box-shadow 覆蓋）

### View Toggle
- 啟用狀態背景：`#00c2a8`

---

## 資料更新流程

1. 管理者在 Google Sheet 新增/編輯資料
2. 網站重新整理後自動讀取最新資料

### 新增圖片流程
1. 上傳圖片到 Cloudinary
2. 複製圖片網址
3. 貼到 Google Sheet K 欄（多張用逗號分隔）

---

## 程式碼更新流程

```bash
./push.sh "說明改了什麼"
```

push 至 GitHub 後 Vercel 自動重新部署，約 1 分鐘生效。

---

## 回報表單

社群回報新地點或資訊有誤：https://forms.gle/1yDKadx89DoesrSj7

---

## 待開發功能（未來規劃）

- 期間限定快速篩選
- 距離篩選（例如「5km 內」，v22 討論過先做排序、篩選半徑之後再議）
- 地點狀態標示（營業中 / 已結束）
- 自訂網域
