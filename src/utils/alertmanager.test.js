import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractAlertmanagerReceivers,
  filterAlertmanagerAlertsByReceivers,
  buildAlertmanagerMatchKey,
  applyAlertmanagerReceiverMapping,
  resolveAlertmanagerState,
  isAlertmanagerSilenceActive,
  getRemainingDurationMs,
  formatRemainingDurationCompact,
  doesAlertmanagerSilenceMatchLabels,
  doesAlertmanagerSilenceMatchAlert
} from './alertmanager.js'

describe('alertmanager utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('extracts receivers from array and single receiver', () => {
    expect(
      extractAlertmanagerReceivers({
        receivers: [{ name: 'team-a' }, 'team-b', { name: '  team-c  ' }, null, ''
        ]
      })
    ).toEqual(['team-a', 'team-b', 'team-c'])

    expect(extractAlertmanagerReceivers({ receiver: '  primary ' })).toEqual(['primary'])
    expect(extractAlertmanagerReceivers({ receiver: '' })).toEqual([])
  })

  it('filters alerts by receivers', () => {
    const alerts = [
      { receivers: [{ name: 'team-a' }] },
      { receivers: ['team-b'] },
      { receivers: [{ name: 'team-c' }] }
    ]

    const filtered = filterAlertmanagerAlertsByReceivers(alerts, ['team-b', 'team-c'])
    const names = filtered.flatMap(alert => extractAlertmanagerReceivers(alert))
    expect(filtered).toHaveLength(2)
    expect(names.sort()).toEqual(['team-b', 'team-c'])
  })

  it('builds match key from labels or fingerprint', () => {
    const key = buildAlertmanagerMatchKey({
      labels: {
        b: '2',
        a: '1',
        __internal__: 'x',
        name: 'ignored'
      }
    })

    expect(key).toBe('a=1|b=2')

    const fingerprintKey = buildAlertmanagerMatchKey({
      labels: {},
      fingerprint: 'fp-123'
    })

    expect(fingerprintKey).toBe('fingerprint:fp-123')
  })

  it('applies receiver mapping to vmalert alerts', () => {
    const vmalertAlerts = [
      { labels: { job: 'api', instance: 'n1' } },
      { labels: { job: 'db', instance: 'n2' } }
    ]

    const receiverAlerts = [
      { labels: { job: 'api', instance: 'n1' }, receivers: ['team-a'] },
      { labels: { job: 'api', instance: 'n1' }, receivers: ['team-b'] }
    ]

    applyAlertmanagerReceiverMapping(vmalertAlerts, receiverAlerts)

    expect(vmalertAlerts[0].alertmanagerMatched).toBe(true)
    expect(vmalertAlerts[0].alertmanagerReceivers.sort()).toEqual(['team-a', 'team-b'])
    expect(vmalertAlerts[1].alertmanagerMatched).toBe(false)
    expect(vmalertAlerts[1].alertmanagerReceivers).toEqual([])
  })

  it('resolves alertmanager state', () => {
    expect(resolveAlertmanagerState({ state: 'firing' })).toBe('firing')
    expect(resolveAlertmanagerState({ status: { state: 'pending' } })).toBe('pending')
    expect(resolveAlertmanagerState({})).toBe('inactive')
  })

  it('checks silence active state', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    expect(isAlertmanagerSilenceActive({ status: { state: 'expired' } })).toBe(false)
    expect(isAlertmanagerSilenceActive({ endsAt: '2024-12-31T23:59:59Z' })).toBe(false)
    expect(isAlertmanagerSilenceActive({ status: { state: 'pending' } })).toBe(true)
  })

  it('formats remaining duration', () => {
    expect(getRemainingDurationMs('2025-01-01T00:00:10Z', Date.parse('2025-01-01T00:00:00Z')))
      .toBe(10_000)
    expect(formatRemainingDurationCompact(65 * 60 * 1000)).toBe('1h5m')
    expect(formatRemainingDurationCompact(2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)).toBe('2d1h')
    expect(formatRemainingDurationCompact(30 * 1000)).toBe('1m')
  })

  it('matches silences against labels and alerts', () => {
    const silence = {
      matchers: [
        { name: 'job', value: 'api' },
        { name: 'instance', value: 'n-\\d+', isRegex: true }
      ]
    }

    expect(doesAlertmanagerSilenceMatchLabels(silence, { job: 'api', instance: 'n-1' })).toBe(true)
    expect(doesAlertmanagerSilenceMatchLabels(silence, { job: 'api', instance: 'x-1' })).toBe(false)
    expect(doesAlertmanagerSilenceMatchAlert(silence, { labels: { job: 'api', instance: 'n-2' } })).toBe(true)

    const badRegex = { matchers: [{ name: 'job', value: '(', isRegex: true }] }
    expect(doesAlertmanagerSilenceMatchLabels(badRegex, { job: 'api' })).toBe(false)
  })
})