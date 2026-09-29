'use strict';
// Loads every location from config/sites/*.json plus environment settings.
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sitesDir = process.env.SITES_DIR || path.join(__dirname, '..', 'config', 'sites');
const sites = fs.readdirSync(sitesDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(sitesDir, f), 'utf8')));
if (!sites.length) throw new Error(`No site files in ${sitesDir}`);

// A site is addressed by its slug ("fort-myers") or any of its Square location ids.
function findSite(key) {
  if (!key) return sites[0];
  const k = String(key).toLowerCase();
  return sites.find((s) => s.site.slug === k || (s.site.squareLocationIDs || []).some((id) => id.toLowerCase() === k)) || null;
}

const tokens = (process.env.APP_TOKENS || process.env.APP_TOKEN || '').split(',').map((t) => t.trim()).filter(Boolean);

module.exports = {
  sites, findSite,
  port: Number(process.env.PORT || 3000),
  mock: process.env.MOCK === '1' || process.env.MOCK === 'true',
  auth: {
    // Bearer tokens accepted on /api/*. Empty list = open (development only).
    tokens,
    required: tokens.length > 0,
  },
  pandora: {
    baseUrl: process.env.PANDORA_BASE || 'https://bma-pandora-api.azurewebsites.net/v2',
    token: process.env.PANDORA_TOKEN || '',
    transport: process.env.PANDORA_TRANSPORT || 'udp',
    timeoutMs: Number(process.env.PANDORA_TIMEOUT_MS || 8000),
  },
  shef: {
    port: Number(process.env.SHEF_PORT || 8080),
    timeoutMs: Number(process.env.SHEF_TIMEOUT_MS || 3000),
    pollMs: Number(process.env.SHEF_POLL_MS || 10000),
  },
  guide: {
    // "tvmedia" (TV Media / TVPassport listings, needs TVMEDIA_API_KEY) or "mock". See src/guide.js.
    provider: process.env.GUIDE_PROVIDER || (process.env.TVMEDIA_API_KEY ? 'tvmedia' : 'mock'),
    timezone: process.env.GUIDE_TIMEZONE || 'America/New_York',
    tvmedia: {
      apiKey: process.env.TVMEDIA_API_KEY || '',
      lineup: process.env.TVMEDIA_LINEUP || '36463D',
    },
  },
};
