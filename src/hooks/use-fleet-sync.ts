'use client'

import { useEffect } from 'react'
import { getPusherClient } from '@/lib/pusher-client'
import { useFleetStore } from '@/stores/fleet-store'
import type { ShipState, FleetAlert, RestrictedZone } from '@/types/fleet'

export function useFleetSync() {
  const { setShips, addAlert, updateAlert, setZones } = useFleetStore()

  useEffect(() => {
    const pusher = getPusherClient()

    const fleet  = pusher.subscribe('fleet')
    const alerts = pusher.subscribe('alerts')
    const zones  = pusher.subscribe('zones')

    fleet.bind('fleet:update',  (data: ShipState[])     => setShips(data))
    alerts.bind('alert:new',    (data: FleetAlert)       => addAlert(data))
    alerts.bind('alert:update', (data: FleetAlert)       => updateAlert(data.id, data))
    zones.bind('zone:update',   (data: RestrictedZone[]) => setZones(data))

    return () => {
      pusher.unsubscribe('fleet')
      pusher.unsubscribe('alerts')
      pusher.unsubscribe('zones')
    }
  }, [setShips, addAlert, updateAlert, setZones])
}
