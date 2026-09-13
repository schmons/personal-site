# personal-site

Source for [schmon.dev](https://www.schmon.dev). A small Express app that
serves my CV, publications, and an MCP endpoint so AI assistants can
query the same data.

## Run locally

```
cd server
npm install
npm start
```

Then open http://localhost:3000.

Run the MCP server tests (they spawn the server on a free port):

```
cd server
npm test
```

To use the MCP server over stdio instead of HTTP (Claude Desktop, Claude Code):

```
claude mcp add schmon-cv -- node /absolute/path/to/server/mcp/stdio.js
```

## Deploy

One Ubuntu VPS, nginx in front, pm2 for process management. Provisioning
is declarative via [deploy/cloud-init.yml](deploy/cloud-init.yml); push
to `main` triggers a git-pull deploy through
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Analytics

Cloudflare Web Analytics beacon, hardcoded in
[server/config.js](server/config.js). The token is public (it ships in
every page's HTML). No cookies, no consent banner required.
