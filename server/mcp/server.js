import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { getResume, getPublications, getAllCvData, buildRoleCv } from "./data-loader.js";

function createServer() {
  const server = new McpServer({
    name: "sebastian-schmon-cv",
    version: "1.0.0",
  });

  // ---------------------------------------------------------------------------
  // RESOURCES
  // ---------------------------------------------------------------------------

  server.resource("cv-profile", "cv://profile", "Professional profile: name, title, summary, and social links", async () => {
    const profile = getResume().basics;
    return {
      contents: [
        {
          uri: "cv://profile",
          mimeType: "application/json",
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  });

  server.resource("cv-experience", "cv://experience", "Work experience history", async () => {
    const work = getResume().work;
    return {
      contents: [
        {
          uri: "cv://experience",
          mimeType: "application/json",
          text: JSON.stringify(work, null, 2),
        },
      ],
    };
  });

  server.resource("cv-education", "cv://education", "Education history", async () => {
    const education = getResume().education;
    return {
      contents: [
        {
          uri: "cv://education",
          mimeType: "application/json",
          text: JSON.stringify(education, null, 2),
        },
      ],
    };
  });

  server.resource("cv-skills", "cv://skills", "Technical skills and expertise areas", async () => {
    const skills = getResume().skills;
    return {
      contents: [
        {
          uri: "cv://skills",
          mimeType: "application/json",
          text: JSON.stringify(skills, null, 2),
        },
      ],
    };
  });

  server.resource("cv-awards", "cv://awards", "Awards and honors", async () => {
    const awards = getResume().awards;
    return {
      contents: [
        {
          uri: "cv://awards",
          mimeType: "application/json",
          text: JSON.stringify(awards, null, 2),
        },
      ],
    };
  });

  server.resource("cv-publications", "cv://publications", "Academic publications from BibTeX bibliography", async () => {
    const pubs = getPublications();
    return {
      contents: [
        {
          uri: "cv://publications",
          mimeType: "application/json",
          text: JSON.stringify(pubs, null, 2),
        },
      ],
    };
  });

  server.resource("cv-languages", "cv://languages", "Languages and fluency levels", async () => {
    const languages = getResume().languages;
    return {
      contents: [
        {
          uri: "cv://languages",
          mimeType: "application/json",
          text: JSON.stringify(languages, null, 2),
        },
      ],
    };
  });

  server.resource("cv-volunteer", "cv://volunteer", "Volunteer and academic service", async () => {
    const volunteer = getResume().volunteer;
    return {
      contents: [
        {
          uri: "cv://volunteer",
          mimeType: "application/json",
          text: JSON.stringify(volunteer, null, 2),
        },
      ],
    };
  });

  // ---------------------------------------------------------------------------
  // TOOLS
  // ---------------------------------------------------------------------------

  server.tool(
    "search_cv",
    "Full-text search across all CV sections (experience, education, skills, awards, publications)",
    { query: z.string().describe("Search term to match against CV content") },
    async ({ query }) => {
      const data = getAllCvData();
      const q = query.toLowerCase();
      const results = [];

      for (const [section, entries] of Object.entries(data)) {
        const text = JSON.stringify(entries).toLowerCase();
        if (text.includes(q)) {
          if (Array.isArray(entries)) {
            const matches = entries.filter((e) =>
              JSON.stringify(e).toLowerCase().includes(q)
            );
            if (matches.length > 0) {
              results.push({ section, matches });
            }
          } else {
            results.push({ section, matches: [entries] });
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: results.length > 0
              ? JSON.stringify(results, null, 2)
              : `No results found for "${query}"`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_experience",
    "Get work experience, optionally filtered by company name or year range",
    {
      company: z.string().optional().describe("Filter by company name (case-insensitive partial match)"),
      year: z.number().optional().describe("Filter by start year"),
    },
    async ({ company, year }) => {
      let work = getResume().work || [];

      if (company) {
        const c = company.toLowerCase();
        work = work.filter((w) => w.name?.toLowerCase().includes(c));
      }
      if (year) {
        work = work.filter((w) => {
          const start = parseInt(w.startDate, 10);
          const end = w.endDate ? parseInt(w.endDate, 10) : new Date().getFullYear();
          return year >= start && year <= end;
        });
      }

      return {
        content: [{ type: "text", text: JSON.stringify(work, null, 2) }],
      };
    }
  );

  server.tool(
    "get_skills",
    "Get skills and keywords, optionally filtered by category",
    {
      category: z.string().optional().describe("Filter by skill category name (e.g. 'Machine Learning', 'Statistics')"),
    },
    async ({ category }) => {
      let skills = getResume().skills || [];

      if (category) {
        const c = category.toLowerCase();
        skills = skills.filter((s) => s.name?.toLowerCase().includes(c));
      }

      return {
        content: [{ type: "text", text: JSON.stringify(skills, null, 2) }],
      };
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

      if (keyword) {
        const k = keyword.toLowerCase();
        pubs = pubs.filter(
          (p) =>
            p.title?.toLowerCase().includes(k) ||
            p.authors?.some((a) => a.toLowerCase().includes(k)) ||
            p.venue?.toLowerCase().includes(k)
        );
      }
      if (year) {
        pubs = pubs.filter((p) => p.year === year);
      }
      if (selected_only) {
        pubs = pubs.filter((p) => p.selected);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(pubs, null, 2) }],
      };
    }
  );

  server.tool(
    "get_education",
    "Get education history, optionally filtered by institution or degree type",
    {
      institution: z.string().optional().describe("Filter by institution name (partial match)"),
      degree: z.string().optional().describe("Filter by degree type (e.g. 'PhD', 'MSc', 'BSc')"),
    },
    async ({ institution, degree }) => {
      let education = getResume().education || [];

      if (institution) {
        const i = institution.toLowerCase();
        education = education.filter((e) =>
          e.institution?.toLowerCase().includes(i)
        );
      }
      if (degree) {
        const d = degree.toLowerCase();
        education = education.filter((e) =>
          e.studyType?.toLowerCase().includes(d)
        );
      }

      return {
        content: [{ type: "text", text: JSON.stringify(education, null, 2) }],
      };
    }
  );

  server.tool(
    "get_cv",
    "Return a role-tailored CV. Pick a role — there is no default. Returns a JSON CV filtered and reordered for that angle: basics (with tailored summary and keywords), experience, publications, education, skills, awards.",
    {
      role: z
        .enum(["agentic", "bioml", "diffusion", "sbi"])
        .describe(
          "Which CV angle to return. 'agentic' = LLM agents & tool use. 'bioml' = AI for life sciences (Latent-X, Perturbench). 'diffusion' = generative/diffusion modelling. 'sbi' = simulation-based inference & Bayesian ML."
        ),
    },
    async ({ role }) => {
      const cv = buildRoleCv(role);
      if (!cv) {
        return {
          content: [{ type: "text", text: `Unknown role "${role}". Valid: agentic, bioml, diffusion, sbi.` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(cv, null, 2) }] };
    }
  );

  // ---------------------------------------------------------------------------
  // PROMPTS (user-invokable templates)
  // ---------------------------------------------------------------------------

  server.prompt(
    "generate_cover_letter",
    "Generate a professional cover letter using CV data, tailored to a specific role",
    {
      job_title: z.string().describe("The job title to apply for"),
      company: z.string().describe("The company name"),
      job_description: z.string().optional().describe("The full job description to tailor the letter to"),
    },
    async ({ job_title, company, job_description }) => {
      const data = getAllCvData();
      const cvContext = JSON.stringify(data, null, 2);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are writing a professional cover letter for Sebastian M. Schmon, PhD.

Here is Sebastian's complete CV data:
${cvContext}

Write a compelling cover letter for the following position:
- Job Title: ${job_title}
- Company: ${company}
${job_description ? `- Job Description: ${job_description}` : ""}

Guidelines:
- Highlight the most relevant experience and skills for this specific role
- Reference specific publications or achievements where relevant
- Keep a professional but personable tone
- Structure: opening paragraph, 2-3 body paragraphs, closing
- Keep it concise (under 400 words)`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "generate_summary",
    "Generate a tailored professional summary based on CV data",
    {
      target_role: z.string().describe("The type of role to tailor the summary for"),
      max_words: z.number().optional().describe("Maximum word count (default: 100)"),
    },
    async ({ target_role, max_words }) => {
      const data = getAllCvData();
      const limit = max_words || 100;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on the following CV data, write a professional summary for Sebastian M. Schmon tailored to a "${target_role}" position.

CV Data:
${JSON.stringify(data, null, 2)}

Requirements:
- Maximum ${limit} words
- Highlight the most relevant qualifications for a ${target_role} role
- Include key achievements and expertise areas
- Professional tone suitable for a CV/resume header`,
            },
          },
        ],
      };
    }
  );

  server.prompt(
    "tailor_cv",
    "Analyze a job description and recommend which CV sections to emphasize",
    {
      job_description: z.string().describe("The full job description to tailor the CV for"),
    },
    async ({ job_description }) => {
      const data = getAllCvData();

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analyze the following job description and recommend how to tailor Sebastian M. Schmon's CV for this role.

Job Description:
${job_description}

Sebastian's Complete CV Data:
${JSON.stringify(data, null, 2)}

Please provide:
1. A relevance score (1-10) for how well Sebastian's background matches
2. The top 5 most relevant skills/keywords to highlight
3. Which work experiences to emphasize and why
4. Which publications are most relevant
5. Any gaps or areas where Sebastian's profile doesn't match
6. A suggested rewrite of the professional summary for this specific role`,
            },
          },
        ],
      };
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Express integration via Streamable HTTP transport
// ---------------------------------------------------------------------------

export function createMcpRequestHandler() {
  const sessions = new Map();

  return {
    async handlePost(req, res) {
      try {
        const sessionId = req.headers["mcp-session-id"];

        let transport;
        if (sessionId && sessions.has(sessionId)) {
          transport = sessions.get(sessionId);
        } else {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, transport);
            },
          });

          transport.onclose = () => {
            const id = transport.sessionId;
            if (id) sessions.delete(id);
          };

          const server = createServer();
          await server.connect(transport);
        }

        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error("MCP POST error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    },

    // Stateless server: SSE streaming not supported
    async handleGet(req, res) {
      const sessionId = req.headers["mcp-session-id"];
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId);
        await transport.handleRequest(req, res);
        return;
      }
      // No session = stateless mode, reject SSE with 405
      res.status(405).set("Allow", "POST, DELETE").send("Method Not Allowed");
    },

    async handleDelete(req, res) {
      const sessionId = req.headers["mcp-session-id"];
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId);
        await transport.handleRequest(req, res);
        return;
      }
      // No session to delete, that's fine
      res.status(202).send();
    },
  };
}
