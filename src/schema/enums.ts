export const DISASTER_TYPES = ['fire', 'earthquake'] as const
export type DisasterType = (typeof DISASTER_TYPES)[number]

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]

export const SIMULATION_STATUSES = ['pending', 'running', 'completed', 'stopped'] as const
export type SimulationStatus = (typeof SIMULATION_STATUSES)[number]
