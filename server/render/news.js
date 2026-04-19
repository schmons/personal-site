import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { layout } from "./layout.js";
import { readMarkdown } from "../md.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_DIR = path.join(__dirname, "..", "..", "content", "news");

let cache = null;

export function newsItems() {
  if (cache) return cache;
  if (!fs.existsSync(NEWS_DIR)) return (cache = []);
  const files = fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith(".md"));
  const items = files.map((f) => {
    const md = readMarkdown(path.join(NEWS_DIR, f));
    const date = md.meta.date ? new Date(md.meta.date) : null;
    return { date, html: md.html, raw: md.raw, file: f };
  });
  items.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return (cache = items);
}

function fmtDate(d) {
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function renderNewsList(items) {
  return `<ul class="news-list">
    ${items
      .map(
        (n) => `<li class="news-item">
        <time datetime="${n.date?.toISOString() || ""}">${fmtDate(n.date)}</time>
        <div class="news-body">${n.html}</div>
      </li>`
      )
      .join("")}
  </ul>`;
}

export function renderNewsPage() {
  const items = newsItems();
  const body = `
    <article>
      <h1>News</h1>
      ${items.length ? renderNewsList(items) : "<p class='muted'>No news yet.</p>"}
    </article>
  `;
  return layout({ title: "News", currentPath: "/news", body });
}
