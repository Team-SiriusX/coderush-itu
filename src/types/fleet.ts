export type ShipStatus =
  | 'normal'
  | 'rerouting'
  | 'distressed'
  | 'stopped'
  | 'stranded'
  | 'insufficient_fuel'
  | 'arrived'

export type RoutePoint = {
  lat: number
  lng: number
}

export type ShipState = {
  id: string
  name: string
  position: { lat: number; lng: number }
  speed: number
  heading: number
  destinationPortId: string
  fuelRemaining: number
  cargo: string
  status: ShipStatus
  route: RoutePoint[]
  weatherPenalty: boolean
  weatherSeverity?: 'LOW' | 'MODERATE' | 'SEVERE' | 'EXTREME'
  lastUpdated: number
}

export type Port = {
  id: string
  name: string
  position: { lat: number; lng: number }
}

export type AlertType =
  | 'GEOFENCE_BREACH'
  | 'PROXIMITY_WARNING'
  | 'COLLISION_RISK'
  | 'DISTRESS_SIGNAL'
  | 'LOW_FUEL'
  | 'OUT_OF_FUEL'
  | 'ROUTE_BLOCKED'
  | 'INSUFFICIENT_FUEL'

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type FleetAlert = {
  id: string
  type: AlertType
  severity: AlertSeverity
  shipId: string
  message: string
  acknowledged: boolean
  resolved: boolean
  metadata?: Record<string, unknown>
  createdAt: number
}

export type RestrictedZone = {
  id: string
  name: string
  geometry: GeoJSONPolygon
  active: boolean
}

export type GeoJSONPolygon = {
  type: 'Polygon'
  coordinates: number[][][]
}

export type Directive = {
  id: string
  shipId: string
  type: 'REROUTE' | 'HOLD' | 'DIVERT' | 'RETURN_TO_PORT'
  payload: Record<string, unknown>
  response?: 'ACCEPT' | 'ESCALATE_DISTRESS'
  createdAt: number
}

/** Matches DistressExtractionResult from distress-chain.ts */
export type DistressExtraction = {
  severity:               'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  situation:              string
  systemsAffected:        string[]
  casualtyCount:          number
  assistanceRequired:     'NONE' | 'MEDICAL' | 'TOWING' | 'ESCORT' | 'FUEL' | 'EVACUATION'
  canContinue:            boolean
  estimatedTimeToFailure: number | null
  recommendedAction:      string
}

export type PredictiveAlertMetadata = {
  isPredictive: true
  riskType: string
  confidence: number
  timeToEventMinutes: number
  reasoning: string
  suggestedAction: string
}

export type PlaybackFrame = {
  timestamp: number
  ships: ShipState[]
  alerts: FleetAlert[]
  zones: RestrictedZone[]
}
