/**
 * Loki Viewer Runtime Configuration
 *
 * This file can be modified after build without recompiling.
 * It will be served as a static file from the public directory.
 */
window.APP_CONFIG = {
  // Page title (optional, leave empty to use default "Loki Log Viewer")
  pageTitle: '',

  // Application name shown in navbar (optional, leave empty to hide)
  appName: '',

  // Service to monitor (corresponds to Loki label: service="xxx")
  service: 'Batch-Sync',

  // Default log level filter (empty string = show all)
  defaultLogLevel: '',

  // Logs per page
  logsPerPage: 500,

  // Loki API configuration
  loki: {
    // API base path (default: '/loki/api/v1')
    apiBasePath: '/loki/api/v1',

    // WebSocket settings (optional, leave empty for auto-detection)
    wsProtocol: '',  // 'ws' or 'wss', auto-detect if empty
    wsHost: ''       // hostname:port, use window.location.host if empty
  },

  // Routing configuration
  routing: {
    basePath: '/logs'  // Base path for task routes (e.g., /logs/:taskName)
  },

  // Virtual scroll settings
  virtualScroll: {
    estimatedItemHeight: 60,
    bufferSize: 10,
    loadMoreThreshold: 0.2  // Load more when scrolled to 20% from bottom
  },

  // WebSocket settings
  websocket: {
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,
    initializationDelay: 2000  // Delay before monitoring starts (milliseconds)
  },

  // Alert settings
  alert: {
    newLogHighlightDuration: 3000  // milliseconds
  }
}
