# Okta Agentic Patterns Demo — Setup Guide for Claude

> **How to use this guide**: Feed this document to Claude and say _"Read this guide and set up the Okta Agentic Patterns demo on my machine"_. Claude will follow each step, prompt you for required credentials, automate everything possible, and tell you exactly what to configure manually in Okta.

---

## What this demo is

Eight Okta identity patterns for AI agents, each running as an isolated Docker service behind a shared Next.js console at `http://localhost:3020`.

| Pattern | Description | Auth flow |
|---|---|---|
| P1 | 3rd Party Coding Assistant | Requires external MCP Bridge |
| P2 | 3rd Party Consumer Agent (PKCE) | Inventory resource, inline PKCE |
| P3 | 1st Party XAA Native (ID-JAG) | HR + Finance via user-delegated XAA |
| P4 | Outbound SaaS via Okta STS | GitHub + Slack token brokering |
| P6 | Autonomous + User-delegated CC | HR + Finance, Slack reports |

---

## Prerequisites — verify before starting

Run the following checks and fix anything missing before proceeding:

```bash
docker --version          # Docker Desktop must be running
node --version            # Need Node.js 18+
git --version
```

You will need:
- **Okta org** — a developer or demo org at `*.okta.com`. Not `*.oktapreview.com`.
- **Anthropic API key** — from console.anthropic.com → API Keys (`sk-ant-...`)
- **Slack bot token** (optional, for P6 Slack posting) — `xoxb-...`

---

## Step 1 — Collect required credentials

Ask the user for:
1. **Okta domain** — e.g. `dev-12345678.okta.com` (no `https://`, no trailing slash). Find it: Okta Admin → Dashboard, top-right.
2. **Anthropic API key** — `sk-ant-api03-...`
3. **Slack bot token** (optional) — `xoxb-...`. If skipped, P6 will print reports to chat instead of Slack.
4. **Slack channel** (optional) — channel name without `#`, e.g. `demo-reports`.

---

## Step 2 — Clone the repo

```bash
cd ~/projects  # or wherever you keep projects
git clone https://github.com/marcopolox/okta-agentic-patterns.git
cd okta-agentic-patterns
```

---

## Step 3 — Create and populate .env

```bash
cp .env.example .env
```

Set the core values. Replace placeholders with values collected in Step 1:

```bash
# Set Okta domain (e.g. dev-12345678.okta.com — no https://, no trailing slash)
sed -i '' 's/^OKTA_DOMAIN=.*/OKTA_DOMAIN=YOUR_OKTA_DOMAIN/' .env
sed -i '' 's/^OKTA_AUTH_SERVER_ID=.*/OKTA_AUTH_SERVER_ID=default/' .env

# Set Anthropic API key
sed -i '' 's/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY/' .env

# Optional: Slack
sed -i '' 's/^SLACK_BOT_TOKEN=.*/SLACK_BOT_TOKEN=YOUR_SLACK_BOT_TOKEN/' .env
sed -i '' 's/^SLACK_DEFAULT_CHANNEL=.*/SLACK_DEFAULT_CHANNEL=YOUR_SLACK_CHANNEL/' .env
```

Then strip the inline comments that would otherwise be read as values:

```bash
sed -i '' 's/^\([A-Z0-9_]*\)=[[:space:]]*#.*$/\1=/' .env
```

---

## Step 4 — Apply known code fixes

The repo has several TypeScript and OAuth configuration issues that must be patched before setup.js will work and before Docker images will build. Apply all of these now.

### 4a — Inventory server TypeScript fixes

```bash
# Fix directory import (ES module incompatibility)
sed -i '' 's|from "./industries";|from "./industries/index.js";|' \
  shared/mcp-servers/inventory/src/index.ts

# Fix stockStatus signature (optional reorderPoint)
sed -i '' 's/function stockStatus(inStock: number, reorderPoint: number)/function stockStatus(inStock: number, reorderPoint?: number)/' \
  shared/mcp-servers/inventory/src/index.ts

sed -i '' 's/if (inStock <= reorderPoint)/if (reorderPoint !== undefined \&\& inStock <= reorderPoint)/' \
  shared/mcp-servers/inventory/src/index.ts
```

