import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { layout, escapeHtml } from "./layout.js";
import { readMarkdown } from "../md.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

// Generic renderer for a markdown-file-per-entry collection (blog, projects).
// Front matter: title, date, summary (all optional).
export function renderCollectionIndex({ dir, title, currentPath, emptyMsg }) {
  const abs = path.join(ROOT, "content", dir);
  let items = [];
  if (fs.existsSync(abs)) {
    items = fs
      .readdirSync(abs)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const md = readMarkdown(path.join(abs, f));
        const slug = f.replace(/\.md$/, "");
        const date = md.meta.date ? new Date(md.meta.date) : null;
        return { slug, title: md.meta.title || slug, date, summary: md.meta.summary || "" };
      })
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }

  const list = items.length
    ? `<ul class="entry-list">${items
        .map(
          (e) => `<li class="entry">
            <a href="${currentPath}/${encodeURIComponent(e.slug)}"><span class="entry-title">${escapeHtml(e.title)}</span></a>
            ${e.date ? `<time class="muted">${e.date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</time>` : ""}
            ${e.summary ? `<p class="muted">${escapeHtml(e.summary)}</p>` : ""}
          </li>`
        )
        .join("")}</ul>`
    : `<p class="muted">${escapeHtml(emptyMsg || "Nothing here yet.")}</p>`;

  return layout({
    title,
    currentPath,
    body: `<article><h1>${escapeHtml(title)}</h1>${list}</article>`,
  });
}

export function renderCollectionEntry({ dir, slug, title, currentPath }) {
  const abs = path.join(ROOT, "content", dir, `${slug}.md`);
  if (!fs.existsSync(abs)) return null;
  const md = readMarkdown(abs);
  const entryTitle = md.meta.title || slug;
  const date = md.meta.date ? new Date(md.meta.date) : null;

  const body = `
    <article class="entry-detail">
      <p><a href="${currentPath}">← ${escapeHtml(title)}</a></p>
      <h1>${escapeHtml(entryTitle)}</h1>
      ${date ? `<p class="muted">${date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}</p>` : ""}
      <div class="prose">${md.html}</div>
    </article>
  `;
  return layout({ title: entryTitle, currentPath, body });
}

// For simpler single-page gated content (teaching, repositories).
export function renderSinglePage({ file, title, currentPath, emptyMsg }) {
  const abs = path.join(ROOT, "content", file);
  let html = "";
  if (fs.existsSync(abs)) {
    html = readMarkdown(abs).html;
  } else {
    html = `<p class="muted">${escapeHtml(emptyMsg || "Coming soon.")}</p>`;
  }
  return layout({
    title,
    currentPath,
    body: `<article><h1>${escapeHtml(title)}</h1><div class="prose">${html}</div></article>`,
  });
}
