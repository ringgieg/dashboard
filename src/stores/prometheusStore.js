import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getAlerts, filterAlerts, groupAlertsByLabel } from '../api/prometheus'
import { getAlertmanagerAlerts, getAlertmanagerSilences } from '../api/alertmanager'
import {
  getPrometheusTaskLabel,
  getPrometheusFixedLabels,
  getPrometheusPollingInterval,
  getPrometheusColumns,
  isDeadManSwitchEnabled,
  getDeadManSwitchAlertName,
  getAlertmanagerReceivers
} from '../utils/config'
import {
  applyAlertmanagerReceiverMapping,
  filterAlertmanagerAlertsByReceivers,
  resolveAlertmanagerState
} from '../utils/alertmanager'
import { useServiceStore } from './serviceStore'
import { useAlertStore } from './alertStore'

const STORAGE_KEY_PREFIX = 'dashboard-watched-prometheus-tasks'

export const usePrometheusStore = defineStore('prometheus', () => {
  // State
  const alerts = ref([])
  const alertmanagerAlerts = ref([])
  const alertmanagerReceiverAlerts = ref([])
  const alertmanagerSilences = ref([])
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

    await fetchAlerts({ showLoading: true })
    updateTasksFromAlerts()
    startPolling()
  }

  // Update tasks from alerts (extract unique task label values from alerts)
  function updateTasksFromAlerts() {
    try {
      const taskLabel = getPrometheusTaskLabel()

      // Extract unique task names from alerts
      const taskNamesFromAlerts = new Set()
      alerts.value.forEach(alert => {
        const taskName = alert.labels?.[taskLabel]
        if (taskName) {
          taskNamesFromAlerts.add(taskName)
        }
      })

      // Merge with watched tasks
      const allTaskNames = new Set([...taskNamesFromAlerts, ...watchedTasks.value])

      tasks.value = Array.from(allTaskNames).map(name => ({
        name,
        watched: watchedTasks.value.has(name),
        existsInPrometheus: taskNamesFromAlerts.has(name)
      }))

      console.log(`[PrometheusStore] Updated ${tasks.value.length} tasks from ${alerts.value.length} alerts`)
    } catch (e) {
      console.error('[PrometheusStore] Error updating tasks:', e)
    }
  }

  async function refreshAlertmanagerSilences(receiverNames = null) {
    const names = Array.isArray(receiverNames) ? receiverNames : getAlertmanagerReceivers()
    if (!names || names.length === 0) {
      alertmanagerSilences.value = []
      return []
    }

    try {
      const response = await getAlertmanagerSilences()
      const silences = Array.isArray(response)
        ? response
        : (Array.isArray(response?.data) ? response.data : [])
      alertmanagerSilences.value = silences
      return silences
    } catch (error) {
      console.warn('[PrometheusStore] Alertmanager silences fetch failed:', error)
      alertmanagerSilences.value = []
      return []
    }
  }

  // Fetch alerts
  async function fetchAlerts(options = {}) {
    const { showLoading = false } = options
    if (showLoading) {
      loading.value = true
    }
    try {
      const receiverNames = getAlertmanagerReceivers()
      const alertmanagerPromise = receiverNames.length > 0
        ? getAlertmanagerAlerts().catch(error => {
          console.warn('[PrometheusStore] Alertmanager fetch failed:', error)
          return []
        })
        : Promise.resolve([])
      const silencesPromise = receiverNames.length > 0
        ? refreshAlertmanagerSilences(receiverNames)
        : Promise.resolve([])

      const allAlerts = await getAlerts()
      const fixedLabels = getPrometheusFixedLabels()

      // Filter by fixed labels
      alerts.value = filterAlerts(allAlerts, fixedLabels)

      const fetchedAlertmanagerAlerts = await alertmanagerPromise
      alertmanagerAlerts.value = fetchedAlertmanagerAlerts
      await silencesPromise
      const receiverAlerts = receiverNames.length > 0
        ? filterAlertmanagerAlertsByReceivers(fetchedAlertmanagerAlerts, receiverNames)
        : []
      alertmanagerReceiverAlerts.value = receiverAlerts

      // Map receiver alerts back to vmalert alerts for UI use
      applyAlertmanagerReceiverMapping(alerts.value, receiverAlerts)

      console.log(`[PrometheusStore] Fetched ${alerts.value.length} alerts`)

      // Update tasks from alerts
      updateTasksFromAlerts()

      // Check DeadManSwitch first
      checkDeadManSwitch()

      // Trigger alert if there are firing alerts (excluding DeadManSwitch)
      checkForFiringAlerts()
    } catch (e) {
      console.error('[PrometheusStore] Error fetching alerts:', e)
      ElMessage.error('获取告警列表失败')
    } finally {
      if (showLoading) {
        loading.value = false
      }
    }
  }

  // Check for firing alerts and trigger alert overlay (excluding DeadManSwitch)
  function checkForFiringAlerts() {
    const alertStore = useAlertStore()
    const receiverNames = getAlertmanagerReceivers()
    const useAlertmanager = receiverNames.length > 0

    // Only Alertmanager alerts are allowed to trigger global alert overlay
    if (!useAlertmanager) {
      return
    }

    const sourceAlerts = alertmanagerReceiverAlerts.value

    const firingAlerts = sourceAlerts.filter(alert => {
      if (isDeadManSwitchAlert(alert)) {
        return false
      }

      const state = resolveAlertmanagerState(alert)
      if (state !== 'active' && state !== 'firing') {
        return false
      }

      const fingerprint = alert.fingerprint || alert.labels?.fingerprint
      if (fingerprint && alertStore.isAlertmanagerFingerprintMuted(fingerprint)) {
        return false
      }

      return true
    })

    if (firingAlerts.length > 0) {
      const reasons = firingAlerts.map(alert => {
        const alertname = alert.labels?.alertname || alert.labels?.name || alert.name || 'Unknown'
        const instance = alert.labels?.instance || alert.labels?.job || ''
        const fingerprint = alert.fingerprint || alert.labels?.fingerprint
        if (fingerprint) {
          alertStore.addAlertFingerprint(fingerprint)
        }
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

  // Refresh (fetch alerts which will also update tasks)
  async function refresh() {
    await fetchAlerts({ showLoading: true })
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
  function buildAlertHierarchy(alerts = null) {
    const columns = getPrometheusColumns()
    const taskAlerts = alerts || selectedTaskAlerts.value

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

  // Get display value from annotation if configured
  function getDisplayValue(alerts, originalValue, annotationKey) {
    if (!annotationKey || !alerts || alerts.length === 0) {
      return originalValue
    }

    // Traverse alerts to find the first one with the annotation value
    for (const alert of alerts) {
      const annotationValue = alert.annotations?.[annotationKey]
      if (annotationValue) {
        return annotationValue
      }
    }

    return originalValue
  }

  // Build hierarchical structure (with columns)
  function buildHierarchicalStructure(alerts, columns) {
    const result = []
    const sortKeys = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })

    // Process each column configuration
    columns.forEach(columnConfig => {
      const columnLabel = columnConfig.label
      const columnLabelSource = columnConfig.labelSource || 'alertLabels'
      const columnDisplayAnnotation = columnConfig.displayNameAnnotation
      const gridConfig = columnConfig.grids
      const itemConfig = gridConfig?.items

      // Group alerts by column label with labelSource
      const columnGroups = groupAlertsByLabel(alerts, columnLabel, columnLabelSource)

      const sortedColumnEntries = Array.from(columnGroups.entries()).sort(([a], [b]) => sortKeys(a, b))

      sortedColumnEntries.forEach(([columnValue, columnAlerts]) => {
        const column = {
          type: 'column',
          label: columnLabel,
          value: columnValue,
          displayValue: getDisplayValue(columnAlerts, columnValue, columnDisplayAnnotation),
          grids: []
        }

        if (gridConfig && gridConfig.label) {
          // Group by grid label with labelSource
          const gridLabelSource = gridConfig.labelSource || 'alertLabels'
          const gridDisplayAnnotation = gridConfig.displayNameAnnotation
          const gridGroups = groupAlertsByLabel(columnAlerts, gridConfig.label, gridLabelSource)

          const sortedGridEntries = Array.from(gridGroups.entries()).sort(([a], [b]) => sortKeys(a, b))

          sortedGridEntries.forEach(([gridValue, gridAlerts]) => {
            const grid = {
              type: 'grid',
              label: gridConfig.label,
              value: gridValue,
              displayValue: getDisplayValue(gridAlerts, gridValue, gridDisplayAnnotation),
              state: getAggregatedState(gridAlerts) // Add aggregated state for grid
            }

            if (itemConfig && itemConfig.label) {
              // Has item config: Group by item label with labelSource
              const itemLabelSource = itemConfig.labelSource || 'alertLabels'
              const itemGroups = groupAlertsByLabel(gridAlerts, itemConfig.label, itemLabelSource)

              grid.items = []
              const sortedItemEntries = Array.from(itemGroups.entries()).sort(([a], [b]) => sortKeys(a, b))
              sortedItemEntries.forEach(([itemValue, itemAlerts]) => {
                grid.items.push({
                  type: 'item',
                  label: itemConfig.label,
                  value: itemValue,
                  alerts: itemAlerts,
                  state: getAggregatedState(itemAlerts)
                })
              })
            } else {
              // No item config: grid directly contains alerts (no item grouping)
              grid.alerts = gridAlerts
            }

            column.grids.push(grid)
          })
        } else {
          // No grid config, treat column alerts as single grid
          column.grids.push({
            type: 'grid',
            state: getAggregatedState(columnAlerts), // Add aggregated state for grid
            alerts: columnAlerts,
            items: columnAlerts.map(alert => {
              // Try to find a suitable value for display
              const itemValue = alert.labels?.instance ||
                               alert.labels?.job ||
                               alert.labels?.alertname ||
                               'unknown'

              return {
                type: 'item',
                value: itemValue,
                alerts: [alert],
                state: alert.state
              }
            })
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
    alertmanagerAlerts,
    alertmanagerReceiverAlerts,
    alertmanagerSilences,
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
    fetchAlerts,
    refresh,
    refreshAlertmanagerSilences,
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
