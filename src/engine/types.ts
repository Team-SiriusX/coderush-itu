// Engine-internal ship representation (server-authoritative)
// Distinct from the frontend ShipState — this is the ground truth
export type LatLng = { lat: number; lng: number }

export type ShipWaypoint = LatLng

export type ShipRoute = {
  waypoints:   ShipWaypoint[]
  currentIdx:  number
}

export type EngineShipStatus =
  | 'NORMAL'
  | 'REROUTING'
  | 'DISTRESSED'
  | 'STOPPED'
  | 'STRANDED'
  | 'OUT_OF_FUEL'
  | 'ARRIVED'

export type EngineShip = {
  id:                string
  name:              string
  position:          LatLng
  previousPosition:  LatLng          // For client-side interpolation
  heading:           number          // degrees, 0 = North, 90 = East
  speed:             number          // knots
  baseSpeed:         number          // original cruise speed (for restoration)
  destinationPortId: string
  destinationPos:    LatLng
  fuelRemaining:     number          // tons
  fuelCapacity:      number          // tons (for percentage display)
  cargo:             string
  status:            EngineShipStatus
  route:             ShipRoute | null
  weatherPenalty:    boolean
  weatherSeverity:   'LOW' | 'MODERATE' | 'SEVERE' | 'EXTREME'
  arrivedAt:         number | null   // ms timestamp when arrived
  lowFuelAlertSent:  boolean
  outOfFuelAlertSent: boolean
  lastUpdated:       number          // ms timestamp
}

export type FuelComputation = {
  burnRate:    number   // tons per nautical mile
  consumed:    number   // tons this tick
  remaining:   number   // tons after tick
  depleted:    boolean  // hit zero this tick
}

export type SimulationTickResult = {
  ships:            EngineShip[]
  alertsGenerated:  PendingAlert[]
  tickDurationMs:   number
  timestamp:        number
}

// An alert to be persisted + broadcast; generated during a tick
export type PendingAlert = {
  shipId:   string
  type:     'LOW_FUEL' | 'OUT_OF_FUEL' | 'ARRIVED' | 'DISTRESS_SIGNAL'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message:  string
}

// Payload broadcast to Pusher fleet channel
export type FleetBroadcastPayload = {
  ships:           BroadcastShip[]
  serverTimestamp: number
}

export type BroadcastShip = {
  id:               string
  name:             string
  position:         LatLng
  previousPosition: LatLng
  heading:          number
  speed:            number
  status:           string          // mapped from EngineShipStatus to lowercase for frontend compat
  fuelRemaining:    number
  cargo:            string
  destinationPortId: string
  weatherPenalty:   boolean
  weatherSeverity:  'LOW' | 'MODERATE' | 'SEVERE' | 'EXTREME'
  route:            LatLng[]
  lastUpdated:      number
  serverTimestamp:  number
}
