/**
 * Stdio entry point for Claude Desktop / Claude Code.
 * Run directly: node server/mcp/stdio.js
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getResume, getPublications, getAllCvData } from "./data-loader.js";

const server = new McpServer({
  name: "sebastian-schmon-cv",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// RESOURCES
// ---------------------------------------------------------------------------

server.resource("cv-profile", "cv://profile", "Professional profile: name, title, summary, and social links", async () => {
  const profile = getResume().basics;
  return { contents: [{ uri: "cv://profile", mimeType: "application/json", text: JSON.stringify(profile, null, 2) }] };
});

server.resource("cv-experience", "cv://experience", "Work experience history", async () => {
  return { contents: [{ uri: "cv://experience", mimeType: "application/json", text: JSON.stringify(getResume().work, null, 2) }] };
});

server.resource("cv-education", "cv://education", "Education history", async () => {
  return { contents: [{ uri: "cv://education", mimeType: "application/json", text: JSON.stringify(getResume().education, null, 2) }] };
});

server.resource("cv-skills", "cv://skills", "Technical skills and expertise areas", async () => {
  return { contents: [{ uri: "cv://skills", mimeType: "application/json", text: JSON.stringify(getResume().skills, null, 2) }] };
});

server.resource("cv-awards", "cv://awards", "Awards and honors", async () => {
  return { contents: [{ uri: "cv://awards", mimeType: "application/json", text: JSON.stringify(getResume().awards, null, 2) }] };
});

server.resource("cv-publications", "cv://publications", "Academic publications from BibTeX bibliography", async () => {
  return { contents: [{ uri: "cv://publications", mimeType: "application/json", text: JSON.stringify(getPublications(), null, 2) }] };
});

server.resource("cv-languages", "cv://languages", "Languages and fluency levels", async () => {
  return { contents: [{ uri: "cv://languages", mimeType: "application/json", text: JSON.stringify(getResume().languages, null, 2) }] };
});

server.resource("cv-volunteer", "cv://volunteer", "Volunteer and academic service", async () => {
  return { contents: [{ uri: "cv://volunteer", mimeType: "application/json", text: JSON.stringify(getResume().volunteer, null, 2) }] };
});

// ---------------------------------------------------------------------------
// TOOLS
// ---------------------------------------------------------------------------

server.tool(
  "search_cv",
  "Full-text search across all CV sections",
  { query: z.string().describe("Search term to match against CV content") },
  async ({ query }) => {
    const data = getAllCvData();
    const q = query.toLowerCase();
    const results = [];
    for (const [section, entries] of Object.entries(data)) {
      const text = JSON.stringify(entries).toLowerCase();
      if (text.includes(q)) {
        if (Array.isArray(entries)) {
          const matches = entries.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
          if (matches.length > 0) results.push({ section, matches });
        } else {
          results.push({ section, matches: [entries] });
        }
      }
    }
    return { content: [{ type: "text", text: results.length > 0 ? JSON.stringify(results, null, 2) : `No results found for "${query}"` }] };
  }
);

server.tool(
  "get_experience",
  "Get work experience, optionally filtered by company name or year",
  {
    company: z.string().optional().describe("Filter by company name (partial match)"),
    year: z.number().optional().describe("Filter by year"),
  },
  async ({ company, year }) => {
    let work = getResume().work || [];
    if (company) { const c = company.toLowerCase(); work = work.filter((w) => w.name?.toLowerCase().includes(c)); }
    if (year) { work = work.filter((w) => { const s = parseInt(w.startDate, 10); const e = w.endDate ? parseInt(w.endDate, 10) : new Date().getFullYear(); return year >= s && year <= e; }); }
    return { content: [{ type: "text", text: JSON.stringify(work, null, 2) }] };
  }
);

server.tool(
  "get_skills",
  "Get skills and keywords, optionally filtered by category",
  { category: z.string().optional().describe("Filter by skill category name") },
  async ({ category }) => {
    let skills = getResume().skills || [];
    if (category) { const c = category.toLowerCase(); skills = skills.filter((s) => s.name?.toLowerCase().includes(c)); }
    return { content: [{ type: "text", text: JSON.stringify(skills, null, 2) }] };
  }
);

server.tool(
  "get_publications",
  "Search and filter academic publications",
  {
    keyword: z.string().optional().describe("Search keyword in title or authors"),
    year: z.number().optional().describe("Filter by publication year"),
    selected_only: z.boolean().optional().describe("Only return selected/featured publications"),
  },
  async ({ keyword, year, selected_only }) => {
    let pubs = getPublications();
    if (keyword) { const k = keyword.toLowerCase(); pubs = pubs.filter((p) => p.title?.toLowerCase().includes(k) || p.authors?.some((a) => a.toLowerCase().includes(k)) || p.venue?.toLowerCase().includes(k)); }
    if (year) { pubs = pubs.filter((p) => p.year === year); }
    if (selected_only) { pubs = pubs.filter((p) => p.selected); }
    return { content: [{ type: "text", text: JSON.stringify(pubs, null, 2) }] };
  }
);

server.tool(
  "get_education",
  "Get education history, optionally filtered",
  {
    institution: z.string().optional().describe("Filter by institution name"),
    degree: z.string().optional().describe("Filter by degree type (PhD, MSc, BSc)"),
  },
  async ({ institution, degree }) => {
    let edu = getResume().education || [];
    if (institution) { const i = institution.toLowerCase(); edu = edu.filter((e) => e.institution?.toLowerCase().includes(i)); }
    if (degree) { const d = degree.toLowerCase(); edu = edu.filter((e) => e.studyType?.toLowerCase().includes(d)); }
    return { content: [{ type: "text", text: JSON.stringify(edu, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// PROMPTS
// ---------------------------------------------------------------------------

server.prompt(
  "generate_cover_letter",
  "Generate a cover letter tailored to a specific role",
  {
    job_title: z.string().describe("The job title to apply for"),
    company: z.string().describe("The company name"),
    job_description: z.string().optional().describe("The full job description"),
  },
  async ({ job_title, company, job_description }) => {
    const data = getAllCvData();
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: `You are writing a professional cover letter for Sebastian M. Schmon, PhD.\n\nCV Data:\n${JSON.stringify(data, null, 2)}\n\nPosition: ${job_title} at ${company}\n${job_description ? `Job Description: ${job_description}\n` : ""}\nWrite a compelling cover letter (under 400 words). Highlight relevant experience, publications, and skills.` },
      }],
    };
  }
);

server.prompt(
  "generate_summary",
  "Generate a tailored professional summary",
  {
    target_role: z.string().describe("The type of role to tailor for"),
    max_words: z.number().optional().describe("Maximum word count (default: 100)"),
  },
  async ({ target_role, max_words }) => {
    const data = getAllCvData();
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: `Write a professional summary for Sebastian M. Schmon tailored to a "${target_role}" position.\n\nCV Data:\n${JSON.stringify(data, null, 2)}\n\nMax ${max_words || 100} words. Professional tone suitable for a CV header.` },
      }],
    };
  }
);

server.prompt(
  "tailor_cv",
  "Analyze a job description and recommend CV emphasis",
  { job_description: z.string().describe("The full job description") },
  async ({ job_description }) => {
    const data = getAllCvData();
    return {
      messages: [{
        role: "user",
        content: { type: "text", text: `Analyze this job description and recommend how to tailor Sebastian M. Schmon's CV.\n\nJob Description:\n${job_description}\n\nCV Data:\n${JSON.stringify(data, null, 2)}\n\nProvide: relevance score (1-10), top 5 skills to highlight, which experiences to emphasize, most relevant publications, any gaps, and a rewritten professional summary.` },
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
