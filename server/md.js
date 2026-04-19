import fs from "fs";
import { marked } from "marked";

// Parse a markdown file with optional YAML-ish front matter (--- ... ---).
// Front matter is intentionally simple: `key: value` per line, no nesting.
export function readMarkdown(filepath) {
  const raw = fs.readFileSync(filepath, "utf-8");
  const meta = {};
  let body = raw;

  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(raw);
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
    body = raw.slice(m[0].length);
  }

  return { meta, html: marked.parse(body), raw: body };
}
