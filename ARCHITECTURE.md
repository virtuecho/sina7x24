# Architecture

## Goal

This repository is now organized around a small set of clear modules:

- `index.html`
  Page skeleton only. It contains the static DOM needed by the viewer itself, plus two empty mount points for optional features.
- `scripts/core/viewer-core.js`
  The main viewer module. It owns the feed lifecycle, rendering pipeline, filters, stats, sticky controls, history loading, attribute modal, and comments modal.
- `scripts/features/discord/`
  Optional Discord feature package. It injects its own button, summary line, modal, styles, state, and webhook relay logic.
- `scripts/app.js`
  Thin bootstrap file. It creates the core viewer, starts it, and then installs optional features.
- `styles/main.css`
  Shared page styling for the main viewer.
- `styles/discord.css`
  Styling used only by the Discord feature.
- `server/`
  Local Node proxy modules.
- `functions/_shared/`
  Shared helper modules for the serverless Pages Functions routes.

The guiding rule is:

- the viewer core should not know Discord exists
- the Discord feature should only talk to the core through explicit hooks
- the server and Pages Functions should expose thin route files and reusable helpers

## Frontend Modules

### 1. Page Shell

`index.html` now has three responsibilities only:

- define the visible page structure
- expose stable DOM IDs for the core viewer
- expose mount points for optional features

The two feature mount points are:

- `developerFeatureMount`
- `featureModalMount`

This allows optional UI to be injected without mixing its markup into the main page shell.

### 2. Viewer Core

`scripts/core/viewer-core.js` is the main application module.

Internally it still has several clearly labeled responsibility groups:

- configuration constants
- state
- DOM references
- initialization
- top control behavior
- sticky panel behavior
- feed fetching and merge logic
- filtering and rendering
- attribute/comment inspection
- stats and loading state
- history loading
- shared text and time helpers

The core exports a factory:

- `createViewerCore()`

The returned object exposes only the integration points that other modules are allowed to use:

- `init()`
- `onLatestFeedReady(handler)`
- `onFeedItemsSynced(handler)`
- `getCurrentPrimaryItem()`
- `getCurrentBulkItems(limit)`
- `getFeatureMounts()`
- `buildRelayContext(item)`

This keeps feature modules from reaching into private viewer state directly.

### 3. Discord Feature

The Discord feature is now split into:

- `scripts/features/discord/template.js`
- `scripts/features/discord/feature.js`
- `styles/discord.css`

`template.js` is pure markup generation.

`feature.js` is the behavior layer. It:

- injects its own panel section into `developerFeatureMount`
- injects its own modal into `featureModalMount`
- owns all Discord-specific state
- subscribes to core feed hooks
- formats relay messages
- performs webhook send/update requests
- manages its own UI status and modal lifecycle

The core viewer does not import Discord code.

Instead, the bootstrap file imports Discord and installs it after the core is ready.

### 4. Bootstrap

`scripts/app.js` is intentionally small.

Its job is:

1. create the core viewer
2. initialize the core viewer
3. install optional features

That keeps the startup path easy to read and easy to modify.

## Discord Removal

The Discord feature is designed to be removable.

To remove it cleanly:

1. delete `scripts/features/discord/`
2. delete `styles/discord.css`
3. remove the Discord stylesheet import from `index.html`
4. remove the Discord feature import/install call from `scripts/app.js`
5. optionally remove the Discord proxy route files if the backend integration is no longer needed

After that:

- no Discord button will be rendered
- no Discord modal will exist
- no Discord state will be created
- no feed hook will try to relay messages
- the core viewer will continue to work normally

This is the main reason the Discord UI is injected dynamically instead of being hardcoded into `index.html`.

## Local Node Proxy

The local Node server is now structured like this:

- `server.js`
  Minimal startup file
- `server/create-app.js`
  App composition
- `server/config.js`
  Central server settings
- `server/utils/url-guards.js`
  Host allowlists and Discord URL builders
- `server/routes/health.js`
  Health route
- `server/routes/zhibo-proxy.js`
  Sina API proxy
- `server/routes/avatar.js`
  Avatar proxy
- `server/routes/discord-webhook.js`
  Discord webhook relay proxy

This makes it obvious where to edit behavior:

- routing/composition in `create-app.js`
- config in `config.js`
- URL validation in `utils/`
- endpoint behavior in `routes/`

## Pages Functions

The serverless side follows the same pattern:

- `functions/api/...`
  Thin entry files
- `functions/_shared/http.js`
  Shared JSON response helper
- `functions/_shared/sina.js`
  Sina target URL builder
- `functions/_shared/avatar.js`
  Avatar URL validation
- `functions/_shared/discord.js`
  Discord URL validation and message URL builders

This keeps the Pages Functions layout consistent with the local Node proxy.

## Data Flow

### Feed Flow

1. the core viewer requests `/api/zhibo/feed`
2. the proxy forwards to Sina
3. the core merges items into its local state
4. the core updates stats, DOM, and history state
5. the core emits feature hooks for optional consumers

### Discord Flow

1. the Discord feature is installed by `scripts/app.js`
2. it injects its own UI into the page
3. it subscribes to core hooks
4. when new feed items arrive, it decides whether to create or edit Discord messages
5. it sends requests to `/api/discord-webhook`

The Discord feature never owns the feed; it only reacts to core events.

## Why This Layout Is Easier To Maintain

The previous layout mixed:

- page structure
- page styles
- viewer state
- modal logic
- sticky control logic
- Discord UI
- Discord relay behavior

The new layout makes those boundaries visible in the file tree itself.

That gives three practical benefits:

- someone reading the repo can find the right place faster
- optional features can be removed with fewer side effects
- future refactors can happen module by module instead of inside one giant file
