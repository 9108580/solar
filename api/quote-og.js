/** תצוגת קישור לוואטסאפ / פייסבוק — HTML עם OG tags (בלי React) */
const SITE = 'https://www.mes.bet';
const OG_IMAGE = `${SITE}/og-quote-share.png?v=1`;
const TITLE = 'הצעת מחיר — מומחי אנרגיה סולארית';
const DESCRIPTION =
  'הצעת מחיר אישית למערכת סולארית. לחצו לצפייה בהצעה המלאה.';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = (req, res) => {
  const id = String(req.query.id || '').trim();
  const pageUrl = id ? `${SITE}/q/${id}` : SITE;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(TITLE)}</title>
<meta name="description" content="${escapeHtml(DESCRIPTION)}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="מומחי אנרגיה סולארית"/>
<meta property="og:title" content="${escapeHtml(TITLE)}"/>
<meta property="og:description" content="${escapeHtml(DESCRIPTION)}"/>
<meta property="og:url" content="${escapeHtml(pageUrl)}"/>
<meta property="og:image" content="${OG_IMAGE}"/>
<meta property="og:image:secure_url" content="${OG_IMAGE}"/>
<meta property="og:image:type" content="image/png"/>
<meta property="og:image:width" content="1024"/>
<meta property="og:image:height" content="576"/>
<meta property="og:locale" content="he_IL"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(TITLE)}"/>
<meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}"/>
<meta name="twitter:image" content="${OG_IMAGE}"/>
<link rel="canonical" href="${escapeHtml(pageUrl)}"/>
<meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}"/>
</head>
<body>
<p><a href="${escapeHtml(pageUrl)}">${escapeHtml(TITLE)}</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
};
