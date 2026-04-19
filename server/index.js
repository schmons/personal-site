import express from "express";
import compression from "compression";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createMcpRequestHandler } from "./mcp/server.js";
import { features } from "./config.js";
import { renderHome } from "./render/home.js";
import { renderPublications } from "./render/publications.js";
import { renderNewsPage } from "./render/news.js";
import { renderMcpInfo } from "./render/mcp-info.js";
import {
  renderCollectionIndex,
  renderCollectionEntry,
  renderSinglePage,
} from "./render/collection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = process.env.PORT || 3000;

const app = express();
app.disable("x-powered-by");
app.use(compression());

// --------------------- MCP ---------------------
app.use("/mcp", cors());
app.use("/mcp", express.json());

const mcp = createMcpRequestHandler();
app.post("/mcp", mcp.handlePost);
app.delete("/mcp", mcp.handleDelete);

// GET /mcp: content-negotiate. Browsers (Accept: text/html) get the info page.
// MCP clients (Accept: application/json, text/event-stream) hit the transport.
app.get("/mcp", (req, res, next) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html") && !accept.includes("text/event-stream")) {
    res.set("Content-Type", "text/html; charset=utf-8").send(renderMcpInfo(req));
    return;
  }
  return mcp.handleGet(req, res, next);
});

// --------------------- Pages ---------------------
function send(res, html) {
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
}

app.get("/", (req, res) => send(res, renderHome()));
app.get("/publications", (req, res) => send(res, renderPublications()));
app.get("/news", (req, res) => send(res, renderNewsPage()));

// Gated: blog
if (features.blog) {
  app.get("/blog", (req, res) =>
    send(
      res,
      renderCollectionIndex({
        dir: "blog",
        title: "Blog",
        currentPath: "/blog",
        emptyMsg: "No posts yet.",
      })
    )
  );
  app.get("/blog/:slug", (req, res) => {
    const html = renderCollectionEntry({
      dir: "blog",
      slug: req.params.slug,
      title: "Blog",
      currentPath: "/blog",
    });
    if (!html) return next404(res);
    send(res, html);
  });
}

// Gated: projects
if (features.projects) {
  app.get("/projects", (req, res) =>
    send(
      res,
      renderCollectionIndex({
        dir: "projects",
        title: "Projects",
        currentPath: "/projects",
        emptyMsg: "No projects listed yet.",
      })
    )
  );
  app.get("/projects/:slug", (req, res) => {
    const html = renderCollectionEntry({
      dir: "projects",
      slug: req.params.slug,
      title: "Projects",
      currentPath: "/projects",
    });
    if (!html) return next404(res);
    send(res, html);
  });
}

// Gated: teaching, repositories — single pages
if (features.teaching) {
  app.get("/teaching", (req, res) =>
    send(
      res,
      renderSinglePage({
        file: "teaching.md",
        title: "Teaching",
        currentPath: "/teaching",
        emptyMsg: "Teaching page coming soon.",
      })
    )
  );
}
if (features.repos) {
  app.get("/repositories", (req, res) =>
    send(
      res,
      renderSinglePage({
        file: "repositories.md",
        title: "Repositories",
        currentPath: "/repositories",
        emptyMsg: "Repositories page coming soon.",
      })
    )
  );
}

// --------------------- Static assets ---------------------
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (/\.(css|js|woff2?|png|jpe?g|webp|svg|gif|pdf)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

// --------------------- 404 ---------------------
function next404(res) {
  res.status(404).set("Content-Type", "text/html; charset=utf-8").send(
    `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title><link rel="stylesheet" href="/style.css"></head><body><main class="container"><h1>404</h1><p>Not found. <a href="/">Home</a></p></main></body></html>`
  );
}
app.use((req, res) => next404(res));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(
    `Features: ${Object.entries(features)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ") || "(none)"}`
  );
});
