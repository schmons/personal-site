# Deploy

schmon.dev runs on a single AWS Lightsail instance in `eu-west-2` (London).
First-boot provisioning is declarative (`cloud-init.yml`); ongoing deploys
are a `git pull` + `pm2 reload` via GitHub Actions.

## One-time setup

### 1. DNS (do this first so TLS can issue on boot)

At your registrar, point `schmon.dev` and `www.schmon.dev` at the Lightsail
static IP you're about to allocate.

- A    schmon.dev        -> <static IP>
- A    www.schmon.dev    -> <static IP>

If the instance boots before DNS resolves, certbot retries for ~10 minutes
then gives up. You can rerun it manually later (see Troubleshooting).

### 2. Create the Lightsail instance

Region: `eu-west-2` (London). Blueprint: `OS Only -> Ubuntu 22.04 LTS`.
Plan: `$5/mo` (512 MB, 2 vCPU, 20 GB).

Under "Launch script", paste the entire contents of `deploy/cloud-init.yml`.

### 3. Static IP

Networking tab -> create a static IP -> attach to the instance.

### 4. Firewall

Networking tab -> IPv4 Firewall -> add a rule for HTTPS (TCP 443).
SSH (22) and HTTP (80) are already open.

### 5. GitHub secrets

Repo -> Settings -> Secrets and variables -> Actions. Add:

- `LIGHTSAIL_HOST`    = the static IP
- `LIGHTSAIL_SSH_KEY` = contents of the private key you downloaded from
                        Lightsail (Account -> SSH keys -> Download default key)

The deploy workflow uses the `ubuntu` user, no separate secret needed.

### 6. Verify

- https://schmon.dev loads the site
- https://schmon.dev/mcp shows the MCP info page in a browser
- `claude mcp add --transport http schmon-cv https://schmon.dev/mcp` connects

## Ongoing deploys

Push to `master`. GitHub Actions runs `.github/workflows/deploy-lightsail.yml`,
which SSHes in, pulls, installs prod deps, and reloads pm2.

## Troubleshooting

Cert didn't issue on first boot:
```
ssh ubuntu@<ip>
sudo certbot --nginx -d schmon.dev -d www.schmon.dev --redirect
```

App isn't running:
```
pm2 status
pm2 logs schmon-portfolio --lines 100
```

Nginx config test:
```
sudo nginx -t
```

Rebuild from scratch: destroy the instance, create a new one with the same
launch script, reattach the static IP. State lives in git; nothing on the
box is precious.
