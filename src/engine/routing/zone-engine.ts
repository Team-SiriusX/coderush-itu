import { routingEngine } from './routing-engine'
import type { RestrictedPolygon } from './types'
import { getPusherServer } from '@/lib/pusher-server'
// import { simulationEngine } from '../simulation-engine' // careful of circular deps, we can expose an event or inject.

type ZoneChangeListener = () => void

class ZoneEngine {
  private listeners: ZoneChangeListener[] = []

  public setZones(zones: RestrictedPolygon[]) {
    routingEngine.updateZones(zones)
    this.notifyListeners()
  }

  public addZone(zone: RestrictedPolygon) {
    const currentZones = routingEngine.getZones()
    this.setZones([...currentZones, zone])
  }

  public updateZone(updatedZone: RestrictedPolygon) {
    const currentZones = routingEngine.getZones()
    const newZones = currentZones.map(z => z.id === updatedZone.id ? updatedZone : z)
    this.setZones(newZones)
  }

  public removeZone(id: string) {
    const currentZones = routingEngine.getZones()
    const newZones = currentZones.filter(z => z.id !== id)
    this.setZones(newZones)
  }

  public onZonesChanged(listener: ZoneChangeListener) {
    this.listeners.push(listener)
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener()
    }
  }

  public async broadcastZoneCreated(zone: RestrictedPolygon) {
    try {
      const pusher = getPusherServer()
      await pusher.trigger('zones', 'zone:create', zone)
    } catch (e) {
      console.error('[ZoneEngine] Failed to broadcast zone:create', e)
    }
  }

  public async broadcastZoneUpdated(zone: RestrictedPolygon) {
    try {
      const pusher = getPusherServer()
      await pusher.trigger('zones', 'zone:update', zone)
    } catch (e) {
      console.error('[ZoneEngine] Failed to broadcast zone:update', e)
    }
  }
}

export const zoneEngine = new ZoneEngine()
