import { EngineShip, PendingAlert } from '@/engine/types'
import { predictFuelAtDestination } from './fuel-predictor'
import { weatherEngine } from '@/systems/weather/weather-engine'

// To avoid spamming alerts every tick, we track which predictions were already sent
const predictionAlertSent = new Set<string>()

export function generatePredictiveAlerts(ship: EngineShip): PendingAlert[] {
  const alerts: PendingAlert[] = []
  if (ship.status === 'ARRIVED' || ship.status === 'STOPPED' || ship.status === 'STRANDED') return alerts

  // 1. Fuel Prediction
  const fuelPred = predictFuelAtDestination(ship)
  const fuelPredKey = `${ship.id}-fuel-pred`
  if (fuelPred.willRunOut && !predictionAlertSent.has(fuelPredKey)) {
    predictionAlertSent.add(fuelPredKey)
    alerts.push({
      shipId: ship.id,
      type: 'LOW_FUEL', 
      severity: 'CRITICAL',
      message: `PREDICTION: ${ship.name} will run out of fuel before reaching destination. Shortfall: ${fuelPred.fuelDeficit.toFixed(1)}t`
    })
  } else if (!fuelPred.willRunOut && predictionAlertSent.has(fuelPredKey)) {
    // ship fueled up or slowed down, resolve the prediction state
    predictionAlertSent.delete(fuelPredKey)
  }

  // 2. Weather Interception Prediction
  if (ship.route && ship.route.waypoints.length > ship.route.currentIdx) {
    const nextWp = ship.route.waypoints[ship.route.currentIdx]
    const nextWeather = weatherEngine.getSeverityAt(nextWp.lat, nextWp.lng)
    const weatherPredKey = `${ship.id}-weather-pred`
    
    if (nextWeather === 'EXTREME' && !predictionAlertSent.has(weatherPredKey)) {
      predictionAlertSent.add(weatherPredKey)
      alerts.push({
        shipId: ship.id,
        type: 'DISTRESS_SIGNAL',
        severity: 'HIGH',
        message: `PREDICTION: ${ship.name} is on intercept course with EXTREME weather.`
      })
    } else if (nextWeather !== 'EXTREME' && predictionAlertSent.has(weatherPredKey)) {
      predictionAlertSent.delete(weatherPredKey)
    }
  }

  return alerts
}
