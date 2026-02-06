/**
 * RuleQueryScheduler Test Suite (Vitest)
 */

import { describe, it } from 'vitest'
import { RuleQueryScheduler } from './RuleQueryScheduler.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createMockExecutor(initialBehavior = 'success') {
  const executionLog = []

  const executor = async (query) => {
    const behavior = executor.behavior || initialBehavior
    executionLog.push({ query, timestamp: Date.now() })

    if (behavior === 'success') {
      return {
        result: [
          {
            metric: { instance: 'test-instance', job: 'test-job' },
            value: [Date.now() / 1000, '42']
          }
        ]
      }
    }

    if (behavior === 'fail') {
      throw new Error('Query execution failed')
    }

    if (behavior === 'mixed') {
      if (executionLog.length === 1) {
        throw new Error('First execution failed')
      }
      return {
        result: [
          {
            metric: { instance: 'test-instance', job: 'test-job' },
            value: [Date.now() / 1000, '100']
          }
        ]
      }
    }

    throw new Error(`Unknown behavior: ${behavior}`)
  }

  executor.getLog = () => executionLog
  executor.behavior = initialBehavior

  return executor
}

describe('RuleQueryScheduler', () => {
  it('parses intervals', async () => {
    const mockExecutor = createMockExecutor('success')
    const scheduler = new RuleQueryScheduler(mockExecutor)

    try {
      scheduler.addRule({ ruleId: 'rule-30s', query: 'up', interval: '30s' })
      scheduler.addRule({ ruleId: 'rule-1m', query: 'up', interval: '1m' })
      scheduler.addRule({ ruleId: 'rule-5m', query: 'up', interval: '5m' })
      scheduler.addRule({ ruleId: 'rule-invalid', query: 'up', interval: 'invalid' })

      const rule30s = scheduler.ruleMap.get('rule-30s')
      const rule1m = scheduler.ruleMap.get('rule-1m')
      const rule5m = scheduler.ruleMap.get('rule-5m')
      const ruleInvalid = scheduler.ruleMap.get('rule-invalid')

      assert(rule30s.intervalMs === 30 * 1000, 'Parses 30s correctly')
      assert(rule1m.intervalMs === 60 * 1000, 'Parses 1m correctly')
      assert(rule5m.intervalMs === 5 * 60 * 1000, 'Parses 5m correctly')
      assert(ruleInvalid.intervalMs === 30 * 1000, 'Invalid interval defaults to 30s')
    } finally {
      scheduler.stop()
    }
  })

  it('orders priority queue by next execution time', async () => {
    const mockExecutor = createMockExecutor('success')
    const scheduler = new RuleQueryScheduler(mockExecutor)

    try {
      const now = Date.now()
      scheduler.addRule({ ruleId: 'rule-late', query: 'up{job="late"}', interval: '5m' })
      scheduler.addRule({ ruleId: 'rule-early', query: 'up{job="early"}', interval: '30s' })
      scheduler.addRule({ ruleId: 'rule-mid', query: 'up{job="mid"}', interval: '2m' })

      scheduler.ruleMap.get('rule-late').nextExecutionTime = now + 300000
      scheduler.ruleMap.get('rule-early').nextExecutionTime = now + 30000
      scheduler.ruleMap.get('rule-mid').nextExecutionTime = now + 120000

      scheduler.queue = []
      scheduler.enqueue(scheduler.ruleMap.get('rule-late'))
      scheduler.enqueue(scheduler.ruleMap.get('rule-early'))
      scheduler.enqueue(scheduler.ruleMap.get('rule-mid'))

      assert(scheduler.queue[0].ruleId === 'rule-early', 'Queue sorted: earliest first')
      assert(scheduler.queue[1].ruleId === 'rule-mid', 'Queue sorted: middle second')
      assert(scheduler.queue[2].ruleId === 'rule-late', 'Queue sorted: latest last')
    } finally {
      scheduler.stop()
    }
  })

  it('executes rules on interval timing', async () => {
    const mockExecutor = createMockExecutor('success')
    const scheduler = new RuleQueryScheduler(mockExecutor)

    try {
      scheduler.addRule({ ruleId: 'rule-2s', query: 'up', interval: '2s' })
      scheduler.start()

      await sleep(1500)
      const log1 = mockExecutor.getLog()
      assert(log1.length >= 1, 'Rule executed immediately on start')

      await sleep(2500)
      const log2 = mockExecutor.getLog()
      assert(log2.length >= 2, 'Rule re-executed after interval')

      const timeDiff = log2[1].timestamp - log2[0].timestamp
      assert(timeDiff >= 2000 && timeDiff <= 3000, `Execution interval is ~2s (actual: ${timeDiff}ms)`)
    } finally {
      scheduler.stop()
    }
  }, 10000)

  it('preserves previous result after failure', async () => {
    const mockExecutor = createMockExecutor('mixed')
    const scheduler = new RuleQueryScheduler(mockExecutor)

    let latestResults = null
    scheduler.onResult((results) => {
      latestResults = results
    })

    try {
      scheduler.addRule({ ruleId: 'rule-failsafe', query: 'up', interval: '2s' })
      scheduler.start()

      await sleep(1500)
      const rule = scheduler.ruleMap.get('rule-failsafe')
      assert(rule.lastResult === null, 'No result after failed execution')

      await sleep(2500)
      assert(rule.lastResult !== null, 'Result stored after successful execution')
      const successResult = rule.lastResult

      mockExecutor.behavior = 'fail'

      await sleep(2500)
      assert(rule.lastResult === successResult, 'Previous result preserved after failure')
      assert(latestResults && latestResults.has('up'), 'Results map contains the query')
    } finally {
      scheduler.stop()
    }
  }, 15000)

  it('updates rules dynamically', async () => {
    const mockExecutor = createMockExecutor('success')
    const scheduler = new RuleQueryScheduler(mockExecutor)

    try {
      const alerts1 = [
        {
          labels: { alertname: 'Alert1' },
          rule: { name: 'Alert1', query: 'up{job="test1"}', duration: '30s' }
        },
        {
          labels: { alertname: 'Alert2' },
          rule: { name: 'Alert2', query: 'up{job="test2"}', duration: '1m' }
        }
      ]

      scheduler.updateRules(alerts1)
      assert(scheduler.ruleMap.size === 2, 'Added 2 rules from alerts')
      assert(scheduler.ruleMap.has('Alert1'), 'Alert1 rule exists')
      assert(scheduler.ruleMap.has('Alert2'), 'Alert2 rule exists')

      const alerts2 = [
        {
          labels: { alertname: 'Alert1' },
          rule: { name: 'Alert1', query: 'up{job="test1"}', duration: '2m' }
        },
        {
          labels: { alertname: 'Alert3' },
          rule: { name: 'Alert3', query: 'up{job="test3"}', duration: '5m' }
        }
      ]

      scheduler.updateRules(alerts2)
      assert(scheduler.ruleMap.size === 2, 'Updated to 2 rules')
      assert(scheduler.ruleMap.has('Alert1'), 'Alert1 still exists')
      assert(!scheduler.ruleMap.has('Alert2'), 'Alert2 removed')
      assert(scheduler.ruleMap.has('Alert3'), 'Alert3 added')
      assert(scheduler.ruleMap.get('Alert1').interval === '2m', 'Alert1 interval updated')
    } finally {
      scheduler.stop()
    }
  })

  it('returns scheduler stats', async () => {
    const mockExecutor = createMockExecutor('success')
    const scheduler = new RuleQueryScheduler(mockExecutor)

    try {
      scheduler.addRule({ ruleId: 'rule-1', query: 'up{job="test1"}', interval: '30s' })
      scheduler.addRule({ ruleId: 'rule-2', query: 'up{job="test2"}', interval: '1m' })

      scheduler.start()
      await sleep(500)

      const stats = scheduler.getStats()
      assert(stats.running === true, 'Stats show running status')
      assert(stats.totalRules === 2, 'Stats show total rules')
      assert(stats.queueSize === 2, 'Stats show queue size')
      assert(stats.nextExecution !== null, 'Stats show next execution')
      assert(stats.rules.length === 2, 'Stats include rule details')
    } finally {
      scheduler.stop()
    }
  }, 5000)
})
