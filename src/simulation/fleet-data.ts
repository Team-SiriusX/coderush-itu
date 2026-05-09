import type { ShipState, Port } from '@/types/fleet'

// ============================================================
// OFFICIAL DATA — DO NOT MODIFY THESE VALUES
// Source: fleet.json provided by ITU Code Rush organizers
// Coordinate format: { lat, lng } (converted from [lat, lng])
// Speed: knots | Fuel: tons | Heading: degrees true north
// ============================================================

export const BOUNDING_BOX = {
  north: 30.5,
  south: 22.0,
  east: 60.0,
  west: 47.5,
}

// Raw polygon in [lat, lng] format — for display/reference
// For Turf.js always convert to [lng, lat]
export const NAVIGABLE_WATER_LATLNG: [number, number][] = [
  [29.80, 48.60], [29.50, 50.00], [28.80, 50.80],
  [27.80, 52.00], [26.70, 53.50], [26.30, 55.00],
  [26.65, 56.10], [26.50, 56.40], [26.00, 56.80],
  [25.50, 57.50], [25.50, 58.50], [25.00, 60.00],
  [22.00, 60.00], [22.50, 60.00], [23.80, 58.80],
  [24.50, 57.20], [25.20, 56.50], [26.45, 56.45],
  [26.30, 55.90], [26.00, 55.50], [25.30, 54.50],
  [24.80, 53.00], [25.30, 52.00], [26.40, 51.50],
  [26.50, 50.30], [27.50, 49.80], [28.50, 49.00],
  [29.50, 48.30], [29.80, 48.60], // closed polygon
]

// For Turf.js — [lng, lat] format
export const NAVIGABLE_WATER_TURF: [number, number][] =
  NAVIGABLE_WATER_LATLNG.map(([lat, lng]) => [lng, lat])

export const PORTS: Port[] = [
  { id: 'KWT-1', name: 'Kuwait City',  position: { lat: 29.48, lng: 48.34 } },
  { id: 'BUS-1', name: 'Bushehr',      position: { lat: 28.83, lng: 50.73 } },
  { id: 'DMM-1', name: 'Dammam',       position: { lat: 26.56, lng: 50.30 } },
  { id: 'BAH-1', name: 'Manama',       position: { lat: 26.50, lng: 50.55 } },
  { id: 'DOH-1', name: 'Doha',         position: { lat: 25.46, lng: 51.95 } },
  { id: 'AUH-1', name: 'Abu Dhabi',    position: { lat: 25.22, lng: 54.18 } },
  { id: 'DXB-1', name: 'Jebel Ali',    position: { lat: 25.50, lng: 54.75 } },
  { id: 'BND-1', name: 'Bandar Abbas', position: { lat: 26.62, lng: 56.11 } },
  { id: 'SOH-1', name: 'Sohar',        position: { lat: 24.72, lng: 57.02 } },
  { id: 'MCT-1', name: 'Muscat',       position: { lat: 23.92, lng: 58.58 } },
]

export const INITIAL_SHIPS: ShipState[] = [
  {
    id: 'MV-1',  name: 'Aurora',
    position: { lat: 26.55, lng: 56.20 },
    speed: 14, heading: 105,
    destinationPortId: 'MCT-1',
    fuelRemaining: 6800, cargo: 'crude oil',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-2',  name: 'Borealis',
    position: { lat: 25.50, lng: 57.20 },
    speed: 19, heading: 270,
    destinationPortId: 'DXB-1',
    fuelRemaining: 5400, cargo: 'containers',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-3',  name: 'Cygnus',
    position: { lat: 25.70, lng: 53.00 },
    speed: 16, heading: 95,
    destinationPortId: 'MCT-1',
    fuelRemaining: 7200, cargo: 'LNG',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-4',  name: 'Dragon',
    position: { lat: 26.40, lng: 56.00 },
    speed: 13, heading: 110,
    destinationPortId: 'SOH-1',
    fuelRemaining: 5800, cargo: 'bulk grain',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-5',  name: 'Emerald',
    position: { lat: 27.50, lng: 51.20 },
    speed: 12, heading: 165,
    destinationPortId: 'DOH-1',
    fuelRemaining: 8200, cargo: 'crude oil',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-6',  name: 'Falcon',
    position: { lat: 25.40, lng: 54.53 },
    speed: 22, heading: 280,
    destinationPortId: 'DOH-1',
    fuelRemaining: 4100, cargo: 'containers',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    // ⚠️ CRITICAL: MV-7 Gharial has only 750 tons fuel — intentionally low
    // This ship will likely run out before reaching KWT-1
    // Fuel logic and rerouting are graded heavily around this ship
    id: 'MV-7',  name: 'Gharial',
    position: { lat: 26.50, lng: 53.50 },
    speed: 14, heading: 270,
    destinationPortId: 'KWT-1',
    fuelRemaining: 750, cargo: 'crude oil',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-8',  name: 'Halcyon',
    position: { lat: 24.93, lng: 56.94 },
    speed: 19, heading: 250,
    destinationPortId: 'DMM-1',
    fuelRemaining: 5200, cargo: 'automobiles',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-9',  name: 'Iris',
    position: { lat: 28.20, lng: 50.30 },
    speed: 13, heading: 175,
    destinationPortId: 'BAH-1',
    fuelRemaining: 7800, cargo: 'crude oil',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-10', name: 'Jade',
    position: { lat: 25.02, lng: 57.96 },
    speed: 20, heading: 285,
    destinationPortId: 'BND-1',
    fuelRemaining: 6300, cargo: 'containers',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-11', name: 'Kite',
    position: { lat: 25.64, lng: 52.18 },
    speed: 18, heading: 95,
    destinationPortId: 'MCT-1',
    fuelRemaining: 7600, cargo: 'LNG',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-12', name: 'Lotus',
    position: { lat: 29.10, lng: 48.80 },
    speed: 12, heading: 145,
    destinationPortId: 'SOH-1',
    fuelRemaining: 8500, cargo: 'crude oil',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-13', name: 'Mirage',
    position: { lat: 24.60, lng: 57.30 },
    speed: 21, heading: 320,
    destinationPortId: 'BAH-1',
    fuelRemaining: 5900, cargo: 'containers',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-14', name: 'Nova',
    position: { lat: 24.12, lng: 58.43 },
    speed: 11, heading: 290,
    destinationPortId: 'DOH-1',
    fuelRemaining: 4600, cargo: 'bulk cement',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
  {
    id: 'MV-15', name: 'Orca',
    position: { lat: 26.34, lng: 55.91 },
    speed: 13, heading: 215,
    destinationPortId: 'MCT-1',
    fuelRemaining: 7100, cargo: 'crude oil',
    status: 'normal', route: [], weatherPenalty: false, lastUpdated: Date.now(),
  },
]

// Helper: get port by ID
export function getPort(id: string): Port | undefined {
  return PORTS.find((p) => p.id === id)
}

// Helper: get ship by ID (from a live ships array)
export function getShipById(ships: ShipState[], id: string): ShipState | undefined {
  return ships.find((s) => s.id === id)
}
