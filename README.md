# Sina 7x24 Viewer

[中文说明](./README.zh-CN.md)

Sina 7x24 Viewer is a small web application for browsing the Sina Finance 7x24 live feed through a same-origin proxy. It provides a standard interface at `/` and a text-first minimal interface at `/legacy`.

## Features

- Browse the Sina 7x24 feed through a same-origin proxy
- Search and filter by content, message ID, time text, source, comments, and tags
- Extract titles and trailing sources into standalone display blocks
- Inspect raw attributes and comment data in dedicated modals in the standard interface
- Auto-refresh the latest feed with at most two retries, pause polling in background tabs, and refresh immediately on return
- Render third-party feed text as text and allow only HTTP(S) image and document URLs
- Open `/legacy` for a compact, text-first timeline with a 100-item default limit; it omits per-item comments and original links, and its bottom control removes the limit and unlocks item-limit adjustment until leaving minimal mode or refreshing

## Project Structure

- `index.html` — page shell and static mount points
- `scripts/core/viewer-core.js` — feed lifecycle, filtering, rendering, stats, and modals
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

## HTTP Endpoints

- `GET /` — standard viewer page
- `GET /legacy` — minimal viewer page
- `GET /healthz` — health check
- `/api/zhibo/*` — proxied Sina 7x24 API requests
- `GET /api/avatar?url=...` — allowlisted avatar proxy
