export const GOOGLE_SIGN_IN_COOLDOWN_MS = 5_000

export const RATE_LIMIT_ACTIONS = {
  simulationRunCreate: 'simulation_run:create',
  simulationRunDelete: 'simulation_run:delete',
  simulationRunResetAll: 'simulation_run:reset_all',
  profileUpdate: 'profile:update',
} as const
