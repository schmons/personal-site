# schmons.github.io

Personal site for Sebastian M. Schmon. Plain Express + vanilla HTML/CSS/JS. No build step, no framework.

## Structure

```
content/   Markdown: about page, news, optionally blog/projects
data/      resume.json (CV) + papers.bib (publications)
public/    Static assets + hand-written CSS and JS
server/    Express app + MCP server
```

## Run

```
cd server
npm install
node index.js
```

Visit http://localhost:3000. MCP endpoint at http://localhost:3000/mcp.

## Feature flags

Optional pages off by default. Enable via env vars:

```
FEATURE_BLOG=true        # /blog + /blog/:slug, reads content/blog/*.md
FEATURE_PROJECTS=true    # /projects + /projects/:slug
FEATURE_TEACHING=true    # /teaching, reads content/teaching.md
FEATURE_REPOS=true       # /repositories, reads content/repositories.md
```

Nav links appear/disappear to match.

## Deploy

AWS Lightsail VM (Ubuntu, $5/mo). See `.github/workflows/deploy-lightsail.yml`.
