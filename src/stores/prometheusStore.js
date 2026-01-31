import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAlerts,
  getLabelValues,
  filterAlerts,
  groupAlertsByLabel
} from '../api/prometheus'
import {
  getPrometheusTaskLabel,
  getPrometheusFixedLabels,
  getPrometheusPollingInterval,
  getPrometheusColumns,
  isDeadManSwitchEnabled,
  getDeadManSwitchAlertName
} from '../utils/config'
import { useServiceStore } from './serviceStore'
import { useAlertStore } from './alertStore'

const STORAGE_KEY_PREFIX = 'dashboard-watched-prometheus-tasks'

export const usePrometheusStore = defineStore('prometheus', () => {
  // State
  const alerts = ref([])
  const tasks = ref([])
  const watchedTasks = ref(new Set())
  const selectedTask = ref(null)
  const loading = ref(false)
  const polling = ref(false)
  const pollingCountdown = ref(0)
  const deadManSwitchOk = ref(true) // DeadManSwitch status

  // Polling timer
  let pollingTimer = null
  let countdownTimer = null

  // Get storage key for current service
  function getStorageKey() {
    const serviceStore = useServiceStore()
    const serviceId = serviceStore.getCurrentServiceId()
    return `${STORAGE_KEY_PREFIX}-${serviceId}`
  }

  // Check if alert is DeadManSwitch alert
  function isDeadManSwitchAlert(alert) {
    if (!isDeadManSwitchEnabled()) return false
    const deadManSwitchName = getDeadManSwitchAlertName()
    return alert.labels?.alertname === deadManSwitchName
  }

  // Load watched tasks from localStorage
  function loadWatchedTasks() {
    try {
      const saved = localStorage.getItem(getStorageKey())
      if (saved) {
        watchedTasks.value = new Set(JSON.parse(saved))
      } else {
        watchedTasks.value = new Set()
      }
    } catch (e) {
      console.error('[PrometheusStore] Error loading watched tasks:', e)
    }
  }

  // Save watched tasks to localStorage
  function saveWatchedTasks() {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify([...watchedTasks.value]))
    } catch (e) {
      console.error('[PrometheusStore] Error saving watched tasks:', e)
    }
  }

  // Computed: Filtered tasks (watched tasks first, then others)
  const sortedTasks = computed(() => {
    return [...tasks.value].sort((a, b) => {
      if (a.watched && !b.watched) return -1
      if (!a.watched && b.watched) return 1
      return a.name.localeCompare(b.name)
    })
  })

  // Computed: Alerts for selected task
  const selectedTaskAlerts = computed(() => {
    if (!selectedTask.value) {
      return alerts.value
    }

    const taskLabel = getPrometheusTaskLabel()
    return filterAlerts(alerts.value, { [taskLabel]: selectedTask.value })
  })

  // Computed: Alert counts by state (excluding DeadManSwitch)
  const alertCounts = computed(() => {
    // Filter out DeadManSwitch alerts
    const regularAlerts = alerts.value.filter(alert => !isDeadManSwitchAlert(alert))

    const counts = {
      firing: 0,
      pending: 0,
      inactive: 0,
      total: regularAlerts.length
    }

    regularAlerts.forEach(alert => {
      const state = alert.state || 'inactive'
      if (state in counts) {
        counts[state]++
      }
    })

    return counts
  })

  // Initialize store
  async function initialize() {
    loadWatchedTasks()
    await fetchTasks()
    await fetchAlerts()
    startPolling()
  }

  // Fetch available tasks from label values
  async function fetchTasks() {
    loading.value = true
    try {
      const taskLabel = getPrometheusTaskLabel()
      const fixedLabels = getPrometheusFixedLabels()

      const taskNames = await getLabelValues(taskLabel, fixedLabels)

      // Merge with watched tasks
      const allTaskNames = new Set([...taskNames, ...watchedTasks.value])

      tasks.value = Array.from(allTaskNames).map(name => ({
        name,
        watched: watchedTasks.value.has(name),
        existsInPrometheus: taskNames.includes(name)
      }))

      console.log(`[PrometheusStore] Fetched ${tasks.value.length} tasks`)
    } catch (e) {
      console.error('[PrometheusStore] Error fetching tasks:', e)
      ElMessage.error('获取任务列表失败')
    } finally {
      loading.value = false
    }
  }

  // Fetch alerts
  async function fetchAlerts() {
    try {
      const allAlerts = await getAlerts()
      const fixedLabels = getPrometheusFixedLabels()

      // Filter by fixed labels
      alerts.value = filterAlerts(allAlerts, fixedLabels)

      console.log(`[PrometheusStore] Fetched ${alerts.value.length} alerts`)

      // Check DeadManSwitch first
      checkDeadManSwitch()

      // Trigger alert if there are firing alerts (excluding DeadManSwitch)
      checkForFiringAlerts()
    } catch (e) {
      console.error('[PrometheusStore] Error fetching alerts:', e)
      ElMessage.error('获取告警列表失败')
    }
  }

  // Check for firing alerts and trigger alert overlay (excluding DeadManSwitch)
  function checkForFiringAlerts() {
    const alertStore = useAlertStore()
    // Filter out DeadManSwitch alerts
    const firingAlerts = alerts.value.filter(alert =>
      alert.state === 'firing' && !isDeadManSwitchAlert(alert)
    )

    if (firingAlerts.length > 0) {
      const reasons = firingAlerts.map(alert => {
        const alertname = alert.labels?.alertname || 'Unknown'
        const instance = alert.labels?.instance || ''
        return instance ? `${alertname} (${instance})` : alertname
      })

      // Trigger alert with all firing alert names
      reasons.forEach(reason => {
        alertStore.triggerAlert(reason)
      })
    }
  }

  // Check DeadManSwitch status
  function checkDeadManSwitch() {
    if (!isDeadManSwitchEnabled()) {
      deadManSwitchOk.value = true
      return
    }

    const deadManSwitchName = getDeadManSwitchAlertName()
    const deadManSwitchAlert = alerts.value.find(alert =>
      alert.labels?.alertname === deadManSwitchName
    )

    const wasOk = deadManSwitchOk.value

    if (!deadManSwitchAlert || deadManSwitchAlert.state !== 'firing') {
      // DeadManSwitch is missing or not firing - CRITICAL!
      deadManSwitchOk.value = false

      // Trigger critical alert if this is a new failure
      if (wasOk) {
        const alertStore = useAlertStore()
        alertStore.triggerAlert('⚠️ 监控系统异常: 监控链路告警丢失!')
        console.error('[PrometheusStore] CRITICAL: DeadManSwitch alert is missing or not firing!')
      }
    } else {
      // DeadManSwitch is working normally
      deadManSwitchOk.value = true
      if (!wasOk) {
        console.log('[PrometheusStore] DeadManSwitch is back to normal')
      }
    }
  }

  // Start polling
  function startPolling() {
    if (polling.value) return

    polling.value = true
    const interval = getPrometheusPollingInterval()

    console.log(`[PrometheusStore] Starting polling (interval: ${interval}ms)`)

    // Reset countdown
    pollingCountdown.value = Math.floor(interval / 1000)

    // Start countdown timer
    countdownTimer = setInterval(() => {
      if (pollingCountdown.value > 0) {
        pollingCountdown.value--
      }
    }, 1000)

    // Poll immediately
    pollOnce()

    // Start polling timer
    pollingTimer = setInterval(async () => {
      await pollOnce()
      pollingCountdown.value = Math.floor(interval / 1000)
    }, interval)
  }

  // Stop polling
  function stopPolling() {
    if (!polling.value) return

    polling.value = false

    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }

    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }

    pollingCountdown.value = 0
    console.log('[PrometheusStore] Polling stopped')
  }

  // Poll once
  async function pollOnce() {
    try {
      await fetchAlerts()
    } catch (e) {
      console.error('[PrometheusStore] Error during poll:', e)
    }
  }

  // Refresh (fetch tasks and alerts)
  async function refresh() {
    await fetchTasks()
    await fetchAlerts()
  }

  // Toggle task watch status
  function toggleTaskWatch(taskName) {
    if (watchedTasks.value.has(taskName)) {
      watchedTasks.value.delete(taskName)
    } else {
      watchedTasks.value.add(taskName)
    }

    // Update tasks array
    const task = tasks.value.find(t => t.name === taskName)
    if (task) {
      task.watched = watchedTasks.value.has(taskName)
    }

    saveWatchedTasks()
  }

  // Select task
  function selectTask(taskName) {
    selectedTask.value = taskName
  }

  // Clear tasks (called when switching services)
  function clearTasks() {
    tasks.value = []
    selectedTask.value = null
  }

  // Build hierarchical alert structure for display
  function buildAlertHierarchy() {
    const columns = getPrometheusColumns()
    const taskAlerts = selectedTaskAlerts.value

    // If no columns configured, return flat structure
    if (!columns || columns.length === 0) {
      return buildFlatStructure(taskAlerts)
    }

    // Build hierarchical structure based on column config
    return buildHierarchicalStructure(taskAlerts, columns)
  }

  // Build flat structure (no columns)
  function buildFlatStructure(alerts) {
    return [{
      type: 'flat',
      alerts: alerts
    }]
  }

  // Build hierarchical structure (with columns)
  function buildHierarchicalStructure(alerts, columns) {
    const result = []

    // Process each column configuration
    columns.forEach(columnConfig => {
      const columnLabel = columnConfig.label
      const gridConfig = columnConfig.grids
      const itemConfig = gridConfig?.items

      // Group alerts by column label
      const columnGroups = groupAlertsByLabel(alerts, columnLabel)

      columnGroups.forEach((columnAlerts, columnValue) => {
        const column = {
          type: 'column',
          label: columnLabel,
          value: columnValue,
          grids: []
        }

        if (gridConfig && gridConfig.label) {
          // Group by grid label
          const gridGroups = groupAlertsByLabel(columnAlerts, gridConfig.label)

          gridGroups.forEach((gridAlerts, gridValue) => {
            const grid = {
              type: 'grid',
              label: gridConfig.label,
              value: gridValue,
              items: []
            }

            if (itemConfig && itemConfig.label) {
              // Group by item label
              const itemGroups = groupAlertsByLabel(gridAlerts, itemConfig.label)

              itemGroups.forEach((itemAlerts, itemValue) => {
                grid.items.push({
                  type: 'item',
                  label: itemConfig.label,
                  value: itemValue,
                  alerts: itemAlerts,
                  state: getAggregatedState(itemAlerts)
                })
              })
            } else {
              // No item config, treat each alert as an item
              gridAlerts.forEach(alert => {
                grid.items.push({
                  type: 'item',
                  alerts: [alert],
                  state: alert.state
                })
              })
            }

            column.grids.push(grid)
          })
        } else {
          // No grid config, treat column alerts as single grid
          column.grids.push({
            type: 'grid',
            alerts: columnAlerts,
            items: columnAlerts.map(alert => ({
              type: 'item',
              alerts: [alert],
              state: alert.state
            }))
          })
        }

        result.push(column)
      })
    })

    return result
  }

  // Get aggregated state from multiple alerts (worst state wins)
  function getAggregatedState(alerts) {
    const statePriority = { firing: 3, pending: 2, inactive: 1 }
    let worstState = 'inactive'
    let worstPriority = 0

    alerts.forEach(alert => {
      const state = alert.state || 'inactive'
      const priority = statePriority[state] || 0
      if (priority > worstPriority) {
        worstState = state
        worstPriority = priority
      }
    })

    return worstState
  }

  // Cleanup (called when store is destroyed)
  function cleanup() {
    stopPolling()
    clearTasks()
  }

  return {
    // State
    alerts,
    tasks,
    watchedTasks,
    selectedTask,
    loading,
    polling,
    pollingCountdown,
    deadManSwitchOk,

    // Computed
    sortedTasks,
    selectedTaskAlerts,
    alertCounts,

    // Actions
    initialize,
    fetchTasks,
    fetchAlerts,
    refresh,
    startPolling,
    stopPolling,
    pollOnce,
    toggleTaskWatch,
    selectTask,
    clearTasks,
    buildAlertHierarchy,
    cleanup
  }
})
