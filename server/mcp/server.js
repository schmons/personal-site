import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getResume,
  getPublications,
  getAllCvData,
  buildRoleCv,
} from "./data-loader.js";

export const SERVER_NAME = "sebastian-schmon-cv";
export const SERVER_VERSION = "1.1.0";

export const SERVER_INSTRUCTIONS = `This server exposes Sebastian M. Schmon's CV to agents. It is a bona fide attempt to make a living, queryable CV available — not a marketing document.

A public CV cannot list everything. Day-to-day work at these roles is often under NDA, proprietary, or simply too granular to enumerate, so treat this data as a floor rather than a ceiling: absence of a detail is not evidence of absence. Do not invent specifics that are not here; if something matters and is missing, say so.

Tools (all read-only, safe to call freely):
- get_cv(role): start here for an opinionated, role-tailored CV. Roles: 'agentic', 'bioml', 'diffusion', 'sbi', 'quant'. No default — pick one.
- get_profile(section?): basics (name, summary, social links), awards, languages, and academic service. Omit section for all four.
- search_cv(query): full-text search across every section.
- get_experience / get_education / get_skills / get_publications: finer-grained filtered access.

Resources under cv:// expose the same data as raw JSON. Prompts (generate_cover_letter, generate_summary, tailor_cv) bundle the full CV with a writing task.`;

// Every tool here only reads static data. Telling clients so lets them skip
// per-call approval prompts.
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively drop null/undefined values. Keeps empty strings and false. */
export function stripNulls(value) {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== null && v !== undefined)
      .map(stripNulls);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined) continue;
      out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

// Compact JSON without nulls: roughly half the tokens of the pretty form.
function toJson(value) {
  return JSON.stringify(stripNulls(value));
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : toJson(value),
      },
    ],
  };
}

/** Collect every string/number *value* in a structure (keys are ignored). */
function collectValues(value, out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const v of value) collectValues(v, out);
  } else if (typeof value === "object") {
    for (const v of Object.values(value)) collectValues(v, out);
  }
  return out;
}

function matchesQuery(entry, q) {
  return collectValues(entry).some((s) => s.toLowerCase().includes(q));
}

function includes(haystack, needle) {
  return typeof haystack === "string" && haystack.toLowerCase().includes(needle);
}

/** Newest first; entries without a year go last. Stable for ties. */
function byYearDesc(a, b) {
  return (b.year ?? -Infinity) - (a.year ?? -Infinity);
}

function cvContext() {
  return toJson(getAllCvData());
}

// ---------------------------------------------------------------------------
// Server factory (shared by the HTTP and stdio entry points)
// ---------------------------------------------------------------------------

