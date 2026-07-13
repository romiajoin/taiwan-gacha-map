// =============================================
// sort.js — 排序 UI（按鈕／dropdown／bottom sheet）+ 定位權限 + 排序狀態
// 會讀寫 main.js 的 currentFiltered（透過 setCurrentFiltered，因為 import 進來的變數
// 不能直接重新賦值，只能透過 main.js 提供的 setter 改）、呼叫 map.js 的 map／renderMapLocations、
// 也會呼叫 filters.js 的 isMobileFilterLayout／closeMobileFilterSheet。
// =============================================

import { getDeviceType } from './utils.js';
import { renderGrid, sortLocations } from './grid.js';
import { isMobileFilterLayout, closeMobileFilterSheet } from './filters.js';
import { currentFiltered, setCurrentFiltered } from './main.js';
import { map, renderMapLocations } from './map.js';

    // =============================================
    // 🔽 排序設定（結束日期 / 距離）
    // =============================================
    const SORT_OPTIONS = [
      { key: 'end_date_asc', label1: '結束日', label2: '近到遠', text: '結束日：近到遠' },
      { key: 'distance_asc', label1: '距離',   label2: '近到遠', text: '距離：近到遠' },
      { key: 'distance_desc', label1: '距離',  label2: '遠到近', text: '距離：遠到近' },
    ];
    export let sortState = 'end_date_asc'; // default
    export let userCoords = null; // { lat, lng }，成功定位後才有值

    // =============================================
    // 🔽 排序按鈕 / dropdown / bottom sheet
    // =============================================
    export function renderSortControl(bar) {
      const group = document.createElement('div');
      group.className = 'sort-group';
      group.innerHTML = `
        <button class="sort-btn" id="sortBtn" type="button">
          <span class="sort-label">
            <span id="sortLabel1"></span>
            <span id="sortLabel2"></span>
          </span>
          <svg class="pill-chevron" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M461-403 318.88-545.19q-2.94-2.95-4.41-6.38Q313-555 313-558.5q0-7 4.95-12.25T331-576h298q8.1 0 13.05 5.4Q647-565.2 647-558q0 1-5.88 12.77L499-403q-4 4-9 6t-10 2q-5 0-10-2t-9-6Z"/></svg>
        </button>
        <div class="sort-panel" id="sortPanel">
          <div class="sort-hint" id="sortPanelHint"></div>
        </div>`;
      bar.appendChild(group);

      const panel = group.querySelector('#sortPanel');
      panel.addEventListener('click', e => e.stopPropagation());
      SORT_OPTIONS.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'sort-option';
        btn.type = 'button';
        btn.textContent = opt.text;
        btn.dataset.sort = opt.key;
        btn.addEventListener('click', () => selectSortOption(opt.key));
        panel.appendChild(btn);
      });

      group.querySelector('#sortBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        if (isMobileFilterLayout()) {
          openMobileSortSheet();
        } else {
          toggleDesktopSortPanel();
        }
      });

      updateSortDisplay();
    }

    function updateSortDisplay() {
      const opt = SORT_OPTIONS.find(o => o.key === sortState);
      const label1 = document.getElementById('sortLabel1');
      const label2 = document.getElementById('sortLabel2');
      if (label1 && label2) {
        label1.textContent = opt.label1;
        label2.textContent = opt.label2;
      }
      document.querySelectorAll('.sort-option').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.sort === sortState);
      });
    }

    function toggleDesktopSortPanel() {
      const panel = document.getElementById('sortPanel');
      const btn = document.getElementById('sortBtn');
      const wasOpen = panel.classList.contains('open');
      closeDesktopPanels();
      closeDesktopSortPanel();
      if (wasOpen) return;
      panel.classList.add('open');
      btn.classList.add('open');
    }

    export function closeDesktopSortPanel() {
      const panel = document.getElementById('sortPanel');
      const btn = document.getElementById('sortBtn');
      if (panel) panel.classList.remove('open');
      if (btn) btn.classList.remove('open');
      const hint = document.getElementById('sortPanelHint');
      if (hint) hint.classList.remove('show');
    }

    function openMobileSortSheet() {
      closeMobileFilterSheet(true);
      const sheetOptionsEl = document.getElementById('sortSheetOptions');
      sheetOptionsEl.innerHTML = '';
      SORT_OPTIONS.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'sort-option';
        btn.type = 'button';
        btn.textContent = opt.text;
        btn.dataset.sort = opt.key;
        if (opt.key === sortState) btn.classList.add('selected');
        btn.addEventListener('click', () => selectSortOption(opt.key));
        sheetOptionsEl.appendChild(btn);
      });
      document.getElementById('sortSheetHint').classList.remove('show');
      document.getElementById('sortSheetOverlay').classList.add('show');
      const sortBtn = document.getElementById('sortBtn');
      if (sortBtn) sortBtn.classList.add('open');
    }

    export function closeMobileSortSheet() {
      document.getElementById('sortSheetOverlay').classList.remove('show');
      const sortBtn = document.getElementById('sortBtn');
      if (sortBtn) sortBtn.classList.remove('open');
    }

    document.getElementById('sortSheetClose').addEventListener('click', closeMobileSortSheet);
    document.getElementById('sortSheetOverlay').addEventListener('click', closeMobileSortSheet);

    function geoPermissionDenied() {
      return localStorage.getItem('geo_permission_denied') === 'true';
    }

    function requestUserLocation() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject({ status: 'unavailable', message: '此瀏覽器不支援定位功能' });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          err => {
            const statusMap = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };
            reject({ status: statusMap[err.code] || 'unavailable', message: err.message });
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      });
    }

    function showSortHint(msg) {
      const panelHint = document.getElementById('sortPanelHint');
      if (panelHint) { panelHint.textContent = msg; panelHint.classList.add('show'); }
      const sheetHint = document.getElementById('sortSheetHint');
      if (sheetHint) { sheetHint.textContent = msg; sheetHint.classList.add('show'); }
    }

    // 定位失敗時依 err.status 對應到不同文案，讓使用者知道具體是哪種情況
    const GEO_ERROR_MESSAGES = {
      denied: '無法取得您的位置，請至瀏覽器設定開啟定位權限',
      timeout: '定位逾時，請稍後再試',
      unavailable: '此裝置不支援定位功能',
    };

    function selectSortOption(key) {
      const isDistance = key === 'distance_asc' || key === 'distance_desc';
      if (!isDistance) {
        applySortState(key);
        return;
      }
      if (userCoords) {
        applySortState(key);
        return;
      }
      if (geoPermissionDenied()) {
        showSortHint('請至瀏覽器設定開啟定位權限');
        return;
      }
      requestUserLocation()
        .then(coords => {
          userCoords = coords;
          localStorage.removeItem('geo_permission_denied');
          // GA: geo_permission_result
          gtag('event', 'geo_permission_result', { geo_result: 'granted', device: getDeviceType() });
          applySortState(key);
        })
        .catch(err => {
          const status = (err && err.status) || 'unavailable';
          if (status === 'denied') localStorage.setItem('geo_permission_denied', 'true');
          // GA: geo_permission_result
          gtag('event', 'geo_permission_result', { geo_result: status, device: getDeviceType() });
          showSortHint(GEO_ERROR_MESSAGES[status] || GEO_ERROR_MESSAGES.unavailable);
        });
    }

    function applySortState(key) {
      sortState = key;
      updateSortDisplay();
      closeDesktopSortPanel();
      closeMobileSortSheet();
      currentFiltered = sortLocations(currentFiltered);
      renderGrid(currentFiltered);
      if (map) renderMapLocations(currentFiltered);

      // 排序＝重新給名次，捲動位置停在原地會對不上新的順序，兩種模式／裝置都直接捲回最上面
      const gridViewEl = document.getElementById('gridView');
      if (gridViewEl) gridViewEl.scrollTop = 0;
      const mapScrollWrapper = document.querySelector('.map-scroll-wrapper');
      if (mapScrollWrapper) mapScrollWrapper.scrollTop = 0;

      // GA: sort_change（新事件，尚未列入 GA4 事件表，之後要記得補上）
      gtag('event', 'sort_change', { sort_key: key, device: getDeviceType() });
    }
