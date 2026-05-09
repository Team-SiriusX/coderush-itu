import { getPusherServer } from '@/lib/pusher-server'
import { createId } from '@paralleldrive/cuid2'
import db from '@/lib/db'
import type { EngineShip, PendingAlert, BroadcastShip, FleetBroadcastPayload } from './types'
import { mapStatusToFrontend } from './status-engine'

/**
 * Convert an EngineShip to the shape expected by the frontend (useFleetSync).
 * The frontend binds to 'fleet:update' and expects an array matching ShipState.
 */
function toBroadcastShip(ship: EngineShip, now: number): BroadcastShip {
  const routeWaypoints = ship.route
    ? ship.route.waypoints.slice(ship.route.currentIdx)
    : []

  return {
    id:               ship.id,
    name:             ship.name,
    position:         ship.position,
    previousPosition: ship.previousPosition,
    heading:          ship.heading,
    speed:            ship.speed,
    status:           mapStatusToFrontend(ship.status),
    fuelRemaining:    ship.fuelRemaining,
    cargo:            ship.cargo,
    destinationPortId: ship.destinationPortId,
    weatherPenalty:   ship.weatherPenalty,
    route:            routeWaypoints,
    lastUpdated:      ship.lastUpdated,
    serverTimestamp:  now,
  }
}

/**
 * Broadcast the full fleet state to the 'fleet' Pusher channel.
 * Called at the end of every simulation tick.
 *
 * Channel: fleet
 * Event:   fleet:update
 * Payload: BroadcastShip[] (matches useFleetSync binding)
 */
export async function broadcastFleet(ships: EngineShip[]): Promise<void> {
  const now     = Date.now()
  const payload: FleetBroadcastPayload = {
    ships:           ships.map((s) => toBroadcastShip(s, now)),
    serverTimestamp: now,
  }

  try {
    const pusher = getPusherServer()
    // Pusher limits payload to 10KB per event; fleet of 15 ships is ~3-4KB
    await pusher.trigger('fleet', 'fleet:update', payload.ships)
  } catch (err) {
    console.error('[broadcaster] Pusher fleet:update failed:', err)
  }
}

/**
 * Persist and broadcast pending alerts generated during a tick.
 * Each alert is written to the DB and pushed via Pusher 'alerts' channel.
 */
export async function broadcastAlerts(alerts: PendingAlert[]): Promise<void> {
  if (alerts.length === 0) return

  const pusher = getPusherServer()

  await Promise.allSettled(
    alerts.map(async (pending) => {
      try {
        const alert = await db.alert.create({
          data: {
            id:       createId(),
            type:     pending.type === 'ARRIVED' ? 'DISTRESS_SIGNAL' : pending.type,  // use valid AlertType enum
            severity: pending.severity,
            shipId:   pending.shipId,
            message:  pending.message,
          },
        })

        await pusher.trigger('alerts', 'alert:new', {
          id:           alert.id,
          type:         alert.type,
          severity:     alert.severity,
          shipId:       alert.shipId,
          message:      alert.message,
          acknowledged: false,
          resolved:     false,
          metadata:     null,
          createdAt:    alert.createdAt.getTime(),
        })
      } catch (err) {
        console.error(`[broadcaster] Failed to persist/broadcast alert for ${pending.shipId}:`, err)
      }
    }),
  )
}
