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

## Deploy

One Ubuntu VPS, nginx in front, pm2 for process management. Provisioning
is declarative via [deploy/cloud-init.yml](deploy/cloud-init.yml); push
to `main` triggers a git-pull deploy through
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Analytics

Optional. Set `CLOUDFLARE_ANALYTICS_TOKEN` to the site token from
Cloudflare → Analytics & Logs → Web Analytics. The beacon is only
injected when the env var is set. No cookies, no banner required.