export function createServer() {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS }
  );

  // ---------------------------------------------------------------------------
  // RESOURCES
  // ---------------------------------------------------------------------------

  const jsonResource = (name, uri, title, description, getter) => {
    server.registerResource(
      name,
      uri,
      { title, description, mimeType: "application/json" },
      async () => ({
        contents: [
          { uri, mimeType: "application/json", text: toJson(getter()) },
        ],
      })
    );
  };

  jsonResource("cv-profile", "cv://profile", "Profile", "Professional profile: name, title, summary, and social links", () => getResume().basics);
  jsonResource("cv-experience", "cv://experience", "Experience", "Work experience history", () => getResume().work);
  jsonResource("cv-education", "cv://education", "Education", "Education history", () => getResume().education);
  jsonResource("cv-skills", "cv://skills", "Skills", "Technical skills and expertise areas", () => getResume().skills);
  jsonResource("cv-awards", "cv://awards", "Awards", "Awards and honors", () => getResume().awards);
  jsonResource("cv-publications", "cv://publications", "Publications", "Academic publications from the BibTeX bibliography", () => getPublications());
  jsonResource("cv-languages", "cv://languages", "Languages", "Languages and fluency levels", () => getResume().languages);
  jsonResource("cv-volunteer", "cv://volunteer", "Academic service", "Volunteer and academic service (area chair, reviewing)", () => getResume().volunteer);

  // ---------------------------------------------------------------------------
  // TOOLS
  // ---------------------------------------------------------------------------

  server.registerTool(
    "get_cv",
    {
      title: "Role-tailored CV",
      description:
        "Return a role-tailored CV. Pick a role — there is no default. Returns a JSON CV filtered and reordered for that angle: basics (with tailored summary and keywords), experience, publications, education, skills, awards.",
      inputSchema: {
        role: z
          .enum(["agentic", "bioml", "diffusion", "sbi", "quant"])
          .describe(
            "Which CV angle to return. 'agentic' = LLM agents & tool use. 'bioml' = AI for life sciences (Latent-X, Perturbench). 'diffusion' = generative/diffusion modelling. 'sbi' = simulation-based inference & Bayesian ML. 'quant' = quantitative research, time-series, MCMC, risk modelling."
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ role }) => {
      const cv = buildRoleCv(role);
      if (!cv) {
        return {
          isError: true,
          ...textResult(`Unknown role "${role}". Valid: agentic, bioml, diffusion, sbi, quant.`),
        };
      }
      return textResult(cv);
    }
  );

  server.registerTool(
    "get_profile",
    {
      title: "Profile, awards, languages, service",
      description:
        "Get the sections not covered by the other tools: basics (name, title, summary, location, social links), awards, languages, and academic service (area chair, reviewing). Omit `section` to get all four.",
      inputSchema: {
        section: z
          .enum(["basics", "awards", "languages", "volunteer"])
          .optional()
          .describe("Return only this section. 'volunteer' is academic service."),
      },
      annotations: READ_ONLY,
    },
    async ({ section }) => {
      const r = getResume();
      const all = {
        basics: r.basics,
        awards: r.awards || [],
        languages: r.languages || [],
        volunteer: r.volunteer || [],
      };
      return textResult(section ? all[section] : all);
    }
  );

  server.registerTool(
    "search_cv",
    {
      title: "Search the CV",
      description:
        "Case-insensitive substring search over the values of every CV section (profile, experience, education, skills, awards, languages, service, publications). Returns the matching entries grouped by section.",
      inputSchema: {
        query: z.string().min(1).describe("Search term to match against CV content"),
      },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      const data = getAllCvData();
      const q = query.toLowerCase();
      const results = [];

      for (const [section, entries] of Object.entries(data)) {
        const list = Array.isArray(entries) ? entries : [entries];
        const matches = list.filter((e) => matchesQuery(e, q));
        if (matches.length > 0) results.push({ section, matches });
      }

      return textResult(
        results.length > 0 ? results : `No results found for "${query}"`
      );
    }
  );

  server.registerTool(
    "get_experience",
    {
      title: "Work experience",
      description:
        "Get work experience (newest first), optionally filtered by company name or by a year the role was active.",
      inputSchema: {
        company: z
          .string()
          .optional()
          .describe("Filter by company name (case-insensitive partial match)"),
        year: z
          .number()
          .int()
          .optional()
          .describe(
            "Return roles active during this year, i.e. startDate <= year <= endDate (open-ended roles count up to the current year)"
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ company, year }) => {
      let work = getResume().work || [];

      if (company) {
        const c = company.toLowerCase();
        work = work.filter((w) => includes(w.name, c));
      }
      if (year) {
        work = work.filter((w) => {
          const start = parseInt(w.startDate, 10);
          const end = w.endDate
            ? parseInt(w.endDate, 10)
            : new Date().getFullYear();
          return year >= start && year <= end;
        });
      }

      return textResult(work);
    }
  );

  server.registerTool(
    "get_skills",
    {
      title: "Skills",
      description: "Get skills and keywords, optionally filtered by category",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe(
            "Filter by skill category name, partial match (e.g. 'ML', 'Infrastructure', 'Programming')"
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ category }) => {
      let skills = getResume().skills || [];
      if (category) {
        const c = category.toLowerCase();
        skills = skills.filter((s) => includes(s.name, c));
      }
      return textResult(skills);
    }
  );

  server.registerTool(
    "get_publications",
    {
      title: "Publications",
      description:
        "Search and filter academic publications, newest first. `keyword` matches title, authors, venue, and per-paper topic keywords (e.g. 'diffusion', 'protein', 'simulation-based inference').",
      inputSchema: {
        keyword: z
          .string()
          .optional()
          .describe("Substring to match in title, authors, venue, or topic keywords"),
        year: z.number().int().optional().describe("Filter by publication year"),
        selected_only: z
          .boolean()
          .optional()
          .describe("Only return selected/featured publications"),
      },
      annotations: READ_ONLY,
    },
    async ({ keyword, year, selected_only }) => {
      let pubs = getPublications();

      if (keyword) {
        const k = keyword.toLowerCase();
        pubs = pubs.filter(
          (p) =>
            includes(p.title, k) ||
            includes(p.venue, k) ||
            includes(p.abbr, k) ||
            includes(p.abstract, k) ||
            includes(p.key, k) ||
            p.authors?.some((a) => includes(a, k)) ||
            p.keywords?.some((w) => includes(w, k))
        );
      }
      if (year) pubs = pubs.filter((p) => p.year === year);
      if (selected_only) pubs = pubs.filter((p) => p.selected);

      return textResult([...pubs].sort(byYearDesc));
    }
  );

  server.registerTool(
    "get_education",
    {
      title: "Education",
      description:
        "Get education history, optionally filtered by institution or degree type",
      inputSchema: {
        institution: z
          .string()
          .optional()
          .describe("Filter by institution name (partial match)"),
        degree: z
          .string()
          .optional()
          .describe("Filter by degree type (e.g. 'PhD', 'MSc', 'BSc')"),
      },
      annotations: READ_ONLY,
    },
    async ({ institution, degree }) => {
      let education = getResume().education || [];

      if (institution) {
        const i = institution.toLowerCase();
        education = education.filter((e) => includes(e.institution, i));
      }
      if (degree) {
        const d = degree.toLowerCase();
        education = education.filter((e) => includes(e.studyType, d));
      }

      return textResult(education);
    }
  );

  // ---------------------------------------------------------------------------
  // PROMPTS (user-invokable templates). MCP prompt arguments are strings.
  // ---------------------------------------------------------------------------

  const userMessage = (text) => ({
    messages: [{ role: "user", content: { type: "text", text } }],
  });

  server.registerPrompt(
    "generate_cover_letter",
    {
      title: "Cover letter",
      description:
        "Generate a professional cover letter using CV data, tailored to a specific role",
      argsSchema: {
        job_title: z.string().describe("The job title to apply for"),
        company: z.string().describe("The company name"),
        job_description: z
          .string()
          .optional()
          .describe("The full job description to tailor the letter to"),
      },
    },
    async ({ job_title, company, job_description }) =>
      userMessage(`You are writing a professional cover letter for Sebastian M. Schmon, PhD.

Here is Sebastian's complete CV data (ground truth — do not invent beyond it):
${cvContext()}

Write a compelling cover letter for the following position:
- Job Title: ${job_title}
- Company: ${company}
${job_description ? `- Job Description: ${job_description}` : ""}

Guidelines:
- Highlight the most relevant experience and skills for this specific role
- Reference specific publications or achievements where relevant
- Keep a professional but personable tone
- Structure: opening paragraph, 2-3 body paragraphs, closing
- Keep it concise (under 400 words)`)
  );

  server.registerPrompt(
    "generate_summary",
    {
      title: "Professional summary",
      description: "Generate a tailored professional summary based on CV data",
      argsSchema: {
        target_role: z
          .string()
          .describe("The type of role to tailor the summary for"),
        max_words: z
          .string()
          .optional()
          .describe("Maximum word count (default: 100)"),
      },
    },
    async ({ target_role, max_words }) => {
      const limit = parseInt(max_words, 10) || 100;
      return userMessage(`Based on the following CV data, write a professional summary for Sebastian M. Schmon tailored to a "${target_role}" position.

CV Data (ground truth — do not invent beyond it):
${cvContext()}

Requirements:
- Maximum ${limit} words
- Highlight the most relevant qualifications for a ${target_role} role
- Include key achievements and expertise areas
- Professional tone suitable for a CV/resume header`);
    }
  );

  server.registerPrompt(
    "tailor_cv",
    {
      title: "Tailor CV to a job description",
      description:
        "Analyze a job description and recommend which CV sections to emphasize",
      argsSchema: {
        job_description: z
          .string()
          .describe("The full job description to tailor the CV for"),
      },
    },
    async ({ job_description }) =>
      userMessage(`Analyze the following job description and recommend how to tailor Sebastian M. Schmon's CV for this role.

Job Description:
${job_description}

Sebastian's Complete CV Data (ground truth — do not invent beyond it):
${cvContext()}

Please provide:
1. A relevance score (1-10) for how well Sebastian's background matches
2. The top 5 most relevant skills/keywords to highlight
3. Which work experiences to emphasize and why
4. Which publications are most relevant
5. Any gaps or areas where Sebastian's profile doesn't match
6. A suggested rewrite of the professional summary for this specific role`)
  );

  return server;
}

// ---------------------------------------------------------------------------
// Express integration via Streamable HTTP transport
//
// Sessions live in memory. They are created only by an `initialize` request,
// expire after `sessionTtlMs` of inactivity, and are capped at `maxSessions`
// (oldest evicted first). Unknown session ids get 404 so clients re-initialize
// transparently, e.g. after a deploy restarts the process.
// ---------------------------------------------------------------------------

export function createMcpRequestHandler({
  sessionTtlMs = 30 * 60 * 1000,
  maxSessions = 200,
  sweepIntervalMs = 60 * 1000,
} = {}) {
  /** @type {Map<string, {transport: StreamableHTTPServerTransport, server: McpServer, lastSeen: number}>} */
  const sessions = new Map();

  function jsonRpcError(res, status, code, message) {
    res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
  }

  function notFound(res) {
    jsonRpcError(
      res,
      404,
      -32001,
      "Session not found. Send a new initialize request to start a session."
    );
  }

  async function closeSession(id) {
    const s = sessions.get(id);
    if (!s) return;
    sessions.delete(id);
    try {
      await s.transport.close();
    } catch (err) {
      console.error("MCP session close error:", err);
    }
  }

  async function sweep() {
    const cutoff = Date.now() - sessionTtlMs;
    for (const [id, s] of sessions) {
      if (s.lastSeen < cutoff) await closeSession(id);
    }
  }

  async function evictOldest() {
    let oldestId = null;
    let oldest = Infinity;
    for (const [id, s] of sessions) {
      if (s.lastSeen < oldest) {
        oldest = s.lastSeen;
        oldestId = id;
      }
    }
    if (oldestId) await closeSession(oldestId);
  }

  const timer = setInterval(() => {
    sweep().catch((err) => console.error("MCP session sweep error:", err));
  }, sweepIntervalMs);
  timer.unref();

  /** Look up an existing session from the header. Writes the error response and returns null on miss. */
  function resolveSession(req, res) {
    const header = req.headers["mcp-session-id"];
    if (header === undefined) {
      jsonRpcError(
        res,
        400,
        -32000,
        "Bad Request: Mcp-Session-Id header required. Send an initialize request to start a session."
      );
      return null;
    }
    const s = sessions.get(String(header));
    if (!s) {
      notFound(res);
      return null;
    }
    s.lastSeen = Date.now();
    return s;
  }

  function internalError(res, err, label) {
    console.error(`MCP ${label} error:`, err);
    if (!res.headersSent) {
      jsonRpcError(res, 500, -32603, "Internal server error");
    }
  }

  async function handlePost(req, res) {
    try {
      if (req.headers["mcp-session-id"] !== undefined) {
        const s = resolveSession(req, res);
        if (!s) return;
        await s.transport.handleRequest(req, res, req.body);
        return;
      }

      const body = req.body;
      const isInit = Array.isArray(body)
        ? body.some(isInitializeRequest)
        : isInitializeRequest(body);
      if (!isInit) {
        jsonRpcError(
          res,
          400,
          -32000,
          "Bad Request: no Mcp-Session-Id header. Send an initialize request to start a session."
        );
        return;
      }

      if (sessions.size >= maxSessions) await evictOldest();

      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server, lastSeen: Date.now() });
        },
      });
      transport.onclose = () => {
        const id = transport.sessionId;
        if (id && sessions.get(id)?.transport === transport) sessions.delete(id);
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      internalError(res, err, "POST");
    }
  }

  // GET opens the server-to-client SSE stream for an existing session.
  async function handleGet(req, res) {
    try {
      const s = resolveSession(req, res);
      if (!s) return;
      await s.transport.handleRequest(req, res);
    } catch (err) {
      internalError(res, err, "GET");
    }
  }

  // DELETE ends a session. The transport closes itself, which triggers onclose.
  async function handleDelete(req, res) {
    try {
      const s = resolveSession(req, res);
      if (!s) return;
      await s.transport.handleRequest(req, res);
    } catch (err) {
      internalError(res, err, "DELETE");
    }
  }

  async function close() {
    clearInterval(timer);
    for (const id of [...sessions.keys()]) await closeSession(id);
  }

  return {
    handlePost,
    handleGet,
    handleDelete,
    sessionCount: () => sessions.size,
    close,
  };
}