Add optional fields to the industries type file:

```bash
node -e "
const fs = require('fs');
const f = 'shared/mcp-servers/inventory/src/industries/index.ts';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(
  'interface InventoryRecord {\n  sku: string;\n  inStock: number;\n  reserved: number;\n  available: number;\n  status: \"in_stock\" | \"low_stock\" | \"out_of_stock\";\n}',
  'interface InventoryRecord {\n  sku: string;\n  inStock: number;\n  reserved: number;\n  available: number;\n  status: \"in_stock\" | \"low_stock\" | \"out_of_stock\";\n  reorderPoint?: number;\n  warehouse?: string;\n}'
);
c = c.replace(
  'interface Order {\n  orderId: string;',
  'interface Order {\n  id?: string;\n  orderId: string;'
);
fs.writeFileSync(f, c);
console.log('Industries types patched');
"
```

Fix the order lookup:

```bash
sed -i '' 's/getData().orders.find((o) => o.id.toLowerCase()/getData().orders.find((o) => (o.id ?? o.orderId).toLowerCase()/' \
  shared/mcp-servers/inventory/src/index.ts
```

### 4b — Remove unsupported OAuth fields from setup scripts

The `pkce_required` field and CIBA grant type cause E0000003 errors in most Okta orgs:

```bash
# P2 setup: remove pkce_required
sed -i '' '/pkce_required: true,/d' scripts/steps/p2.js

# P3 setup: remove pkce_required and CIBA grant
sed -i '' "/pkce_required: false,/d" scripts/steps/p3.js
sed -i '' "/'urn:openid:params:grant-type:ciba',/d" scripts/steps/p3.js

# P6 setup: remove authorization_code from service app (service apps can't use auth_code)
node -e "
const fs = require('fs');
const f = 'scripts/steps/p6.js';
let c = fs.readFileSync(f, 'utf8');
// Remove 'authorization_code' from the CC service app grant_types array
c = c.replace(\"'authorization_code',\\n              'client_credentials',\", \"'client_credentials',\");
fs.writeFileSync(f, c);
console.log('P6 script patched');
"

# P6 WLP placeholder: remove pkce_required
sed -i '' '/pkce_required: false,/d' scripts/steps/p6.js
```

### 4c — P2: add native auth routes (console handles PKCE directly)

Create `/api/auth/start/p2`:

