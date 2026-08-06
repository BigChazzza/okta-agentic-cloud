#!/usr/bin/env node
'use strict';
/**
 * Push all provisioned env vars to Render services and Vercel project.
 * Run: RENDER_API_KEY=rnd_... VERCEL_TOKEN=vcp_... node scripts/push-env-to-cloud.js
 *
 * Requires:
 *   RENDER_API_KEY  — set as environment variable before running
 *   VERCEL_TOKEN    — set as environment variable before running
 */

const { readEnv } = require('./lib/env');

const RENDER_KEY   = process.env.RENDER_API_KEY;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

if (!RENDER_KEY || !VERCEL_TOKEN) {
  console.error('Error: RENDER_API_KEY and VERCEL_TOKEN must be set as environment variables.');
  console.error('Usage: RENDER_API_KEY=rnd_... VERCEL_TOKEN=vcp_... node scripts/push-env-to-cloud.js');
  process.exit(1);
}
const RENDER_OWNER = 'tea-d5stjiv5r7bs73b9fqsg';
const VERCEL_PROJECT = 'prj_xhSy93eQocXh1iA3NrACFrGBACVd';
const VERCEL_URL = 'https://okta-agentic-cloud.vercel.app';

const e = readEnv();

// ── Vars pushed to ALL Render backend services ──────────────────────────────
const SHARED_RENDER = {
  OKTA_DOMAIN:                     e.OKTA_DOMAIN,
  OKTA_API_TOKEN:                  e.OKTA_API_TOKEN,
};

// ── Per-service Render env vars ─────────────────────────────────────────────
const RENDER_SERVICES = {
  'okta-demo-event-bus': {
    ALLOWED_ORIGINS: VERCEL_URL,
  },
  'okta-demo-hr-server': {
    OKTA_ISSUER:  `https://${e.OKTA_DOMAIN}/oauth2/${e.HR_AUTHZ_SERVER_ID}`,
    OKTA_AUDIENCE: e.HR_RESOURCE_AUDIENCE || 'api:hr',
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    PATTERN_IDS: 'p1,p3,p6,p7',
    DEMO_THEME: 'default',
  },
  'okta-demo-finance-server': {
    OKTA_ISSUER:  `https://${e.OKTA_DOMAIN}/oauth2/${e.FINANCE_AUTHZ_SERVER_ID}`,
    OKTA_AUDIENCE: e.FINANCE_RESOURCE_AUDIENCE || 'api:finance',
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    PATTERN_IDS: 'p1,p3,p6,p7',
    DEMO_THEME: 'default',
  },
  'okta-demo-inventory-server': {
    OKTA_ISSUER:  `https://${e.OKTA_DOMAIN}/oauth2/${e.INVENTORY_AUTHZ_SERVER_ID}`,
    OKTA_AUDIENCE: e.INVENTORY_RESOURCE_AUDIENCE || 'api://inventory-resource',
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    PATTERN_IDS: 'p2,p5',
    DEMO_THEME: 'default',
  },
  'okta-demo-p2-agent': {
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    INVENTORY_SERVER_URL: 'https://okta-demo-inventory-server.onrender.com',
    CONSOLE_URL: VERCEL_URL,
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
  },
  'okta-demo-p3-agent': {
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    OKTA_ISSUER:  `https://${e.OKTA_DOMAIN}/oauth2/default`,
    OKTA_CLIENT_ID: e.P3_OKTA_CLIENT_ID,
    OKTA_AI_AGENT_ID: e.P3_OKTA_AI_AGENT_ID || '',
    OKTA_PRIVATE_KEY: e.P3_OKTA_PRIVATE_KEY,
    OKTA_API_TOKEN: e.OKTA_API_TOKEN,
    HR_RESOURCE_AUDIENCE: e.HR_RESOURCE_AUDIENCE || 'api:hr',
    FINANCE_RESOURCE_AUDIENCE: e.FINANCE_RESOURCE_AUDIENCE || 'api:finance',
    PROTECTED_API_URL: 'https://okta-demo-hr-server.onrender.com',
    FINANCE_API_URL:   'https://okta-demo-finance-server.onrender.com',
    CONSOLE_URL: VERCEL_URL,
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
  },
  'okta-demo-p4-agent': {
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    OKTA_AUTH_SERVER_ID: 'default',
    OKTA_AI_AGENT_ID: e.P4_OKTA_AI_AGENT_ID || '',
    OKTA_PRIVATE_KEY: e.P4_OKTA_PRIVATE_KEY,
    GITHUB_STS_RESOURCE: e.P4_GITHUB_STS_RESOURCE || '',
    SLACK_STS_RESOURCE:  e.P4_SLACK_STS_RESOURCE  || '',
    CONSOLE_URL: VERCEL_URL,
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
  },
  'okta-demo-p6-agent': {
    EVENT_BUS_URL: 'https://okta-demo-event-bus.onrender.com',
    OKTA_AI_AGENT_ID: e.P6_OKTA_AI_AGENT_ID || '',
    OKTA_PRIVATE_KEY: e.P6_OKTA_PRIVATE_KEY || e.P6_ORCHESTRATOR_OKTA_PRIVATE_KEY,
    P6_OKTA_CLIENT_ID:     e.P6_OKTA_CLIENT_ID,
    P6_OKTA_CLIENT_SECRET: e.P6_OKTA_CLIENT_SECRET,
    HR_AUTHZ_SERVER_ID:    e.HR_AUTHZ_SERVER_ID,
    HR_RESOURCE_AUDIENCE:  e.HR_RESOURCE_AUDIENCE || 'api:hr',
    FINANCE_AUTHZ_SERVER_ID:   e.FINANCE_AUTHZ_SERVER_ID,
    FINANCE_RESOURCE_AUDIENCE: e.FINANCE_RESOURCE_AUDIENCE || 'api:finance',
    HR_API_URL:      'https://okta-demo-hr-server.onrender.com',
    FINANCE_API_URL: 'https://okta-demo-finance-server.onrender.com',
    SLACK_BOT_TOKEN:      e.SLACK_BOT_TOKEN      || '',
    SLACK_DEFAULT_CHANNEL: e.SLACK_DEFAULT_CHANNEL || 'demo-reports',
    CONSOLE_URL: VERCEL_URL,
    ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
  },
};

