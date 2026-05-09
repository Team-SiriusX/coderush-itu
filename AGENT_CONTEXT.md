# AGENT_CONTEXT

## What Was Implemented
- Role-based routing: COMMAND -> /command, CAPTAIN -> /captain
- Captain dashboard: real-time fuel gauge, status, position, incoming directives
- Captain subscribes to captain-{shipId} Pusher channel for directives
- Distress signal textarea -> POST /api/distress (AI extraction in next prompt)
- Seed script: command@hormuz.ops (COMMAND) + captain@hormuz.ops (CAPTAIN, MV-7)

## Files Added
- prisma/seed.ts
- src/app/captain/page.tsx
- src/components/captain/captain-dashboard.tsx

## Files Modified
- src/app/page.tsx - role-based redirect
- src/app/auth/sign-in/page.tsx - demo credentials hint
