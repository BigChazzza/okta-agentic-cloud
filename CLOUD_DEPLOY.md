# Cloud Deployment Guide — Render + Vercel

Deploy the Okta Agentic Patterns demo to the public internet using Render (backend services) and Vercel (Next.js console). Feed this document to Claude and say **"Follow CLOUD_DEPLOY.md to deploy this demo"**.

---

## Prerequisites

- GitHub account with this repo pushed to it
- Render account — render.com (free or Starter tier)
- Vercel account — vercel.com (free tier)
- Okta org already provisioned (run `node scripts/setup.js` from local demo first)
- All `.env` values from the local demo setup

---

## Architecture overview

```
Browser
  └── Vercel (console Next.js)
        ├── /api/events/[id]  ──proxy SSE──►  Render: event-bus
        ├── /api/chat/[id]    ──proxy POST──►  Render: p2/p3/p4/p6 agents
        └── /api/p6/...       ──proxy POST──►  Render: p6-agent

Render services (all HTTPS, auto-TLS):
  event-bus          ←── all agents emit events here
  hr-server          ←── P3, P6 tool calls (Okta token validation)
  finance-server     ←── P3, P6 tool calls
  inventory-server   ←── P2 tool calls
  p2-agent           ←── Consumer agent
  p3-agent           ←── XAA/ID-JAG agent
  p4-agent           ←── STS outbound agent
  p6-agent           ←── Autonomous + user-delegated agent
```

---

## Step 1 — Push to GitHub

```bash
cd ~/projects/okta-agentic-cloud   # or wherever your cloud copy lives
git add -A
git commit -m "Initial cloud deployment setup"
# Create a new repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/okta-agentic-cloud.git
git push -u origin main
```

---

## Step 2 — Deploy Render services

Render supports a Blueprint (`render.yaml`) to provision all services at once.

### Option A — Blueprint (recommended, one click)

1. Go to **render.com/dashboard** → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and creates all services
4. Each service will be in "Build" state — wait for all to turn green

### Option B — Manual (one service at a time)

For each service in the table below, go to **Render → New → Web Service**:

| Service name | Root directory | Build command | Start command |
|---|---|---|---|
| `okta-demo-event-bus` | `shared/event-bus` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-hr-server` | `shared/mcp-servers/hr` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-finance-server` | `shared/mcp-servers/finance` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-inventory-server` | `shared/mcp-servers/inventory` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-p2-agent` | `patterns/p2-third-party-single/agent` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-p3-agent` | `patterns/p3-first-party-xaa/agent` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-p4-agent` | `patterns/p4-outbound-saas/agent` | `npm install && npm run build` | `node dist/index.js` |
| `okta-demo-p6-agent` | `patterns/p6-autonomous-m2m/agent` | `npm install && npm run build` | `node dist/index.js` |

### Collect Render URLs

After all services are deployed, record the public URLs. They follow the pattern `https://SERVICE-NAME.onrender.com`:

```
EVENT_BUS_URL=https://okta-demo-event-bus.onrender.com
HR_SERVER_URL=https://okta-demo-hr-server.onrender.com
FINANCE_SERVER_URL=https://okta-demo-finance-server.onrender.com
INVENTORY_SERVER_URL=https://okta-demo-inventory-server.onrender.com
P2_AGENT_URL=https://okta-demo-p2-agent.onrender.com
P3_AGENT_URL=https://okta-demo-p3-agent.onrender.com
P4_AGENT_URL=https://okta-demo-p4-agent.onrender.com
P6_AGENT_URL=https://okta-demo-p6-agent.onrender.com
```

---

## Step 3 — Set Render environment variables

For each service, go to **Render → Service → Environment** and add the following variables.

> **Tip**: Use Render's Environment Groups to share common vars (OKTA_DOMAIN, ANTHROPIC_API_KEY) across all services.

### Shared (all services)

```
OKTA_DOMAIN         = your-org.okta.com
NODE_ENV            = production
```

### event-bus

```
ALLOWED_ORIGINS     = https://YOUR_VERCEL_URL.vercel.app  (set after Step 4)
```

### hr-server

```
OKTA_ISSUER         = https://your-org.okta.com/oauth2/HR_AUTHZ_SERVER_ID
OKTA_AUDIENCE       = api:hr
EVENT_BUS_URL       = https://okta-demo-event-bus.onrender.com
```

### finance-server

```
OKTA_ISSUER         = https://your-org.okta.com/oauth2/FINANCE_AUTHZ_SERVER_ID
OKTA_AUDIENCE       = api:finance
EVENT_BUS_URL       = https://okta-demo-event-bus.onrender.com
```

### inventory-server

```
OKTA_ISSUER         = https://your-org.okta.com/oauth2/INVENTORY_AUTHZ_SERVER_ID
OKTA_AUDIENCE       = api://inventory-resource
EVENT_BUS_URL       = https://okta-demo-event-bus.onrender.com
```

### p2-agent

