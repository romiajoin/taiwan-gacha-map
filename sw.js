// Card Radar TW - Service Worker
// 快取策略：
// 1. 靜態殼層（HTML / CSS / JS / Leaflet / 字型）→ cache-first
// 2. Google Sheets 資料（CSV）→ network-first，抓不到才 fallback 快取（離線 / 訊號差時還能看到上次資料）
// 3. Cloudinary 圖片、地圖圖磚 → cache-first（不太會變動，且量大适合長期快取）
//
// 版本號 bump 時（CACHE_VERSION 改掉），install/activate 會自動清掉舊快取，
// 不需要手動處理使用者端的快取殘留。

const CACHE_VERSION = 'v28.2';
const SHELL_CACHE = `cardradar-shell-${CACHE_VERSION}`;
const DATA_CACHE = `cardradar-data-${CACHE_VERSION}`;
const IMAGE_CACHE = `cardradar-images-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keepCaches = [SHELL_CACHE, DATA_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !keepCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isDataRequest(url) {
  return url.hostname === 'docs.google.com' && url.pathname.includes('/spreadsheets/');
}

// changelog.json 內容會不定期增加新條目，但改動它通常不會跟著 bump CACHE_VERSION
// （不是shell殼層檔案的改版），所以要跟 Google Sheet 資料一樣走 network-first，
// 不然已安裝 PWA 的使用者要等到下次真的動到 index.html/css/js 才會看到新的更新日誌紀錄
function isChangelogRequest(url) {
  return url.pathname.endsWith('/changelog.json');
}

function isImageRequest(url) {
  return (
    url.hostname === 'res.cloudinary.com' ||
    url.hostname.endsWith('tile.openstreetmap.org')
  );
}

// 每次都必須真的打網路、絕不能被快取的請求（例如訪客計數 API，
// 每次呼叫都應該回傳最新的計數並讓伺服器累加一次，快取住會讓數字卡住不動）
function isNoCacheRequest(url) {
  return url.hostname === 'api.counterapi.dev';
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (isChangelogRequest(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (isNoCacheRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // 其餘（HTML/CSS/JS/字型等殼層資源）：cache-first，快取沒有才打網路
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});
