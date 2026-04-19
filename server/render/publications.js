import { layout, escapeHtml } from "./layout.js";
import { getPublications } from "../mcp/data-loader.js";

export function formatAuthors(authors) {
  if (!authors?.length) return "";
  return authors
    .map((a) => {
      const s = escapeHtml(a);
      // Bold Sebastian's name.
      if (/schmon/i.test(a)) return `<strong>${s}</strong>`;
      return s;
    })
    .join(", ");
}

export function paperLinks(p) {
  const links = [];
  if (p.url) links.push(`<a href="${escapeHtml(p.url)}">link</a>`);
  if (p.doi) links.push(`<a href="https://doi.org/${escapeHtml(p.doi)}">doi</a>`);
  if (p.googleScholarId)
    links.push(
      `<a href="https://scholar.google.com/citations?view_op=view_citation&user=GWvvwhMAAAAJ&citation_for_view=GWvvwhMAAAAJ:${escapeHtml(p.googleScholarId)}">scholar</a>`
    );
  if (!links.length) return "";
  return `<div class="pub-links">${links.join(" · ")}</div>`;
}

export function renderPublications() {
  const pubs = getPublications().slice().sort((a, b) => (b.year || 0) - (a.year || 0));

  // Group by year.
  const byYear = new Map();
  for (const p of pubs) {
    const y = p.year || "Undated";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  }

  const groups = [...byYear.entries()]
    .map(
      ([year, items]) => `
    <section class="pub-year">
      <h2>${escapeHtml(String(year))}</h2>
      <ul class="pub-list">
        ${items
          .map(
            (p) => `<li class="pub">
              ${p.abbr ? `<span class="pub-abbr">${escapeHtml(p.abbr)}</span>` : ""}
              <div class="pub-title">${escapeHtml(p.title)}</div>
              <div class="pub-meta">${formatAuthors(p.authors)}${p.venue ? ` · <em>${escapeHtml(p.venue)}</em>` : ""}</div>
              ${paperLinks(p)}
            </li>`
          )
          .join("")}
      </ul>
    </section>`
    )
    .join("");

  const body = `
    <article class="publications">
      <h1>Publications</h1>
      <p class="muted"><a href="https://scholar.google.com/citations?user=GWvvwhMAAAAJ">Google Scholar</a></p>
      ${groups}
    </article>
  `;

  return layout({ title: "Publications", currentPath: "/publications", wide: true, body });
}