```
EVENT_BUS_URL         = https://okta-demo-event-bus.onrender.com
INVENTORY_SERVER_URL  = https://okta-demo-inventory-server.onrender.com
CONSOLE_URL           = https://YOUR_VERCEL_URL.vercel.app
ANTHROPIC_API_KEY     = sk-ant-...
```

### p3-agent

```
EVENT_BUS_URL           = https://okta-demo-event-bus.onrender.com
OKTA_DOMAIN             = your-org.okta.com
OKTA_ISSUER             = https://your-org.okta.com/oauth2/default
OKTA_CLIENT_ID          = (P3_OKTA_CLIENT_ID from .env)
OKTA_AI_AGENT_ID        = (P3_OKTA_AI_AGENT_ID from .env)
OKTA_PRIVATE_KEY        = (P3_OKTA_PRIVATE_KEY from .env — full JWK JSON)
OKTA_API_TOKEN          = (OKTA_API_TOKEN from .env)
HR_RESOURCE_AUDIENCE    = api:hr
FINANCE_RESOURCE_AUDIENCE = api:finance
PROTECTED_API_URL       = https://okta-demo-hr-server.onrender.com
FINANCE_API_URL         = https://okta-demo-finance-server.onrender.com
CONSOLE_URL             = https://YOUR_VERCEL_URL.vercel.app
ANTHROPIC_API_KEY       = sk-ant-...
```

### p4-agent

```
EVENT_BUS_URL           = https://okta-demo-event-bus.onrender.com
OKTA_DOMAIN             = your-org.okta.com
OKTA_AUTH_SERVER_ID     = default
OKTA_AI_AGENT_ID        = (P4_OKTA_AI_AGENT_ID)
OKTA_PRIVATE_KEY        = (P4_OKTA_PRIVATE_KEY)
GITHUB_STS_RESOURCE     = (P4_GITHUB_STS_RESOURCE)
SLACK_STS_RESOURCE      = (P4_SLACK_STS_RESOURCE)
CONSOLE_URL             = https://YOUR_VERCEL_URL.vercel.app
ANTHROPIC_API_KEY       = sk-ant-...
```

### p6-agent

```
EVENT_BUS_URL           = https://okta-demo-event-bus.onrender.com
OKTA_DOMAIN             = your-org.okta.com
OKTA_API_TOKEN          = (OKTA_API_TOKEN)
OKTA_AI_AGENT_ID        = (P6_ORCHESTRATOR_OKTA_AI_AGENT_ID)
OKTA_PRIVATE_KEY        = (P6_ORCHESTRATOR_OKTA_PRIVATE_KEY)
P6_OKTA_CLIENT_ID       = (P6_OKTA_CLIENT_ID)
P6_OKTA_CLIENT_SECRET   = (P6_OKTA_CLIENT_SECRET)
HR_AUTHZ_SERVER_ID      = (HR_AUTHZ_SERVER_ID)
HR_RESOURCE_AUDIENCE    = api:hr
FINANCE_AUTHZ_SERVER_ID = (FINANCE_AUTHZ_SERVER_ID)
FINANCE_RESOURCE_AUDIENCE = api:finance
HR_API_URL              = https://okta-demo-hr-server.onrender.com
FINANCE_API_URL         = https://okta-demo-finance-server.onrender.com
SLACK_BOT_TOKEN         = xoxb-...
SLACK_DEFAULT_CHANNEL   = demo-reports
CONSOLE_URL             = https://YOUR_VERCEL_URL.vercel.app
ANTHROPIC_API_KEY       = sk-ant-...
```

---

## Step 4 — Deploy Vercel console

1. Go to **vercel.com/new** → Import Git Repository → select your repo
2. Set **Root Directory** to `console`
3. Framework: **Next.js** (auto-detected)
4. **Do not** set `output: standalone` — Vercel uses its own output. Set env var:
   ```
   NEXT_OUTPUT=   (leave empty — override the standalone default)
   ```

### Vercel environment variables

Add all of these in **Vercel → Project → Settings → Environment Variables**:

```
# Console identity
NEXTAUTH_URL                        = https://YOUR_APP.vercel.app
NEXT_PUBLIC_OKTA_DOMAIN             = your-org.okta.com

# Okta
OKTA_DOMAIN                         = your-org.okta.com
OKTA_ISSUER                         = https://your-org.okta.com/oauth2/default
OKTA_API_TOKEN                      = (SSWS token — for P3 runtime Connections API)

# Auth servers
HR_AUTHZ_SERVER_ID                  = aus...
FINANCE_AUTHZ_SERVER_ID             = aus...
INVENTORY_AUTHZ_SERVER_ID           = aus...

# Pattern clients
P2_OKTA_CLIENT_ID                   = 0oa...
P2_OKTA_CLIENT_SECRET               = ...
P3_OKTA_CLIENT_ID                   = 0oa...
P3_OKTA_CLIENT_SECRET               = ...
P4_OKTA_CLIENT_ID                   = 0oa...
P4_OKTA_CLIENT_SECRET               = ...
P6_ORCHESTRATOR_OKTA_CLIENT_ID      = 0oa... (WLP placeholder web app — for Mission 2 login)
P6_ORCHESTRATOR_OKTA_CLIENT_SECRET  = ...

# Internal URLs (Vercel server-side calls to Render)
EVENT_BUS_INTERNAL_URL              = https://okta-demo-event-bus.onrender.com
P2_AGENT_INTERNAL_URL               = https://okta-demo-p2-agent.onrender.com
P3_AGENT_INTERNAL_URL               = https://okta-demo-p3-agent.onrender.com
P4_AGENT_INTERNAL_URL               = https://okta-demo-p4-agent.onrender.com
P6_AGENT_INTERNAL_URL               = https://okta-demo-p6-agent.onrender.com
HR_SERVER_URL                       = https://okta-demo-hr-server.onrender.com
FINANCE_SERVER_URL                  = https://okta-demo-finance-server.onrender.com
INVENTORY_SERVER_URL                = https://okta-demo-inventory-server.onrender.com

# Misc
ANTHROPIC_API_KEY                   = sk-ant-...
```

