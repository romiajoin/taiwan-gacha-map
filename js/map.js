// =============================================
// map.js — 地圖核心：Leaflet 地圖／marker／cluster popup／桌面側邊欄／手機 bottom sheet
// 拆分階段四（最後一塊）：這是牽連最廣的一塊，幾乎被 grid／sort／filters 都摸過。
//
// 這裡把原本分散在檔案兩端的「地圖渲染」跟「mobile bottom sheet 手勢」（SHEET_PEEK_RATIO／
// levelHeightPx／initBottomSheet，原本在檔案最尾端、離主要地圖邏輯很遠）合併搬到一起，
// 因為它們本來就是同一個子系統（都在讀寫 sheetLevel），分開放反而更難懂。
//
// main.js 還留著 prevSearchKw／sheetLevelBeforeSearch 這兩個「搜尋還原用」的狀態——
// 雖然名字裡有 sheet，但只有 applyFilters 會碰，跟這裡的 sheetLevel／sheetLoc 不是同一組,
// 所以沒有跟著搬過來。
// =============================================

import { getDeviceType } from './utils.js';
import { getEndingBadge } from './grid.js';
import { driveUrlToImage, allLocations, currentFiltered } from './main.js';

window.closeDetailPanel = closeDetailPanel; // 給 buildDetailContentHtml 動態產生的 onclick="closeDetailPanel(...)" 用

    export let map = null;
    let markers = [];
    let markerByLocId = {}; // loc.id -> 該機台所屬的 marker（同座標多機共用一個 marker，供列表點擊時對照用）
    let lastSelectedLocId = null; // 關閉詳情、回到列表時，捲到「最後」選中那台的卡片位置（會隨切換不斷更新，不是最一開始點的那張）
    let currentMapData = []; // 目前地圖上繪製的資料集（給側邊欄「預設列表」使用，篩選變動時同步更新）
    let anyPopupOpen = false; // 目前地圖上是否有任何 cluster popup 開著（手機點地圖空白處要不要收合 sheet 會用到）
    // 地圖 marker 用的圖示（與既有 type-badge 同一套 path，白色描邊圓形，跟 OSM 底圖圖示做出區隔）
    const MARKER_ICON_SVG = {
      '相卡機': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-264q72 0 120-49t48-119q0-69-48-118.5T480-600q-72 0-120 49.5T312-432q0 70 48 119t120 49Zm0-72q-42 0-69-27t-27-68q0-40 27-68.5t69-28.5q42 0 69 28.5t27 68.5q0 41-27 68t-69 27ZM168-144q-29 0-50.5-21.5T96-216v-432q0-29 21.5-50.5T168-720h120l50-67q11-14 26-21.5t32-7.5h168q17 0 32 7.5t26 21.5l50 67h120q30 0 51 21.5t21 50.5v432q0 29-21 50.5T792-144H168Z"/></svg>',
      '抽卡機': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="m612-404 31-107q3-11-1-22t-14-18l-93-63q-8-5-16.5-2T508-604l-31 107q-3 11 .5 22t13.5 18l93 63q8 5 17 2t11-12ZM168-222l-30-15q-28-13-38-40t3-55l65-140v250Zm148 78q-31 0-53.5-20.5T240-216v-288l134 360h-58Zm206-4q-31 11-56-1t-36-43L259-660q-11-31 .5-56.5T302-753l294-107q31-11 56 .5t36 42.5l172 472q11 31-.5 56T817-253L522-148Z"/></svg>',
    };
    const MARKER_COLOR = { '抽卡機': 'var(--fill-orange)', '相卡機': 'var(--fill-green)' };

    // 依同座標分組後的 locs 陣列，決定 marker 顏色／圖示／是否顯示數量角標
    function createClusterIcon(locs) {
      const types = [...new Set(locs.map(l => l.type))];
      const isSingleType = types.length === 1;
      const color = isSingleType ? (MARKER_COLOR[types[0]] || 'var(--fill-blue)') : 'var(--fill-blue)';
      const iconInner = isSingleType
        ? (MARKER_ICON_SVG[types[0]] || '')
        : `<span class="marker-num">${locs.length}</span>`;
      const countBadge = locs.length > 1 ? `<div class="marker-count">${locs.length}</div>` : '';
      return L.divIcon({
        html: `<div class="marker-pin" style="--marker-color:${color}">${iconInner}${countBadge}</div>`,
        className: 'card-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });
    }
    // =============================================
    // <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-191q119-107 179.5-197T720-549q0-105-68.5-174T480-792q-103 0-171.5 69T240-549q0 71 60.5 161T480-191Zm-24.5 67.5Q444-128 433-137q-40-35-86.5-82T260-320q-40-54-66-112.5T168-549q0-134 89-224.5T480-864q133 0 222.5 90.5T792-549q0 58-26.5 117t-66 113q-39.5 54-86 100.5T527-137q-11 9-22.5 13.5T480-119q-13 0-24.5-4.5ZM480-552Zm0 164q62-56 88-81t41-44q14-17 20.5-35.5T636-587q0-35-25.5-60.5T550-673q-21 0-40 9t-30 23q-12-14-30.5-23t-39.5-9q-35 0-60.5 25.5T324-587q0 19 6.5 36t20.5 36q16 21 44 48.5t85 78.5Z"/></svg> 初始化地圖（只一次）
    // =============================================
    export function initMap() {
      if (map) return;
      map = L.map('map').setView([23.6, 121.0], 8);
      window.map = map; // 給 innerHTML 動態產生的 onclick="map.closePopup()" 用，模組作用域下 map 不會自動變成全域
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
      }).addTo(map);
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      // 手動 pan-to-fit：Leaflet 原生 autoPan 在 max-height+overflow 下量不準
      // 改在 popupopen 後用 rAF 拿到真實 render 尺寸再算位移
      map.on('popupopen', function(e) {
        anyPopupOpen = true;
        const container = e.popup.getElement();
        if (!container) return;
        requestAnimationFrame(() => {
          const mapRect = map.getContainer().getBoundingClientRect();
          const popupRect = container.getBoundingClientRect();
          const pad = 16;
          let dx = 0, dy = 0;
          if (popupRect.top    < mapRect.top    + pad) dy = popupRect.top    - mapRect.top    - pad;
          if (popupRect.bottom > mapRect.bottom - pad) dy = popupRect.bottom - mapRect.bottom + pad;
          if (popupRect.left   < mapRect.left   + pad) dx = popupRect.left   - mapRect.left   - pad;
          if (popupRect.right  > mapRect.right  - pad) dx = popupRect.right  - mapRect.right  + pad;
          if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { animate: true, duration: 0.25 });
        });
      });

      // 點地圖空白處收回 sheet／側邊欄：桌機一律收回；手機只有「有東西可以收」（正在看詳情，或有 popup
      // 開著）才動作，單純瀏覽列表時點地圖空白處不用強制把使用者手動拉開的列表高度收掉。
      map.on('click', () => {
        if (isMobileMapLayout() && !sheetLoc && !anyPopupOpen) return;
        closeDetailPanel(false, 'empty_map_tap');
      });

      // popup 被關閉（不管是側欄 X 觸發的、還是使用者直接再點一次同一個聚合 marker 讓 Leaflet 原生切換關閉）
      // 都順便把側欄／sheet 收回列表，避免「popup 已經關了，畫面卻還停在剛剛那台的詳情」這種不同步的狀態。
      map.on('popupclose', () => {
        anyPopupOpen = false;
        closeDetailPanel(false, 'popup_native_close');
      });

      renderMapLocations(currentFiltered.length ? currentFiltered : allLocations);
    }

    // =============================================
    // 📍 渲染地圖 markers
    // 同座標的多台機器共用一個 marker（避免完全重疊互相遮蓋），
    // marker 依機台類型上色／加數量角標。
    //
    // 互動模式（對齊 Figma 新版 mobile/desktop 地圖流程）：
    // - Cluster marker（同座標多台機器）：不分裝置，一律用浮動 Leaflet popup 顯示清單。
    // - Mobile（≤640px）：預設 sheet 收在小 peek（放提示文字，跟桌面版同一句文案）；
    //   點單一 marker，或 cluster popup 清單裡的項目，開「摘要卡」中間態；可拖 handle 展開「完整詳情」；
    //   往下滑最低只會停在「摘要卡」，不會自動變不見；只有點 X 才會整個收回 peek。
    // - Desktop：側邊欄固定寬 400 常駐（預設顯示提示文字）；點單一 marker，或 cluster popup 清單裡的項目，
    //   直接在側邊欄顯示完整詳情（popup 不會關閉）；點側邊欄 X 或點地圖空白處都會換回提示文字。
    // =============================================
    export function renderMapLocations(data) {
      if (!map) return;
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      markerByLocId = {};
      currentMapData = data;
      closeDetailPanel(true); // 資料重新渲染（例如篩選條件變了）時，先收掉舊的側邊欄/sheet，無條件回 peek，改顯示新的預設列表／空狀態，避免內容跟新資料兜不起來

      if (data.length === 0) return; // closeDetailPanel → renderDesktopDefaultPanel 已經處理了「找不到符合的地點」的空狀態

      // 依經緯度分組：同一地點（同一商場）常常有好幾台機器共用同一組座標
      const groups = {};
      data.forEach(loc => {
        const key = `${loc.lat},${loc.lng}`;
        (groups[key] = groups[key] || []).push(loc);
      });

      Object.values(groups).forEach(locs => {
        const { lat, lng } = locs[0];
        const marker = L.marker([lat, lng], { icon: createClusterIcon(locs) }).addTo(map);
        markers.push(marker);
        locs.forEach(loc => { markerByLocId[loc.id] = marker; });
        marker.__locs = locs;

        if (locs.length > 1) {
          // 一開始就綁好 popup（不要等點擊時才延遲綁定）。
          // bindPopup() 本身會自動幫 marker 加上「已開啟就關閉、沒開啟就打開」的內建 click 監聽器，
          // 如果我們自己又手動呼叫 openPopup()，兩邊會在同一次點擊裡互相打架
          // （第一次點沒事，因為內建監聽器是在點擊當下才被加進去、來不及在同一輪觸發；
          //  但只要點過一次之後，兩個監聽器都會生效，變成「我們打開、它馬上關掉」，看起來像沒反應）。
          // 所以這裡只負責綁定內容，開合完全交給 Leaflet 自己的內建行為處理。
          bindClusterPopup(marker, locs);
        }

        marker.on('click', () => {
          // GA: map_marker_click
          gtag('event', 'map_marker_click', {
            machine_id: locs.length === 1 ? locs[0].id : null,
            machine_count: locs.length,
            device: getDeviceType(),
          });

          if (locs.length === 1) {
            window.a2hsRecordCardView && window.a2hsRecordCardView();
            if (isMobileMapLayout()) {
              map.closePopup(); // 關掉任何還留著的 cluster popup，不然它會卡在「已開啟」狀態，之後點回去沒反應
              openMobileSheetSummary(locs[0]);
            } else {
              map.closePopup();
              openDesktopSidebar(locs[0]);
            }
          } else if (isMobileMapLayout()) {
            // 聚合點：popup 開合交給 Leaflet 原生 click-toggle 處理，這裡只負責把 sheet 收回 peek+列表，
            // 讓地圖空間空出來顯示 popup（桌機不用做這件事，因為側欄本來就不會蓋住地圖）。
            // 如果這次點擊其實是原生關閉 popup，popupclose 監聽器已經先做過同樣的事，這裡等於是無害的重複。
            // 不動 sheetReturnLevel：這裡只是暫時收合去露出選單，不是真正的「關閉」，
            // 如果最一開始是從列表點進來的，這筆記憶要留到使用者真的關閉時才用得到。
            sheetLoc = null;
            document.querySelectorAll('.card-marker.selected').forEach(el => el.classList.remove('selected'));
            applySheetLevel('peek');
          }
        });
      });
    }

    // ---- 內容組裝：完整詳情／精簡摘要共用同一份欄位邏輯 ----
    function buildDetailContentHtml(loc, { compact = false } = {}) {
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.city + loc.addr)}`;
      const typeBadge = `<div class="type-badge ${loc.type === '相卡機' ? 'photocard' : 'gacha'}">${loc.type === '相卡機' ? '<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-264q72 0 120-49t48-119q0-69-48-118.5T480-600q-72 0-120 49.5T312-432q0 70 48 119t120 49Zm0-72q-42 0-69-27t-27-68q0-40 27-68.5t69-28.5q42 0 69 28.5t27 68.5q0 41-27 68t-69 27ZM168-144q-29 0-50.5-21.5T96-216v-432q0-29 21.5-50.5T168-720h120l50-67q11-14 26-21.5t32-7.5h168q17 0 32 7.5t26 21.5l50 67h120q30 0 51 21.5t21 50.5v432q0 29-21 50.5T792-144H168Z"/></svg> 相卡機' : '<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="m612-404 31-107q3-11-1-22t-14-18l-93-63q-8-5-16.5-2T508-604l-31 107q-3 11 .5 22t13.5 18l93 63q8 5 17 2t11-12ZM168-222l-30-15q-28-13-38-40t3-55l65-140v250Zm148 78q-31 0-53.5-20.5T240-216v-288l134 360h-58Zm206-4q-31 11-56-1t-36-43L259-660q-11-31 .5-56.5T302-753l294-107q31-11 56 .5t36 42.5l172 472q11 31-.5 56T817-253L522-148Z"/></svg> 抽卡機'}</div>`;
      // close 按鈕跟 badge 放同一個 flex row、align-items:center 垂直置中，
      // 不再靠 popup-close-btn 原本的 position:absolute;top:4px 硬定位（那個沒辦法保證跟 badge 對齊）
      const headerRow = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          ${typeBadge}
          <button class="popup-close-btn" style="position:static;" onclick="closeDetailPanel(false, 'x_button')" aria-label="關閉">✕</button>
        </div>
      `;
      const basicRows = `
        ${loc.venue ? `<div class="popup-addr">場地：${loc.venue}</div>` : ''}
        ${loc.addr ? `<div class="popup-addr">地址：${loc.addr}</div>` : ''}
        ${loc.character ? `<div class="popup-addr">IP：${loc.character}</div>` : ''}
        ${loc.edition ? `<div class="popup-addr">彈數：${loc.edition}</div>` : ''}
      `;

      if (compact) {
        return `
          ${headerRow}
          <div class="modal-header"><div class="popup-title">${loc.name}</div></div>
          ${loc.limited ? `<div class="popup-limited">期間限定：${loc.limited}</div>` : ''}
          <div class="modal-info-section">${basicRows}</div>
        `;
      }

      const imgs = loc.image ? loc.image.split(',').map(s => driveUrlToImage(s.trim())).filter(Boolean) : [];
      let imgHtml = '';
      if (imgs.length === 1) {
        imgHtml = `<div class="popup-img-wrap"><img src="${imgs[0]}" class="popup-img" data-lightbox="${imgs[0]}" alt="${loc.name}" /></div>`;
      } else if (imgs.length > 1) {
        const cid = 'detail-carousel-' + loc.id;
        imgHtml = `
          <div class="popup-img-wrap">
            <div class="carousel" id="${cid}" data-index="0" data-imgs='${JSON.stringify(imgs)}'>
              <div class="carousel-img-wrap">
                <img src="${imgs[0]}" class="popup-img carousel-img" data-lightbox="${imgs[0]}" alt="${loc.name}" />
              </div>
              <div class="carousel-controls">
                <button class="carousel-btn" data-carousel-action="prev" data-carousel-id="${cid}" aria-label="上一張圖片">&#8249;</button>
                <span class="carousel-counter">1 / ${imgs.length}</span>
                <button class="carousel-btn" data-carousel-action="next" data-carousel-id="${cid}" aria-label="下一張圖片">&#8250;</button>
              </div>
            </div>
          </div>`;
      }

      return `
        ${headerRow}
        <div class="modal-header"><div class="popup-title">${loc.name}</div></div>
        ${loc.limited ? `<div class="popup-limited">期間限定：${loc.limited}</div>` : ''}
        <div class="modal-info-section">
          ${basicRows}
          ${loc.perDraw ? `<div class="popup-addr">一抽張數：${loc.perDraw}</div>` : ''}
          ${loc.hours ? `<div class="popup-addr">營業時間：${loc.hours}</div>` : ''}
          ${loc.note ? `<div class="popup-addr">備註：${loc.note}</div>` : ''}
        </div>
        <div class="popup-actions">
          <a href="${googleMapsUrl}" target="_blank" class="popup-gmaps-link" onclick="trackGmapsClick('${loc.id}','map_detail_panel')"><svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M480-191q119-107 179.5-197T720-549q0-105-68.5-174T480-792q-103 0-171.5 69T240-549q0 71 60.5 161T480-191Zm-24.5 67.5Q444-128 433-137q-40-35-86.5-82T260-320q-40-54-66-112.5T168-549q0-134 89-224.5T480-864q133 0 222.5 90.5T792-549q0 58-26.5 117t-66 113q-39.5 54-86 100.5T527-137q-11 9-22.5 13.5T480-119q-13 0-24.5-4.5ZM480-552Zm0 164q62-56 88-81t41-44q14-17 20.5-35.5T636-587q0-35-25.5-60.5T550-673q-21 0-40 9t-30 23q-12-14-30.5-23t-39.5-9q-35 0-60.5 25.5T324-587q0 19 6.5 36t20.5 36q16 21 44 48.5t85 78.5Z"/></svg> 前往 Google Maps 查看 →</a>
          <button class="popup-share-btn" onclick="shareLocation('${loc.id}','map_detail_panel')">分享 <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M648-96q-50 0-85-35t-35-85q0-9 4-29L295-390q-16 14-36.05 22-20.04 8-42.95 8-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 43 8t36 22l237-145q-2-7-3-13.81-1-6.81-1-15.19 0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-43-8t-36-22L332-509q2 7 3 13.81 1 6.81 1 15.19 0 8.38-1 15.19-1 6.81-3 13.81l237 145q16-14 36.05-22 20.04-8 42.95-8 50 0 85 35t35 85q0 50-35 85t-85 35Zm0-72q20.4 0 34.2-13.8Q696-195.6 696-216q0-20.4-13.8-34.2Q668.4-264 648-264q-20.4 0-34.2 13.8Q600-236.4 600-216q0 20.4 13.8 34.2Q627.6-168 648-168ZM216-432q20.4 0 34.2-14 13.8-14 13.8-34t-13.8-34q-13.8-14-34.2-14-20.4 0-34.2 14-13.8 14-13.8 34t13.8 34q13.8 14 34.2 14Zm466-277.8q14-13.8 14-34.2 0-20.4-13.8-34.2Q668.4-792 648-792q-20.4 0-34.2 13.8Q600-764.4 600-744q0 20.4 14 34.2 14 13.8 34 13.8t34-13.8ZM648-216ZM216-480Zm432-264Z"/></svg></button>
        </div>
        ${imgHtml}
      `;
    }

    // ---- Desktop：cluster marker 維持浮動 Leaflet popup（不受這次改版影響）----
    function bindClusterPopup(marker, locs) {
      // 大標題：同座標多台機器如果店名（C欄）都一樣就顯示店名；
      // 店名不一樣就退回顯示場地（D欄）；連場地都沒有才用地址（F欄）
      const uniqueNames = [...new Set(locs.map(l => l.name).filter(Boolean))];
      const venue = uniqueNames.length === 1
        ? uniqueNames[0]
        : (locs[0].venue || locs[0].addr || '');
      const namesAllSame = uniqueNames.length === 1;
      const rowsHtml = locs.map(loc => {
        const primary = loc.character || loc.name; // 優先顯示 IP，沒有 IP 資料時退回顯示活動名稱
        // 店名都一樣的話，大標題已經顯示過了，選項底下不用再重複顯示同一個店名
        const showSub = !namesAllSame && loc.character && loc.name && loc.name !== primary;
        return `
          <button class="cluster-popup-item" type="button" data-loc-id="${loc.id}">
            <div class="type-badge ${loc.type === '相卡機' ? 'photocard' : 'gacha'}">${MARKER_ICON_SVG[loc.type] || ''}</div>
            <span class="cluster-popup-item-text">
              <span class="cluster-popup-item-name">${primary}</span>
              ${showSub ? `<span class="cluster-popup-item-sub">${loc.name}</span>` : ''}
            </span>
          </button>`;
      }).join('');

      // 清單直接跟著標題一起組成完整字串綁給 bindPopup，
      // Leaflet 從一開始量測到的就是完整內容，寬度才會抓對，也不需要事後再 update()
      marker.bindPopup(`
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div class="popup-title" style="white-space:nowrap;">${venue}</div>
            <button class="popup-close-btn" style="position:static; flex-shrink:0;" onclick="map.closePopup()" aria-label="關閉">✕</button>
          </div>
          <div class="popup-addr" style="margin-top:8px;margin-bottom:12px;color:var(--fill-gray-64);">目前有 ${locs.length} 台機器</div>
          <div class="cluster-popup-list">${rowsHtml}</div>
        </div>
      `, { maxWidth: 420, autoPan: false, closeButton: false });

      // popupopen 只負責幫已經渲染好的按鈕綁點擊事件，不再碰 innerHTML
      marker.on('popupopen', () => {
        const el = marker.getPopup().getElement();
        if (!el) return;
        el.querySelectorAll('.cluster-popup-item').forEach(btn => {
          if (btn.dataset.bound) return; // 避免同一顆按鈕重複綁定
          btn.dataset.bound = '1';
          btn.addEventListener('click', (e) => {
            // 擋掉冒泡：這個 click 若冒泡到地圖本身，會被「點地圖空白處收起側欄」那個監聽器接住，
            // 導致這裡剛設定好的詳情內容馬上被 closeDetailPanel() 蓋回列表 / 提示文字。
            e.stopPropagation();
            const loc = locs.find(l => String(l.id) === btn.dataset.locId);
            if (!loc) return;
            gtag('event', 'card_click', { machine_id: loc.id, machine_name: loc.name, machine_type: loc.type, source: 'map_cluster_popup', device: getDeviceType() });
            // popup 保持開著，mobile／desktop 一致；mobile 用 sheet 顯示摘要卡，desktop 用側邊欄顯示完整詳情
            if (isMobileMapLayout()) {
              openMobileSheetSummary(loc);
            } else {
              openDesktopSidebar(loc);
            }
          });
        });
      });
    }

    // ---- Desktop：側邊欄固定寬 400 常駐，預設顯示提示文字；點單一 marker，或 cluster popup 清單裡的項目，才會換成詳情 ----
    export function openDesktopSidebar(loc) {
      document.getElementById('locationList').innerHTML = buildDetailContentHtml(loc, { compact: false });
      highlightMarker(loc);
      focusMapOnLocation(loc);
      lastSelectedLocId = loc.id;
      if (map) setTimeout(() => map.invalidateSize(), 0);
    }

    // ---- 平移地圖到選中的機台（不論從側欄列表或從 marker 選取，統一走這裡）----
    // 縮放層級太小（看不清街廓）才會放大；使用者已手動調到夠近的層級就保留原樣，不搶著幫他改。
    // 是聚合點（同座標多台）的話，額外打開它的 cluster popup，並把清單裡對應那一項標成選中樣式。
    const FOCUS_MIN_ZOOM = 15;
    function focusMapOnLocation(loc) {
      if (!map) return;
      const marker = markerByLocId[loc.id];
      if (!marker) return;

      const targetZoom = map.getZoom() < FOCUS_MIN_ZOOM ? FOCUS_MIN_ZOOM + 1 : map.getZoom();
      map.setView(marker.getLatLng(), targetZoom, { animate: true, duration: 0.4 });

      const locs = marker.__locs || [];
      if (locs.length > 1) {
        const popup = marker.getPopup();
        // 只有在 popup 還沒開的時候才呼叫 openPopup()：對已開啟的 popup 再開一次，
        // Leaflet 會把內容重新產生（按鈕變成全新 DOM 節點），導致其他項目原本綁好的點擊事件失效。
        if (popup && !popup.isOpen()) {
          marker.openPopup();
        }
        const popupEl = popup && popup.getElement();
        if (popupEl) {
          let selectedBtn = null;
          popupEl.querySelectorAll('.cluster-popup-item').forEach(btn => {
            const isSelected = btn.dataset.locId === String(loc.id);
            btn.classList.toggle('selected', isSelected);
            if (isSelected) selectedBtn = btn;
          });
          // popup 清單本身有獨立捲軸（.cluster-popup-list），選中項若在下方會被擋住看不到，
          // 捲進來讓使用者不用自己往下滑確認選到哪一項。
          if (selectedBtn) selectedBtn.scrollIntoView({ block: 'nearest' });
        }
      }
    }

    // ---- Mobile：bottom sheet（peek／mid／full 三檔，列表跟詳情共用同一套）----
    export let sheetLevel = 'peek';        // 'peek' | 'mid' | 'full' | 'content'（content 專屬給撐不滿 mid 的短內容詳情用）
    let sheetLoc = null;            // 目前顯示詳情的那一筆；null 代表顯示列表
    let sheetReturnLevel = null;    // 從 sheet 列表點卡片進入詳情時，記住當時的層級，關閉時要回去；
                                     // 其餘入口（marker／popup／點地圖空白處／篩選改變）不設定，關閉一律回 peek
    let sheetContentMaxHeight = null; // 詳情內容撐不滿 mid 時，記住內容實際高度；這種情況下拖曳最高只能拉到這裡，
                                       // 不是拉到 full（內容就這麼多，拉更高只會多出空白，沒有意義）

    function sheetLevelsStack() {
      // 短內容的詳情（撐不滿 mid）：只有 peek／content 兩檔，拖到底就是內容實際高度，不會拉到 full 空出一片。
      // 列表瀏覽、或內容本身就撐得滿 mid 的詳情：維持原本 peek／mid／full 三檔。
      if (sheetLoc && sheetContentMaxHeight != null) {
        return ['peek', 'content'];
      }
      return ['peek', 'mid', 'full'];
    }

    export function applySheetLevel(level) {
      sheetLevel = level;
      const sidebar = document.querySelector('.sidebar');
      if (level === 'full' && sheetLoc) {
        // 拖到 full 時如果正在看詳情：跟 preferFull 分支共用同一套「內容沒那麼高就貼合、
        // 不留白」的規則，而不是無腦套用固定的 levelHeightPx('full')。
        renderMobileSheetContent();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { fitDetailToTarget('full'); });
        });
      } else {
        sidebar.style.height = levelHeightPx(level) + 'px';
        renderMobileSheetContent();
      }
      if (map) setTimeout(() => map.invalidateSize(), 320);
    }

    // ---- 依 sheetLoc 決定 sheet 裡現在該顯示列表還是詳情內容（純內容渲染，不動高度）----
    function renderMobileSheetContent() {
      const list = document.getElementById('locationList');
      if (!list) return;
      if (!sheetLoc) {
        if (!currentMapData.length) {
          list.innerHTML = '<div class="sidebar-placeholder">找不到符合的地點 இдஇ</div>';
          return;
        }
        list.innerHTML = currentMapData.map(loc => buildSidebarListCardHtml(loc)).join('');
        bindSidebarListCardEvents(list);
        restoreListScrollPosition(list);
      } else {
        list.innerHTML = buildDetailContentHtml(sheetLoc, { compact: false });
      }
    }

    export function openMobileSheetSummary(loc, opts) {
      if (opts && opts.fromListLevel) {
        sheetReturnLevel = opts.fromListLevel;
      }
      // 其餘入口（marker／popup）不動 sheetReturnLevel：有記憶就留著（代表最一開始是從列表
      // 進來的，之後不管在 popup 裡切換幾次機台，都要記得關閉時回到那個列表高度）；
      // 沒有記憶就維持 null（代表這趟純粹從 marker/popup 開始，關閉回 peek）。
      sheetLoc = loc;
      highlightMarker(loc);
      lastSelectedLocId = loc.id;
      focusMapOnLocation(loc);
      applyMobileDetailHeight({ preferFull: opts && opts.preferFull });
    }

    // ---- 共用：量測目前 sheetLoc 詳情內容的實際高度 ----
    // 內容剛塞進 DOM 的同一瞬間量 scrollHeight 不可靠（瀏覽器可能還沒真的排版完成），
    // 呼叫端要負責用兩層 rAF 包起來再呼叫這個函式，確保量到的是排版後的真實高度。
    function measureSheetContentHeight() {
      const handle = document.querySelector('.sheet-handle');
      const handleH = handle ? handle.getBoundingClientRect().height : 0;
      const list = document.getElementById('locationList');
      const peek = levelHeightPx('peek');
      if (!list) return peek;
      // 量到的內容高度不能小於 peek：不管是量測時機不巧、還是內容本身真的很短，
      // sheet（跟拉桿）都不能塌到比 peek 還矮，不然使用者連拉桿都碰不到，等於拖曳完全失效。
      return Math.max(list.scrollHeight + handleH, peek);
    }

    // ---- 共用：把詳情內容「撐到某個目標層級」時，決定實際要用的高度 ----
    // 內容矮於目標高度：貼合內容實際高度，進 content 狀態，不留白。
    // 內容夠高（或超過）：才真的撐滿目標高度（超過的部分靠 sheet 內捲動看完）。
    // preferFull（分享連結進來）跟手動拖曳到 full，都要吃到同一套「不留白」規則，
    // 不能各自寫一份，不然又會變回其中一條路徑忘記套用。
    function fitDetailToTarget(targetLevel) {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return;
      const contentH = measureSheetContentHeight();
      const targetH = levelHeightPx(targetLevel);
      const fitH = Math.min(contentH, targetH);
      if (fitH < targetH) {
        sheetContentMaxHeight = fitH;
        sheetLevel = 'content';
        sidebar.style.height = fitH + 'px';
      } else {
        sheetContentMaxHeight = null;
        sheetLevel = targetLevel;
        sidebar.style.height = targetH + 'px';
      }
    }

    // ---- 詳情開啟時的高度：內容撐不滿 mid（裝置高 0.32）就縮到內容實際高度，不留空白，
    // 這種情況拖曳最高也只能到這個高度（sheetContentMaxHeight），不會拉到 full；
    // 撐得滿或更高就開在 mid，可再手動拖到 full 捲動看完 ----
    function applyMobileDetailHeight(opts) {
      const preferFull = !!(opts && opts.preferFull);
      const sidebar = document.querySelector('.sidebar');
      const list = document.getElementById('locationList');
      const scrollWrapper = document.querySelector('.map-scroll-wrapper');
      if (!sidebar || !list) return;
      renderMobileSheetContent();
      // 切換到新的詳情內容，內部捲動位置要回到最上面，不要沿用上一筆看到一半的位置。
      if (scrollWrapper) scrollWrapper.scrollTop = 0;
      sidebar.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const mid = levelHeightPx('mid');
          const contentH = measureSheetContentHeight();
          if (contentH < mid) {
            // 內容本來就比 mid 矮：維持貼合內容高度，就算 preferFull 也不用硬撐到 full，
            // 不然下面只會多出一大塊空白，反而更難看。
            sheetContentMaxHeight = contentH;
            sheetLevel = 'content';
            sidebar.style.height = contentH + 'px';
          } else if (preferFull) {
            // 分享連結進來：盡量一次看到完整內容，交給共用的 fitDetailToTarget 決定要不要貼合。
            fitDetailToTarget('full');
          } else {
            sheetContentMaxHeight = null; // 內容夠高，維持一般的 mid/full 兩檔可拖
            sheetLevel = 'mid';
            sidebar.style.height = mid + 'px';
          }
          requestAnimationFrame(() => { sidebar.style.transition = ''; });
        });
      });
      if (map) setTimeout(() => map.invalidateSize(), 320);
    }


    // ---- 共用：關閉 sheet／清空側邊欄詳情，回到列表（兩邊平台文案一致，高度規則不同）----
    // Desktop：側邊欄固定常駐，只是內容換回列表。
    // Mobile：從 sheet 列表進入的詳情，關閉後回到選中前那一層；其餘入口一律回 peek；
    // 篩選／搜尋條件改變時（forcePeek=true）無條件回 peek，不管有沒有記住的列表層級。
    let closingDetailPanel = false; // 防重入：map.closePopup() 會同步觸發 popupclose，那個監聽器也會呼叫這裡，沒擋住會無限遞迴
    export function closeDetailPanel(forcePeek, method) {
      if (closingDetailPanel) return;
      closingDetailPanel = true;
      // 只在「真的正在看某台機台詳情」時才算一次使用者主動關閉；篩選/搜尋改變觸發的重置（forcePeek）
      // 是別的事件在管的事，不是使用者主動關閉這個動作本身，不重複記錄。
      if (!forcePeek && method && sheetLoc) {
        gtag('event', 'detail_panel_close', { method, device: getDeviceType() });
      }
      sheetLoc = null;
      document.querySelectorAll('.card-marker.selected').forEach(el => el.classList.remove('selected'));
      if (map) map.closePopup(); // 側欄／sheet 收回時，順便關掉任何還開著的 cluster popup，兩者維持同步
      if (isMobileMapLayout()) {
        const targetLevel = forcePeek ? 'peek' : (sheetReturnLevel || 'peek');
        sheetReturnLevel = null;
        applySheetLevel(targetLevel);
      } else {
        renderDesktopDefaultPanel();
      }
      if (map) setTimeout(() => map.invalidateSize(), 320);
      closingDetailPanel = false;
    }

    // ---- Desktop 預設狀態：沒有選中任何機台時，側邊欄顯示目前篩選結果的卡片列表 ----
    // （沒有結果時顯示空狀態文字）。點列表卡片＝點 marker，直接切到該機台的完整詳情。
    function renderDesktopDefaultPanel() {
      const list = document.getElementById('locationList');
      if (!list) return;
      if (!currentMapData.length) {
        list.innerHTML = '<div class="sidebar-placeholder">找不到符合的地點 இдஇ</div>';
        return;
      }
      list.innerHTML = currentMapData.map(loc => buildSidebarListCardHtml(loc)).join('');
      bindSidebarListCardEvents(list);
      restoreListScrollPosition(list);
    }

    // ---- 共用：回到列表時，把最後選中的那張卡片捲到畫面上方（不是還原成點擊當下的原始畫面）。
    // lastSelectedLocId 每次選中都會更新（不管是列表點的、marker 點的、還是在 popup 裡切換到別的 IP），
    // 所以這裡永遠捲到「最後」選中的那一張，不是最一開始點的那一張。----
    function restoreListScrollPosition(list) {
      if (lastSelectedLocId) {
        const card = list.querySelector(`.loc-card[data-loc-id="${lastSelectedLocId}"]`);
        if (card) card.scrollIntoView({ block: 'start' });
        lastSelectedLocId = null;
      }
    }

    // ---- 側邊欄列表卡片：只顯示挑選機台需要的最少資訊（badge／名稱／期間／tags），
    // 詳細內容（地址、圖片、分享...）留給點選後的完整詳情面板，避免列表跟詳情重複 ----
    function buildSidebarListCardHtml(loc) {
      const typeBadge = `<div class="type-badge ${loc.type === '相卡機' ? 'photocard' : 'gacha'}">${loc.type === '相卡機' ? '<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-264q72 0 120-49t48-119q0-69-48-118.5T480-600q-72 0-120 49.5T312-432q0 70 48 119t120 49Zm0-72q-42 0-69-27t-27-68q0-40 27-68.5t69-28.5q42 0 69 28.5t27 68.5q0 41-27 68t-69 27ZM168-144q-29 0-50.5-21.5T96-216v-432q0-29 21.5-50.5T168-720h120l50-67q11-14 26-21.5t32-7.5h168q17 0 32 7.5t26 21.5l50 67h120q30 0 51 21.5t21 50.5v432q0 29-21 50.5T792-144H168Z"/></svg> 相卡機' : '<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="m612-404 31-107q3-11-1-22t-14-18l-93-63q-8-5-16.5-2T508-604l-31 107q-3 11 .5 22t13.5 18l93 63q8 5 17 2t11-12ZM168-222l-30-15q-28-13-38-40t3-55l65-140v250Zm148 78q-31 0-53.5-20.5T240-216v-288l134 360h-58Zm206-4q-31 11-56-1t-36-43L259-660q-11-31 .5-56.5T302-753l294-107q31-11 56 .5t36 42.5l172 472q11 31-.5 56T817-253L522-148Z"/></svg> 抽卡機'}</div>`;
      const endingBadge = getEndingBadge(loc.limited);
      return `
        <div class="loc-card" data-loc-id="${loc.id}">
          <div class="card-badge-row">
            ${typeBadge}
            ${endingBadge ? `<div class="ending-badge">${endingBadge}</div>` : ''}
          </div>
          <div class="loc-name">${loc.name}</div>
          ${loc.limited ? `<div class="loc-limited">期間限定：${loc.limited}</div>` : ''}
          <div class="loc-tags">
            ${loc.character ? `<span class="tag">${loc.character}</span>` : ''}
            ${loc.city ? `<span class="tag">${loc.city}</span>` : ''}
            ${loc.venue ? `<span class="tag">${loc.venue}</span>` : ''}
          </div>
        </div>`;
    }

    function bindSidebarListCardEvents(container) {
      container.querySelectorAll('.loc-card').forEach(card => {
        card.addEventListener('click', () => {
          const loc = currentMapData.find(l => String(l.id) === card.dataset.locId);
          if (!loc) return;
          gtag('event', 'card_click', {
            machine_id: loc.id,
            machine_name: loc.name,
            machine_type: loc.type,
            source: 'map_sidebar_list',
            device: getDeviceType(),
          });
          window.a2hsRecordCardView && window.a2hsRecordCardView();
          if (isMobileMapLayout()) {
            openMobileSheetSummary(loc, { fromListLevel: sheetLevel });
          } else {
            openDesktopSidebar(loc);
          }
        });
      });
    }

    function highlightMarker(loc) {
      document.querySelectorAll('.card-marker.selected').forEach(el => el.classList.remove('selected'));
      const marker = markerByLocId[loc.id];
      if (!marker) return;
      const el = marker.getElement();
      if (el) el.classList.add('selected');
    }

    // 判斷目前是不是走 mobile 地圖版型：跟篩選器的 isMobileFilterLayout() 統一用同一條 768px 分界線，
    // 跟 getDeviceType()（用 pointer:coarse 判斷、給 GA 用）分開，
    // 避免「觸控筆電＋寬螢幕」這種邊界情況兩邊判斷對不上。
    export function isMobileMapLayout() {
      return window.matchMedia('(max-width: 768px)').matches;
    }

    // =============================================
    // 🖼️ Google Drive 轉圖片網址
    // =============================================
    const SHEET_PEEK_RATIO = 0.12; // 收合：露出拉桿 + 第一張卡片的頂端一小截（0.08 太矮，連卡片頂端都看不到）
    const SHEET_MID_RATIO = 0.32;  // 中間展開：可以看到好幾張卡片／詳情的預設開啟高度

    function levelHeightPx(level) {
      if (level === 'peek') return window.innerHeight * SHEET_PEEK_RATIO;
      if (level === 'content') return sheetContentMaxHeight != null ? sheetContentMaxHeight : window.innerHeight * SHEET_MID_RATIO;
      if (level !== 'full') return window.innerHeight * SHEET_MID_RATIO; // 'mid'
      // 完整展開最高只能頂到篩選列下緣，不能蓋住搜尋框／篩選器
      const filterBar = document.getElementById('filterBar');
      const topLimit = filterBar ? filterBar.getBoundingClientRect().bottom + 8 : window.innerHeight * 0.3;
      return Math.max(window.innerHeight - topLimit, window.innerHeight * 0.4);
    }

    export function initBottomSheet() {
      const sidebar = document.querySelector('.sidebar');
      const handle = document.querySelector('.sheet-handle');
      if (!handle || handle.dataset.sheetInit) return;
      handle.dataset.sheetInit = '1';

      let startY = 0;
      let startHeight = 0;

      handle.addEventListener('touchstart', function(e) {
        startY = e.touches[0].clientY;
        startHeight = sidebar.getBoundingClientRect().height;
        sidebar.style.transition = 'none';
      }, { passive: true });

      handle.addEventListener('touchmove', function(e) {
        const dy = startY - e.touches[0].clientY;
        const levels = sheetLevelsStack();
        const minH = levelHeightPx(levels[0]);
        const maxH = levelHeightPx(levels[levels.length - 1]); // 拿目前這個 stack 真正的最高一格，短內容詳情時是 content 不是 full
        const newHeight = Math.min(Math.max(startHeight + dy, minH), maxH);
        sidebar.style.height = newHeight + 'px';
      }, { passive: true });

      handle.addEventListener('touchend', function(e) {
        sidebar.style.transition = '';
        const dy = startY - e.changedTouches[0].clientY;
        const levels = sheetLevelsStack();
        const curIdx = levels.indexOf(sheetLevel);
        let nextIdx = curIdx;
        if (dy > 50 && curIdx < levels.length - 1) nextIdx = curIdx + 1;      // 往上滑：展開一層
        else if (dy < -50 && curIdx > 0) nextIdx = curIdx - 1;               // 往下滑：收合一層（不會低於清單/摘要層）
        applySheetLevel(levels[nextIdx]);
        if (nextIdx !== curIdx) {
          gtag('event', 'sheet_toggle', { state: levels[nextIdx], device: getDeviceType() }); // GA：只在真正拖拉造成狀態改變時記錄
        }
      });
    }
