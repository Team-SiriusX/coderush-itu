# Codebase Snapshot (2026-05-09)

## Executive Summary
- Project: `softec-26`
- Stack: Next.js 16.2.4 (App Router) + React 19.2 + TypeScript (strict)
- Styling/UI: Tailwind CSS 4 + shadcn/ui + custom tactical theme tokens
- API runtime: Hono mounted inside Next route handlers at `/api/*`
- Auth: Better Auth (email/password + GitHub + Google) with JWT cookie cache
- DB: PostgreSQL via Prisma schema; Better Auth + fleet operations models
- Realtime: Pusher (`fleet`, `alerts`, `zones`, `captain-{shipId}`)
- State: Zustand (`fleet-store`) + React Query provider scaffolding
- Mapping/Geo: Leaflet (imperative init/teardown), Turf.js, Cobe globe visualizations
- AI integration: OpenRouter for distress-message structured extraction

---

## Current Product Surfaces

### 1. Role-Aware Entry Routing
- `src/app/page.tsx`
  - Server-side user lookup via `currentUser()`.
  - Redirect matrix:
    - unauthenticated -> `/auth/sign-in`
    - `COMMAND` -> `/command`
    - `CAPTAIN` -> `/captain`
    - fallback -> `/auth/sign-in`

### 2. Command Center (`/command`)
- `src/app/command/page.tsx`
  - Suspense-wrapped `CommandDashboard`.
- `src/components/command/command-dashboard.tsx`
  - 3-pane layout:
    - left: fleet list + live globe overlay
    - center: tactical Leaflet map
    - right: selected ship details (`ShipSidebar`) or alert log (`AlertPanel`)
  - Uses `useFleetSync()` for realtime hydration from Pusher.
  - Computes `liveShips`, unacked alerts, selected ship.
  - Builds globe marker payload with anti-overlap bucketing and radial offsets.

### 3. Captain Console (`/captain`)
- `src/app/captain/page.tsx`
  - Role guard: only `CAPTAIN` allowed, otherwise redirect `/command`.
  - Injects `shipId` from `user.assignedShipId` (default `MV-7`).
- `src/components/captain/captain-dashboard.tsx`
  - Live ship status card, fuel gauge, telemetry grid.
  - Subscribes to `captain-{shipId}` channel for directives.
  - Directive acceptance: `POST /api/directives/:id/respond`.
  - Distress send: `POST /api/distress` with free-text payload.

### 4. Globe Demo Route
- `src/app/globe-demo/page.tsx`
  - Renders `GlobeFlights` demo component for Cobe experiments.

---

## Routing, Auth, and Request Gatekeeping

### Proxy Gate (Next 16 style)
- `src/proxy.ts`
  - Uses Better Auth cookie cache to resolve auth state.
  - Allows:
    - API routes (`/api/*`, `/trpc/*`)
    - explicit auth routes (`src/routes.ts`)
    - public routes (`/`, `/sample`, `/chat`)
  - Redirects unauthenticated private routes to `/auth/sign-in`.

### Route Constants
- `src/routes.ts`
  - `authRoutes`, `publicRoutes`, `SIGN_IN_PAGE_PATH`, `DEFAULT_LOGIN_REDIRECT`.

### Better Auth Server Config
- `src/lib/auth.ts`
  - `betterAuth` with Prisma adapter over Postgres adapter (`@prisma/adapter-pg`).
  - Enabled providers:
    - email/password
    - GitHub OAuth
    - Google OAuth
  - Session cache: JWT cookie strategy.

### Current User Resolver
- `src/lib/current-user.ts`
  - Reads cookie cache from request headers.
  - Hydrates DB user fields:
    - `id`, `email`, `name`, `image`, `role`, `assignedShipId`.

---

## API Layer (Hono in Next)

### Entrypoint
- `src/app/api/[[...route]]/route.ts`
  - Creates `Hono().basePath('/api')`.
  - Mounts base controller at `/`.
  - Exposes `GET/POST/PUT/PATCH/DELETE` via `hono/vercel` `handle()`.
  - Typed export: `AppType`.

### Mounted Base Controllers
- `src/app/api/[[...route]]/controllers/(base)/index.ts`
  - `/directives`
  - `/distress`
  - `/zones`
  - `/alerts`
  - `/playback`
  - `/health`

### Key Implemented Endpoints
- Distress ingestion + AI extraction:
  - `src/app/api/[[...route]]/controllers/(base)/distress.ts`
  - Flow:
    1. Accept `{ shipId, message }`
    2. Prompt OpenRouter model to emit strict JSON extraction
    3. Fallback extraction on parse/model failure
    4. Persist `DistressMessage`
    5. Create `Alert` (`DISTRESS_SIGNAL`)
    6. Publish realtime alert on Pusher `alerts:alert:new`
- Directives (additional controller):
  - `src/app/api/[[...route]]/controllers/directives.ts`
  - Validates payload with `zod` and persists directive.
  - Broadcasts `fleet-ops:new-directive`.

### Auth API
- `src/app/api/auth/[...all]/route.ts`
  - Better Auth route adapter for auth actions.

---

## Realtime and Client State

### Zustand Fleet Store
- `src/stores/fleet-store.ts`
- State:
  - `ships`, `selectedShipId`, `alerts`, `zones`, `directives`
  - playback flags: `isPlayback`, `playbackTimestamp`
- Actions:
  - set ships/selection
  - add/update alerts
  - add/remove/set zones
  - add directives
  - playback controls

### Pusher Sync Hook
- `src/hooks/use-fleet-sync.ts`
- Subscriptions:
  - `fleet` -> `fleet:update` -> `setShips`
  - `alerts` -> `alert:new`, `alert:update`
  - `zones` -> `zone:update`
- Cleanup unsubscribes on unmount.