5. Click **Deploy**. Note your Vercel URL (e.g. `https://okta-agentic-cloud.vercel.app`).

---

## Step 5 — Update Okta redirect URIs

Now that you have the Vercel URL, update every OAuth app to accept callbacks from it. Run this script with your SSWS token:

```bash
OKTA_DOMAIN="your-org.okta.com"
SSWS="your-ssws-token"
VERCEL_URL="https://your-app.vercel.app"

node -e "
const DOMAIN = '$OKTA_DOMAIN'; const SSWS = '$SSWS'; const BASE = '$VERCEL_URL';
const h = { Authorization: 'SSWS ' + SSWS, 'Content-Type': 'application/json', Accept: 'application/json' };

const newUris = {
  'P2': { client_id: 'P2_OKTA_CLIENT_ID_HERE', uris: [BASE + '/api/auth/callback/p2'] },
  'P3': { client_id: 'P3_OKTA_CLIENT_ID_HERE', uris: [BASE + '/api/auth/callback/p3', BASE + '/api/auth/callback/p4', BASE + '/patterns/p4'] },
  'P6': { client_id: 'P6_ORCHESTRATOR_OKTA_CLIENT_ID_HERE', uris: [BASE + '/api/auth/callback/p6'] },
};

async function addUris(label, appId, newRedirects) {
  const app = await fetch('https://' + DOMAIN + '/api/v1/apps/' + appId, { headers: h }).then(r => r.json());
  const existing = app.settings.oauthClient.redirect_uris || [];
  const merged = [...new Set([...existing, ...newRedirects])];
  if (merged.length === existing.length) { console.log(label + ': already up to date'); return; }
  await fetch('https://' + DOMAIN + '/api/v1/apps/' + appId, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ ...app, settings: { ...app.settings, oauthClient: { ...app.settings.oauthClient, redirect_uris: merged } } })
  });
  console.log(label + ': added', newRedirects.join(', '));
}

for (const [label, { client_id, uris }] of Object.entries(newUris)) {
  await addUris(label, client_id, uris).catch(e => console.error(label, e.message));
}
"
```

> **Replace** `P2_OKTA_CLIENT_ID_HERE` etc. with the actual IDs from your `.env`.

---

## Step 6 — Add Okta Trusted Origin

**Okta Admin → Security → API → Trusted Origins → Add Origin**:
- Name: `Vercel Demo Console`
- Origin: `https://your-app.vercel.app`
- Enable: CORS + Redirect

---

## Step 7 — Update event-bus ALLOWED_ORIGINS

Back in **Render → okta-demo-event-bus → Environment**:
```
ALLOWED_ORIGINS = https://your-app.vercel.app
```

Trigger a redeploy (Manual Deploy → Deploy latest commit).

---

## Step 8 — Verify

Open `https://your-app.vercel.app` and test each pattern:

| Pattern | Test |
|---|---|
| P2 | "What products do you have?" → public; "Check stock" → auth link → authorize → full access |
| P3 | Login → "Show me the Engineering org chart" |
| P4 | Login → "List my GitHub repositories" |
| P6 M1 | RUN → autonomous Slack report (no login needed) |
| P6 M2 | Login → RUN → user-delegated budget report |

---

## Render free tier — keeping services warm

Render free services spin down after 15 min. For a demo, use a ping service to keep them alive:

1. Sign up for **uptimerobot.com** (free)
2. Add a monitor for each Render URL's `/health` endpoint
3. Set interval to 14 minutes

Or upgrade to **Render Starter ($7/service/month)** which doesn't spin down. At minimum, keep the **event-bus** and **p3-agent** on Starter as they handle the most traffic.

---

## Updating the deployment

Push to `main` → Render and Vercel auto-redeploy.

For `.env` changes (e.g. new Okta credentials): update them in Render/Vercel dashboards directly — never commit secrets to git.

---

## Local development still works

The original `~/projects/okta-agentic-patterns` is unchanged. This cloud repo also supports local dev via Docker Compose — the only difference is the fallback URLs now use `localhost` instead of Docker hostnames (which also works with Docker Compose since env vars override the fallbacks).