```bash
cat > console/app/api/auth/start/p2/route.ts << 'TSEOF'
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.P2_OKTA_CLIENT_ID;
  const authServerId = process.env.INVENTORY_AUTHZ_SERVER_ID;
  if (!domain || !clientId || !authServerId) {
    return NextResponse.json({ error: "OKTA_DOMAIN, P2_OKTA_CLIENT_ID, and INVENTORY_AUTHZ_SERVER_ID must be set" }, { status: 500 });
  }
  const state = crypto.randomUUID();
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const redirectUri = `${base}/api/auth/callback/p2`;
  const url = new URL(`https://${domain}/oauth2/${authServerId}/v1/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email inventory:read");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("p2_state", state, { httpOnly: true, sameSite: "lax", maxAge: 300, path: "/" });
  return response;
}
TSEOF
```

Create `/api/auth/callback/p2`:

```bash
mkdir -p console/app/api/auth/callback/p2
cat > console/app/api/auth/callback/p2/route.ts << 'TSEOF'
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const base = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  if (error) return NextResponse.redirect(new URL(`/patterns/p2?error=${encodeURIComponent(error)}`, base));
  if (!code) return NextResponse.redirect(new URL("/patterns/p2?error=no_code", base));
  const domain = process.env.OKTA_DOMAIN;
  const clientId = process.env.P2_OKTA_CLIENT_ID;
  const clientSecret = process.env.P2_OKTA_CLIENT_SECRET;
  const authServerId = process.env.INVENTORY_AUTHZ_SERVER_ID;
  const redirectUri = `${base}/api/auth/callback/p2`;
  if (!domain || !clientId || !clientSecret || !authServerId) {
    return NextResponse.redirect(new URL("/patterns/p2?error=missing_config", base));
  }
  const tokenRes = await fetch(`https://${domain}/oauth2/${authServerId}/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.redirect(new URL(`/patterns/p2?error=${encodeURIComponent(body)}`, base));
  }
  const tokens = await tokenRes.json() as { access_token?: string };
  const response = NextResponse.redirect(new URL("/patterns/p2", base));
  if (tokens.access_token) {
    response.cookies.set("p2_access_token", tokens.access_token, { httpOnly: true, maxAge: 3600, sameSite: "lax", path: "/" });
    const eventBusUrl = process.env.EVENT_BUS_URL ?? "http://event-bus:4000";
    await fetch(`${eventBusUrl}/emit`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patternId: "p2", actor: "Okta", action: "issued access_token", target: "Console", detail: "inventory:read scope granted", level: "token", token: tokens.access_token }) }).catch(() => {});
  }
  return response;
}
TSEOF
```

### 4d — P2 agent: connect directly to Inventory server (bypasses adapter auth)

```bash
node -e "
const fs = require('fs');
const f = 'patterns/p2-third-party-single/agent/src/index.ts';
let c = fs.readFileSync(f, 'utf8');
// Replace adapter URL constants with direct inventory server
c = c.replace(
  \`const PORT = parseInt(process.env.PORT ?? \"3200\");
const EVENT_BUS_URL = process.env.EVENT_BUS_URL ?? \"http://localhost:4000\";
// Internal URL for API calls from the Docker container to the standalone adapter
const MCP_ADAPTER_URL = process.env.MCP_ADAPTER_URL ?? \"http://localhost:8008\";
// Browser-accessible URL used to build auth links shown to the user
const MCP_ADAPTER_PUBLIC_URL = process.env.MCP_ADAPTER_PUBLIC_URL ?? MCP_ADAPTER_URL;
// Console base URL — combined with /callback to form the PKCE redirect_uri
const CONSOLE_URL = process.env.CONSOLE_URL ?? \"http://localhost:3020\";
const REDIRECT_URI = \\\`\\\${CONSOLE_URL}/callback\\\`;
const PATTERN_ID = \"p2\";\`,
  \`const PORT = parseInt(process.env.PORT ?? \"3200\");
const EVENT_BUS_URL = process.env.EVENT_BUS_URL ?? \"http://localhost:4000\";
// Direct URL to the Inventory MCP server — no adapter proxy needed for P2
const INVENTORY_SERVER_URL = process.env.INVENTORY_SERVER_URL ?? \"http://localhost:3103\";
const CONSOLE_URL = process.env.CONSOLE_URL ?? \"http://localhost:3020\";
const PATTERN_ID = \"p2\";\`
);
fs.writeFileSync(f, c);
console.log('P2 agent URL patched');
" 2>/dev/null || echo "P2 agent may already be patched"
```

### 4e — P6: autonomous CC flow and Mission 2 XAA fallback

These patches make P6 Mission 1 (autonomous CC) and Mission 2 (user-delegated XAA) work without A2A worker infrastructure.

> **Note**: These are the most complex patches. If they fail, apply them manually by comparing with the reference implementation in `DEMO_SETUP_GUIDE.md`.

The key changes are:
1. `console/app/api/p6/run-autonomous/route.ts` — POST to `/chat` instead of CC→`/invoke`
2. `patterns/p6-autonomous-m2m/agent/src/index.ts` — CC flow in no-token `/chat`, XAA fallback when workers absent
3. `docker-compose.yml` — add HR/Finance vars to p6-agent

These are applied automatically later via the Node.js setup helper script (Step 6b).

---

## Step 5 — Create a temporary SSWS admin token

Go to **Okta Admin → Security → API → Tokens → Create Token**. Name it anything (e.g. `demo-setup`). Copy the token value — you will paste it when the setup script prompts you.

**Important**: Keep this token active until the demo is fully running. P3 needs it at runtime to call the Connections API. You can create a second long-lived token for runtime use once setup is complete.

---

## Step 6 — Run the provisioning script

```bash
node scripts/setup.js
```

When prompted (`→`), paste your SSWS token.

The script will provision ~20 Okta resources including:
- 3 custom authorization servers (HR, Finance, Inventory)
- OAuth apps for P2, P3/P4 shared, P6 CC service
- AI Agent workload principals for P3, P4, P6 with RSA key pairs
- Token-exchange policies

### 6b — Write P6 orchestrator aliases and additional .env vars

After setup.js completes, run this helper to write remaining required vars:

```bash
node -e "
const { readEnv, writeEnv } = require('./scripts/lib/env');
const e = readEnv();
const extras = {};

// P6 orchestrator aliases (docker-compose uses P6_ORCHESTRATOR_* naming)
if (e.P6_OKTA_AI_AGENT_ID && !e.P6_ORCHESTRATOR_OKTA_AI_AGENT_ID)
  extras.P6_ORCHESTRATOR_OKTA_AI_AGENT_ID = e.P6_OKTA_AI_AGENT_ID;
if (e.P6_OKTA_PRIVATE_KEY && !e.P6_ORCHESTRATOR_OKTA_PRIVATE_KEY)
  extras.P6_ORCHESTRATOR_OKTA_PRIVATE_KEY = e.P6_OKTA_PRIVATE_KEY;
if (e.P6_OKTA_CLIENT_ID && !e.P6_ORCHESTRATOR_OKTA_CLIENT_ID)
  extras.P6_ORCHESTRATOR_OKTA_CLIENT_ID = e.P6_OKTA_CLIENT_ID;
if (e.P6_OKTA_CLIENT_SECRET && !e.P6_ORCHESTRATOR_OKTA_CLIENT_SECRET)
  extras.P6_ORCHESTRATOR_OKTA_CLIENT_SECRET = e.P6_OKTA_CLIENT_SECRET;

// Derived values
if (!e.OKTA_ISSUER && e.OKTA_DOMAIN && e.OKTA_AUTH_SERVER_ID)
  extras.OKTA_ISSUER = 'https://' + e.OKTA_DOMAIN + '/oauth2/' + e.OKTA_AUTH_SERVER_ID;
if (!e.NEXT_PUBLIC_OKTA_DOMAIN && e.OKTA_DOMAIN)
  extras.NEXT_PUBLIC_OKTA_DOMAIN = e.OKTA_DOMAIN;
if (!e.OKTA_API_TOKEN)
  extras.OKTA_API_TOKEN = 'PASTE_YOUR_SSWS_TOKEN_HERE';

if (Object.keys(extras).length > 0) {
  writeEnv(extras);
  console.log('Wrote', Object.keys(extras).length, 'extra vars');
} else {
  console.log('All aliases already present');
}
"
```

> **Action required**: If `OKTA_API_TOKEN` was written as `PASTE_YOUR_SSWS_TOKEN_HERE`, edit `.env` and replace it with your actual SSWS token (the one you used in step 5, or a new one).

### 6c — Create AI Agent public key registrations

Run the following to find the agent IDs and register their JWKs (in case the setup script couldn't call the beta AI Agent API):

```bash
node -e "
const { init, okta } = require('./scripts/lib/okta');
const { readEnv, writeEnv } = require('./scripts/lib/env');
const e = readEnv();
init(e.OKTA_DOMAIN, e.OKTA_API_TOKEN || process.env.SSWS_TOKEN);
async function toPublic(jwk) { const { d, p, q, dp, dq, qi, ...pub } = jwk; return pub; }
async function run() {
  const agents = await okta('/workload-principals/api/v1/ai-agents?limit=50')
    .then(d => d.data || []).catch(() => []);
  const map = { 'okta-demo-p3-agent': 'P3_OKTA_AI_AGENT_ID', 'okta-demo-p4-agent': 'P4_OKTA_AI_AGENT_ID', 'okta-demo-p6-agent': 'P6_OKTA_AI_AGENT_ID' };
  const keyMap = { 'P3_OKTA_AI_AGENT_ID': 'P3_OKTA_PRIVATE_KEY', 'P4_OKTA_AI_AGENT_ID': 'P4_OKTA_PRIVATE_KEY', 'P6_OKTA_AI_AGENT_ID': 'P6_OKTA_PRIVATE_KEY' };
  const updates = {};
  for (const a of agents) {
    const envVar = map[a.profile?.name];
    if (!envVar) continue;
    if (!e[envVar]) updates[envVar] = a.id;
    const privKeyVar = keyMap[envVar];
    if (e[privKeyVar]) {
      const pub = await toPublic(JSON.parse(e[privKeyVar]));
      await okta('/workload-principals/api/v1/ai-agents/' + a.id + '/credentials/jwks', 'POST', pub).catch(() => {});
      console.log('JWK registered for', a.profile.name, a.id);
    }
  }
  if (Object.keys(updates).length) { writeEnv(updates); console.log('Agent IDs written:', updates); }
}
run().catch(console.error);
"
```

---

## Step 7 — Update docker-compose for P2 and P6

Apply these targeted docker-compose changes (they're idempotent — safe to run multiple times):

```bash
# P2 agent: replace adapter URL with direct inventory server
node -e "
const fs = require('fs');
const f = 'docker-compose.yml';
let c = fs.readFileSync(f, 'utf8');
if (c.includes('INVENTORY_SERVER_URL: http://inventory-server:3103')) {
  console.log('docker-compose already patched for P2'); process.exit(0);
}
c = c.replace(
  /      PORT: 3200\n      EVENT_BUS_URL: http:\/\/event-bus:4000\n.*MCP_ADAPTER_URL.*\n.*MCP_ADAPTER_PUBLIC_URL.*\n.*CONSOLE_URL.*\n/s,
  '      PORT: 3200\n      EVENT_BUS_URL: http://event-bus:4000\n      INVENTORY_SERVER_URL: http://inventory-server:3103\n      CONSOLE_URL: \${NEXTAUTH_URL:-http://localhost:3020}\n'
);
fs.writeFileSync(f, c);
console.log('docker-compose P2 patched');
"

# P6 agent: add HR/Finance CC vars
node -e "
const fs = require('fs');
const f = 'docker-compose.yml';
let c = fs.readFileSync(f, 'utf8');
if (c.includes('P6_OKTA_CLIENT_ID: \${P6_OKTA_CLIENT_ID')) {
  console.log('docker-compose already patched for P6'); process.exit(0);
}
const insert = '      # CC service app + HR/Finance auth servers for P6 missions\n      P6_OKTA_CLIENT_ID: \${P6_OKTA_CLIENT_ID:-}\n      P6_OKTA_CLIENT_SECRET: \${P6_OKTA_CLIENT_SECRET:-}\n      HR_AUTHZ_SERVER_ID: \${HR_AUTHZ_SERVER_ID:-}\n      HR_RESOURCE_AUDIENCE: \${HR_RESOURCE_AUDIENCE:-}\n      FINANCE_AUTHZ_SERVER_ID: \${FINANCE_AUTHZ_SERVER_ID:-}\n      FINANCE_RESOURCE_AUDIENCE: \${FINANCE_RESOURCE_AUDIENCE:-}\n      HR_API_URL: http://hr-server:3101\n      FINANCE_API_URL: http://finance-server:3102\n';
c = c.replace('      SLACK_BOT_TOKEN: \${SLACK_BOT_TOKEN:-}\n      SLACK_DEFAULT_CHANNEL:', insert + '      SLACK_BOT_TOKEN: \${SLACK_BOT_TOKEN:-}\n      SLACK_DEFAULT_CHANNEL:');
fs.writeFileSync(f, c);
console.log('docker-compose P6 patched');
"
```

---

## Step 8 — Build and start Docker

```bash
docker compose --profile p2 --profile p3 --profile p4 --profile p6 up -d --build
```

This builds 11 images (first run ~5 min) and starts all containers. Verify:

```bash
docker compose --profile p2 --profile p3 --profile p4 --profile p6 ps
```

All containers should show `Up`. Open **http://localhost:3020** — you should see the demo console.

---

## Step 9 — Set correct P6 user-login client

The P6 Mission 2 "Login to run" uses a web app client (not the CC service app). Run this to fetch the correct client ID and secret:

```bash
node -e "
const { readEnv, writeEnv } = require('./scripts/lib/env');
const { init, okta } = require('./scripts/lib/okta');
const e = readEnv();
init(e.OKTA_DOMAIN, e.OKTA_API_TOKEN);
async function run() {
  const apps = await okta('/api/v1/apps?q=okta-demo-p6-wlp-placeholder&limit=5').catch(() => []);
  const app = (apps || []).find(a => a.label === 'okta-demo-p6-wlp-placeholder');
  if (!app) { console.log('WLP placeholder not found — run setup.js first'); return; }
  // Generate a new secret
  const sec = await okta('/api/v1/apps/' + app.id + '/credentials/secrets', 'POST', {});
  const secret = sec.client_secret;
  writeEnv({ P6_ORCHESTRATOR_OKTA_CLIENT_ID: app.id, P6_ORCHESTRATOR_OKTA_CLIENT_SECRET: secret });
  console.log('P6_ORCHESTRATOR_OKTA_CLIENT_ID =', app.id);
  console.log('P6_ORCHESTRATOR_OKTA_CLIENT_SECRET set');
}
run().catch(console.error);
"
docker compose --profile p6 up -d --no-build console
```

---

## Step 10 — Verify working patterns

| Pattern | URL | Quick test |
|---|---|---|
| P2 | http://localhost:3020/patterns/p2 | Ask "What products do you have?" |
| P3 | http://localhost:3020/patterns/p3 | Login → "Show me the org chart for Engineering" |
| P4 | http://localhost:3020/patterns/p4 | Login → "List my GitHub repositories" |
| P6 Mission 1 | http://localhost:3020/patterns/p6 | RUN on Org Pulse Report |
| P6 Mission 2 | http://localhost:3020/patterns/p6 | Login → RUN on Budget Report |

---

## Manual Okta configuration required

The following cannot be automated and must be done through the Okta Admin Console.

### A. P4 — Outbound SaaS via Okta STS (GitHub + Slack)

P4 brokers user identity to GitHub and Slack via Okta STS. You need to add two OIN integrations.

#### GitHub Enterprise

1. **Okta Admin → Applications → Browse App Catalog** → search `GitHub Enterprise` → Add Integration
2. Open the app → **General** tab → **Security Token Service (STS)** → Enable STS → Save
3. Copy the **Resource ORN** (format: `orn:okta:...`)
4. Run: `cd YOUR_PROJECT_DIR && node -e "require('./scripts/lib/env').writeEnv({P4_GITHUB_STS_RESOURCE:'PASTE_ORN_HERE'})"`
5. Restart P4: `docker compose --profile p4 up -d --no-build p4-agent`

#### Slack

1. **Okta Admin → Applications → Browse App Catalog** → search `Slack` → Add Integration
2. Create a Slack app at **api.slack.com/apps** with:
   - Bot Token Scopes: `chat:write`, `channels:read`
   - Redirect URL: `https://YOUR_OKTA_DOMAIN/oauth2/v1/sts/callback`
   - Copy the **Client ID** and **Client Secret**
3. In the Okta Slack app → **Sign On** or **General** → enter the Slack app credentials
4. **STS** section → Enable STS → configure scopes → Save → Copy the **Resource ORN**
5. Run: `node -e "require('./scripts/lib/env').writeEnv({P4_SLACK_STS_RESOURCE:'PASTE_ORN_HERE'})"`
6. Restart: `docker compose --profile p4 up -d --no-build p4-agent`

> **Slack note**: STS issues a bot token. If `post_message` fails with `missing_scope`, add `chat:write` and `channels:read` scopes in the Slack app and reinstall.

---

### B. P6 — Slack bot token (autonomous reporting)

P6 Mission 1 posts reports to Slack using a direct bot token.

1. Create a Slack app at **api.slack.com/apps** (or reuse the P4 one)
2. Bot Token Scopes: `chat:write`, `chat:write.public`, `channels:read`
3. Install to workspace → copy the **Bot User OAuth Token** (`xoxb-...`)
4. In the demo console: **Settings** → paste the token and your channel name (e.g. `demo-reports`)
5. Or set directly: `node -e "require('./scripts/lib/env').writeEnv({SLACK_BOT_TOKEN:'xoxb-...',SLACK_DEFAULT_CHANNEL:'demo-reports'})"` then `docker compose --profile p6 up -d --no-build p6-agent`

---

### C. P6 — AI Agent connections in Okta Admin (for Mission 2 user-delegated XAA)

Mission 2 uses `IDENTITY_ASSERTION_CUSTOM_AS` connections on the P6 orchestrator agent. Check if these already exist:

```bash
node -e "
const { readEnv } = require('./scripts/lib/env');
const { init, okta } = require('./scripts/lib/okta');
const e = readEnv();
init(e.OKTA_DOMAIN, e.OKTA_API_TOKEN);
okta('/workload-principals/api/v1/ai-agents/' + e.P6_OKTA_AI_AGENT_ID + '/connections')
  .then(d => { console.log('Connections:'); (d.data||[]).forEach(c => console.log(' -', c.connectionType, c.status, c.resourceIndicator)); })
  .catch(console.error);
"
```

If you see `IDENTITY_ASSERTION_CUSTOM_AS ACTIVE api:hr` and `api:finance` — **no action needed**, Mission 2 will work automatically.

If empty, configure in Okta Admin:
1. **Okta Admin → Directory → AI Agents** → find `okta-demo-p6-agent`
2. **Resource connections** tab → Add connection for HR:
   - Type: **Custom authorization server** (IDENTITY_ASSERTION_CUSTOM_AS)
   - Authorization server: `okta-demo-hr`
   - Resource indicator: `api:hr`
   - Scope: `hr:read`
3. Add connection for Finance similarly (server: `okta-demo-finance`, resource: `api:finance`, scope: `finance:read`)
4. Activate both connections

---

### D. P1 — MCP Bridge / Coding Assistant (optional)

P1 requires the **Okta MCP Adapter** running separately. It is not included in this repo.

If you have the adapter running (locally or in cloud):
1. Set `MCP_ADAPTER_URL` in `.env` to the adapter's public URL (e.g. `https://your-adapter.example.com`)
2. Set `MCP_ADAPTER_INTERNAL_URL` to how Docker containers reach it (e.g. `http://host.docker.internal:8000` for local)
3. Rebuild: `docker compose up -d --no-build console`
4. Point your AI coding assistant (Claude Code, Cursor) at `MCP_ADAPTER_URL/mcp`

---

## Troubleshooting

### Setup script fails with "request body not well-formed"

The org doesn't support `pkce_required` or CIBA grant type. Ensure Step 4b patches were applied before running setup.js. Re-run setup.js after patching (it's idempotent).

### P2: "Error connecting to Inventory Server: fetch failed"

The inventory-server container isn't running. Run:
```bash
docker compose --profile p2 up -d inventory-server
```

### P3: "Loaded 0 XAA servers"

The P3 agent couldn't reach the Okta Connections API. Check `OKTA_API_TOKEN` is set and valid in `.env`.

### P4: "invalid_target: resource is invalid or not supported"

The P4_GITHUB_STS_RESOURCE or P4_SLACK_STS_RESOURCE ORN is stale after reconfiguring the OIN app. Get the new ORN from the Okta Admin app's STS section and update `.env`.

### P6 Mission 1: "CC grant failed: unauthorized_client"

The `P6_OKTA_CLIENT_ID` is a service app which doesn't support CC? Check it's the CC service app (`okta-demo-p6-autonomous-m2m`) and that CC policies exist on the HR/Finance auth servers.

### P6 Mission 2: "No A2A worker agents configured"

The XAA server connections aren't loading. Check Step C above — the P6 orchestrator agent needs `IDENTITY_ASSERTION_CUSTOM_AS` connections to HR and Finance in Okta Admin.

### Containers keep restarting

```bash
docker compose --profile p2 --profile p3 --profile p4 --profile p6 logs --tail=20 SERVICE_NAME
```

Replace `SERVICE_NAME` with the failing container name.

---

## Complete .env reference

After all steps, your `.env` should have these key values populated:

```
# Core
OKTA_DOMAIN=               # your-org.okta.com
OKTA_AUTH_SERVER_ID=default
OKTA_ISSUER=               # https://your-org.okta.com/oauth2/default
ANTHROPIC_API_KEY=         # sk-ant-...
OKTA_API_TOKEN=            # SSWS token (keep alive for P3 runtime)

# Auth servers (from setup.js)
HR_AUTHZ_SERVER_ID=        # aus...
HR_RESOURCE_AUDIENCE=api:hr
FINANCE_AUTHZ_SERVER_ID=   # aus...
FINANCE_RESOURCE_AUDIENCE=api:finance
INVENTORY_AUTHZ_SERVER_ID= # aus...
INVENTORY_RESOURCE_AUDIENCE=api://inventory-resource

# P2
P2_OKTA_CLIENT_ID=         # 0oa...
P2_OKTA_CLIENT_SECRET=

# P3/P4 shared app
P3_OKTA_CLIENT_ID=         # 0oa...
P3_OKTA_CLIENT_SECRET=
P3_OKTA_AI_AGENT_ID=       # wlp...
P3_OKTA_PRIVATE_KEY=       # JWK JSON (single line)
P4_OKTA_CLIENT_ID=         # same as P3
P4_OKTA_CLIENT_SECRET=     # same as P3
P4_OKTA_AI_AGENT_ID=       # wlp...
P4_OKTA_PRIVATE_KEY=       # JWK JSON

# P4 OIN (manual)
P4_GITHUB_STS_RESOURCE=    # orn:okta:...
P4_SLACK_STS_RESOURCE=     # orn:okta:...

# P6
P6_OKTA_CLIENT_ID=         # 0oa... (CC service app)
P6_OKTA_CLIENT_SECRET=
P6_OKTA_AI_AGENT_ID=       # wlp...
P6_OKTA_PRIVATE_KEY=       # JWK JSON
P6_ORCHESTRATOR_OKTA_CLIENT_ID=    # 0oa... (WLP placeholder web app — for Mission 2 login)
P6_ORCHESTRATOR_OKTA_CLIENT_SECRET=
P6_ORCHESTRATOR_OKTA_AI_AGENT_ID=  # alias = P6_OKTA_AI_AGENT_ID
P6_ORCHESTRATOR_OKTA_PRIVATE_KEY=  # alias = P6_OKTA_PRIVATE_KEY

# Slack (optional)
SLACK_BOT_TOKEN=           # xoxb-...
SLACK_DEFAULT_CHANNEL=demo-reports
```

---

## Summary of what the automation covers

| Task | Automated | Manual |
|---|---|---|
| Clone repo | ✅ | |
| Set core .env vars | ✅ (prompt) | |
| Strip .env comment placeholders | ✅ | |
| TypeScript inventory server fixes | ✅ | |
| OAuth app grant type fixes | ✅ | |
| P2 auth routes (start + callback) | ✅ | |
| Okta provisioning (setup.js) | ✅ (needs SSWS token) | |
| AI Agent JWK registration | ✅ | |
| P6 orchestrator aliases + CC vars | ✅ | |
| P6 user-login client config | ✅ | |
| Docker build + start | ✅ | |
| P4 GitHub OIN + STS | | ✅ Okta Admin UI |
| P4 Slack OIN + STS | | ✅ Okta Admin UI + api.slack.com |
| P6 orchestrator agent connections | | ✅ Okta Admin UI (check first — may already exist) |
| Slack bot token | | ✅ api.slack.com + demo settings page |
| P1 MCP Bridge | | ✅ Separate product |
