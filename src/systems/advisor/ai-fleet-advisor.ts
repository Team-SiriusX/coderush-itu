import { EngineShip } from '@/engine/types'
import { FleetRecommendation } from './advisor-types'
import { predictFuelAtDestination } from '../prediction/fuel-predictor'
import { weatherEngine } from '../weather/weather-engine'

export class AIFleetAdvisor {
  generateRecommendations(ship: EngineShip): FleetRecommendation[] {
    const recs: FleetRecommendation[] = []

    if (ship.status === 'ARRIVED' || ship.status === 'STRANDED') return recs

    const fuelPred = predictFuelAtDestination(ship)
    const severity = weatherEngine.getSeverityAt(ship.position.lat, ship.position.lng)

    if (fuelPred.willRunOut) {
      if (ship.speed > ship.baseSpeed * 0.7) {
        recs.push({
          id: `rec-${ship.id}-speed`,
          shipId: ship.id,
          type: 'REDUCE_SPEED',
          rationale: 'Reducing speed will significantly lower fuel burn rate and may allow vessel to reach port.',
          confidenceScore: 85,
          impact: 'Eliminates fuel deficit but delays ETA by several hours.'
        })
      } else {
         recs.push({
          id: `rec-${ship.id}-divert`,
          shipId: ship.id,
          type: 'DIVERT',
          rationale: 'Vessel cannot reach destination on current fuel even at reduced speed. Must divert to nearest port.',
          confidenceScore: 95,
          impact: 'Prevents vessel from becoming stranded at sea.'
        })
      }
    }

    if (severity === 'EXTREME') {
      recs.push({
        id: `rec-${ship.id}-reroute`,
        shipId: ship.id,
        type: 'REROUTE',
        rationale: 'Vessel is currently operating in EXTREME weather. Rerouting is highly advised to avoid structural damage.',
        confidenceScore: 92,
        impact: 'Increases safety margin, slightly increases ETA.'
      })
    } else if (severity === 'SEVERE') {
      recs.push({
        id: `rec-${ship.id}-speed-weather`,
        shipId: ship.id,
        type: 'REDUCE_SPEED',
        rationale: 'Vessel operating in SEVERE weather. Reducing speed minimizes wave impact stress.',
        confidenceScore: 78,
        impact: 'Reduces risk of cargo loss and hull damage.'
      })
    }

    if (ship.status === 'DISTRESSED') {
      recs.push({
        id: `rec-${ship.id}-escort`,
        shipId: ship.id,
        type: 'REQUEST_ESCORT',
        rationale: 'Vessel has broadcasted a distress signal. Immediate escort/tug assistance required.',
        confidenceScore: 99,
        impact: 'Secures vessel safety and prevents total loss.'
      })
    }

    return recs
  }

  // Generates fleet-wide recommendations (top 5 most critical)
  getFleetRecommendations(ships: EngineShip[]): FleetRecommendation[] {
    const allRecs = ships.flatMap(s => this.generateRecommendations(s))
    // Sort by confidence/criticality
    return allRecs.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 5)
  }
}

export const aiFleetAdvisor = new AIFleetAdvisor()
