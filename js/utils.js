// =============================================
// 🧩 共用小工具：裝置 / 顯示模式判斷
// 這兩個函式互相呼叫（getDeviceType 依賴 isStandaloneMode），
// 但不依賴任何其他模組或全域狀態，所以獨立成一個零依賴的 utils 模組，
// main.js 跟 pwa.js 都直接從這裡 import，不用互相牽扯。
// =============================================

// 是不是已安裝的 PWA（standalone 模式）在打開；跟 getDeviceType() 共用同一個判斷準則，
// 避免各處各自重複寫一份、之後改判斷邏輯要到處找。
export function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// GA 用的裝置判斷：用輸入裝置類型（觸控 vs 滑鼠），不受視窗寬度縮放影響，
// 跟排版用的 isMobileFilterLayout() 分開（那個留在 main.js，跟篩選 UI 邏輯放一起）。
export function getDeviceType() {
  const base = window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
  return isStandaloneMode() ? `${base}_pwa` : base;
}
