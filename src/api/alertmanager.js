import axios from 'axios'
import {
  getAlertmanagerApiBasePath,
  getPrometheusMaxRetries,
  getPrometheusRetryBaseDelay
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
        console.log(`[Alertmanager] Request failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
}

/**
 * Get silences from Alertmanager
 * @returns {Promise<Array>} Array of silence objects
 */
export async function getAlertmanagerSilences() {
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
 * Delete a silence in Alertmanager
 * @param {string} silenceId - Silence ID
 * @returns {Promise<Object>} Delete response
 */
export async function deleteAlertmanagerSilence(silenceId) {
  const apiBasePath = getAlertmanagerApiBasePath()

  const requestFn = async () => {
    // Alertmanager v2 uses singular resource path for delete: /api/v2/silence/:id
    const response = await axios.delete(`${apiBasePath}/silence/${silenceId}`)
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)
    return response.data
  } catch (error) {
    console.error('[Alertmanager] Failed to delete silence:', error)
    throw error
  }
}

/**
 * Get active alerts from Alertmanager
 * @returns {Promise<Array>} Array of Alertmanager alert objects
 */
export async function getAlertmanagerAlerts() {
  const apiBasePath = getAlertmanagerApiBasePath()

  const requestFn = async () => {
    const response = await axios.get(`${apiBasePath}/alerts`)
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)
    const data = response.data

    if (Array.isArray(data)) {
      return data
    }

    if (Array.isArray(data?.data)) {
      return data.data
    }

    console.error('[Alertmanager] Invalid response format:', data)
    return []
  } catch (error) {
    console.error('[Alertmanager] Failed to fetch alerts:', error)
    throw error
  }
}

/**
 * Create a silence in Alertmanager
 * @param {Object} payload - Alertmanager silence payload
 * @returns {Promise<Object>} Created silence response
 */
export async function createAlertmanagerSilence(payload) {
  const apiBasePath = getAlertmanagerApiBasePath()

  const requestFn = async () => {
    const response = await axios.post(`${apiBasePath}/silences`, payload)
    return response
  }

  try {
    const response = await retryWithBackoff(requestFn)
    return response.data
  } catch (error) {
    console.error('[Alertmanager] Failed to create silence:', error)
    throw error
  }
}

// Backward-compatible alias
export const getSilences = getAlertmanagerSilences
