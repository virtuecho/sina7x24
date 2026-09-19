# Sina 7x24 Viewer

[中文说明](./README.zh-CN.md)

Sina 7x24 Viewer is a small web application for browsing the Sina Finance 7x24 live feed through a same-origin proxy.

## Features

- Browse the live feed from the standard page at /.
- Open /legacy for a compact, text-first timeline.
- Search and filter by article text, message ID, time, source, tags, and comment fields.
- Load older news while scrolling.
- Refresh the latest news automatically or on demand.
- Preserve a useful reading position while the latest feed changes.
- Inspect article attributes and comments in the standard interface.
- Render upstream text safely and allow only HTTP(S) image and document links.

The viewer continues loading older pages even when the upstream page totals are unreliable. It stops safely when the upstream returns an empty page, stops advancing, repeats a page, or exceeds the per-request safety limit.

The optional 100-item limit keeps the newest items and preserves the reading anchor. Removing the limit reloads history from the first older page and deduplicates by message ID.

## Requirements

- Node.js 18 or newer

## Run locally

Install dependencies:

    npm install

Start the development server:

    npm run dev

Open http://127.0.0.1:3000/.

Open http://127.0.0.1:3000/legacy for the compact interface.

For a normal run without watch mode:

    npm start

## Refresh behavior

- Initial load, manual refresh, and returning from a hidden page within 24 hours request a 100-item latest window.
- In-window automatic refresh requests 30 items.
- The automatic refresh interval can be set from 1 second through 24 hours.
- Each request retries at most twice after the initial attempt.
- A page that is merely unfocused continues refreshing.
- Returning after 24 hours hidden requires a manual refresh.

## Test and dependency checks

Run the regression tests:

    npm test

Audit production dependencies:

    npm audit --omit=dev

Refresh the lockfile when applying compatible security updates:

    npm audit fix --package-lock-only

## HTTP endpoints

- GET / — standard viewer page
- GET /legacy — compact viewer page
- GET /healthz — health check
- /api/zhibo/* — proxied Sina 7x24 API requests
- GET /api/avatar?url=... — allowlisted avatar proxy

## Documentation

- Architecture: ./ARCHITECTURE.md
- 中文说明: ./README.zh-CN.md
