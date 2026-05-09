import type { ShipState } from '@/types/fleet'

export function predictPosition(ship: ShipState, horizonSec: number) {
  const distanceNm = ship.speed * (horizonSec / 3600)
  const degPerNm = 1 / 60
  const rad = (ship.heading * Math.PI) / 180
  return {
    lat: ship.position.lat + Math.cos(rad) * distanceNm * degPerNm,
    lng: ship.position.lng + Math.sin(rad) * distanceNm * degPerNm,
  }
}
