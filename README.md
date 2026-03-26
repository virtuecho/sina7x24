# Sina 7x24 Viewer

[中文说明](./README.zh-CN.md)

Sina 7x24 Viewer is a small web application for browsing the Sina Finance 7x24 live feed through a same-origin proxy. It adds a cleaner reading experience, feed inspection tools, richer filters, and an optional Discord relay panel on top of the raw feed.

## Features

- Browse the Sina 7x24 feed through a same-origin proxy
- Search by content, message ID, and time text
- Filter by comment presence, detected source, and tag-based categories
- Extract titles and trailing sources into standalone display blocks
- Inspect raw attributes and comment data in dedicated modals
- Auto-refresh the latest feed and load older history on demand
- Toggle item limits and latest-refresh behavior from the sticky control panel
- Proxy avatars safely through an allowlisted image route
- Relay feed items to Discord through an optional webhook feature
- Support both local Express routes and Pages Functions style serverless routes

## Project Structure

- `index.html` — page shell and static mount points
- `scripts/core/viewer-core.js` — feed lifecycle, filtering, rendering, stats, and modals
- `scripts/features/discord/` — optional Discord relay feature
- `scripts/app.js` — frontend bootstrap
- `styles/` — main and Discord-specific styles
- `server/` — local Node proxy routes and app composition
- `functions/` — serverless API routes and shared helpers
- `ARCHITECTURE.md` — module-level architecture notes

## Requirements

- Node.js 18 or newer

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

For a normal local run without watch mode:

```bash
npm start
```

## HTTP Endpoints

- `GET /healthz` — health check
- `/api/zhibo/*` — proxied Sina 7x24 API requests
- `GET /api/avatar?url=...` — allowlisted avatar proxy
- `POST /api/discord-webhook` — Discord webhook relay/update proxy

## Notes

- The repository root is served as the static site root in local development.
- The Discord feature is optional and can be removed cleanly.
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deeper module breakdown.
