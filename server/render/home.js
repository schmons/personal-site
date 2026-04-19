import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { layout, escapeHtml } from "./layout.js";
import { readMarkdown } from "../md.js";
import { getPublications } from "../mcp/data-loader.js";
import { newsItems, renderNewsList } from "./news.js";
import { formatAuthors, paperLinks } from "./publications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

export function renderHome() {
  const about = readMarkdown(path.join(ROOT, "content", "about.md"));
  const subtitle = about.meta.subtitle || "Machine Learning Researcher";

  const recentNews = newsItems().slice(0, 5);
  const selected = getPublications()
    .filter((p) => p.selected)
    .sort((a, b) => (b.year || 0) - (a.year || 0));

  const selectedHtml = selected.length
    ? `<section class="selected-pubs">
      <h2>Selected publications</h2>
      <ul class="pub-list">
        ${selected
          .map(
            (p) => `<li class="pub">
              <div class="pub-title">${escapeHtml(p.title)}</div>
              <div class="pub-meta">${formatAuthors(p.authors)} · <em>${escapeHtml(p.venue || "")}</em>${p.year ? ` · ${p.year}` : ""}</div>
              ${paperLinks(p)}
            </li>`
          )
          .join("")}
      </ul>
    </section>`
    : "";

  const body = `
  <article class="home">
    <div class="home-header">
      <img class="avatar" src="/assets/seb.jpeg" alt="Sebastian Schmon">
      <div>
        <h1>Sebastian M. Schmon</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
        <p class="links">
          <a href="https://scholar.google.com/citations?user=GWvvwhMAAAAJ">Scholar</a> ·
          <a href="https://twitter.com/sebayesian">Twitter</a> ·
          <a href="https://github.com/schmons">GitHub</a> ·
          <a href="mailto:sebastian.schmon@gmail.com">Email</a>
        </p>
      </div>
    </div>

    <div class="prose">
      ${about.html}
    </div>

    <aside class="callout">
      This site has an <a href="/mcp">MCP server</a>. If you use an AI assistant, you can connect it and ask questions about my CV and publications instead of reading the pages yourself.
    </aside>

    ${recentNews.length ? `<section class="home-news"><h2>News</h2>${renderNewsList(recentNews)}<p><a href="/news">All news →</a></p></section>` : ""}

    ${selectedHtml}
  </article>
  `;

  return layout({ title: null, currentPath: "/", body });
}
