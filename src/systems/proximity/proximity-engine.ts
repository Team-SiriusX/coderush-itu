import { distance, point } from '@turf/turf'
import type { FleetAlert, ShipState } from '@/types/fleet'
import { predictPosition } from './collision-predictor'

type ActivePair = { key: string; lastSeen: number }

export class ProximityEngine {
  private activePairs = new Map<string, ActivePair>()

  scan(ships: ShipState[], nowMs = Date.now()): FleetAlert[] {
    const out: FleetAlert[] = []
    const seen = new Set<string>()

    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i]
        const b = ships[j]
        if (a.status === 'arrived' || b.status === 'arrived') continue

        const pairKey = [a.id, b.id].sort().join(':')
        const dKm = distance(point([a.position.lng, a.position.lat]), point([b.position.lng, b.position.lat]), {
          units: 'kilometers',
        })

        if (dKm <= 2) {
          seen.add(pairKey)
          if (!this.activePairs.has(pairKey)) {
            this.activePairs.set(pairKey, { key: pairKey, lastSeen: nowMs })
            out.push(this.makeAlert('PROXIMITY_WARNING', 'HIGH', a.id, b.id, `${a.name} and ${b.name} within ${dKm.toFixed(2)}km`, nowMs))
          } else {
            this.activePairs.get(pairKey)!.lastSeen = nowMs
          }
        }

        const af = predictPosition(a, 180)
        const bf = predictPosition(b, 180)
        const futureKm = distance(point([af.lng, af.lat]), point([bf.lng, bf.lat]), { units: 'kilometers' })
        if (futureKm <= 2 && !seen.has(`risk:${pairKey}`)) {
          seen.add(`risk:${pairKey}`)
          out.push(
            this.makeAlert(
              'COLLISION_RISK',
              'CRITICAL',
              a.id,
              b.id,
              `${a.name} and ${b.name} predicted to breach 2km in ~3 minutes`,
              nowMs,
            ),
          )
        }
      }
    }

    for (const [key, pair] of this.activePairs) {
      if (!seen.has(key) && nowMs - pair.lastSeen > 5000) {
        this.activePairs.delete(key)
      }
    }

    return out
  }

  private makeAlert(
    type: FleetAlert['type'] | 'COLLISION_RISK',
    severity: FleetAlert['severity'],
    shipA: string,
    shipB: string,
    message: string,
    nowMs: number,
  ): FleetAlert {
    return {
      id: `client-${type}-${shipA}-${shipB}-${nowMs}`,
      type: type as FleetAlert['type'],
      severity,
      shipId: shipA,
      message,
      acknowledged: false,
      resolved: false,
      metadata: { counterpartShipId: shipB, generatedBy: 'proximity-engine' },
      createdAt: nowMs,
    }
  }
}
