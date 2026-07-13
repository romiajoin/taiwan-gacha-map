// api/share.js
//
// 專門給社群平台的爬蟲（LINE / Threads / Discord）讀取這個網址時看到的內容。
// 這些爬蟲不會執行 JavaScript，只會讀 <head> 裡寫死的 og:title / og:image。
//
// 卡片內容固定：不管分享哪個機台，標題/描述/圖片都一樣，只有真人點進去
// 跳轉的目標網址（/?id=xxx）會依機台不同。

const SITE_URL = 'https://cardradartw.vercel.app';
const OG_IMAGE_URL = `${SITE_URL}/og.png`;
const TITLE = '抽卡機在哪！Card Radar';
const DESCRIPTION = '想找抽卡機 / 相卡機？到「抽卡機在哪！Card Radar」找找，快速掌握最新的機台資訊！';

module.exports = function handler(req, res) {
  const id = req.query.id || '';
  // 只白名單允許 view=map，其餘值一律忽略（避免把任意 query 原封轉發，保守一點）
  const view = req.query.view === 'map' ? '&view=map' : '';
  const targetUrl = `${SITE_URL}/?id=${encodeURIComponent(id)}${view}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(`<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${OG_IMAGE_URL}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${targetUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="抽卡機在哪！Card Radar">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESCRIPTION}">
<meta name="twitter:image" content="${OG_IMAGE_URL}">
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
<p>正在前往 <a href="${targetUrl}">${TITLE}</a>...</p>
</body>
</html>`);
};
