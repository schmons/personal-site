import { navLinks } from "../config.js";

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout({ title, currentPath = "/", wide = false, body }) {
  const fullTitle = title ? `${title} · Sebastian Schmon` : "Sebastian Schmon";
  const nav = navLinks()
    .map((l) => {
      const active = l.href === currentPath ? ' aria-current="page"' : "";
      return `<a href="${l.href}"${active}>${l.label}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="Sebastian Schmon, machine learning researcher and statistician.">
<link rel="icon" href="/assets/seb.jpeg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/style.css">
<script>
  // Set theme before paint to avoid flash.
  (function(){
    try {
      var t = localStorage.getItem('theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch(e){}
  })();
</script>
</head>
<body class="${wide ? "wide" : ""}">
<header class="site-header">
  <div class="container">
    <a class="brand" href="/">Sebastian Schmon</a>
    <nav>${nav}
      <button id="theme-toggle" aria-label="Toggle theme" title="Toggle theme">◐</button>
    </nav>
  </div>
</header>
<main class="container">
${body}
</main>
<footer class="site-footer">
  <div class="container">
    <span>© ${new Date().getFullYear()} Sebastian Schmon</span>
    <span class="muted"> · <a href="/mcp" rel="nofollow">MCP endpoint</a> · <a href="https://github.com/schmons">GitHub</a></span>
  </div>
</footer>
<script src="/script.js" defer></script>
</body>
</html>`;
}
