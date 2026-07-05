# 抽卡機在哪！Card Radar — 規格文件

**網站網址：** https://cardradartw.vercel.app/  
**GitHub Repo：** https://github.com/romiajoin/taiwan-gacha-map  
**最後更新：** 2026/07/03（v19）

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
| `filter_clear` | 清除篩選 | `device` |
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

詳細觸發規則與防誤觸機制見 `CLAUDE.md`。

### 分享單一地點
- URL 格式：`cardradartw.vercel.app/?id=<id>`
- 地圖 popup 與 grid modal 各有一個分享按鈕
- 手機：`navigator.share()` 跳出原生分享選單
- 桌機：`clipboard.writeText()` + toast 提示「已複製連結！」
- 開啟分享連結時：資料載入後偵測 `?id=` 參數，自動開對應地點的 grid modal

### 地圖（23.6N, 121.0E），預設縮放層級 8
- 地標圖示：🎰 emoji（52×52px）
- 點地標 → 跳出彈窗（Leaflet popup）
- 手機版 popup `max-height: 260px`，支援捲動
- 桌機版 popup `max-height: 70vh`，支援捲動

### 彈窗（點地標後）與列表模式詳情彈窗
兩者樣式一致，顯示以下資訊（有資料才顯示）：
1. 店名（白色粗體標題，右上角固定 ✕ 關閉按鈕）
2. 期間限定（黃色邊框圓角框）
3. 資訊欄（純文字標籤，無 icon）：場地、地址、IP、彈數、一抽張數、營業時間、備註
4. 前往 Google Maps 查看 →（藍色連結）
5. 圖片（width: 100%，height: auto，依原始比例顯示；多張支援輪播）

### 列表模式（Grid View）
- 格狀排版（手機 1 欄、桌機響應式多欄）
- 卡片半透明背景 `rgba(235,235,245,0.16)`，hover 顯示黃色邊框
- Tags：白色文字 + 白色邊框 + 半透明背景
- 「詳情」按鈕：青色實心 `#00c2a8`，黑色文字，↗ 圖示，點擊開啟彈窗

### 地圖模式側邊欄列表（Sidebar）
- PC 寬度：360px
- 卡片背景：`rgba(235,235,245,0.08)`，邊框 `rgba(235,235,245,0.16)`
- hover：邊框變黃色 `#ffcf48`，向右位移 3px
- active：邊框黃色 `#ffcf48`
- 每個卡片顯示：店名、期間限定（黃色文字）、Tags（IP、縣市、場地）
- 點卡片 → 地圖飛到該地點並打開彈窗

### 篩選
- 三個篩選維度，各自一個 dropdown pill：機台類型、縣市、IP，均為多選
- **桌面版**：點 pill 在下方展開錨定 popover 面板，選項為 chip，點擊即時套用（無需確認按鈕）；已選 1 項時 pill 直接顯示該值全名，選 2 項以上顯示「類別 (n)」
- **手機版**：改用 bottom sheet（標題「{類別}篩選」+ 右上角關閉鈕），header 固定不隨選項列表捲動；選項區塊整包置中、內部每列靠左對齊
- 縣市選項固定顯示全部 22 個（`TW_CITY_ORDER` 自訂順序），不受目前資料是否涵蓋該縣市影響；IP、機台類型選項則是動態去重
- 清除篩選：桌面版位於最後一個 pill 右側（24px 間距）；手機版固定在 pill 列右側，不隨 pill 橫向捲動
- 篩選與搜尋同時作用（交集）
- 類型 Badge 顯示於：列表卡片左上角、詳情 Modal、地圖 Popup（樣式與篩選 UI 無關，維持原本設計）
  - 抽卡機：背景 `#00c2a8`，黑字，`border-radius: 4px`，icon：Material Symbols playing_cards（FILL1）
  - 相卡機：背景 `#ffcf48`，黑字，`border-radius: 4px`，icon：Material Symbols photo_camera（FILL1）

### 搜尋
- 搜尋框可搜尋：店名、地址、縣市、IP 角色、場地
- 即時過濾，不需按 Enter
- 地圖模式手機版：搜尋框在 sidebar 頂部（`.map-search-row`，pill 形狀，`border-radius: 999px`）；count badge 在 pill 外側右邊
- 地圖模式桌機版：搜尋框在頂部 toolbar
- 列表模式手機版：獨立的 `#searchInputMobile`（`.search-box-mobile`，`font-size: 16px` 防 iOS zoom）
- 列表模式桌機版：`#searchInput`（`.search-box-desktop`）

### 最後更新資訊
- PC header：`#lastUpdated`（`.header-info`，Space Mono 14px，fill-black）
- Mobile list mode：`#listLastUpdated`，位於 `#gridView` 內、卡片上方，隨卡片捲動（12px / weight 400 / text-align center）
- Mobile map mode：`#mapLastUpdated`，位於 `.map-scroll-wrapper` 內、卡片上方，隨列表捲動（同上樣式）

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
- Filter bar（機台類型 / 縣市 / IP dropdown pill）顯示於地圖上方（toolbar 隱藏，filter-bar 保留），pill 列可橫向捲動，清除篩選固定不隨捲動
- 篩選面板改為 bottom sheet 呈現，z-index 高於下方的 sidebar bottom sheet，避免被蓋住
- 地圖：`flex: 1` 佔滿整個內容區高度
- Sidebar（bottom sheet）：`position: fixed; bottom: 0`，疊在地圖上方
  - **Peek state**（預設）：`height: 154px`，顯示 handle bar + search row + 第一張卡片微露
  - **Open state**：`height: 50vh`，往上拖 handle 展開
  - 內部結構由上至下：
    1. `.sheet-handle`（drag handle pill）
    2. `.map-search-row`（pill 搜尋 + 地點數）
    3. `.map-scroll-wrapper`（`flex: 1; overflow-y: auto`）
       - `#mapLastUpdated`（最後更新，隨列表捲動）
       - `.location-list`（地點卡片）

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
- 地點狀態標示（營業中 / 已結束）
- 自訂網域
