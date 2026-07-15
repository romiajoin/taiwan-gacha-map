// =============================================
// filters.js — 篩選 UI（pill／dropdown／bottom sheet）+ 篩選狀態
// 拆分階段三之二：跟 sort.js 高度互相依賴（原始碼裡兩者本來就緊緊相鄰、互相呼叫對方的
// 開關函式），所以會 import sort.js 的 closeDesktopSortPanel／closeMobileSortSheet／
// renderSortControl；也需要 main.js 的 isMobileFilterLayout／applyFilters／getDeviceType
// （getDeviceType 其實是從 utils.js 轉出來的，main.js 自己也是 import 的）。
//
// filterState 是用 const 宣告的物件，這裡跟 main.js 之間只互相「改物件內的屬性」
// （filterState[key] = [...]），不是「重新指到別的物件」，所以可以直接 export/import，
// 不需要像 currentFiltered 那樣另外寫 setter。
// =============================================

import { getDeviceType } from './utils.js';
import { applyFilters } from './main.js';
import { renderSortControl, closeDesktopSortPanel, closeMobileSortSheet } from './sort.js';

    // =============================================
    // 🔽 篩選設定（機台 / IP / 縣市）
    // =============================================
    export const FILTER_CONFIG = [
      { key: 'type',  label: '機台', field: 'type',      fixedOptions: ['抽卡機', '相卡機'] },
      { key: 'ip',    label: 'IP',      field: 'character' },
      { key: 'city',  label: '縣市',    field: 'city' },
    ];
    export const filterState = { type: [], city: [], ip: [] };
    let filterOptionsData = {};
    let openPanelKey = null;

    // =============================================
    // 🔽 篩選 pill / dropdown / bottom sheet
    // =============================================
    // 縣市固定順序（依指定排列）
    const TW_CITY_ORDER = [
      '臺北市', '新北市', '基隆市', '桃園市',
      '新竹市', '臺中市', '嘉義市', '臺南市',
      '高雄市', '新竹縣', '宜蘭縣', '苗栗縣',
      '彰化縣', '雲林縣', '南投縣', '嘉義縣',
      '屏東縣', '花蓮縣', '臺東縣', '澎湖縣',
      '金門縣', '連江縣',
    ];

    export function buildFilterOptions(locations) {
      filterOptionsData = {};
      FILTER_CONFIG.forEach(cfg => {
        if (cfg.fixedOptions) {
          filterOptionsData[cfg.key] = cfg.fixedOptions;
          return;
        }
        if (cfg.key === 'city') {
          // 縣市固定顯示全部 22 個，不受資料是否存在影響；沒資料的選項篩出來會是 0 筆
          filterOptionsData[cfg.key] = TW_CITY_ORDER.slice();
          return;
        }
        const uniq = [...new Set(locations.map(l => l[cfg.field]).filter(Boolean))];
        uniq.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        filterOptionsData[cfg.key] = uniq;
      });
    }

    export function isMobileFilterLayout() {
      return window.matchMedia('(max-width: 768px)').matches;
    }

    function pillLabelText(cfg) {
      const selected = filterState[cfg.key];
      if (selected.length === 0) return cfg.label;
      if (selected.length === 1) return selected[0];
      return `${cfg.label} (${selected.length})`;
    }

    export function renderFilterBar() {
      const bar = document.getElementById('filterBar');
      bar.innerHTML = '';
      const scroll = document.createElement('div');
      scroll.className = 'filter-scroll';
      scroll.id = 'filterScroll';
      bar.appendChild(scroll);

      FILTER_CONFIG.forEach(cfg => {
        const group = document.createElement('div');
        group.className = 'filter-pill-group';
        group.innerHTML = `
          <button class="filter-pill" data-key="${cfg.key}" type="button">
            <span class="pill-label">${pillLabelText(cfg)}</span>
            <span class="pill-icon" data-role="icon">
              <svg class="pill-chevron" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M461-403 318.88-545.19q-2.94-2.95-4.41-6.38Q313-555 313-558.5q0-7 4.95-12.25T331-576h298q8.1 0 13.05 5.4Q647-565.2 647-558q0 1-5.88 12.77L499-403q-4 4-9 6t-10 2q-5 0-10-2t-9-6Z"/></svg>
              <svg class="pill-clear" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="m480-429 116 116q11 11 25.5 10.5T647-314q11-11 11-25.5T647-365L531-480l116-116q11-11 11-25.5T647-647q-11-11-25.5-11T596-647L480-531 364-647q-11-11-25-11t-25 11q-11 11-11 25.5t11 25.5l115 116-116 116q-11 11-10.5 25t11.5 25q11 11 25.5 11t25.5-11l115-115Zm0 333q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z"/></svg>
            </span>
          </button>
          <div class="filter-panel" data-panel="${cfg.key}">
            ${cfg.key === 'ip' ? `<div class="filter-panel-hint">依「數字 → 筆畫 → 英文」排序</div>` : ''}
            <div class="filter-panel-options"></div>
          </div>`;
        scroll.appendChild(group);
        group.querySelector('.filter-panel').addEventListener('click', e => e.stopPropagation());
        renderOptionsInto(group.querySelector('.filter-panel-options'), cfg);
        fitPanelWidth(group.querySelector('.filter-panel'));
      });

      renderSortControl(bar);

      bar.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const key = this.getAttribute('data-key');
          if (isMobileFilterLayout()) {
            openMobileFilterSheet(key);
          } else {
            toggleDesktopPanel(key);
          }
        });
        // icon 區域單獨處理：active 狀態下顯示清除 icon,點擊只清除該類別篩選,不觸發展開選單
        btn.querySelector('.pill-icon').addEventListener('click', function (e) {
          e.stopPropagation();
          const key = btn.getAttribute('data-key');
          if (btn.classList.contains('active')) {
            clearFilterKey(key);
          } else if (isMobileFilterLayout()) {
            openMobileFilterSheet(key);
          } else {
            toggleDesktopPanel(key);
          }
        });
      });

      refreshPillStates();
    }

    function renderOptionsInto(container, cfg) {
      container.innerHTML = '';
      filterOptionsData[cfg.key].forEach(value => {
        const btn = document.createElement('button');
        btn.className = 'filter-option';
        btn.type = 'button';
        btn.textContent = value;
        if (filterState[cfg.key].includes(value)) btn.classList.add('selected');
        btn.addEventListener('click', () => toggleFilterValue(cfg.key, value));
        container.appendChild(btn);
      });
    }

    function toggleFilterValue(key, value) {
      const selected = filterState[key];
      const idx = selected.indexOf(value);
      const willSelect = idx === -1;
      if (willSelect) selected.push(value); else selected.splice(idx, 1);

      // GA: filter_click
      gtag('event', 'filter_click', {
        filter_type: key,
        filter_value: value,
        filter_state: willSelect ? 'on' : 'off',
        device: getDeviceType(),
      });

      const cfg = FILTER_CONFIG.find(c => c.key === key);

      // 重新渲染桌面下拉面板的選中狀態
      const panelOptions = document.querySelector(`.filter-panel[data-panel="${key}"] .filter-panel-options`);
      if (panelOptions) {
        renderOptionsInto(panelOptions, cfg);
        fitPanelWidth(panelOptions.closest('.filter-panel'));
      }

      // 若手機 bottom sheet 正顯示同一個類別，也一併更新
      const sheet = document.getElementById('filterSheet');
      if (sheet.dataset.key === key) {
        const sheetOptionsEl = document.getElementById('filterSheetOptions');
        renderOptionsInto(sheetOptionsEl, cfg);
        if (key === 'type') sheetOptionsEl.style.width = '';
        else fitOptionsWidth(sheetOptionsEl);
      }

      refreshPillStates();
      applyFilters();
    }

    // flex-wrap 容器的 fit-content 在規格上是「假裝不換行」去量寬度的，
    // 沒辦法直接撐出「換行後最寬那一列」的寬度，所以改用 JS 量測：
    // 抓每個 chip 換行後的列（用 offsetTop 分組），取最寬那一列的寬度
    // 設成容器寬度，讓 margin:0 auto 能真正把整個區塊置中。
    function fitOptionsWidth(container) {
      container.style.width = '';
      const items = Array.from(container.children);
      if (!items.length) return;
      const rows = new Map();
      items.forEach(item => {
        const top = item.offsetTop;
        if (!rows.has(top)) rows.set(top, []);
        rows.get(top).push(item);
      });
      let maxRowWidth = 0;
      rows.forEach(rowItems => {
        const left = Math.min(...rowItems.map(i => i.offsetLeft));
        const right = Math.max(...rowItems.map(i => i.offsetLeft + i.offsetWidth));
        maxRowWidth = Math.max(maxRowWidth, right - left);
      });
      if (maxRowWidth > 0) container.style.width = Math.ceil(maxRowWidth) + 'px';
    }

    // 桌面 dropdown 面板同樣的問題：width:max-content 對會換行的 flex 容器
    // 是「假裝不換行」去算的，內容一多一定超過 max-width，永遠卡滿 320px，
    // 就算換行後實際只用到一部分寬度也一樣。改用量測換行後實際列寬來設定面板寬度。
    function fitPanelWidth(panelEl) {
      const optionsEl = panelEl.querySelector('.filter-panel-options');
      if (!optionsEl) return;
      const prevDisplay = panelEl.style.display;
      const wasHidden = getComputedStyle(panelEl).display === 'none';
      if (wasHidden) panelEl.style.display = 'block';
      panelEl.style.width = '';

      const items = Array.from(optionsEl.children);
      if (items.length) {
        const rows = new Map();
        items.forEach(item => {
          const top = item.offsetTop;
          if (!rows.has(top)) rows.set(top, []);
          rows.get(top).push(item);
        });
        let maxRowWidth = 0;
        rows.forEach(rowItems => {
          const left = Math.min(...rowItems.map(i => i.offsetLeft));
          const right = Math.max(...rowItems.map(i => i.offsetLeft + i.offsetWidth));
          maxRowWidth = Math.max(maxRowWidth, right - left);
        });
        const cs = getComputedStyle(panelEl);
        const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        if (maxRowWidth > 0) panelEl.style.width = Math.ceil(maxRowWidth + paddingX) + 'px';
      }

      if (wasHidden) panelEl.style.display = prevDisplay;
    }

    function refreshPillStates() {
      FILTER_CONFIG.forEach(cfg => {
        const pill = document.querySelector(`.filter-pill[data-key="${cfg.key}"]`);
        if (!pill) return;
        pill.querySelector('.pill-label').textContent = pillLabelText(cfg);
        pill.classList.toggle('active', filterState[cfg.key].length > 0);
      });
    }

    function clearFilterKey(key) {
      const cfg = FILTER_CONFIG.find(c => c.key === key);
      const hadFilter = filterState[key].length > 0;
      filterState[key] = [];

      // 重新渲染桌面下拉面板的選中狀態
      const panelOptions = document.querySelector(`.filter-panel[data-panel="${key}"] .filter-panel-options`);
      if (panelOptions) {
        renderOptionsInto(panelOptions, cfg);
        fitPanelWidth(panelOptions.closest('.filter-panel'));
      }

      // 若手機 bottom sheet 正顯示同一個類別，也一併更新
      const sheet = document.getElementById('filterSheet');
      if (sheet.dataset.key === key) {
        const sheetOptionsEl = document.getElementById('filterSheetOptions');
        renderOptionsInto(sheetOptionsEl, cfg);
        if (key === 'type') sheetOptionsEl.style.width = '';
        else fitOptionsWidth(sheetOptionsEl);
      }

      refreshPillStates();
      applyFilters();

      // GA: filter_clear
      if (hadFilter) {
        gtag('event', 'filter_clear', { filter_type: key, device: getDeviceType() });
      }
    }

    function toggleDesktopPanel(key) {
      const alreadyOpen = openPanelKey === key;
      closeDesktopPanels();
      closeDesktopSortPanel();
      if (alreadyOpen) return;
      const panel = document.querySelector(`.filter-panel[data-panel="${key}"]`);
      const pill = document.querySelector(`.filter-pill[data-key="${key}"]`);
      panel.classList.add('open');
      pill.classList.add('open');
      openPanelKey = key;

      // GA: filter_panel_open
      gtag('event', 'filter_panel_open', { filter_type: key, device: getDeviceType() });
    }

    export function closeDesktopPanels(skipTracking) {
      if (openPanelKey && !skipTracking) {
        // GA: filter_panel_close
        gtag('event', 'filter_panel_close', {
          filter_type: openPanelKey,
          had_selection: filterState[openPanelKey].length > 0,
          device: getDeviceType(),
        });
      }
      document.querySelectorAll('.filter-panel.open').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.filter-pill.open').forEach(p => p.classList.remove('open'));
      openPanelKey = null;
    }

    document.addEventListener('click', function () {
      closeDesktopPanels();
      closeDesktopSortPanel();
    });


    function openMobileFilterSheet(key) {
      closeMobileSortSheet();
      const cfg = FILTER_CONFIG.find(c => c.key === key);
      document.getElementById('filterSheetTitle').textContent = cfg.key === 'ip' ? 'IP 篩選' : `${cfg.label}篩選`;
      const sheet = document.getElementById('filterSheet');
      sheet.dataset.key = key;
      const hintEl = document.getElementById('filterSheetHint');
      if (cfg.key === 'ip') {
        hintEl.textContent = '依「數字 → 筆畫 → 英文」排序，可滑動尋找';
        hintEl.style.display = 'block';
      } else {
        hintEl.style.display = 'none';
      }
      const sheetOptionsEl = document.getElementById('filterSheetOptions');
      renderOptionsInto(sheetOptionsEl, cfg);
      document.getElementById('filterSheetOverlay').classList.add('show');
      if (key === 'type') sheetOptionsEl.style.width = '';
      else fitOptionsWidth(sheetOptionsEl);
      const pill = document.querySelector(`.filter-pill[data-key="${key}"]`);
      if (pill) pill.classList.add('open');

      // GA: filter_panel_open
      gtag('event', 'filter_panel_open', { filter_type: key, device: getDeviceType() });
    }

    export function closeMobileFilterSheet(skipTracking) {
      const key = document.getElementById('filterSheet').dataset.key;
      const wasShown = document.getElementById('filterSheetOverlay').classList.contains('show');
      if (wasShown && key && !skipTracking) {
        // GA: filter_panel_close
        gtag('event', 'filter_panel_close', {
          filter_type: key,
          had_selection: (filterState[key] || []).length > 0,
          device: getDeviceType(),
        });
      }
      document.getElementById('filterSheetOverlay').classList.remove('show');
      const pill = document.querySelector(`.filter-pill[data-key="${key}"]`);
      if (pill) pill.classList.remove('open');
    }

    document.getElementById('filterSheetClose').addEventListener('click', () => closeMobileFilterSheet());
    document.getElementById('filterSheetOverlay').addEventListener('click', () => closeMobileFilterSheet());
    window.addEventListener('resize', () => closeDesktopPanels(true));
    window.addEventListener('resize', () => closeDesktopSortPanel());
    window.addEventListener('resize', function () {
      const overlay = document.getElementById('filterSheetOverlay');
      if (overlay.classList.contains('show') && document.getElementById('filterSheet').dataset.key !== 'type') {
        fitOptionsWidth(document.getElementById('filterSheetOptions'));
      }
    });
