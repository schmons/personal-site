import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSON5 from "json5";
import { parseBibtex } from "./bibtex-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

let resume = null;
let publications = null;
let cvRoles = null;

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

export function getCvRoles() {
  if (!cvRoles) {
    const raw = fs.readFileSync(
      path.join(ROOT, "data", "cv-roles.json"),
      "utf-8"
    );
    cvRoles = JSON5.parse(raw);
  }
  return cvRoles;
}

export function buildRoleCv(role) {
  const roles = getCvRoles();
  const config = roles[role];
  if (!config) return null;

  const r = getResume();
  const workById = new Map();
  for (const w of r.work || []) {
    if (!workById.has(w.id)) workById.set(w.id, []);
    workById.get(w.id).push(w);
  }
  const experience = (config.experienceIds || []).flatMap(
    (id) => workById.get(id) || []
  );

  const pubByKey = new Map(getPublications().map((p) => [p.key, p]));
  const publications = (config.publicationKeys || [])
    .map((k) => pubByKey.get(k))
    .filter(Boolean);

  return {
    role,
    label: config.label,
    basics: {
      ...r.basics,
      label: config.label,
      summary: config.summary,
      keywords: config.keywords,
    },
    experience,
    publications,
    education: r.education,
    skills: r.skills,
    awards: r.awards,
    languages: r.languages,
    volunteer: r.volunteer,
  };
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
