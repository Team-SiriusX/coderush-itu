# Hormuz Ops Platform Context (2026-05-09)

## Summary
- Replaced Socket.IO scaffolding with Pusher scaffolding.
- Added Dockerized setup for Postgres + web + engine.
- Added fleet simulation data/types and state store remain in place.

## What Was Implemented
- Pusher server/client helpers and shared realtime event constants.
- Docker Compose for local/production-like orchestration.
- Full 1Hz simulation engine (A* routing, dead reckoning, geofencing, proximity, weather, playback, Pusher events).
- Zone sync from DB every 5 ticks.
- Alert deduplication window (30s per alert type/ship).
- Command dashboard: dark Leaflet map with 15 live ship markers fed by Pusher.
- Ship markers rotate to heading, color-coded by status.
- Left sidebar: live ship list with fuel and status.
- Right panel: alert feed OR selected ship details with directive buttons.
- Dead reckoning: markers update position every Pusher tick (1Hz).
- useFleetSync hook: subscribes to fleet/alerts/zones Pusher channels.
- Updated documentation snapshot.

## Files Added
- docker-compose.yml
- Dockerfile
- docker/engine/Dockerfile
- docker/engine/package.json
- docker/engine/src/index.ts
- src/lib/pusher-server.ts
- src/lib/pusher-client.ts
- src/constants/realtime-events.ts
- src/app/command/page.tsx
- src/app/page.tsx
- src/components/command/command-dashboard.tsx
- src/components/command/fleet-map.tsx
- src/components/command/alert-panel.tsx
- src/components/command/ship-sidebar.tsx
- src/hooks/use-fleet-sync.ts

## Files Removed
- src/lib/socket-server.ts
- src/lib/socket-client.ts
- src/constants/socket-events.ts

## Files Modified
- docker/engine/src/index.ts -- complete simulation engine (was stub)

## Dependency Changes
- Removed: socket.io, socket.io-client
- Added: pusher, pusher-js, tsx, @hono/node-server, @paralleldrive/cuid2

## Environment
- Added Pusher env vars to .env (values set locally).

## Notes
- Pusher is scaffolded; channels/events still need to be wired into app workflows as needed.
