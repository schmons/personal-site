import { layout, escapeHtml } from "./layout.js";
import { getResume } from "../mcp/data-loader.js";

function fmtDate(s) {
  if (!s) return "";
  // Keep year-month if present, strip to year otherwise.
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
  }
  return s;
}

function fmtRange(start, end) {
  if (!start && !end) return "";
  const s = fmtDate(start);
  const e = end && String(end).trim() ? fmtDate(end) : "present";
  if (s === e) return s;
  return `${s} – ${e}`;
}

function section(heading, inner) {
  if (!inner) return "";
  return `<section class="cv-section"><h2>${escapeHtml(heading)}</h2>${inner}</section>`;
}

function bulletList(bullets) {
  if (!bullets?.length) return "";
  return `<ul class="cv-bullets">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
}

function experienceItems(work) {
  if (!work?.length) return "";
  return `<ul class="cv-list">${work
    .map(
      (w) => `<li class="cv-item">
        <div class="cv-date">${escapeHtml(fmtRange(w.startDate, w.endDate))}</div>
        <div class="cv-body">
          <div class="cv-title">${escapeHtml(w.position || "")}${
            w.name
              ? ` · ${
                  w.url
                    ? `<a href="${escapeHtml(w.url)}">${escapeHtml(w.name)}</a>`
                    : escapeHtml(w.name)
                }`
              : ""
          }${w.location ? ` <span class="muted">· ${escapeHtml(w.location)}</span>` : ""}</div>
          ${w.summary ? `<p>${escapeHtml(w.summary)}</p>` : ""}
          ${bulletList(w.bullets)}
          ${
            w.highlights?.length
              ? `<div class="chips">${w.highlights
                  .map((h) => `<span class="chip">${escapeHtml(h)}</span>`)
                  .join("")}</div>`
              : ""
          }
        </div>
      </li>`
    )
    .join("")}</ul>`;
}

function educationItems(edu) {
  if (!edu?.length) return "";
  return `<ul class="cv-list">${edu
    .map(
      (e) => `<li class="cv-item">
        <div class="cv-date">${escapeHtml(fmtRange(e.startDate, e.endDate))}</div>
        <div class="cv-body">
          <div class="cv-title">${escapeHtml(e.studyType || "")}${e.area ? ` in ${escapeHtml(e.area)}` : ""} · ${
            e.url
              ? `<a href="${escapeHtml(e.url)}">${escapeHtml(e.institution || "")}</a>`
              : escapeHtml(e.institution || "")
          }${e.location ? ` <span class="muted">· ${escapeHtml(e.location)}</span>` : ""}</div>
          ${e.score ? `<p class="muted">${escapeHtml(e.score)}</p>` : ""}
          ${e.supervisors ? `<p class="muted">Supervisors: ${escapeHtml(e.supervisors)}</p>` : ""}
          ${bulletList(e.details)}
        </div>
      </li>`
    )
    .join("")}</ul>`;
}

function skillItems(skills) {
  if (!skills?.length) return "";
  return `<ul class="cv-list skills">${skills
    .map(
      (s) => `<li class="cv-item">
        <div class="cv-date">${escapeHtml(s.name || "")}</div>
        <div class="cv-body">
          ${
            s.keywords?.length
              ? `<div class="chips">${s.keywords
                  .map((k) => `<span class="chip">${escapeHtml(k)}</span>`)
                  .join("")}</div>`
              : ""
          }
        </div>
      </li>`
    )
    .join("")}</ul>`;
}

function awardItems(awards) {
  if (!awards?.length) return "";
  return `<ul class="cv-list">${awards
    .map(
      (a) => `<li class="cv-item">
        <div class="cv-date">${escapeHtml(a.date || "")}</div>
        <div class="cv-body">
          <div class="cv-title">${escapeHtml(a.title || "")}${
            a.awarder ? ` · <span class="muted">${escapeHtml(a.awarder)}</span>` : ""
          }</div>
          ${a.summary ? `<p>${escapeHtml(a.summary)}</p>` : ""}
        </div>
      </li>`
    )
    .join("")}</ul>`;
}

function serviceItems(volunteer) {
  if (!volunteer?.length) return "";
  return `<ul class="cv-list">${volunteer
    .map(
      (v) => `<li class="cv-item">
        <div class="cv-date">${escapeHtml(fmtRange(v.startDate, v.endDate))}</div>
        <div class="cv-body">
          <div class="cv-title">${escapeHtml(v.position || "")}${
            v.organization ? ` · <span class="muted">${escapeHtml(v.organization)}</span>` : ""
          }</div>
        </div>
      </li>`
    )
    .join("")}</ul>`;
}

export function renderCv() {
  const r = getResume();
  const b = r.basics || {};

  const body = `
    <article class="cv">
      <header class="cv-header">
        <h1>${escapeHtml(b.name || "Sebastian M. Schmon")}</h1>
        ${b.title ? `<p class="subtitle">${escapeHtml(b.title)}${b.label ? ` · ${escapeHtml(b.label)}` : ""}</p>` : b.label ? `<p class="subtitle">${escapeHtml(b.label)}</p>` : ""}
        ${b.summary ? `<p>${escapeHtml(b.summary)}</p>` : ""}
        ${b.keywords?.length ? `<div class="chips">${b.keywords.map((k) => `<span class="chip">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
        <p class="links"><a href="/assets/cv_schmon.pdf">Download PDF</a></p>
      </header>

      ${section("Experience", experienceItems(r.work))}
      ${section("Education", educationItems(r.education))}
      ${section("Skills", skillItems(r.skills))}
      ${section("Awards", awardItems(r.awards))}
      ${section("Service", serviceItems(r.volunteer))}
    </article>
  `;

  return layout({ title: "CV", currentPath: "/cv", wide: true, body });
}
