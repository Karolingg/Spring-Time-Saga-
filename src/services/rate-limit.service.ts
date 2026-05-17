const RATE_LIMIT_MESSAGE_PREFIX = 'Rate limit reached'

export class RateLimitError extends Error {
  constructor(message = 'Rate limit reached: wait before trying again.') {
    super(message)
    this.name = 'RateLimitError'
  }
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true
  if (!(error instanceof Error)) return false
  return error.message.includes(RATE_LIMIT_MESSAGE_PREFIX)
}

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (isRateLimitError(error) && error instanceof Error) return error.message
  return fallback
}
