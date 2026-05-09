# Codebase Snapshot (2026-05-09)

## Summary
- Project name: softec-26 (package.json)
- Framework: Next.js 16 App Router + React 19 + TypeScript
- Styling: Tailwind CSS 4, shadcn/ui (base-luma), tw-animate-css
- API: Hono mounted at /api with typed client (Hono + Hono client)
- Auth: Better Auth (JWT cookie cache) + Prisma adapter, Next.js auth handler
- Data: Prisma schema for PostgreSQL, migrations tracked in prisma/migrations
- Realtime + state: Pusher, Zustand
- Maps + geo: Leaflet (imperative lifecycle), Turf.js
- LLM tooling: OpenRouter SDK, LangChain
- Containers: Docker (web + engine) with Postgres

## Implemented So Far (2026-05-09)
- Added Command Center route at `/command` with three-pane dashboard layout:
  left ship list, center tactical map, right selected-ship/alerts panel.
- Added command UI modules:
  `src/components/command/command-dashboard.tsx`,
  `src/components/command/fleet-map.tsx`,
  `src/components/command/ship-sidebar.tsx`,
  `src/components/command/alert-panel.tsx`.
- Added realtime fleet synchronization hook:
  `src/hooks/use-fleet-sync.ts` subscribing to Pusher channels (`fleet`, `alerts`, `zones`) and updating Zustand store.
- Added tactical map rendering with custom SVG ship markers, status color coding, heading rotation, tooltip metadata, and click-to-select behavior.
- Implemented strict-mode-safe Leaflet lifecycle in `fleet-map.tsx`:
  removed `react-leaflet` `MapContainer` usage from this feature and switched to direct `L.map(...)` initialization with idempotent teardown (`map.remove()`, marker cleanup, and `_leaflet_id` reset) to prevent `Map container is already initialized` runtime errors in Next.js 16 dev/fast-refresh.
- Added stale-closure-safe marker click handling by reading current selection from `useFleetStore.getState()` at click time.
- Added global live globe overlay in Command Dashboard using `GlobeLive` with active ship markers.
- Role-based routing: COMMAND -> /command, CAPTAIN -> /captain.
- Captain dashboard implemented with real-time fuel gauge, status, position, and incoming directives.
- Captain dashboard subscribes to `captain-{shipId}` Pusher channel for directives.
- Distress signal textarea posts to `/api/distress`.
- Seed flow added for demo users:
  `command@hormuz.ops` (COMMAND) and `captain@hormuz.ops` (CAPTAIN, MV-7).

## AGENT_CONTEXT
### What Was Implemented
- Role-based routing: COMMAND -> /command, CAPTAIN -> /captain
- Captain dashboard: real-time fuel gauge, status, position, incoming directives
- Captain subscribes to captain-{shipId} Pusher channel for directives
- Distress signal textarea -> POST /api/distress (AI extraction in next prompt)
- Seed script: command@hormuz.ops (COMMAND) + captain@hormuz.ops (CAPTAIN, MV-7)

### Files Added
- prisma/seed.ts
- src/app/captain/page.tsx
- src/components/captain/captain-dashboard.tsx

### Files Modified
- src/app/page.tsx - role-based redirect
- src/app/auth/sign-in/page.tsx - demo credentials hint

## Scripts (package.json)
- dev: next dev
- build: next build
- start: next start
- lint: eslint
- format: prettier --write .
- format:check: prettier --check .

