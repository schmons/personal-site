/**
 * Black-box tests for the MCP server.
 *
 * Spawns `node index.js` on a free port and talks to it with the official
 * MCP client over Streamable HTTP, then does the same over stdio. No test
 * framework beyond node:test.
 *
 * Run: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { parseBibtex } from "../mcp/bibtex-parser.js";
import { stripNulls } from "../mcp/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");

const H = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, ["index.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stderr.on("data", (d) => (log += d));
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`server did not start:\n${log}`)),
      15000
    );
    child.stdout.on("data", (d) => {
      log += d;
      if (log.includes("Server running")) {
        clearTimeout(t);
        resolve();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(t);
      reject(new Error(`server exited with ${code}:\n${log}`));
    });
  });
  return { port, child, base: `http://127.0.0.1:${port}` };
}

async function connectHttp(base) {
  const client = new Client({ name: "mcp-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
  await client.connect(transport);
  return { client, transport };
}

function parseText(result) {
  assert.equal(result.isError, undefined, JSON.stringify(result));
  const text = result.content.find((c) => c.type === "text")?.text;
  assert.ok(text, "tool returned no text content");
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Unit: parser and helpers
// ---------------------------------------------------------------------------

test("bibtex parser keeps google_scholar_id verbatim and reads keywords", () => {
  const pubs = parseBibtex(`---
---
@article{x2024,
  title={Capturing {VAE}s and {SO(3)}},
  author={Doe, Jane and Roe, Richard},
  journal={Nature},
  year={2024},
  google_scholar_id={k_IJM867U9cC},
  keywords={diffusion models, protein design},
  selected={true}
}
@phdthesis{t2020,
  title={A thesis},
  author={Doe, Jane},
  school={University of Oxford},
  year={2020}
}`);
  assert.equal(pubs.length, 2);
  const [x, t] = pubs;
  assert.equal(x.googleScholarId, "k_IJM867U9cC");
  assert.equal(x.title, "Capturing VAEs and SO(3)");
  assert.deepEqual(x.keywords, ["diffusion models", "protein design"]);
  assert.deepEqual(x.authors, ["Jane Doe", "Richard Roe"]);
  assert.equal(x.selected, true);
  assert.equal(x.year, 2024);
  assert.equal("doi" in x, false, "null fields are dropped");
  assert.equal(t.venue, "University of Oxford");
  assert.equal(t.selected, false);
});

test("stripNulls drops null and undefined but keeps false and empty strings", () => {
  assert.deepEqual(
    stripNulls({ a: null, b: undefined, c: false, d: "", e: [null, 1, { f: null, g: 2 }] }),
    { c: false, d: "", e: [1, { g: 2 }] }
  );
});

// ---------------------------------------------------------------------------
// Integration: Streamable HTTP
// ---------------------------------------------------------------------------

let srv;
before(async () => {
  srv = await startServer();
});
after(() => {
  srv?.child.kill();
});

test("healthz responds", async () => {
  const res = await fetch(`${srv.base}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.sessions, "number");
});

test("initialize exposes instructions, tools, resources, prompts", async () => {
  const { client, transport } = await connectHttp(srv.base);
  try {
    assert.ok(transport.sessionId, "server assigned a session id");
    assert.match(client.getInstructions() || "", /get_cv/);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "get_cv",
      "get_education",
      "get_experience",
      "get_profile",
      "get_publications",
      "get_skills",
      "search_cv",
    ]);
    for (const t of tools) {
      assert.equal(t.annotations?.readOnlyHint, true, `${t.name} readOnlyHint`);
      assert.equal(t.annotations?.openWorldHint, false, `${t.name} openWorldHint`);
    }

    const { resources } = await client.listResources();
    assert.ok(resources.some((r) => r.uri === "cv://profile"));

    const { prompts } = await client.listPrompts();
    assert.deepEqual(
      prompts.map((p) => p.name).sort(),
      ["generate_cover_letter", "generate_summary", "tailor_cv"]
    );
  } finally {
    await client.close();
  }
});

test("tools return compact JSON without nulls", async () => {
  const { client } = await connectHttp(srv.base);
  try {
    const profile = parseText(await client.callTool({ name: "get_profile", arguments: {} }));
    assert.ok(profile.basics?.name);
    assert.ok(Array.isArray(profile.awards));

    const awards = parseText(
      await client.callTool({ name: "get_profile", arguments: { section: "awards" } })
    );
    assert.ok(Array.isArray(awards) && awards.length > 0);

    const cv = parseText(await client.callTool({ name: "get_cv", arguments: { role: "agentic" } }));
    assert.equal(cv.role, "agentic");
    assert.ok(cv.experience.length > 0);

    const raw = (await client.callTool({ name: "get_publications", arguments: {} })).content[0].text;
    assert.equal(raw.includes(": null"), false, "no nulls in output");
    assert.equal(raw.includes("\n"), false, "compact JSON");
  } finally {
    await client.close();
  }
});

test("search_cv matches values, not key names", async () => {
  const { client } = await connectHttp(srv.base);
  try {
    // Every publication has a "url" *key*; matching on keys returned all of them.
    const byKey = await client.callTool({ name: "search_cv", arguments: { query: "googleScholarId" } });
    assert.match(byKey.content[0].text, /No results found/);

    const byValue = parseText(await client.callTool({ name: "search_cv", arguments: { query: "Altos" } }));
    assert.ok(byValue.some((s) => s.section === "experience"));
  } finally {
    await client.close();
  }
});

test("get_publications: keyword search reaches topic keywords, results newest first", async () => {
  const { client } = await connectHttp(srv.base);
  try {
    const pubs = parseText(
      await client.callTool({ name: "get_publications", arguments: { keyword: "diffusion" } })
    );
    assert.ok(
      pubs.some((p) => p.key === "latentlabs2025latentx"),
      "Latent-X is tagged as a diffusion paper via keywords"
    );
    const years = pubs.map((p) => p.year);
    assert.deepEqual(years, [...years].sort((a, b) => b - a), "sorted newest first");

    const ids = parseText(await client.callTool({ name: "get_publications", arguments: { keyword: "PerturBench" } }));
    assert.equal(ids[0].googleScholarId, "k_IJM867U9cC");
  } finally {
    await client.close();
  }
});

test("get_experience year filter means 'active during'", async () => {
  const { client } = await connectHttp(srv.base);
  try {
    const roles = parseText(
      await client.callTool({ name: "get_experience", arguments: { year: 2019 } })
    );
    assert.ok(roles.some((r) => r.name === "Foresight Works"));
    assert.ok(roles.every((r) => parseInt(r.startDate, 10) <= 2019));
  } finally {
    await client.close();
  }
});

test("prompts render with the CV embedded", async () => {
  const { client } = await connectHttp(srv.base);
  try {
    const p = await client.getPrompt({
      name: "generate_summary",
      arguments: { target_role: "Staff ML Engineer", max_words: "80" },
    });
    const text = p.messages[0].content.text;
    assert.match(text, /Maximum 80 words/);
    assert.match(text, /Latent Labs/);
  } finally {
    await client.close();
  }
});

test("session lifecycle: unknown ids get 404, missing header gets 400, DELETE ends the session", async () => {
  const stale = await fetch(`${srv.base}/mcp`, {
    method: "POST",
    headers: { ...H, "Mcp-Session-Id": "00000000-0000-4000-8000-000000000000" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(stale.status, 404);

  const noSession = await fetch(`${srv.base}/mcp`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(noSession.status, 400);

  const getNoHeader = await fetch(`${srv.base}/mcp`, {
    headers: { Accept: "text/event-stream" },
  });
  assert.equal(getNoHeader.status, 400);

  const { client, transport } = await connectHttp(srv.base);
  const id = transport.sessionId;
  const before = (await (await fetch(`${srv.base}/healthz`)).json()).sessions;
  assert.ok(before >= 1);
  await transport.terminateSession(); // sends DELETE
  await client.close();
  const gone = await fetch(`${srv.base}/mcp`, {
    method: "POST",
    headers: { ...H, "Mcp-Session-Id": id },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  assert.equal(gone.status, 404);
});

test("browser page still served on GET /mcp with Accept: text/html", async () => {
  const res = await fetch(`${srv.base}/mcp`, { headers: { Accept: "text/html" } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const cors = await fetch(`${srv.base}/mcp`, {
    method: "OPTIONS",
    headers: { Origin: "https://example.com", "Access-Control-Request-Method": "POST" },
  });
  assert.match(cors.headers.get("access-control-expose-headers") || "", /Mcp-Session-Id/i);
});

// ---------------------------------------------------------------------------
// Integration: stdio
// ---------------------------------------------------------------------------

test("stdio entry point serves the same tools", async () => {
  const client = new Client({ name: "mcp-test-stdio", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(SERVER_DIR, "mcp", "stdio.js")],
  });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.ok(tools.some((t) => t.name === "get_cv"));
    const edu = parseText(
      await client.callTool({ name: "get_education", arguments: { degree: "PhD" } })
    );
    assert.equal(edu.length, 1);
    assert.match(edu[0].institution, /Oxford/);
  } finally {
    await client.close();
  }
});
