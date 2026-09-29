'use strict';
// Vercel serverless entry: the same Express router as server.js, without the long-lived pieces.
// On Vercel there is no persistent process, so:
//   - /api/events (server-sent events) is not available; the page falls back to polling /api/state every 10 s.
//   - box polling happens per request instead of on a timer (see state.startAll in server.js for the always-on host).
// Long term the box and TV state should come from Pandora's cached /directv/boxes and /hdtv/status so this host stays stateless.
const express = require('express');
const api = require('../src/routes');

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use('/api', api);

module.exports = app;
