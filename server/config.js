// Feature flags. Set via env vars. Unknown values default to false.
const flag = (name) => {
  const v = process.env[name];
  return v === "true" || v === "1" || v === "yes";
};

export const analytics = {
  cloudflareToken: process.env.CLOUDFLARE_ANALYTICS_TOKEN || "",
};

export const features = {
  blog: flag("FEATURE_BLOG"),
  projects: flag("FEATURE_PROJECTS"),
  teaching: flag("FEATURE_TEACHING"),
  repos: flag("FEATURE_REPOS"),
};

// Nav links shown on every page. Gated items only appear if their flag is on.
export function navLinks() {
  const links = [
    { href: "/", label: "About" },
    { href: "/publications", label: "Publications" },
    { href: "/news", label: "News" },
    { href: "/mcp", label: "MCP" },
  ];
  if (features.blog) links.push({ href: "/blog", label: "Blog" });
  if (features.projects) links.push({ href: "/projects", label: "Projects" });
  if (features.teaching) links.push({ href: "/teaching", label: "Teaching" });
  if (features.repos) links.push({ href: "/repositories", label: "Repositories" });
  return links;
}
