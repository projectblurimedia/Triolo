// Vercel serverless entry point. Deliberately plain JS requiring the already-compiled
// `dist/` output (built via `npm run build`, which runs tsc-alias so every `@/` import is
// already resolved to a relative path) rather than a TS file with its own alias-resolution
// story inside Vercel's function bundler — this file itself has none, so there's nothing
// for the bundler to get wrong. `createApp()` returns a plain Express app, which is itself
// a valid `(req, res) => void` handler — Vercel accepts it directly as the function export,
// no adapter needed. `vercel.json`'s rewrite sends every path here while leaving the
// original `req.url` intact, so the app's own `/health`/`/api/v1/...` routing still works
// exactly as it does under `server.ts`'s plain `app.listen()` in local/dev use.
const { createApp } = require('../dist/app');

module.exports = createApp();
