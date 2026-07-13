# 抽卡機在哪！Card Radar

社群共建的台灣 IP 抽卡機 / 快閃活動查詢網站，資料由管理者維護於 Google Sheet，網站自動讀取並顯示。

**🔗 [查看網站](https://cardradartw.vercel.app/)**  
**最後更新：** 2026/07/13（v24）

---

## 功能

- 🔍 搜尋 IP 角色、地點名稱、縣市
- 🔽 依機台類型、縣市、IP 篩選（多選，桌面版 dropdown 面板 / 手機版 bottom sheet）
- ⏰ 即將結束的期間限定活動顯示倒數天數 badge（3 天內）
- 📍 點地標查看詳細資訊（場地、IP、彈數、一抽張數、期間限定、圖片）
- 🖼️ 支援多張圖片輪播，點擊放大
- 🗺️ 互動地圖，顯示全台抽卡機與 IP 快閃活動地點，自訂彩色圖示 + 同地點多機自動聚合
- 📱 手機版響應式設計（地圖全螢幕 + 底部可拖拉、依內容自動調整高度的詳情面板）
- 🗺️ 一鍵導航至 Google Maps
- 📅 依期間限定結束日期排序，或授權定位後依「離我最近／最遠」排序
- 🔗 分享單一地點連結，社群平台（LINE / Threads / Discord）預覽卡片有專屬標題與縮圖
- 👣 顯示累計訪客人數
- 📲 支援加入主畫面（PWA），可像 App 一樣從手機桌面開啟，離線時仍可查看上次載入的資料；回到前景自動刷新資料（節流 30 分鐘），列表模式支援下拉手動刷新
- 🔗 分享單一地點連結，社群平台（LINE / Threads / Discord）預覽卡片有專屬標題與縮圖；地圖模式分享的連結，收到方點開後會直接回到地圖模式並展開該機台詳情
- 📋 回報表單，讓社群協助新增地點或回報錯誤

---

## 技術架構

| 項目 | 工具 |
|------|------|
| 前端 | 純 HTML / CSS / JavaScript（ES Modules，見下方檔案結構） |
| 地圖套件 | Leaflet.js 1.9.4（OpenStreetMap 底圖，免費） |
| 資料來源 | Google Sheet（發布為公開 CSV） |
| 圖片託管 | Cloudinary |
| 網站託管 | Vercel（免費） |
| Serverless Function | `api/share.js`（分享連結 OG meta 用，Vercel 免費方案內） |
| PWA | `manifest.json` + Service Worker（split caching，v21 新增） |
| 字體 | Chiron GoRound TC（400/500/700）、Space Mono（統計數字）|
| 訪客計數 | counterapi.dev |
| 數據分析 | Google Analytics 4（GA4） |

**不需要資料庫、不需要 API 金鑰。** 有一支極輕量的 serverless function（`api/share.js`）純粹是為了讓分享連結在 LINE/Threads 等平台顯示正確的預覽卡片，不涉及任何使用者資料或資料庫。

### 檔案結構

```
index.html          # 進入點
style.css            # 全部樣式
js/
  main.js            # 資料載入／view 切換／篩選＋排序協調
  map.js             # 地圖／marker／側邊欄／mobile bottom sheet
  filters.js         # 篩選 UI
  sort.js            # 排序 UI + 定位權限
  grid.js            # 列表卡片渲染 + 排序邏輯
  pwa.js             # A2HS banner／自動刷新／下拉刷新／SW 註冊
  utils.js           # 裝置/顯示模式判斷
  visitor.js         # 訪客計數
api/share.js         # 分享連結 OG meta 用的 serverless function
```

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

---

## 資料更新流程

1. 在 Google Sheet 新增或編輯資料
2. 網站重新整理後自動讀取，不需修改程式碼

### 新增圖片
1. 上傳圖片到 Cloudinary
2. 複製圖片網址
3. 貼到 Google Sheet K 欄（多張用逗號分隔）

### 程式碼更新
```bash
./push.sh "說明改了什麼"
```

push 至 GitHub 後 Vercel 自動重新部署，約 1 分鐘生效。

---

## 回報表單

社群回報新地點或資訊有誤：https://forms.gle/1yDKadx89DoesrSj7

---

## 設計文件

[查看完整設計迭代紀錄 →](https://www.notion.so/372feb89ce7e811c9a4efac174a5691f?source=copy_link)
