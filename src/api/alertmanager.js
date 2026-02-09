import axios from 'axios'
import { MutationObserver } from '@tanstack/query-core'
import {
  getAlertmanagerApiBasePath,
  getPrometheusMaxRetries,
  getPrometheusRetryBaseDelay
} from '../utils/config'
import { queryClient } from '../queryClient'
import { createRetryOptions, getHttpStatus } from '../utils/queryRetry'

function getAlertmanagerRetryOptions() {
  const maxAttempts = getPrometheusMaxRetries()
  const baseDelay = getPrometheusRetryBaseDelay()
  return createRetryOptions({
    maxAttempts,
    baseDelay,
    maxDelay: 30_000,
    shouldRetry: (error) => {
      const status = getHttpStatus(error)
      return status === 429 || (status != null && status >= 500)
    },
    logPrefix: '[Alertmanager] Request failed,'
  })
}

async function runAlertmanagerMutation({ mutationKey, mutationFn, variables }) {
  const observer = new MutationObserver(queryClient, {
    mutationKey,
    mutationFn,
    ...getAlertmanagerRetryOptions()
  })
  return observer.mutate(variables)
}

/**
 * Get silences from Alertmanager
 * @returns {Promise<Array>} Array of silence objects
 */
export async function getAlertmanagerSilences() {
  const apiBasePath = getAlertmanagerApiBasePath()

  try {
    return await queryClient.fetchQuery({
      queryKey: ['alertmanager', 'silences', apiBasePath],
      queryFn: async () => {
        const response = await axios.get(`${apiBasePath}/silences`)
        return response.data || []
      },
      staleTime: 0,
      gcTime: 60_000,
      ...getAlertmanagerRetryOptions()
    })
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

  try {
    const data = await runAlertmanagerMutation({
      mutationKey: ['alertmanager', 'silence', 'delete', apiBasePath, silenceId],
      mutationFn: async (id) => {
        const response = await axios.delete(`${apiBasePath}/silence/${id}`)
        return response.data
      },
      variables: silenceId
    })

    await queryClient.invalidateQueries({ queryKey: ['alertmanager', 'silences', apiBasePath] })
    await queryClient.invalidateQueries({ queryKey: ['alertmanager', 'alerts', apiBasePath] })
    return data
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

  try {
    return await queryClient.fetchQuery({
      queryKey: ['alertmanager', 'alerts', apiBasePath],
      queryFn: async () => {
        const response = await axios.get(`${apiBasePath}/alerts`)
        const data = response.data

        if (Array.isArray(data)) return data
        if (Array.isArray(data?.data)) return data.data

        console.error('[Alertmanager] Invalid response format:', data)
        return []
      },
      staleTime: 0,
      gcTime: 30_000,
      ...getAlertmanagerRetryOptions()
    })
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

  try {
    const data = await runAlertmanagerMutation({
      mutationKey: ['alertmanager', 'silences', 'create', apiBasePath],
      mutationFn: async (vars) => {
        const response = await axios.post(`${apiBasePath}/silences`, vars)
        return response.data
      },
      variables: payload
    })

    await queryClient.invalidateQueries({ queryKey: ['alertmanager', 'silences', apiBasePath] })
    return data
  } catch (error) {
    console.error('[Alertmanager] Failed to create silence:', error)
    throw error
  }
}

// Backward-compatible alias
export const getSilences = getAlertmanagerSilences
