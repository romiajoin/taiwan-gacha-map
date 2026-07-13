// =============================================
// 👣 訪客計數
// 完全獨立的小功能：只讀寫自己的兩個 DOM 元素，不跟其他模組共享任何狀態。
// =============================================
async function loadVisitorCount() {
  try {
    const res = await fetch('https://api.counterapi.dev/v1/cardradartw/visits/up');
    const data = await res.json();
    document.getElementById('visitorCount').textContent = data.count.toLocaleString('zh-TW');
    document.getElementById('visitorBanner').style.display = 'flex';
  } catch (e) {
    // API 失敗時靜默隱藏 banner
  }
}
loadVisitorCount();
