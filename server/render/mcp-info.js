import { layout, escapeHtml } from "./layout.js";

const PUBLIC_URL = process.env.PUBLIC_URL || "";

export function renderMcpInfo(req) {
  const host = req?.headers?.host || "localhost:3000";
  const proto =
    req?.headers?.["x-forwarded-proto"] ||
    (host.startsWith("localhost") ? "http" : "https");
  const base = PUBLIC_URL || `${proto}://${host}`;
  const endpoint = `${base}/mcp`;

  const body = `
  <article class="mcp-info">
    <h1>MCP endpoint</h1>

    <p class="lede">My CV is available as an MCP server. Connect an AI assistant to it and ask about my background, pull specific publications, or check how my experience maps to a role you are hiring for. Building this kind of infrastructure is part of my work at <a href="https://www.latentlabs.com/">Latent Labs</a>.</p>

    <p>Point any MCP-capable client (Claude, Cursor, and friends) at:</p>

    <div class="mcp-endpoint">
      <code>${escapeHtml(endpoint)}</code>
    </div>

    <h2>Things you can ask once connected</h2>
    <ul class="mcp-prompts">
      <li>Summarise Sebastian's work in generative models for biology.</li>
      <li>Which of his publications are most relevant to simulation-based inference?</li>
      <li>Does his background fit this job description? [paste JD]</li>
      <li>Why would he be a good fit for leading a diffusion model team?</li>
      <li>Give me five bullets on why to hire him, grounded in his CV.</li>
    </ul>

    <h2>How to connect</h2>

    <h3>Claude Code</h3>
    <pre><code>claude mcp add --transport http schmon-cv ${escapeHtml(endpoint)}</code></pre>

    <h3>Claude Desktop, Cursor, Windsurf, Cline</h3>
    <p>Add the URL to your MCP config:</p>
    <pre><code>{
  "mcpServers": {
    "schmon-cv": { "url": "${escapeHtml(endpoint)}" }
  }
}</code></pre>

  </article>
  `;

  return layout({ title: "MCP", currentPath: "/mcp", body });
}
