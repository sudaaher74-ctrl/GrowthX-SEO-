# Running the crawler on a laptop

For a Lenovo with 8GB of RAM and 500GB of disk, running Windows 11, with the
frontend staying on Vercel.

## Why bother

Render's free instance gives the crawler 512MB. Chromium needs ~250MB of that
to render one page, so there is room for exactly one render at a time, and
every page of a client-rendered site needs one. Most of the crawler bugs fixed
in this repository were that constraint expressing itself: renders queueing past
their lock, a container killed mid-crawl, pages recorded as empty shells because
the wait for the browser ran out.

8GB does not make the crawler faster in any interesting way. It makes it
*correct*: three renders at once instead of one, a 300-page render budget
instead of 50, and a crawl that finishes rather than being cut off by memory.

What you give up is availability. A laptop that sleeps, reboots for an update or
loses Wi-Fi takes the API down with it. Plan for it (§7) rather than being
surprised by it.

## The shape of it

```
   Vercel (unchanged)                    Your laptop
   ┌────────────────────┐                ┌─────────────────────────────────┐
   │ growth-x-seo       │   HTTPS        │  WSL2 Ubuntu                    │
   │ .vercel.app        │───────────────▶│  ┌───────────────────────────┐  │
   └────────────────────┘   Cloudflare   │  │ api      1024m  (no crawl)│  │
                            Tunnel       │  │ worker   2000m  (crawls)  │  │
                                         │  │ postgres  640m            │  │
                                         │  │ redis     300m            │  │
                                         │  └───────────────────────────┘  │
                                         └─────────────────────────────────┘
```

No ports are opened on your router. The tunnel dials out from the laptop, so
there is nothing to port-forward and no static IP to buy.

**Time:** about 3 hours, most of it waiting on downloads. **Cost:** nothing,
unless you need a domain (~₹800/year).

---

## 1. Prepare Windows (20 min)

The laptop has to stay awake with the lid shut.

- **Settings → System → Power & battery → Screen and sleep**: set *When plugged
  in, put my device to sleep after* to **Never**.
- **Control Panel → Power Options → Choose what closing the lid does**: set
  *When I close the lid — Plugged in* to **Do nothing**.
- **Settings → Windows Update → Advanced options**: set active hours, and turn
  off *Restart this device as soon as possible*. An unattended reboot at 3am
  kills a running crawl.
- Check you have the room: 8GB RAM, and at least 60GB free on C:. Postgres,
  Redis, three container images and the page snapshots are ~25GB in the first
  year; 500GB is generous.

Leave the laptop on mains power. Nothing here is tuned for battery.

## 2. WSL2 and Docker (45 min)

**Docker Desktop is the wrong choice at 8GB** — it runs its own VM and UI and
costs around 1GB before a container starts. Install Docker Engine inside WSL
instead.

Open **PowerShell as Administrator**:

```powershell
wsl --install -d Ubuntu-24.04
```

Reboot when it asks. On first launch, Ubuntu asks for a username and password —
this is a Linux account, unrelated to your Windows login.

Now cap what WSL may take. Create `C:\Users\<you>\.wslconfig` in Notepad:

```ini
[wsl2]
# 5GB for Linux, leaving ~3GB for Windows 11 itself. Going higher makes
# Windows swap, which slows everything including the crawl.
memory=5GB
processors=4
# Swap is disk, and you have 500GB of it. This is the difference between a
# memory spike being slow and being an OOM kill.
swap=8GB
```

Apply it, then confirm:

```powershell
wsl --shutdown
wsl -d Ubuntu-24.04
```

```bash
free -h        # "Mem: 4.9Gi" or similar
```

Inside Ubuntu, let systemd run so Docker starts as a service:

```bash
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Back in PowerShell: `wsl --shutdown`, then reopen Ubuntu. Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker run --rm hello-world
```

That last line must print "Hello from Docker!" before you go on.

## 3. Get the code and the secrets (25 min)

```bash
cd ~
git clone https://github.com/sudaaher74-ctrl/GrowthX-SEO-.git
cd GrowthX-SEO-
cp .env.selfhost.example .env.selfhost
```

> Keep the clone inside the Linux filesystem (`~/`), never under `/mnt/c/`.
> Docker builds across the Windows filesystem boundary are several times
> slower.

Now fill in `.env.selfhost` (`nano .env.selfhost`). Two rules:

**Copy, do not regenerate, these two** if you are moving an existing Render
deployment — from the Render dashboard, service `growthx-crawler-api`,
Environment tab:

| Variable | What a new value breaks |
|---|---|
| `ENCRYPTION_KEY` | Stored customer integration credentials become unreadable |
| `INTEGRATION_TOKEN_KEY` | Every connected Google account must reauthorize |

Neither fails loudly. They decrypt to garbage and the feature simply stops
working, which is a bad afternoon to debug.

**Generate the rest:**

```bash
openssl rand -hex 16     # POSTGRES_PASSWORD
openssl rand -hex 32     # JWT_SECRET  (new is fine — it only logs everyone out)
```

Copy your AI provider keys (`SARVAM_API_KEY`, `MAMMOUTH_API_KEY`, …) from the
same Render Environment tab. Leave `GOOGLE_CALLBACK_URL` and
`GOOGLE_REDIRECT_URI` alone for now — you get the hostname in §5.