### Pusher Clients
- `src/lib/pusher-client.ts` (browser)
- `src/lib/pusher-server.ts` (server trigger client)

---

## Tactical UI Modules

### Fleet Map (Leaflet imperative lifecycle)
- `src/components/command/fleet-map.tsx`
- Important implementation details:
  - `L.map()` manually initialized on container ref.
  - Strict-mode and fast-refresh defense:
    - checks/removes stale `_leaflet_id` before init
    - full teardown (`marker.remove`, `map.remove`, clear refs)
    - removes `_leaflet_id` again on cleanup
  - Marker rendering:
    - custom SVG ship triangle rotated by `heading`
    - color by status
    - click toggles selected ship via Zustand
  - Tooltip includes tactical metadata.

### Ship Sidebar
- `src/components/command/ship-sidebar.tsx`
- Features:
  - status badge and telemetry rows
  - fuel progress indicator with threshold colors
  - command directive buttons (`HOLD`, `REROUTE`, `DIVERT`, `RETURN_TO_PORT`)
  - posts to `/api/directives`

### Alert Panel
- `src/components/command/alert-panel.tsx`
- Features:
  - unacked alert list with severity styles
  - `ACK` action (`PATCH /api/alerts/:id/acknowledge`)
  - distress metadata expansion (systems, casualties, assistance)

### Globe Overlay (Command Sidebar)
- `src/components/ui/cobe-globe-cdn.tsx`
- Behavior:
  - canvas-driven Cobe globe
  - continuous phi rotation with drag-to-rotate interaction
  - marker/arc updates using refs to avoid re-init churn
  - tactical caption beams with red visual treatment and truncation guard
  - cleanup destroys globe and RAF loop

---

## Domain Model and Types

### Prisma Enums (`prisma/schema.prisma`)
- `UserRole`: `COMMAND`, `CAPTAIN`
- `AlertType`: includes distress/fuel/proximity/geofence/route states
- `AlertSeverity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `DirectiveType`: `REROUTE`, `HOLD`, `DIVERT`, `RETURN_TO_PORT`
- `DirectiveResponse`: `ACCEPT`, `ESCALATE_DISTRESS`

### Prisma Models (high-level)
- Auth core: `User`, `Session`, `Account`, `Verification`
- Fleet ops: `RestrictedZone`, `Alert`, `Directive`, `DistressMessage`, `PlaybackFrame`

### TS Domain Types
- `src/types/fleet.ts`
  - `ShipState`, `FleetAlert`, `RestrictedZone`, `Directive`, `PlaybackFrame`
  - normalized client-facing shapes (timestamps as numbers on client)

---

## Seed and Demo Users

### Seed Script
- `prisma/seed.ts`
- Strategy:
  - idempotent-ish ensure flow by email
  - creates users through Better Auth signup API
  - enforces role + assignment in DB
- Users seeded:
  - `command@hormuz.ops` / `command123` -> `COMMAND`
  - `captain@hormuz.ops` / `captain123` -> `CAPTAIN`, `assignedShipId = MV-7`

### Script Registration
- `package.json` -> `"seed": "tsx prisma/seed.ts"`

---

## Tooling, Build, and Runtime

### Core Scripts
- `pnpm dev` -> Next dev
- `pnpm engine` -> simulation engine runner under `docker/engine`
- `pnpm seed` -> seed users
- `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm format`, `pnpm format:check`

### TypeScript
- `tsconfig.json`
  - strict mode
  - `moduleResolution: bundler`
  - alias `@/* -> src/*`

### shadcn/Tailwind
- `components.json`
  - style: `base-luma`
  - ui alias: `@/components/ui`
  - css path: `src/app/globals.css`
- Tailwind v4 via `@tailwindcss/postcss`

### Lint/Format
- ESLint with Next + TS (`eslint.config.mjs`)
- Prettier with organize-imports + tailwind plugin

---

## Environment Variables In Use
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `OPEN_ROUTER_API_KEY`
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`

---

## Known Architectural Notes / Risks
- There are two directive controller paths (`controllers/(base)/directives.ts` and `controllers/directives.ts`), which can cause confusion unless one is canonicalized.
- `src/lib/auth.ts` and `prisma/seed.ts` import `PrismaClient` from `@prisma/client` directly, while repo guidance prefers generated client / shared `db` instance.
- Leaflet is intentionally imperative in command map to avoid React-Leaflet + React 19 lifecycle issues observed earlier.
- Distress AI extraction currently uses a free OpenRouter model and JSON parsing fallback; robust schema validation/retry loops are still advisable.

---

## High-Value Files (Quick Index)
- Routing/Auth:
  - `src/app/page.tsx`
  - `src/proxy.ts`
  - `src/routes.ts`
  - `src/lib/auth.ts`
  - `src/lib/current-user.ts`
- Command Center:
  - `src/components/command/command-dashboard.tsx`
  - `src/components/command/fleet-map.tsx`
  - `src/components/command/ship-sidebar.tsx`
  - `src/components/command/alert-panel.tsx`
- Captain:
  - `src/app/captain/page.tsx`
  - `src/components/captain/captain-dashboard.tsx`
- API:
  - `src/app/api/[[...route]]/route.ts`
  - `src/app/api/[[...route]]/controllers/(base)/index.ts`
  - `src/app/api/[[...route]]/controllers/(base)/distress.ts`
- State/realtime:
  - `src/hooks/use-fleet-sync.ts`
  - `src/stores/fleet-store.ts`
  - `src/lib/pusher-client.ts`
  - `src/lib/pusher-server.ts`
- Data and seed:
  - `prisma/schema.prisma`
  - `prisma/seed.ts`

---

## Last Updated
- Snapshot generated on: **2026-05-09**
- Basis: direct scan of current repository files in workspace.
