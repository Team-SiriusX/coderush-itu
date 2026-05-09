/**
 * Next.js Instrumentation Hook
 *
 * This file is called ONCE when the Next.js server process initialises,
 * before it handles any requests. It is the correct place to start
 * background server-side processes like the fleet simulation engine.
 *
 * Placed in src/ root per Next.js file conventions.
 * See: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */
export async function register() {
  // Only run on the Node.js runtime (not Edge, not browser)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapEngine } = await import('./engine/bootstrap')
    bootstrapEngine()
  }
}