## 4. Start the stack (30 min, mostly the build)

```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d --build
```

The first build downloads Chromium and takes 10–20 minutes. Watch it come up:

```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost logs -f api
```

You are looking for `Applying database migrations...` then `Starting API...`.
Then check it:

```bash
curl -s localhost:3000/health | jq
curl -s localhost:3000/health/queues | jq
```

`/health` gives you the commit it is running. `/health/queues` must show
`redis.connected: true` and `workers.pageFetch: true` — on the **worker**
container, not the API, which has workers off by design.

If the API container restarts in a loop, read the log: it refuses to boot
without `ENCRYPTION_KEY` and `JWT_SECRET`, and it says so in as many words.

## 5. Put it on the internet (30 min)

You need a hostname the Vercel frontend can reach. Two options:

**With a domain** (recommended) — add it to Cloudflare (free plan), then:

```bash
# Inside WSL Ubuntu
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cf.deb
sudo dpkg -i cf.deb && rm cf.deb

cloudflared tunnel login                     # opens a browser to authorize
cloudflared tunnel create growthx-api
cloudflared tunnel route dns growthx-api api.yourdomain.com

# Run it as a service so it survives reboots
sudo cloudflared service install
```

Point the tunnel at the API by creating `~/.cloudflared/config.yml`:

```yaml
tunnel: growthx-api
credentials-file: /home/<you>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

**Without a domain** — use Tailscale Funnel instead. It gives you a stable
`https://<machine>.<tailnet>.ts.net` URL for free:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale funnel 3000
```

Avoid `cloudflared tunnel --url` quick tunnels: the hostname changes on every
restart, and you would be editing Vercel's environment each time.

Now wire the two ends together:

1. **Vercel** → project settings → Environment Variables →
   `NEXT_PUBLIC_API_URL` = your new hostname. Redeploy (Next.js inlines
   `NEXT_PUBLIC_*` at build time — an env change alone does nothing).
2. **`.env.selfhost`** → `CORS_ALLOWED_ORIGINS=https://growth-x-seo.vercel.app`
   and the two `GOOGLE_*` URLs with your hostname. Restart:
   `docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d`
3. **Google Cloud Console** → Credentials → your OAuth client → add both
   redirect URIs exactly as written in `.env.selfhost`.

## 6. Move the data (30 min, optional)

Skip this to start clean. To bring your crawl history across, get the
**External Database URL** from the Render dashboard:

```bash
# Dump from Render (takes a few minutes on the free tier)
docker run --rm -v ~/backups:/b postgres:15-alpine \
  pg_dump --no-owner --no-acl -Fc -d "<render-external-url>" -f /b/render.dump

# Restore into the laptop
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost \
  exec -T postgres pg_restore --no-owner --clean --if-exists \
  -U growthx -d growthx_crawler < ~/backups/render.dump
```

Do this while no crawl is running on either side. Restart the API afterwards so
Prisma reconnects.

Render's free Postgres expires 90 days after creation, so this dump is worth
taking even if you decide against the laptop.

## 7. Keep it running (20 min)

**Start on boot.** WSL does not start until something asks for it. Create a
Windows scheduled task: Task Scheduler → Create Task → *Run whether user is
logged on or not*, trigger *At startup*, action:

```
Program:   wsl.exe
Arguments: -d Ubuntu-24.04 -u root -e /bin/true
```

That boots the distro; systemd then starts Docker, and `restart: unless-stopped`
brings the containers back.

**Back up nightly.** Add to `crontab -e` inside Ubuntu:

```bash
0 3 * * * cd ~/GrowthX-SEO- && docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost exec -T postgres pg_dump -U growthx -Fc growthx_crawler > ~/backups/growthx-$(date +\%F).dump 2>>~/backups/backup.log
0 4 * * 0 find ~/backups -name 'growthx-*.dump' -mtime +30 -delete
```

**Watch the memory** during your first real crawl:

```bash
docker stats
```

The worker should sit near 1.2–1.6GB while rendering. If it is pinned at its
2000m limit, drop `MAX_RENDER_CONCURRENCY` to 1. If it never goes above 1GB and
Windows has room to spare, raise it to 3 and the limit to 3000m.

## 8. Verify

Run an audit for a site you know. For milquufresh.in — 29 URLs in its sitemap —
expect:

- 29 pages, not 6
- Real word counts on every page, not 5-word shells
- `Pages crawled: 29 of 29`
- A crawl that takes longer than the 6 minutes Render managed, because pages are
  now actually being rendered rather than abandoned

```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost logs -f worker
```

The log names every page as it is fetched, with its depth.

---

## What this does not fix

**Your home upload speed** bounds nothing here — crawling is mostly download —
but the Vercel frontend now makes every API call across your home connection, so
the dashboard will feel slower than it did against Render.

**Uptime is yours now.** A Windows update, a power cut or a closed lid takes the
product down. If the audit needs to be reachable by customers rather than by
you, a €5/month VPS with 4GB is the honest answer — the same compose file runs
there unchanged, minus the WSL section.

**The laptop's IP is now the crawler's IP.** Sites you audit see your home
address, and a rate-limited or blocked crawl is your household's connection
being blocked.
