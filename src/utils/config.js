/**
 * Runtime configuration utility
 * Provides type-safe access to window.APP_CONFIG with fallbacks
 */

const defaultConfig = {
  pageTitle: '',
  activeService: 'batch-sync',
  services: [
    {
      id: 'batch-sync',
      displayName: 'Batch-Sync Service',
      loki: {
        apiBasePath: '/loki/api/v1',
        wsProtocol: '',
        wsHost: '',
        fixedLabels: {
          job: 'tasks',
          service: 'Batch-Sync'
        },
        taskLabel: 'task_name'
      },
      defaultLogLevel: '',
      logsPerPage: 500,
      websocket: {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        initializationDelay: 2000
      },
      alert: {
        newLogHighlightDuration: 3000
      },
      query: {
        defaultTimeRangeDays: 7
      }
    },
    {
      id: 'data-service',
      displayName: 'Data Service',
      loki: {
        apiBasePath: '/loki/api/v1',
        wsProtocol: '',
        wsHost: '',
        fixedLabels: {
          job: 'api',
          service: 'Data-Service'
        },
        taskLabel: 'endpoint'
      },
      defaultLogLevel: 'WARN',
      logsPerPage: 1000,
      websocket: {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        initializationDelay: 2000
      },
      alert: {
        newLogHighlightDuration: 3000
      },
      query: {
        defaultTimeRangeDays: 7
      }
    }
  ],
  routing: {
    basePath: '/logs'
  },
  virtualScroll: {
    estimatedItemHeight: 60,
    bufferSize: 10,
    loadMoreThreshold: 0.2
  }
}

/**
 * Get configuration value with fallback
 * @param {string} path - Dot-separated path (e.g., 'websocket.reconnectDelay')
 * @param {*} fallback - Fallback value if path not found
 * @returns {*} Configuration value
 */
export function getConfig(path, fallback) {
  const config = window.APP_CONFIG || defaultConfig

  if (!path) return config

  const keys = path.split('.')
  let value = config

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return fallback !== undefined ? fallback : getDefaultValue(path)
    }
  }

  return value
}

/**
 * Get default value from default config
 */
function getDefaultValue(path) {
  const keys = path.split('.')
  let value = defaultConfig

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Current service ID getter (can be set by serviceStore for dynamic service switching)
 */
let currentServiceIdGetter = null

/**
 * Set the current service ID getter function
 * This allows serviceStore to control which service is currently active
 * @param {Function} getter - Function that returns current service ID
 */
export function setCurrentServiceIdGetter(getter) {
  currentServiceIdGetter = getter
}

/**
 * Get all services
 * @returns {Array} Array of service configurations
 */
export function getServices() {
  const config = window.APP_CONFIG || defaultConfig
  const services = config.services || []

  // Debug: log what we found
  if (services.length === 0 && window.APP_CONFIG) {
    console.error('[Config] getServices() found 0 services!')
    console.error('[Config] window.APP_CONFIG:', window.APP_CONFIG)
    console.error('[Config] window.APP_CONFIG.services:', window.APP_CONFIG.services)
    console.error('[Config] config.services:', config.services)
  }

  return services
}

/**
 * Get current active service ID
 * Uses dynamic getter if set (by serviceStore), otherwise reads from config
 * @returns {string} Active service ID
 */
export function getCurrentServiceId() {
  // Use dynamic getter if available (set by serviceStore)
  if (currentServiceIdGetter) {
    return currentServiceIdGetter()
  }

  const config = window.APP_CONFIG || defaultConfig
  const activeService = config.activeService

  // Validate activeService exists in services array
  const services = config.services || []
  if (activeService && services.some(s => s.id === activeService)) {
    return activeService
  }

  // Fallback to first service
  return services[0]?.id || 'batch-sync'
}

/**
 * Get service configuration by ID
 * @param {string} serviceId - Service ID
 * @returns {object|null} Service configuration or null if not found
 */
export function getServiceById(serviceId) {
  const services = getServices()
  return services.find(s => s.id === serviceId) || null
}

/**
 * Get configuration value for a specific service
 * Merges service-specific config with global config (service config takes precedence)
 * @param {string} serviceId - Service ID
 * @param {string} path - Dot-separated path (e.g., 'loki.fixedLabels.service')
 * @param {*} fallback - Fallback value if path not found
 * @returns {*} Configuration value
 */
export function getServiceConfig(serviceId, path, fallback) {
  const service = getServiceById(serviceId)
  if (!service) {
    return fallback !== undefined ? fallback : getDefaultValue(path)
  }

  // Try to get value from service-specific config first
  if (path) {
    const keys = path.split('.')
    let value = service

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        // Not found in service config, try global config
        return getConfig(path, fallback)
      }
    }

    return value
  }

  return service
}

/**
 * Get configuration value for current active service
 * @param {string} path - Dot-separated path
 * @param {*} fallback - Fallback value if path not found
 * @returns {*} Configuration value
 */
export function getCurrentServiceConfig(path, fallback) {
  const serviceId = getCurrentServiceId()
  return getServiceConfig(serviceId, path, fallback)
}
