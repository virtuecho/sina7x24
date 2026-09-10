# Sina 7x24 Viewer

[中文说明](./README.zh-CN.md)

Sina 7x24 Viewer is a small web application for browsing the Sina Finance 7x24 live feed through a same-origin proxy. It provides a standard interface at `/` and a text-first minimal interface at `/legacy`.

## Features

- Browse the Sina 7x24 feed through a same-origin proxy
- Search by content, message ID, and time text
- Filter from the main select by comment/source presence and tag-based categories, with a separate focus-only toggle
- Extract titles and trailing sources into standalone display blocks
- Inspect raw attributes and comment data in dedicated modals in the standard interface
- Auto-refresh the latest feed and load older history on demand
- Toggle item limits and latest-refresh behavior from the standard control panel
- Open `/legacy` for a compact, text-first timeline with a fixed 100-item limit and a focused set of reading actions
- Keep the `/legacy` toolbar in normal document flow
- Use the same latest-refresh pause state in the control panel and the bottom-right shortcut button; history pagination remains automatic
- Proxy avatars safely through an allowlisted image route
- Support both local Express routes and Pages Functions style serverless routes

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

Open `http://127.0.0.1:3000/legacy` for the minimal interface. The local server adds the minimal-mode class to the HTML response for this route before the browser renders the page, preventing a standard-interface flash on the first paint.

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

## Notes

- The repository root is served as the static site root in local development.
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deeper module breakdown.
