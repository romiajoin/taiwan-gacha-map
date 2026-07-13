// =============================================
// grid.js — 格狀列表渲染 + 排序邏輯（結束日期 / 距離）
// 拆分階段二：這塊算「次獨立」——會讀 sort.js 的 sortState／userCoords，
// 也會呼叫 main.js 的 driveUrlToImage／openGridModal，
// 但不會回頭呼叫地圖或篩選 UI 的任何東西，依賴方向大致單向。
//
// 註：applyFilters／syncCount／trackFilterResult／handleSearch 這幾個「重新計算＋觸發地圖同步」
// 的協調邏輯，因為牽動 map／sheet 狀態太深，這階段先留在 main.js，之後視情況再決定要不要獨立成
// core.js。
// =============================================

import { getDeviceType } from './utils.js';
import { driveUrlToImage, openGridModal } from './main.js';
import { sortState, userCoords } from './sort.js';


    // =============================================
    // 🃏 渲染格狀列表
    // =============================================
    export function renderGrid(data) {
      const grid = document.getElementById('grid');
      grid.innerHTML = '';
      document.getElementById('countBadge').textContent = data.length;

      if (data.length === 0) {
        grid.innerHTML = '<div class="empty-state">找不到符合的地點 இдஇ</div>';
        return;
      }

      data.forEach((loc, i) => {
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.city + loc.addr)}`;
        const imgs = loc.image
          ? loc.image.split(',').map(s => driveUrlToImage(s.trim())).filter(Boolean)
          : [];

        const cid = 'grid-c-' + i;
        let imageHtml = '';
        if (imgs.length === 1) {
          imageHtml = `<div class="single-img-wrap"><img src="${imgs[0]}" data-lightbox="${imgs[0]}" loading="lazy" alt="${loc.name}"/></div>`;
        } else if (imgs.length > 1) {
          imageHtml = `
            <div class="carousel-grid" id="${cid}" data-index="0" data-imgs='${JSON.stringify(imgs)}'>
              <div class="carousel-grid-img-wrap">
                <img src="${imgs[0]}" class="carousel-grid-img" data-lightbox="${imgs[0]}" loading="lazy" alt="${loc.name}"/>
              </div>
              <div class="carousel-controls-grid">
                <button class="carousel-btn" data-grid-action="prev" data-grid-cid="${cid}" aria-label="上一張圖片">&#8249;</button>
                <span class="carousel-counter" style="color:var(--grey)">1 / ${imgs.length}</span>
                <button class="carousel-btn" data-grid-action="next" data-grid-cid="${cid}" aria-label="下一張圖片">&#8250;</button>
              </div>
            </div>`;
        }

        const hasDetail = loc.addr || loc.edition || loc.perDraw || loc.hours || loc.note || imgs.length > 0;
        let detailHtml = '';
        if (loc.addr) detailHtml += `<div class="detail-row"><span class="detail-text">${loc.city}${loc.addr}</span></div>`;
        if (loc.hours) detailHtml += `<div class="detail-row"><span class="detail-text">${loc.hours}</span></div>`;
        if (loc.edition || loc.perDraw) {
          const t = [loc.edition ? `彈數：${loc.edition}` : '', loc.perDraw ? `一抽：${loc.perDraw}張` : ''].filter(Boolean).join('　');
          detailHtml += `<div class="detail-row"><span class="detail-text">${t}</span></div>`;
        }
        if (loc.note) detailHtml += `<div class="detail-row"><span class="detail-text">備註：${loc.note}</span></div>`;
        if (imageHtml) detailHtml += imageHtml;

        const card = document.createElement('div');
        card.className = 'loc-card-grid';
        card.dataset.machineId = loc.id;
        const endingBadge = getEndingBadge(loc.limited);
        card.innerHTML = `
          <div class="card-top">
            <div class="card-badge-row">
            <div class="type-badge ${loc.type === '相卡機' ? 'photocard' : 'gacha'}">${loc.type === '相卡機' ? '<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M480-264q72 0 120-49t48-119q0-69-48-118.5T480-600q-72 0-120 49.5T312-432q0 70 48 119t120 49Zm0-72q-42 0-69-27t-27-68q0-40 27-68.5t69-28.5q42 0 69 28.5t27 68.5q0 41-27 68t-69 27ZM168-144q-29 0-50.5-21.5T96-216v-432q0-29 21.5-50.5T168-720h120l50-67q11-14 26-21.5t32-7.5h168q17 0 32 7.5t26 21.5l50 67h120q30 0 51 21.5t21 50.5v432q0 29-21 50.5T792-144H168Z"/></svg> 相卡機' : '<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="m612-404 31-107q3-11-1-22t-14-18l-93-63q-8-5-16.5-2T508-604l-31 107q-3 11 .5 22t13.5 18l93 63q8 5 17 2t11-12ZM168-222l-30-15q-28-13-38-40t3-55l65-140v250Zm148 78q-31 0-53.5-20.5T240-216v-288l134 360h-58Zm206-4q-31 11-56-1t-36-43L259-660q-11-31 .5-56.5T302-753l294-107q31-11 56 .5t36 42.5l172 472q11 31-.5 56T817-253L522-148Z"/></svg> 抽卡機'}</div>
            ${endingBadge ? `<div class="ending-badge">${endingBadge}</div>` : ''}
            </div>
            <div class="card-name">${loc.name}</div>
            ${loc.limited ? `<div class="card-limited">期間限定：${loc.limited}</div>` : ''}
            <div class="card-tags">
              ${loc.character ? `<span class="tag">${loc.character}</span>` : ''}
              ${loc.city ? `<span class="tag">${loc.city}</span>` : ''}
              ${loc.venue ? `<span class="tag">${loc.venue}</span>` : ''}
            </div>
          </div>
          <div class="card-actions">
            <a href="${googleMapsUrl}" target="_blank" class="btn-gmaps" onclick="trackGmapsClick('${loc.id}','grid')"><svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M480-191q119-107 179.5-197T720-549q0-105-68.5-174T480-792q-103 0-171.5 69T240-549q0 71 60.5 161T480-191Zm-24.5 67.5Q444-128 433-137q-40-35-86.5-82T260-320q-40-54-66-112.5T168-549q0-134 89-224.5T480-864q133 0 222.5 90.5T792-549q0 58-26.5 117t-66 113q-39.5 54-86 100.5T527-137q-11 9-22.5 13.5T480-119q-13 0-24.5-4.5ZM480-552Zm0 164q62-56 88-81t41-44q14-17 20.5-35.5T636-587q0-35-25.5-60.5T550-673q-21 0-40 9t-30 23q-12-14-30.5-23t-39.5-9q-35 0-60.5 25.5T324-587q0 19 6.5 36t20.5 36q16 21 44 48.5t85 78.5Z"/></svg> 在 Google Maps 查看 →</a>
            ${hasDetail ? `<button class="btn-expand" type="button">詳情 <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M312-312h132q15.3 0 25.65 10.29Q480-291.42 480-276.21t-10.35 25.71Q459.3-240 444-240H276q-15.3 0-25.65-10.35Q240-260.7 240-276v-168q0-15.3 10.29-25.65Q260.58-480 275.79-480t25.71 10.35Q312-459.3 312-444v132Zm336-336H516q-15.3 0-25.65-10.29Q480-668.58 480-683.79t10.35-25.71Q500.7-720 516-720h168q15.3 0 25.65 10.35Q720-699.3 720-684v168q0 15.3-10.29 25.65Q699.42-480 684.21-480t-25.71-10.35Q648-500.7 648-516v-132Z"/></svg></button>` : ''}
          </div>
        `;

        if (hasDetail) {
          const btn = card.querySelector('.btn-expand');
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            // GA: card_click
            gtag('event', 'card_click', {
              machine_id: loc.id,
              machine_name: loc.name,
              machine_type: loc.type,
              source: 'grid',
              device: getDeviceType(),
            });
            window.a2hsRecordCardView && window.a2hsRecordCardView();
            openGridModal(loc, imgs, googleMapsUrl, 'grid_modal');
          });
        }

        grid.appendChild(card);
      });
    }

    // =============================================
    // 🔍 排序邏輯（結束日期 / 距離）
    // =============================================
    function getEndDate(limited) {
      if (!limited) return null; // null 代表無期限（常態機）
      const p = limited.split('～');
      return new Date(p[p.length - 1].trim().replace(/\//g, '-'));
    }

    // 即將結束 badge：只在 URGENT_DAYS 天內顯示（把今天算進去 → 今天結束＝剩 1 天＝「最後一天」）
    const URGENT_DAYS = 3; // 幾天內才顯示 badge，之後要調就改這裡
    export function getEndingBadge(limited) {
      const end = getEndDate(limited);
      if (!end) return null;                       // 常態機、無結束日 → 不顯示
      const now = new Date();
      const endD = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const nowD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((endD - nowD) / 86400000); // 只比日期，不看時分
      if (diffDays < 0) return null;               // 已結束
      if (diffDays >= URGENT_DAYS) return null;     // 超過 3 天不顯示
      const remaining = diffDays + 1;              // 今天結束 = 剩 1 天
      return remaining === 1 ? '最後一天' : `倒數 ${remaining} 天`;
    }

    function haversineKm(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    export function sortLocations(arr) {
      const list = arr.slice();

      if (sortState === 'distance_asc' || sortState === 'distance_desc') {
        if (!userCoords) return list; // 理論上選取距離排序前一定已經拿到座標，這裡是防呆
        list.sort((a, b) => {
          const da = haversineKm(userCoords.lat, userCoords.lng, a.lat, a.lng);
          const db = haversineKm(userCoords.lat, userCoords.lng, b.lat, b.lng);
          return sortState === 'distance_asc' ? da - db : db - da;
        });
        return list;
      }

      // end_date_asc：有結束日期的排前面（近到遠），無期限的常態機永遠排最後，
      // 常態機彼此之間依 IP 名稱排序（數字 → 筆畫 → 英文，跟篩選選項同一套慣例）
      list.sort((a, b) => {
        const ea = getEndDate(a.limited);
        const eb = getEndDate(b.limited);
        if (ea && eb) return ea - eb;
        if (ea && !eb) return -1;
        if (!ea && eb) return 1;
        return (a.character || '').localeCompare(b.character || '', 'zh-Hant');
      });
      return list;
    }
