// =============================================
// 📲 PWA 相關功能：A2HS banner、回到前景自動刷新、下拉刷新、Service Worker 註冊
// 這幾塊是目前 JS 裡耦合最低的部分：只跟 utils.js 的裝置判斷、
// 以及 main.js 的 loadFromSheet / lastFetchTime 有關，跟地圖/篩選/排序核心狀態完全無關,
// 所以是拆分的第一階段。
// =============================================

import { isStandaloneMode, getDeviceType } from './utils.js';
import { loadFromSheet, lastFetchTime, REFRESH_THROTTLE_MS } from './main.js';

    // =============================================
    // 📲 A2HS（加到主畫面）Banner
    // 顯示時機（iOS / Android 共用同一套判斷，不再各自用「瀏覽器事件」或「固定延遲」決定）：
    //   累計點擊「查看詳情」（grid 詳情 or 地圖 marker）達 3 次（跨造訪永久累計，存 localStorage）
    //   或 單次瀏覽停留超過 20 秒
    //   兩者達成其一即可
    // 平台差異只影響「達成門檻後要顯示什麼內容」：
    // - Android：按鈕觸發原生安裝流程（但技術上仍需等瀏覽器發出 beforeinstallprompt 事件才能真的呼叫，
    //   這點無法繞過；如果門檻已達成但事件還沒來，就先不顯示，事件一到馬上顯示）
    // - iOS + Safari：純教學文案，按鈕與 X 都只是關閉
    // - iOS + 非 Safari（LINE / IG / FB 內嵌瀏覽器）：先引導「用 Safari 開啟」
    // 關閉次數 + 時間戳記做退避，避免同一裝置被一直打擾（localStorage 遺失也不會造成體驗災難）
    // =============================================
    (function () {
      const DISMISS_KEY = 'a2hsDismiss';
      const VIEWS_KEY = 'a2hsCardViews';
      const MAX_DISMISS = 3;       // 關過 3 次後永久不再顯示
      const COOLDOWN_DAYS = 14;    // 每次關閉後至少間隔 14 天才再問一次
      const VIEW_THRESHOLD = 3;    // 累計查看詳情次數門檻
      const DWELL_MS = 20000;      // 單次瀏覽停留門檻（20 秒）

      function getDismissData() {
        try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); }
        catch (e) { return {}; }
      }
      function recordDismiss() {
        const data = getDismissData();
        const count = (data.count || 0) + 1;
        try {
          localStorage.setItem(DISMISS_KEY, JSON.stringify({ count, lastDismissed: Date.now() }));
        } catch (e) { /* localStorage 不可用時靜默失敗，最壞情況只是多顯示幾次 */ }
      }
      function shouldShow() {
        const data = getDismissData();
        if (!data.count) return true;
        if (data.count >= MAX_DISMISS) return false;
        const daysSince = (Date.now() - (data.lastDismissed || 0)) / 86400000;
        return daysSince > COOLDOWN_DAYS;
      }
      function isStandalone() {
        return isStandaloneMode();
      }
      function getCumulativeViews() {
        try { return parseInt(localStorage.getItem(VIEWS_KEY) || '0', 10) || 0; }
        catch (e) { return 0; }
      }
      function bumpCumulativeViews() {
        const next = getCumulativeViews() + 1;
        try { localStorage.setItem(VIEWS_KEY, String(next)); } catch (e) { /* 最壞情況只是這次沒記到 */ }
        return next;
      }

      const ua = navigator.userAgent.toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(ua);
      const isAndroid = /android/.test(ua);
      const isInAppBrowser = /line|instagram|fban|fbav|micromessenger/.test(ua);
      // crios/fxios/edgios = iOS 上的 Chrome/Firefox/Edge（外殼是 Safari 引擎但不是真的 Safari App）
      const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua) && !isInAppBrowser;

      let deferredPrompt = null;
      let engagementMet = false;
      let bannerShownOnce = false;
      let installedViaBanner = false; // 記錄這次安裝是不是透過我們的 banner 按鈕促成的，appinstalled 觸發時要用
      const banner = document.getElementById('a2hsBanner');
      const desc = document.getElementById('a2hsDesc');
      const actionBtn = document.getElementById('a2hsAction');
      const closeBtn = document.getElementById('a2hsClose');

      function dismiss(reason) {
        banner.classList.remove('show');
        recordDismiss();
        gtag('event', 'a2hs_banner_dismissed', { reason: reason || 'close' });
      }

      function showBanner(platform) {
        banner.classList.add('show');
        gtag('event', 'a2hs_banner_shown', { platform });
      }

      function renderForPlatform() {
        if (isAndroid) {
          desc.textContent = '下次找機台不用再開瀏覽器，點一下就開啟！';
          actionBtn.textContent = '加到主畫面';
          actionBtn.onclick = async () => {
            banner.classList.remove('show');
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            gtag('event', 'a2hs_prompt_result', { outcome, platform: 'android' });
            if (outcome === 'accepted') installedViaBanner = true;
            deferredPrompt = null;
          };
          showBanner('android');
        } else if (isIos && !isSafari) {
          desc.textContent = '在 Safari 開啟網頁 → 「⋯」→ 分享 → 加入主畫面，下次找機台不用再開瀏覽器，點一下就開啟！';
          actionBtn.textContent = '我知道了';
          actionBtn.onclick = () => dismiss('ack');
          showBanner('ios_in_app');
        } else if (isIos && isSafari) {
          desc.textContent = '點擊「⋯」→ 分享 → 加入主畫面，下次找機台不用再開瀏覽器，點一下就開啟！';
          actionBtn.textContent = '我知道了';
          actionBtn.onclick = () => dismiss('ack');
          showBanner('ios_safari');
        }
        // 其他平台（桌機等）不顯示
      }

      function tryTrigger() {
        if (bannerShownOnce) return;
        if (isStandalone() || !shouldShow() || !banner) return;
        if (!engagementMet) return;
        if (!isAndroid && !isIos) return;               // 桌機等其他平台不顯示
        if (isAndroid && !deferredPrompt) return;        // Android 仍須等瀏覽器把安裝事件準備好，才有東西可觸發
        bannerShownOnce = true;
        renderForPlatform();
      }

      function markEngaged(reason) {
        if (engagementMet) return;
        engagementMet = true;
        gtag('event', 'a2hs_engagement_met', {
          reason,
          platform: isAndroid ? 'android' : (isIos ? 'ios' : 'other'),
        });
        tryTrigger();
      }

      // 條件一：累計點擊「查看詳情」次數（跨造訪永久累計）
      window.a2hsRecordCardView = function () {
        const total = bumpCumulativeViews();
        if (total >= VIEW_THRESHOLD) markEngaged('cumulative_views');
      };
      if (getCumulativeViews() >= VIEW_THRESHOLD) markEngaged('cumulative_views'); // 這次進站前就已經累計達標

      // 條件二：本次瀏覽停留超過門檻秒數
      setTimeout(() => markEngaged('dwell_time'), DWELL_MS);

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        tryTrigger(); // 事件來的時候，如果互動門檻早就達成了，馬上顯示
      });
      window.addEventListener('appinstalled', () => {
        banner.classList.remove('show');
        gtag('event', 'pwa_installed', {
          platform: isAndroid ? 'android' : (isIos ? 'ios' : 'other'),
          source: installedViaBanner ? 'a2hs_banner' : 'native_browser_ui',
        });
      });
      closeBtn?.addEventListener('click', () => dismiss('close_x'));
    })();

    // =============================================
    // 🔄 回到前景自動刷新（節流）
    // =============================================
    function maybeAutoRefresh() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchTime < REFRESH_THROTTLE_MS) return;
      // GA: auto_refresh（通過節流門檻、真的觸發背景刷新）
      gtag('event', 'auto_refresh', { device: getDeviceType() });
      loadFromSheet({ silent: true, trigger: 'auto' });
    }
    document.addEventListener('visibilitychange', maybeAutoRefresh);
    // 部分瀏覽器（尤其是舊版 iOS Safari／某些 in-app browser）visibilitychange 不夠可靠，focus 當備援
    window.addEventListener('focus', maybeAutoRefresh);

    // =============================================
    // 👇 下拉刷新（僅列表模式，#gridView 捲到頂時才觸發）
    // =============================================
    (function initPullToRefresh() {
      const container = document.getElementById('gridView');
      const indicator = document.getElementById('ptrIndicator');
      const spinner = indicator.querySelector('.ptr-spinner');
      const PULL_TRIGGER_PX = 60;   // 拉到這個高度放開才觸發刷新
      const PULL_MAX_PX = 90;       // 視覺上限（rubber-band）
      const DAMPING = 0.5;          // 手指移動距離的實際反映比例

      let startY = 0;
      let pulling = false;   // 這次觸控是否正在做下拉手勢
      let dragY = 0;
      let refreshing = false;

      function setIndicatorHeight(px) {
        indicator.style.height = px + 'px';
        spinner.style.transform = `rotate(${Math.min(px / PULL_TRIGGER_PX, 1) * 360}deg)`;
      }

      container.addEventListener('touchstart', (e) => {
        if (refreshing) return;
        // 只有捲到最頂端時，往下拉才可能是「刷新」而不是一般捲動
        if (container.scrollTop > 0) { pulling = false; return; }
        startY = e.touches[0].clientY;
        pulling = true;
        dragY = 0;
      }, { passive: true });

      container.addEventListener('touchmove', (e) => {
        if (!pulling || refreshing) return;
        const diff = e.touches[0].clientY - startY;
        // 手指往上滑，或列表本身已經被滑走了，就取消手勢，交還給正常捲動
        if (diff <= 0 || container.scrollTop > 0) { pulling = false; setIndicatorHeight(0); return; }
        dragY = Math.min(diff * DAMPING, PULL_MAX_PX);
        setIndicatorHeight(dragY);
        e.preventDefault(); // 手勢確定成立時才擋掉，避免吃掉一般捲動
      }, { passive: false });

      container.addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;
        if (dragY >= PULL_TRIGGER_PX) {
          refreshing = true;
          indicator.classList.add('loading');
          setIndicatorHeight(PULL_TRIGGER_PX);
          // GA: pull_to_refresh（下拉超過門檻放開，真的觸發刷新）
          gtag('event', 'pull_to_refresh', { device: getDeviceType() });
          loadFromSheet({ silent: true, trigger: 'pull' }).finally(() => {
            refreshing = false;
            indicator.classList.remove('loading');
            setIndicatorHeight(0);
          });
        } else {
          setIndicatorHeight(0);
        }
      });

      container.addEventListener('touchcancel', () => {
        if (refreshing) return;
        pulling = false;
        setIndicatorHeight(0);
      });
    })();

    // =============================================
    // ⚙️ Service Worker 註冊（PWA 離線快取）
    // =============================================
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('Service worker 註冊失敗：', err);
        });
      });
    }

    // GA：這次是用已安裝的 PWA（standalone）打開，還是一般瀏覽器 —— 用來驗證安裝後有沒有真的被回訪使用
    gtag('event', 'pwa_launch_mode', {
      mode: isStandaloneMode() ? 'standalone' : 'browser',
    });
