import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getRetryAfterMs,
  getHttpStatus,
  createRetryOptions
} from './queryRetry.js'

describe('queryRetry utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses retry-after seconds', () => {
    const error = { response: { headers: { 'retry-after': '120' } } }
    expect(getRetryAfterMs(error)).toBe(120_000)
  })

  it('parses retry-after http date', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    const error = { response: { headers: { 'retry-after': 'Wed, 01 Jan 2025 00:00:10 GMT' } } }
    expect(getRetryAfterMs(error)).toBe(10_000)
  })

  it('returns 0 for past retry-after date', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:10Z'))
    const error = { response: { headers: { 'Retry-After': 'Wed, 01 Jan 2025 00:00:00 GMT' } } }
    expect(getRetryAfterMs(error)).toBe(0)
  })

  it('returns null for invalid retry-after', () => {
    const error = { response: { headers: { 'retry-after': 'not-a-date' } } }
    expect(getRetryAfterMs(error)).toBe(null)
  })

  it('returns http status when available', () => {
    expect(getHttpStatus({ response: { status: 503 } })).toBe(503)
    expect(getHttpStatus({ response: { status: '503' } })).toBe(null)
    expect(getHttpStatus({})).toBe(null)
  })

  it('computes retry decisions from maxAttempts', () => {
    const opts = createRetryOptions({ maxAttempts: 3, baseDelay: 1000 })
    expect(opts.retry(0, {})).toBe(true)
    expect(opts.retry(1, {})).toBe(true)
    expect(opts.retry(2, {})).toBe(false)
  })

  it('respects shouldRetry predicate', () => {
    const opts = createRetryOptions({
      maxAttempts: 3,
      baseDelay: 1000,
      shouldRetry: () => false
    })
    expect(opts.retry(0, {})).toBe(false)
  })

  it('uses retry-after header and caps by maxDelay', () => {
    const opts = createRetryOptions({ maxAttempts: 3, baseDelay: 1000, maxDelay: 1000 })
    const error = { response: { headers: { 'retry-after': '2' } } }
    expect(opts.retryDelay(0, error)).toBe(1000)
  })

  it('uses exponential backoff and caps by maxDelay', () => {
    const opts = createRetryOptions({ maxAttempts: 3, baseDelay: 1000, maxDelay: 3000 })
    expect(opts.retryDelay(0, {})).toBe(1000)
    expect(opts.retryDelay(2, {})).toBe(3000)
  })
})