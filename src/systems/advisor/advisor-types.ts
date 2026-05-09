export interface FleetRecommendation {
  id: string
  shipId: string
  type: 'REROUTE' | 'REDUCE_SPEED' | 'REQUEST_ESCORT' | 'DIVERT' | 'HOLD'
  rationale: string
  confidenceScore: number // 0-100
  impact: string
}
