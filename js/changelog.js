// =============================================
// changelog.js — 使用者版更新日誌
// 獨立於 grid-modal（詳情）／filter-sheet（篩選排序）之外的專用元件。
// 桌機：置中 modal；手機：CSS media query 切成單一高度的 bottom sheet（無拖曳/多段 snap，
// 內容單純不需要那種複雜度，跟 map.js 裡的地圖 bottom sheet 是兩套不同的東西）。
// 資料源是同層的 changelog.json，跟 Notion 上的「使用者版更新日誌」頁面內容保持一致，
// 之後每次上版，記完開發日誌後，記得也在 changelog.json 補一筆使用者向的一句話說明。
// =============================================

import { getDeviceType } from './utils.js';

let changelogData = null; // cache，同一次瀏覽不用重複打 fetch

async function loadChangelog() {
  if (changelogData) return changelogData;
  try {
    const res = await fetch('changelog.json');
    changelogData = await res.json();
  } catch (err) {
    console.error('更新日誌載入失敗：', err);
    changelogData = [];
  }
  return changelogData;
}

function renderChangelog(entries) {
  const body = document.getElementById('changelogBody');
  if (!entries.length) {
    body.innerHTML = '<div class="empty-state">目前沒有更新紀錄</div>';
    return;
  }
  body.innerHTML = entries.map(e => {
    // text 可以是單一字串（當天只有一項變動），或陣列（當天多項變動，各自列一個 bullet）
    const textHtml = Array.isArray(e.text)
      ? `<ul class="changelog-bullets">${e.text.map(t => `<li>${t}</li>`).join('')}</ul>`
      : `<div class="changelog-text">${e.text}</div>`;
    return `
      <div class="changelog-entry">
        <div class="changelog-date">${e.date}</div>
        ${textHtml}
      </div>
    `;
  }).join('');
}

export async function openChangelog(source) {
  const entries = await loadChangelog();
  renderChangelog(entries);
  document.getElementById('changelogOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  // GA: changelog_open
  gtag('event', 'changelog_open', { source: source || 'unknown', device: getDeviceType() });
}

export function closeChangelog(e) {
  // 跟 gridModal 同一套判斷：有事件物件、且點的是 overlay 本身（背景），才算 backdrop_click；
  // 沒有事件物件（直接呼叫）就是點了 X 按鈕
  if (e && e.target !== document.getElementById('changelogOverlay')) return;
  document.getElementById('changelogOverlay').classList.remove('show');
  document.body.style.overflow = '';
  // GA: changelog_close
  gtag('event', 'changelog_close', {
    method: e ? 'backdrop_click' : 'x_button',
    device: getDeviceType(),
  });
}

document.getElementById('changelogLinkDesktop').addEventListener('click', (e) => {
  e.preventDefault();
  openChangelog('header_desktop');
});
document.getElementById('changelogLinkMobile').addEventListener('click', (e) => {
  e.preventDefault();
  openChangelog('header_mobile_list');
});
document.getElementById('changelogClose').addEventListener('click', () => closeChangelog());

// 掛到 window：changelog-overlay 的 onclick="closeChangelog(event)" 是寫死在 index.html 裡的 inline attribute
window.closeChangelog = closeChangelog;