// ── Vercel env vars ──────────────────────────────────────────────────────────
const VERCEL_VARS = {
  NEXTAUTH_URL:               VERCEL_URL,
  NEXT_PUBLIC_OKTA_DOMAIN:    e.OKTA_DOMAIN,
  OKTA_DOMAIN:                e.OKTA_DOMAIN,
  OKTA_ISSUER:               `https://${e.OKTA_DOMAIN}/oauth2/default`,
  OKTA_API_TOKEN:             e.OKTA_API_TOKEN,
  HR_AUTHZ_SERVER_ID:         e.HR_AUTHZ_SERVER_ID,
  FINANCE_AUTHZ_SERVER_ID:    e.FINANCE_AUTHZ_SERVER_ID,
  INVENTORY_AUTHZ_SERVER_ID:  e.INVENTORY_AUTHZ_SERVER_ID,
  P2_OKTA_CLIENT_ID:          e.P2_OKTA_CLIENT_ID,
  P2_OKTA_CLIENT_SECRET:      e.P2_OKTA_CLIENT_SECRET,
  P3_OKTA_CLIENT_ID:          e.P3_OKTA_CLIENT_ID,
  P3_OKTA_CLIENT_SECRET:      e.P3_OKTA_CLIENT_SECRET,
  P4_OKTA_CLIENT_ID:          e.P4_OKTA_CLIENT_ID,
  P4_OKTA_CLIENT_SECRET:      e.P4_OKTA_CLIENT_SECRET,
  P6_ORCHESTRATOR_OKTA_CLIENT_ID:     e.P6_ORCHESTRATOR_OKTA_CLIENT_ID,
  P6_ORCHESTRATOR_OKTA_CLIENT_SECRET: e.P6_ORCHESTRATOR_OKTA_CLIENT_SECRET,
  EVENT_BUS_INTERNAL_URL:    'https://okta-demo-event-bus.onrender.com',
  P2_AGENT_INTERNAL_URL:     'https://okta-demo-p2-agent.onrender.com',
  P3_AGENT_INTERNAL_URL:     'https://okta-demo-p3-agent.onrender.com',
  P4_AGENT_INTERNAL_URL:     'https://okta-demo-p4-agent.onrender.com',
  P6_AGENT_INTERNAL_URL:     'https://okta-demo-p6-agent.onrender.com',
  HR_SERVER_URL:             'https://okta-demo-hr-server.onrender.com',
  FINANCE_SERVER_URL:        'https://okta-demo-finance-server.onrender.com',
  INVENTORY_SERVER_URL:      'https://okta-demo-inventory-server.onrender.com',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getServiceId(name) {
  const r = await fetch(`https://api.render.com/v1/services?limit=100&ownerId=${RENDER_OWNER}`, {
    headers: { Authorization: `Bearer ${RENDER_KEY}`, Accept: 'application/json' },
  }).then(r => r.json());
  return r.find(s => s.service?.name === name)?.service?.id;
}

async function setRenderEnvVars(serviceId, vars) {
  const envVars = Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) => ({ key, value: String(value) }));
  const r = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${RENDER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(envVars),
  });
  return r.ok;
}

async function setVercelEnvVar(key, value) {
  if (!value) return 'skipped (empty)';
  // Try update first, then create
  const list = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  }).then(r => r.json()).catch(() => ({ envs: [] }));
  const existing = (list.envs || []).find(v => v.key === key);
  if (existing) {
    const r = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env/${existing.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: String(value), target: ['production', 'preview'] }),
    });
    return r.ok ? 'updated' : 'failed';
  } else {
    const r = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: String(value), type: 'plain', target: ['production', 'preview'] }),
    });
    return r.ok ? 'created' : 'failed';
  }
}

async function main() {
  console.log('── Pushing to Render services ──────────────────────────────────');
  for (const [name, serviceVars] of Object.entries(RENDER_SERVICES)) {
    const id = await getServiceId(name);
    if (!id) { console.log('  ⚠', name, '- service not found'); continue; }
    const merged = { ...SHARED_RENDER, ...serviceVars };
    const ok = await setRenderEnvVars(id, merged);
    console.log(ok ? '  ✔' : '  ✘', name, `(${Object.keys(merged).length} vars)`);
  }

  console.log('\n── Pushing to Vercel ────────────────────────────────────────────');
  for (const [key, value] of Object.entries(VERCEL_VARS)) {
    const status = await setVercelEnvVar(key, value);
    console.log(`  ${status === 'failed' ? '✘' : '✔'} ${key} → ${status}`);
  }

  console.log('\n── Triggering Vercel redeploy ───────────────────────────────────');
  const deploy = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'okta-agentic-cloud',
      project: VERCEL_PROJECT,
      gitSource: { type: 'github', repo: 'BigChazzza/okta-agentic-cloud', ref: 'main' },
      target: 'production',
    }),
  }).then(r => r.json());
  console.log(deploy.id ? '  ✔ Deploying: ' + (deploy.url || deploy.id) : '  ✘ ' + JSON.stringify(deploy).slice(0, 100));

  console.log('\nDone. Render services will redeploy automatically on next push.');
  console.log('Vercel: https://okta-agentic-cloud.vercel.app');
}

main().catch(console.error);
