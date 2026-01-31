import axios from 'axios'
import {
  getPrometheusApiBasePath,
  getAlertmanagerApiBasePath,
  getPrometheusMaxRetries,
  getPrometheusRetryBaseDelay,
  getCurrentServiceConfig
} from '../utils/config'

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = null, baseDelay = null) {
  const finalMaxRetries = maxRetries ?? getPrometheusMaxRetries()
  const finalBaseDelay = baseDelay ?? getPrometheusRetryBaseDelay()

  for (let i = 0; i < finalMaxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      const isTooManyRequests = error.response?.status === 429
      const isServerError = error.response?.status >= 500

      if ((isTooManyRequests || isServerError) && i < finalMaxRetries - 1) {
        const delay = finalBaseDelay * Math.pow(2, i)
        console.log(`[Prometheus] Request failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
}

/**
 * Get all active alerts from Prometheus
 * @returns {Promise<Array>} Array of alert objects
 */
export async function getAlerts() {
  const apiBasePath = getPrometheusApiBasePath()

  const requestFn = async () => {
    const response = await axios.get(`${apiBasePath}/alerts`)
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)

    if (response.data?.status === 'success') {
      return response.data.data?.alerts || []
    } else {
      console.error('[Prometheus] Invalid response format:', response.data)
      return []
    }
  } catch (error) {
    console.error('[Prometheus] Failed to fetch alerts:', error)
    throw error
  }
}

/**
 * Get values for a specific label
 * @param {string} labelName - Label name to query
 * @param {Object} matchers - Optional label matchers to filter results
 * @returns {Promise<Array<string>>} Array of label values
 */
export async function getLabelValues(labelName, matchers = {}) {
  const apiBasePath = getPrometheusApiBasePath()

  const requestFn = async () => {
    const params = {}

    // Add label matchers if provided
    if (Object.keys(matchers).length > 0) {
      const matcherStrings = Object.entries(matchers).map(
        ([key, value]) => `${key}="${value}"`
      )
      params['match[]'] = `{${matcherStrings.join(',')}}`
    }

    const response = await axios.get(
      `${apiBasePath}/label/${labelName}/values`,
      { params }
    )
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)

    if (response.data?.status === 'success') {
      return response.data.data || []
    } else {
      console.error('[Prometheus] Invalid response format:', response.data)
      return []
    }
  } catch (error) {
    console.error(`[Prometheus] Failed to fetch label values for ${labelName}:`, error)
    throw error
  }
}

/**
 * Query Prometheus for instant vector
 * @param {string} query - PromQL query
 * @param {number} time - Evaluation timestamp (optional)
 * @returns {Promise<Object>} Query result
 */
export async function queryInstant(query, time = null) {
  const apiBasePath = getPrometheusApiBasePath()

  const requestFn = async () => {
    const params = { query }
    if (time) {
      params.time = time
    }

    const response = await axios.get(`${apiBasePath}/query`, { params })
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)

    if (response.data?.status === 'success') {
      return response.data.data
    } else {
      console.error('[Prometheus] Invalid response format:', response.data)
      return null
    }
  } catch (error) {
    console.error('[Prometheus] Failed to execute query:', error)
    throw error
  }
}

/**
 * Get silences from Alertmanager (reserved for future use)
 * @returns {Promise<Array>} Array of silence objects
 */
export async function getSilences() {
  const apiBasePath = getAlertmanagerApiBasePath()

  const requestFn = async () => {
    const response = await axios.get(`${apiBasePath}/silences`)
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)
    return response.data || []
  } catch (error) {
    console.error('[Alertmanager] Failed to fetch silences:', error)
    throw error
  }
}

/**
 * Build alert matchers from fixed labels and dynamic filters
 * @param {Object} fixedLabels - Fixed labels from config
 * @param {Object} filters - Dynamic filters (e.g., { job: 'api-server' })
 * @returns {Object} Combined matchers
 */
export function buildAlertMatchers(fixedLabels = {}, filters = {}) {
  return { ...fixedLabels, ...filters }
}

/**
 * Filter alerts by label matchers
 * @param {Array} alerts - Array of alert objects
 * @param {Object} matchers - Label matchers
 * @returns {Array} Filtered alerts
 */
export function filterAlerts(alerts, matchers = {}) {
  if (!matchers || Object.keys(matchers).length === 0) {
    return alerts
  }

  return alerts.filter(alert => {
    return Object.entries(matchers).every(([key, value]) => {
      return alert.labels?.[key] === value
    })
  })
}

/**
 * Group alerts by label value
 * @param {Array} alerts - Array of alert objects
 * @param {string} labelName - Label name to group by
 * @returns {Map<string, Array>} Map of label value to alerts
 */
export function groupAlertsByLabel(alerts, labelName) {
  const groups = new Map()

  alerts.forEach(alert => {
    const labelValue = alert.labels?.[labelName] || 'unknown'
    if (!groups.has(labelValue)) {
      groups.set(labelValue, [])
    }
    groups.get(labelValue).push(alert)
  })

  return groups
}

/**
 * Get alert state color (for UI display)
 * @param {string} state - Alert state ('firing', 'pending', 'inactive')
 * @returns {string} Color name or hex code
 */
export function getAlertStateColor(state) {
  const colorMap = {
    'firing': '#f56c6c',    // Red (critical)
    'pending': '#e6a23c',   // Yellow (warning)
    'inactive': '#67c23a'   // Green (normal)
  }
  return colorMap[state] || '#909399' // Gray (unknown)
}

/**
 * Get alert state display name
 * @param {string} state - Alert state
 * @returns {string} Display name
 */
export function getAlertStateDisplayName(state) {
  const nameMap = {
    'firing': '告警中',
    'pending': '待触发',
    'inactive': '正常'
  }
  return nameMap[state] || '未知'
}
