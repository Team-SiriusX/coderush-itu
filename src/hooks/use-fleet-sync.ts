'use client'

import { useEffect } from 'react'
import { getPusherClient } from '@/lib/pusher-client'
import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState, FleetAlert, RestrictedZone } from '@/types/fleet'

export function useFleetSync() {
  useEffect(() => {
    const pusher = getPusherClient()

    const fleet  = pusher.subscribe('fleet')
    const alerts = pusher.subscribe('alerts')
    const zones  = pusher.subscribe('zones')

    const handleFleet = (data: ShipState[]) => useFleetStore.getState().setShips(data)
    const handleNewAlert = (data: FleetAlert) => useFleetStore.getState().addAlert(data)
    const handleUpdateAlert = (data: FleetAlert) => useFleetStore.getState().updateAlert(data.id, data)
    const handleZone = (data: RestrictedZone[]) => useFleetStore.getState().setZones(data)

    fleet.bind('fleet:update', handleFleet)
    alerts.bind('alert:new', handleNewAlert)
    alerts.bind('alert:update', handleUpdateAlert)
    zones.bind('zone:update', handleZone)

    return () => {
      fleet.unbind('fleet:update', handleFleet)
      alerts.unbind('alert:new', handleNewAlert)
      alerts.unbind('alert:update', handleUpdateAlert)
      zones.unbind('zone:update', handleZone)
      
      pusher.unsubscribe('fleet')
      pusher.unsubscribe('alerts')
      pusher.unsubscribe('zones')
    }
  }, [])
}
