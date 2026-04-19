import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSON5 from "json5";
import { parseBibtex } from "./bibtex-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

let resume = null;
let publications = null;

export function getResume() {
  if (!resume) {
    const raw = fs.readFileSync(
      path.join(ROOT, "data", "resume.json"),
      "utf-8"
    );
    resume = JSON5.parse(raw);
  }
  return resume;
}

export function getPublications() {
  if (!publications) {
    const raw = fs.readFileSync(
      path.join(ROOT, "data", "papers.bib"),
      "utf-8"
    );
    publications = parseBibtex(raw);
  }
  return publications;
}

export function getAllCvData() {
  const r = getResume();
  return {
    profile: r.basics,
    experience: r.work,
    education: r.education,
    skills: r.skills,
    awards: r.awards,
    languages: r.languages,
    volunteer: r.volunteer,
    publications: getPublications(),
  };
}
