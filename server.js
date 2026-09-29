'use strict';
const path = require('path');
const express = require('express');
const cfg = require('./src/config');
const state = require('./src/state');
const api = require('./src/routes');

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use('/api', api);
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

state.startAll();
app.listen(cfg.port, () => {
  console.log(`TV control on http://localhost:${cfg.port}  (${cfg.mock ? 'MOCK hardware' : 'LIVE hardware'}; sites: ${cfg.sites.map((s) => s.site.slug).join(', ')}; auth ${cfg.auth.required ? 'on' : 'OFF'})`);
  if (!cfg.mock && !cfg.pandora.token) console.warn('PANDORA_TOKEN is not set; matrix commands will fail with 401.');
  if (!cfg.auth.required) console.warn('APP_TOKENS is not set; the API is open. Fine for local development only.');
});