## Tooling and Config
- Package manager: pnpm (pnpm-workspace.yaml present)
- Lint: eslint.config.mjs (next core-web-vitals + typescript)
- Format: .prettierrc (single quotes, tailwindcss + organize-imports plugins)
- Tailwind: postcss.config.mjs (tailwindcss v4 via @tailwindcss/postcss)
- TS: tsconfig.json (strict, moduleResolution bundler, path alias @/* -> src/*)
- Prisma: prisma.config.ts (schema at prisma/schema.prisma, migrations path set)
- shadcn/ui: components.json (rsc true, css at src/app/globals.css)

## Environment Variables Used
- DATABASE_URL
- BETTER_AUTH_SECRET
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- NEXT_PUBLIC_API_URL (optional; defaults to http://localhost:3000)
- NEXT_PUBLIC_APP_URL (app base URL)
- OPEN_ROUTER_API_KEY
- PUSHER_APP_ID
- PUSHER_KEY
- PUSHER_SECRET
- PUSHER_CLUSTER
- NEXT_PUBLIC_PUSHER_KEY
- NEXT_PUBLIC_PUSHER_CLUSTER

## Routes and Behavior
### App routes
- /: src/app/page.tsx (shows authenticated/unauthenticated via currentUser)
- /auth/sign-in: src/app/auth/sign-in/page.tsx
- /auth/sign-up: src/app/auth/sign-up/page.tsx

### API routes
- /api/*: src/app/api/[[...route]]/route.ts (Hono router, no subroutes mounted)
- /api/auth/*: src/app/api/auth/[...all]/route.ts (Better Auth handler)

### Auth/public routing rules (src/routes.ts + src/proxy.ts)
- Auth routes: /auth/sign-in, /auth/sign-up, /auth/forget-password,
  /auth/reset-password, /auth/verify-email, /auth/verify-email/verify
- Public routes: /, /sample, /chat
- Default login redirect: /
- Middleware-like proxy logic in src/proxy.ts

## Data Model (prisma/schema.prisma)
### Enums
- UserRole: COMMAND, CAPTAIN
- AlertType: GEOFENCE_BREACH, PROXIMITY_WARNING, DISTRESS_SIGNAL, LOW_FUEL,
  OUT_OF_FUEL, ROUTE_BLOCKED, INSUFFICIENT_FUEL
- AlertSeverity: LOW, MEDIUM, HIGH, CRITICAL
- DirectiveType: REROUTE, HOLD, DIVERT, RETURN_TO_PORT
- DirectiveResponse: ACCEPT, ESCALATE_DISTRESS

### Models
- User: Better Auth user profile with role and optional assignedShipId
- Session: Better Auth session storage
- Account: OAuth account storage
- Verification: verification tokens
- RestrictedZone: geojson-like restricted zones
- Alert: fleet alert records
- Directive: command directives sent to ships
- DistressMessage: raw distress payload + extracted metadata
- PlaybackFrame: timestamped playback snapshots (ships/alerts/zones)

## Realtime, Fleet, and Simulation
- src/lib/pusher-server.ts: Pusher server client
- src/lib/pusher-client.ts: Pusher browser client
- src/constants/realtime-events.ts: shared event names
- src/types/fleet.ts: fleet domain types (ships, alerts, zones, directives, playback)
- src/stores/fleet-store.ts: Zustand store for fleet UI state
- src/simulation/fleet-data.ts: ports, bounding box, navigable water polygon, initial ships

## Key Runtime Modules
- src/lib/auth.ts: Better Auth server config + Prisma adapter
- src/lib/auth-client.ts: Better Auth React client
- src/lib/db.ts: Prisma client with PG adapter (singleton in dev)
- src/lib/hono.ts: Hono client typed against API routes
- src/lib/current-user.ts: server helper to read session from cookies
- src/lib/open-router.ts: OpenRouter SDK client
- src/components/providers: React Query + Sonner toaster
- src/hooks/use-mobile.ts: matchMedia-based mobile detection

## UI Component Library (src/components/ui)
- accordion.tsx
- alert-dialog.tsx
- alert.tsx
- aspect-ratio.tsx
- avatar.tsx
- badge.tsx
- breadcrumb.tsx
- button-group.tsx
- button.tsx
- calendar.tsx
- card.tsx
- carousel.tsx
- chart.tsx
- checkbox.tsx
- collapsible.tsx
- combobox.tsx
- command.tsx
- context-menu.tsx
- dialog.tsx
- direction.tsx
- drawer.tsx
- dropdown-menu.tsx
- empty.tsx
- field.tsx
- hover-card.tsx
- input-group.tsx
- input-otp.tsx
- input.tsx
- item.tsx
- kbd.tsx
- label.tsx
- menubar.tsx
- native-select.tsx
- navigation-menu.tsx
- pagination.tsx
- popover.tsx
- progress.tsx
- radio-group.tsx
- resizable.tsx
- scroll-area.tsx
- select.tsx
- separator.tsx
- sheet.tsx
- sidebar.tsx
- skeleton.tsx
- slider.tsx
- sonner.tsx
- spinner.tsx
- switch.tsx
- table.tsx
- tabs.tsx
- textarea.tsx
- toggle-group.tsx
- toggle.tsx
- tooltip.tsx

## File Tree (complete)

```text
.
|-- AGENTS.md
|-- CLAUDE.md
|-- CODEBASE.md
|-- README.md
|-- components.json
|-- eslint.config.mjs
|-- next.config.ts
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
|-- postcss.config.mjs
|-- prisma.config.ts
|-- tsconfig.json
|-- .gitignore
|-- .prettierignore
|-- .prettierrc
|-- .env
|-- Dockerfile
|-- docker-compose.yml
|-- docker/
|   `-- engine/
|       |-- Dockerfile
|       |-- package.json
|       `-- src/
|           `-- index.ts
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
|       |-- migration_lock.toml
|       `-- 20260509065517_fleet_init/
|           `-- migration.sql
|-- public/
|   |-- file.svg
|   |-- globe.svg
|   |-- next.svg
|   |-- vercel.svg
|   `-- window.svg
`-- src/
    |-- proxy.ts
    |-- routes.ts
    |-- app/
    |   |-- favicon.ico
    |   |-- globals.css
    |   |-- layout.tsx
    |   |-- page.tsx
    |   |-- api/
    |   |   |-- [[...route]]/
    |   |   |   |-- route.ts
    |   |   |   |-- controllers/
    |   |   |   |   `-- (base)/
    |   |   |   |       |-- index.ts
    |   |   |   |       `-- sample.ts
    |   |   |   `-- middleware/
    |   |   |       `-- auth-middleware.ts
    |   |   `-- auth/
    |   |       `-- [...all]/
    |   |           `-- route.ts
    |   `-- auth/
    |       |-- sign-in/
    |       |   `-- page.tsx
    |       `-- sign-up/
    |           `-- page.tsx
    |-- components/
    |   |-- providers/
    |   |   |-- index.tsx
    |   |   `-- query-provider.tsx
    |   `-- ui/
    |       |-- accordion.tsx
    |       |-- alert-dialog.tsx
    |       |-- alert.tsx
    |       |-- aspect-ratio.tsx
    |       |-- avatar.tsx
    |       |-- badge.tsx
    |       |-- breadcrumb.tsx
    |       |-- button-group.tsx
    |       |-- button.tsx
    |       |-- calendar.tsx
    |       |-- card.tsx
    |       |-- carousel.tsx
    |       |-- chart.tsx
    |       |-- checkbox.tsx
    |       |-- collapsible.tsx
    |       |-- combobox.tsx
    |       |-- command.tsx
    |       |-- context-menu.tsx
    |       |-- dialog.tsx
    |       |-- direction.tsx
    |       |-- drawer.tsx
    |       |-- dropdown-menu.tsx
    |       |-- empty.tsx
    |       |-- field.tsx
    |       |-- hover-card.tsx
    |       |-- input-group.tsx
    |       |-- input-otp.tsx
    |       |-- input.tsx
    |       |-- item.tsx
    |       |-- kbd.tsx
    |       |-- label.tsx
    |       |-- menubar.tsx
    |       |-- native-select.tsx
    |       |-- navigation-menu.tsx
    |       |-- pagination.tsx
    |       |-- popover.tsx
    |       |-- progress.tsx
    |       |-- radio-group.tsx
    |       |-- resizable.tsx
    |       |-- scroll-area.tsx
    |       |-- select.tsx
    |       |-- separator.tsx
    |       |-- sheet.tsx
    |       |-- sidebar.tsx
    |       |-- skeleton.tsx
    |       |-- slider.tsx
    |       |-- sonner.tsx
    |       |-- spinner.tsx
    |       |-- switch.tsx
    |       |-- table.tsx
    |       |-- tabs.tsx
    |       |-- textarea.tsx
    |       |-- toggle-group.tsx
    |       |-- toggle.tsx
    |       `-- tooltip.tsx
    |-- constants/
    |   |-- query-keys.ts
    |   `-- realtime-events.ts
    |-- hooks/
    |   `-- use-mobile.ts
    |-- lib/
    |   |-- auth-client.ts
    |   |-- auth.ts
    |   |-- current-user.ts
    |   |-- db.ts
    |   |-- hono.ts
    |   |-- open-router.ts
    |   |-- pusher-client.ts
    |   |-- pusher-server.ts
    |   `-- utils.ts
    |-- simulation/
    |   `-- fleet-data.ts
    |-- stores/
    |   `-- fleet-store.ts
    `-- types/
        `-- fleet.ts
```

## Key Configs

- components.json: shadcn/ui configuration (style base-luma, Tailwind CSS path src/app/globals.css, aliases for components/utils/ui/lib/hooks).
- next.config.ts: default Next.js config placeholder.
- tsconfig.json: strict TypeScript, bundler module resolution, path alias @/* -> src/*.
- eslint.config.mjs: Next core-web-vitals + TypeScript config with extra global ignores.
- postcss.config.mjs: Tailwind CSS PostCSS plugin.
- prisma.config.ts: Prisma schema and migrations paths, DATABASE_URL datasource.
- .prettierrc: single quotes, trailing commas, Tailwind + organize-imports plugins.
- pnpm-workspace.yaml: ignored built deps (sharp, unrs-resolver).
- Dockerfile: Next.js production build for web service.
- docker-compose.yml: Postgres + web + engine services.
- docker/engine/Dockerfile: tsx-based engine runner.

## App Entry Points

- src/app/layout.tsx: Root layout, global fonts (Inter + Geist), Providers wrapper, base metadata.
- src/app/page.tsx: Uses currentUser() to render authenticated/unauthenticated state.
- src/app/globals.css: Tailwind v4 base with CSS variables for theme tokens.

## API Layer (Hono + Next.js)

- src/app/api/[[...route]]/route.ts: Hono app mounted at /api, error handler, GET/POST/PUT/PATCH/DELETE handlers for Next.js.
- src/app/api/[[...route]]/middleware/auth-middleware.ts: Better Auth cookie-based session validation, attaches user to request.

## Auth Flow

- src/app/api/auth/[...all]/route.ts: Better Auth Next.js handler (GET/POST).
- src/lib/auth.ts: Better Auth config with Prisma adapter + JWT cookie cache; email/password + GitHub/Google providers.
- src/lib/auth-client.ts: client-side Better Auth hooks.
- src/routes.ts and src/proxy.ts: route gating and auth redirects via middleware.
- src/app/auth/sign-in/page.tsx and src/app/auth/sign-up/page.tsx: UI for auth flows with Sonner toasts.

## Data Layer (Prisma)

Prisma schema defines Better Auth tables plus fleet alerting and playback data:

- Enums: UserRole, AlertType, AlertSeverity, DirectiveType, DirectiveResponse
- Models: User, Session, Account, Verification, RestrictedZone, Alert, Directive,
  DistressMessage, PlaybackFrame

## Client Data Fetching and State

- React Query provider: src/components/providers/query-provider.tsx
- Zustand fleet store: src/stores/fleet-store.ts

## Utilities and Shared Helpers

- src/lib/hono.ts: Hono client typed with AppType and NEXT_PUBLIC_API_URL.
- src/lib/db.ts: Prisma client with PostgreSQL adapter and global caching in dev.
- src/lib/current-user.ts: session lookup via Better Auth cookie cache.
- src/lib/open-router.ts: OpenRouter SDK client.
- src/lib/pusher-server.ts: Pusher server client.
- src/lib/pusher-client.ts: Pusher browser client.
- src/lib/utils.ts: cn() class name helper.
- src/hooks/use-mobile.ts: media-query hook for mobile detection.
- src/constants/query-keys.ts: query key enum.
- src/constants/realtime-events.ts: realtime event keys shared across services.
