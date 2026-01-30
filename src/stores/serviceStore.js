/**
 * Service Store
 * Manages current active service in multi-service mode
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  getServices,
  getCurrentServiceId as getConfigServiceId,
  getServiceById,
  setCurrentServiceIdGetter
} from '../utils/config'

export const useServiceStore = defineStore('service', () => {
  // State
  const currentServiceId = ref(null)

  // Computed
  const services = computed(() => getServices())

  const currentService = computed(() => {
    const id = currentServiceId.value || getConfigServiceId()
    const service = getServiceById(id)

    if (!service) {
      console.error('[ServiceStore] Service not found for ID:', id)
      console.error('[ServiceStore] Available services:', getServices())
      console.error('[ServiceStore] window.APP_CONFIG:', window.APP_CONFIG)
    }

    return service
  })

  const currentServiceDisplayName = computed(() => {
    const service = currentService.value
    return service?.displayName || 'Unknown Service'
  })

  // Actions
  function initialize() {
    // Set initial service from config
    currentServiceId.value = getConfigServiceId()

    // Set getter for config utility to enable dynamic service switching
    setCurrentServiceIdGetter(() => getCurrentServiceId())

    // Debug: log initialization result
    const service = currentService.value
    if (service) {
      console.log(`[ServiceStore] Initialized: ${service.displayName} (${currentServiceId.value})`)
    } else {
      console.error('[ServiceStore] Initialization failed!')
      console.error('  - window.APP_CONFIG exists:', !!window.APP_CONFIG)
      console.error('  - Services found:', getServices().length)
      console.error('  - Current service ID:', currentServiceId.value)
    }
  }

  function setCurrentService(serviceId) {
    const service = getServiceById(serviceId)
    if (!service) {
      console.warn(`Service ${serviceId} not found`)
      return false
    }

    currentServiceId.value = serviceId
    console.log(`Switched to service: ${service.displayName} (${serviceId})`)
    return true
  }

  function getCurrentServiceId() {
    return currentServiceId.value || getConfigServiceId()
  }

  return {
    // State
    currentServiceId,

    // Computed
    services,
    currentService,
    currentServiceDisplayName,

    // Actions
    initialize,
    setCurrentService,
    getCurrentServiceId
  }
})
