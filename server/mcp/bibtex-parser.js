/**
 * Parses BibTeX content into structured publication objects.
 * Uses @retorquere/bibtex-parser for robust LaTeX-aware parsing.
 */
import bibtex from "@retorquere/bibtex-parser";

const { parse: bibtexParse, fields: bibFields } = bibtex;

// Fields that must come through untouched. The parser's default verbatim list
// covers url/doi/eprint; identifiers like google_scholar_id contain
// underscores that would otherwise be interpreted as TeX subscripts
// (k_IJM867U9cC -> k<sub>I</sub>JM867U9cC).
const VERBATIM_FIELDS = [
  /^citeulike-linkout-[0-9]+$/,
  /^bdsk-url-[0-9]+$/,
  ...bibFields.verbatim,
  "google_scholar_id",
  "abbr",
];

function cleanLatex(str) {
  if (!str) return "";
  return str
    .replace(/\\{|\\}/g, "") // remove \{ \}
    .replace(/[{}]/g, "") // remove remaining braces
    .replace(/\\["'`^~=.uvHtcdb]/g, "") // remove accent commands
    .replace(/\\\\/g, "") // remove double backslash
    .trim();
}

/** The parser returns some fields as arrays; join text fields, take the first of scalar ones. */
function joined(v) {
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join("") : String(v);
}

function first(v) {
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function list(v) {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : String(v).split(/[;,]/);
  return arr.map((s) => cleanLatex(String(s))).filter(Boolean);
}

/**
 * The parser yields author names as plain strings in whatever form the bib
 * used ("Doe, Jane" or "Jane Doe"). Normalise to "First Last" so consumers see
 * one format.
 */
function formatAuthor(a) {
  if (a && typeof a === "object") {
    const parts = [a.firstName, a.lastName].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  const s = cleanLatex(String(a));
  const comma = s.indexOf(",");
  if (comma === -1) return s;
  const last = s.slice(0, comma).trim();
  const first = s.slice(comma + 1).trim();
  return first ? `${first} ${last}` : last;
}

function extractAuthors(entry) {
  const authors = entry.fields?.author;
  if (!Array.isArray(authors)) return [];
  return authors.map(formatAuthor).filter(Boolean);
}

/** Drop empty strings, empty arrays, null, and undefined so consumers get compact objects. */
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

export function parseBibtex(raw) {
  // Strip YAML frontmatter (papers.bib starts with --- / ---)
  const cleaned = raw.replace(/^---[\s\S]*?---\s*/, "");

  const result = bibtexParse(cleaned, {
    sentenceCase: false,
    verbatimFields: VERBATIM_FIELDS,
  });

  return result.entries.map((entry) => {
    const fields = entry.fields || {};
    const year = fields.year ? parseInt(first(fields.year), 10) : null;

    return compact({
      key: entry.key,
      type: entry.type,
      title: cleanLatex(joined(fields.title)),
      authors: extractAuthors(entry),
      year: Number.isFinite(year) ? year : null,
      venue:
        cleanLatex(joined(fields.booktitle)) ||
        cleanLatex(joined(fields.journal)) ||
        cleanLatex(joined(fields.school)) ||
        "",
      abbr: cleanLatex(joined(fields.abbr)) || null,
      selected: first(fields.selected).toLowerCase() === "true",
      keywords: list(fields.keywords),
      googleScholarId: first(fields.google_scholar_id) || null,
      url: first(fields.url) || null,
      doi: first(fields.doi) || null,
      abstract: cleanLatex(joined(fields.abstract)) || null,
      pages: joined(fields.pages) || null,
      volume: first(fields.volume) || null,
    });
  });
}
