# Codebase Snapshot (2026-05-09)

## Summary
- Project name: itu-coderush (package.json)
- Framework: Next.js 16 App Router + React 19 + TypeScript
- Styling: Tailwind CSS 4, shadcn/ui (base-luma), tw-animate-css
- API: Hono mounted at /api with typed client (Hono + Hono client)
- Auth: Better Auth (JWT cookie cache) + Prisma adapter, Next.js auth handler
- Data: Prisma schema for PostgreSQL, migrations tracked in prisma/migrations
- Client data: TanStack Query for cache + mutations

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
- OPEN_ROUTER_API_KEY

## Routes and Behavior
### App routes
- /: src/app/page.tsx (shows authenticated/unauthenticated via currentUser)
- /auth/sign-in: src/app/auth/sign-in/page.tsx
- /auth/sign-up: src/app/auth/sign-up/page.tsx
- /sample: src/app/sample/page.tsx

### API routes
- /api/*: src/app/api/[[...route]]/route.ts (Hono router)
- /api/sample:
  - GET /: query name optional, returns greeting
  - POST /: json name optional, returns created user payload
  - DELETE /:id: deletes by id
- /api/auth/*: src/app/api/auth/[...all]/route.ts (Better Auth handler)

### Auth/public routing rules (src/routes.ts + src/proxy.ts)
- Auth routes: /auth/sign-in, /auth/sign-up, /auth/forget-password,
  /auth/reset-password, /auth/verify-email, /auth/verify-email/verify
- Public routes: /, /sample, /chat
- Default login redirect: /
- Middleware-like proxy logic in src/proxy.ts

## Data Model (prisma/schema.prisma)
### Enums
- Role: WORKER, VERIFIER, ADVOCATE
- WorkerCategory: RIDE_HAILING, FOOD_DELIVERY, FREELANCE_DESIGN, DOMESTIC_WORK, OTHER
- VerificationStatus: PENDING, CONFIRMED, FLAGGED, UNVERIFIABLE
- ScreenshotStatus: PENDING, CONFIRMED, FLAGGED, UNVERIFIABLE
- GrievanceStatus: OPEN, TAGGED, ESCALATED, RESOLVED
- GrievanceCategory: COMMISSION_CHANGE, ACCOUNT_DEACTIVATION, PAYMENT_DISPUTE,
  UNFAIR_RATING, SAFETY_CONCERN, OTHER
- CertificateStatus: GENERATED, EXPIRED

### Models
- User: auth user profile + relations to logs, grievances, sessions, accounts
- RefreshToken: refresh token storage
- Platform: gig platforms (Bykea, Foodpanda, etc.)
- ShiftLog: worker shift earnings + verification status
- Screenshot: uploaded shift proof + verifier review
- AnomalyFlag: detected earnings anomalies
- Grievance: complaint records with status and tags
- GrievanceTag: tags attached by advocates
- GrievanceEscalation: escalations on grievances
- DailyPlatformStat: aggregated daily platform stats
- VulnerabilityFlag: monthly income drop flags
- IncomeCertificate: rendered income certificate snapshots
- Session: Better Auth session storage
- Account: OAuth account storage
- Verification: verification tokens

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
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
|       |-- migration_lock.toml
|       |-- 20260416172751_init/
|       |   `-- migration.sql
|       |-- 20260418064729_phase_1/
|       |   `-- migration.sql
|       |-- 20260418065323_phase_2/
|       |   `-- migration.sql
|       `-- 20260418065647_phase_3/
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
    |   |-- auth/
    |   |   |-- sign-in/
    |   |   |   `-- page.tsx
    |   |   `-- sign-up/
    |   |       `-- page.tsx
    |   `-- sample/
    |       |-- layout.tsx
    |       |-- page.tsx
    |       |-- _api/
    |       |   |-- create-sample.ts
    |       |   |-- delete-sample.ts
    |       |   `-- get-sample.ts
    |       `-- _components/
    |           |-- create-sample.tsx
    |           `-- delete-sample.tsx
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
    |   `-- query-keys.ts
    |-- hooks/
    |   `-- use-mobile.ts
    `-- lib/
        |-- auth-client.ts
        |-- auth.ts
        |-- current-user.ts
        |-- db.ts
        |-- hono.ts
        |-- open-router.ts
        `-- utils.ts
```
# Codebase Snapshot (2026-05-09)

This file captures the current setup, key code structure, and a complete file tree of the repository. Detailed summaries focus on key configs and entry points. If you want full file contents embedded, say so and I will generate a full dump.

## Stack Overview

- Framework: Next.js 16 (App Router)
- UI: React 19, Tailwind CSS 4, shadcn/ui, lucide-react
- API: Hono inside Next.js API routes
- Data: Prisma (PostgreSQL)
- Auth: Better Auth (email/password + social providers)
- Client data fetching: TanStack React Query
- Other: OpenRouter SDK
- Package manager: pnpm

## Scripts (package.json)

- dev: next dev
- build: next build
- start: next start
- lint: eslint
- format: prettier --write .
- format:check: prettier --check .

## Environment Variables (observed usage)

- DATABASE_URL (Prisma + Better Auth adapter)
- BETTER_AUTH_SECRET (session cookie cache)
- GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (Better Auth GitHub provider)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Better Auth Google provider)
- NEXT_PUBLIC_API_URL (Hono client base URL)
- OPEN_ROUTER_API_KEY (OpenRouter SDK)

## Repository Structure (full tree)

```
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── prisma.config.ts
├── tsconfig.json
├── .gitignore
├── .prettierignore
├── .prettierrc
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── prisma/
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   ├── 20260416172751_init/
│   │   │   └── migration.sql
│   │   ├── 20260418064729_phase_1/
│   │   │   └── migration.sql
│   │   ├── 20260418065323_phase_2/
│   │   │   └── migration.sql
│   │   └── 20260418065647_phase_3/
│   │       └── migration.sql
│   └── schema.prisma
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── [[...route]]/
    │   │   │   ├── controllers/
    │   │   │   │   └── (base)/
    │   │   │   │       ├── index.ts
    │   │   │   │       └── sample.ts
    │   │   │   ├── middleware/
    │   │   │   │   └── auth-middleware.ts
    │   │   │   └── route.ts
    │   │   └── auth/
    │   │       └── [...all]/
    │   │           └── route.ts
    │   ├── auth/
    │   │   ├── sign-in/
    │   │   │   └── page.tsx
    │   │   └── sign-up/
    │   │       └── page.tsx
    │   ├── sample/
    │   │   ├── _api/
    │   │   │   ├── create-sample.ts
    │   │   │   ├── delete-sample.ts
    │   │   │   └── get-sample.ts
    │   │   ├── _components/
    │   │   │   ├── create-sample.tsx
    │   │   │   └── delete-sample.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── providers/
    │   │   ├── index.tsx
    │   │   └── query-provider.tsx
    │   └── ui/
    │       ├── accordion.tsx
    │       ├── alert-dialog.tsx
    │       ├── alert.tsx
    │       ├── aspect-ratio.tsx
    │       ├── avatar.tsx
    │       ├── badge.tsx
    │       ├── breadcrumb.tsx
    │       ├── button-group.tsx
    │       ├── button.tsx
    │       ├── calendar.tsx
    │       ├── card.tsx
    │       ├── carousel.tsx
    │       ├── chart.tsx
    │       ├── checkbox.tsx
    │       ├── collapsible.tsx
    │       ├── combobox.tsx
    │       ├── command.tsx
    │       ├── context-menu.tsx
    │       ├── dialog.tsx
    │       ├── direction.tsx
    │       ├── drawer.tsx
    │       ├── dropdown-menu.tsx
    │       ├── empty.tsx
    │       ├── field.tsx
    │       ├── hover-card.tsx
    │       ├── input-group.tsx
    │       ├── input-otp.tsx
    │       ├── input.tsx
    │       ├── item.tsx
    │       ├── kbd.tsx
    │       ├── label.tsx
    │       ├── menubar.tsx
    │       ├── native-select.tsx
    │       ├── navigation-menu.tsx
    │       ├── pagination.tsx
    │       ├── popover.tsx
    │       ├── progress.tsx
    │       ├── radio-group.tsx
    │       ├── resizable.tsx
    │       ├── scroll-area.tsx
    │       ├── select.tsx
    │       ├── separator.tsx
    │       ├── sheet.tsx
    │       ├── sidebar.tsx
    │       ├── skeleton.tsx
    │       ├── slider.tsx
    │       ├── sonner.tsx
    │       ├── spinner.tsx
    │       ├── switch.tsx
    │       ├── table.tsx
    │       ├── tabs.tsx
    │       ├── textarea.tsx
    │       ├── toggle-group.tsx
    │       ├── toggle.tsx
    │       └── tooltip.tsx
    ├── constants/
    │   └── query-keys.ts
    ├── hooks/
    │   └── use-mobile.ts
    ├── lib/
    │   ├── auth-client.ts
    │   ├── auth.ts
    │   ├── current-user.ts
    │   ├── db.ts
    │   ├── hono.ts
    │   ├── open-router.ts
    │   └── utils.ts
    ├── proxy.ts
    └── routes.ts
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

## App Entry Points

- src/app/layout.tsx: Root layout, global fonts (Inter + Geist), Providers wrapper, base metadata.
- src/app/page.tsx: Uses currentUser() to render authenticated/unauthenticated state.
- src/app/globals.css: Tailwind v4 base with CSS variables for theme tokens.

## API Layer (Hono + Next.js)

- src/app/api/[[...route]]/route.ts: Hono app mounted at /api, error handler, routes under /sample; exports GET/POST/PUT/PATCH/DELETE handlers for Next.js.
- src/app/api/[[...route]]/controllers/(base)/sample.ts: Sample GET/POST/DELETE with zod validation.
- src/app/api/[[...route]]/middleware/auth-middleware.ts: Better Auth cookie-based session validation, attaches user to request.

## Auth Flow

- src/app/api/auth/[...all]/route.ts: Better Auth Next.js handler (GET/POST).
- src/lib/auth.ts: Better Auth config with Prisma adapter + JWT cookie cache; email/password + GitHub/Google providers.
- src/lib/auth-client.ts: client-side Better Auth hooks.
- src/routes.ts and src/proxy.ts: route gating and auth redirects via middleware.
- src/app/auth/sign-in/page.tsx and src/app/auth/sign-up/page.tsx: UI for auth flows with Sonner toasts.

## Data Layer (Prisma)

Prisma schema defines enums and models for workers, earnings, verification, grievances, analytics, and auth sessions:

- Enums: Role, WorkerCategory, VerificationStatus, ScreenshotStatus, GrievanceStatus, GrievanceCategory, CertificateStatus
- Models: User, RefreshToken, Platform, ShiftLog, Screenshot, AnomalyFlag, Grievance, GrievanceTag, GrievanceEscalation, DailyPlatformStat, VulnerabilityFlag, IncomeCertificate, Session, Account, Verification

## Client Data Fetching

- React Query provider: src/components/providers/query-provider.tsx
- Sample feature hooks: src/app/sample/_api/* (useGetSample, useCreateSample, useDeleteSample)
- Sample page: src/app/sample/page.tsx

## Utilities and Shared Helpers

- src/lib/hono.ts: Hono client typed with AppType and NEXT_PUBLIC_API_URL.
- src/lib/db.ts: Prisma client with PostgreSQL adapter and global caching in dev.
- src/lib/current-user.ts: session lookup via Better Auth cookie cache.
- src/lib/open-router.ts: OpenRouter SDK client.
- src/lib/utils.ts: cn() class name helper.
- src/hooks/use-mobile.ts: media-query hook for mobile detection.
- src/constants/query-keys.ts: query key enum.
