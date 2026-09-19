# Sina 7x24 Viewer

[中文说明](./README.zh-CN.md)

Sina 7x24 Viewer is a small web application for browsing the Sina Finance 7x24 live feed through a same-origin proxy. It provides a standard interface at `/` and a text-first minimal interface at `/legacy`.

## Features

- Browse the Sina 7x24 feed through a same-origin proxy
- Search and filter by content, message ID, time text, source, tag IDs/names, and comment fields such as nickname, content, and area
- Extract titles and trailing sources into standalone display blocks
- Inspect raw attributes and comment data in dedicated modals in the standard interface
- Auto-refresh the latest feed with 100 items on first load, manual refresh, and return from a hidden page before 24 hours; use 30 items for in-window timers; allow a user-configured interval from 1 second to 24 hours; retry each request at most twice; keep refreshing a merely unfocused but visible window, and require manual refresh after 24 hours hidden
- Continue history pagination despite unreliable upstream page totals; stop on an empty page, a stalled response page, a repeated page ID fingerprint, or a 100-page safety limit
- Preserve a scroll anchor around 25% from the top of the viewport during refresh; in both standard and minimal modes, the 100-item limit preserves the anchor, returns to the latest top if it is evicted, and stays at the bottom when already there or when the anchor is the last item; removing the limit uses unlimited-feed behavior without forced exact middle/bottom restoration
- When the 100-item limit trims loaded history, reset the history cursor; removing the limit reloads from page 2 and deduplicates by message ID so older items are not skipped
- Render third-party feed text as text and allow only HTTP(S) image and document URLs
- Open `/legacy` for a compact, text-first timeline with a 100-item default limit; it omits per-item comments and original links, and its bottom control removes the limit and unlocks item-limit adjustment until leaving minimal mode or refreshing

## Project Structure

- `index.html` — page shell and static mount points
- `scripts/core/viewer-core.js` — feed lifecycle, filtering, rendering, stats, and modals
- `scripts/core/*.test.js` — built-in regression tests for pagination, refresh bounds, and search
- `scripts/app.js` — frontend bootstrap
- `styles/` — page styles
- `backend/core/` — runtime-agnostic backend handlers and shared validation rules
- `server/` — local Node adapter layer and app composition
- `functions/` — serverless API adapter routes
- `ARCHITECTURE.md` — module-level architecture notes

## Requirements

- Node.js 18 or newer

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

Open `http://127.0.0.1:3000/legacy` for the minimal interface.

For a normal local run without watch mode:

```bash
npm start
```

Run the regression tests with:

    npm test

## HTTP Endpoints

- `GET /` — standard viewer page
- `GET /legacy` — minimal viewer page
- `GET /healthz` — health check
- `/api/zhibo/*` — proxied Sina 7x24 API requests
- `GET /api/avatar?url=...` — allowlisted avatar proxy

## Dependency Checks

Refresh the lockfile and audit production dependencies with:

    npm audit fix --package-lock-only
    npm audit --omit=dev
