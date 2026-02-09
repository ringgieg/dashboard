function tryParseRetryAfterSeconds(value) {
  const n = Number.parseInt(String(value), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function tryParseRetryAfterHttpDate(value) {
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : null
}

export function getRetryAfterMs(error) {
  const header = error?.response?.headers?.['retry-after'] ?? error?.response?.headers?.['Retry-After']
  if (!header) return null

  const seconds = tryParseRetryAfterSeconds(header)
  if (seconds != null) return seconds * 1000

  const dateMs = tryParseRetryAfterHttpDate(header)
  if (dateMs == null) return null

  const delta = dateMs - Date.now()
  return delta > 0 ? delta : 0
}

export function getHttpStatus(error) {
  const s = error?.response?.status
  return typeof s === 'number' ? s : null
}

export function createRetryOptions({
  maxAttempts,
  baseDelay,
  maxDelay = 30_000,
  shouldRetry,
  logPrefix
}) {
  const safeMaxAttempts = Number.isFinite(maxAttempts) ? Math.max(1, Math.floor(maxAttempts)) : 1
  const safeBaseDelay = Number.isFinite(baseDelay) ? Math.max(0, Math.floor(baseDelay)) : 0
  const safeMaxDelay = Number.isFinite(maxDelay) ? Math.max(0, Math.floor(maxDelay)) : 0

  // TanStack `retry` counts retries (not total attempts). Our config is typically total attempts.
  const maxRetries = Math.max(0, safeMaxAttempts - 1)

  return {
    retry: (failureCount, error) => {
      if (typeof shouldRetry === 'function' && !shouldRetry(error)) return false
      return failureCount < maxRetries
    },
    retryDelay: (attemptIndex, error) => {
      const retryAfter = getRetryAfterMs(error)
      if (retryAfter != null) {
        const capped = Math.min(retryAfter, safeMaxDelay || retryAfter)
        if (logPrefix) console.log(`${logPrefix} retry-after ${capped}ms`)
        return capped
      }

      const exp = safeBaseDelay * Math.pow(2, attemptIndex)
      const delay = Math.min(exp, safeMaxDelay || exp)
      if (logPrefix) console.log(`${logPrefix} retrying in ${delay}ms...`)
      return delay
    }
  }
}
