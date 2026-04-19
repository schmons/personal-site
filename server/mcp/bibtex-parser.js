/**
 * Parses BibTeX content into structured publication objects.
 * Uses @retorquere/bibtex-parser for robust LaTeX-aware parsing.
 */
import { parse as bibtexParse } from "@retorquere/bibtex-parser";

function cleanLatex(str) {
  if (!str) return "";
  return str
    .replace(/\\{|\\}/g, "") // remove \{ \}
    .replace(/[{}]/g, "") // remove remaining braces
    .replace(/\\["'`^~=.uvHtcdb]/g, "") // remove accent commands
    .replace(/\\\\/g, "") // remove double backslash
    .trim();
}

function extractAuthors(entry) {
  if (entry.fields?.author) {
    return entry.fields.author.map((a) => {
      const parts = [];
      if (a.firstName) parts.push(a.firstName);
      if (a.lastName) parts.push(a.lastName);
      return parts.join(" ") || String(a);
    });
  }
  return [];
}

export function parseBibtex(raw) {
  // Strip YAML frontmatter (papers.bib starts with --- / ---)
  const cleaned = raw.replace(/^---[\s\S]*?---\s*/, "");

  const result = bibtexParse(cleaned, { sentenceCase: false });

  return result.entries.map((entry) => {
    const fields = entry.fields || {};

    return {
      key: entry.key,
      type: entry.type,
      title: cleanLatex(
        Array.isArray(fields.title) ? fields.title.join("") : fields.title || ""
      ),
      authors: extractAuthors(entry),
      year: fields.year
        ? parseInt(Array.isArray(fields.year) ? fields.year[0] : fields.year, 10)
        : null,
      venue:
        cleanLatex(
          Array.isArray(fields.booktitle)
            ? fields.booktitle.join("")
            : fields.booktitle || ""
        ) ||
        cleanLatex(
          Array.isArray(fields.journal)
            ? fields.journal.join("")
            : fields.journal || ""
        ) ||
        "",
      abbr: fields.abbr
        ? cleanLatex(
            Array.isArray(fields.abbr) ? fields.abbr.join("") : fields.abbr
          )
        : null,
      selected:
        fields.selected &&
        String(
          Array.isArray(fields.selected)
            ? fields.selected[0]
            : fields.selected
        ).toLowerCase() === "true",
      googleScholarId: fields.google_scholar_id
        ? Array.isArray(fields.google_scholar_id)
          ? fields.google_scholar_id[0]
          : fields.google_scholar_id
        : null,
      url: fields.url
        ? Array.isArray(fields.url)
          ? fields.url[0]
          : fields.url
        : null,
      doi: fields.doi
        ? Array.isArray(fields.doi)
          ? fields.doi[0]
          : fields.doi
        : null,
      abstract: fields.abstract
        ? cleanLatex(
            Array.isArray(fields.abstract)
              ? fields.abstract.join("")
              : fields.abstract
          )
        : null,
      pages: fields.pages
        ? Array.isArray(fields.pages)
          ? fields.pages.join("")
          : fields.pages
        : null,
      volume: fields.volume
        ? Array.isArray(fields.volume)
          ? fields.volume[0]
          : fields.volume
        : null,
    };
  });
}
