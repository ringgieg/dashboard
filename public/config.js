/**
 * Loki Viewer Runtime Configuration
 *
 * This file can be modified after build without recompiling.
 * It will be served as a static file from the public directory.
 */
window.APP_CONFIG = {
  // Page title (browser tab, optional, leave empty to use default "Loki Log Viewer")
  pageTitle: '',

  // Active service ID (which service to monitor on startup)
  activeService: 'batch-sync',

  // Services configuration
  // Each service has its own complete configuration
  services: [
    {
      id: 'batch-sync',
      displayName: 'Batch-Sync Service',
      loki: {
        // API base path (default: '/loki/api/v1')
        apiBasePath: '/loki/api/v1',
        // WebSocket settings (optional, leave empty for auto-detection)
        wsProtocol: '',  // 'ws' or 'wss', auto-detect if empty
        wsHost: '',      // hostname:port, use window.location.host if empty
        // Service-specific labels
        fixedLabels: {
          job: 'tasks',
          service: 'Batch-Sync'
        },
        taskLabel: 'task_name'
      },
      defaultLogLevel: '',
      logsPerPage: 500,
      // WebSocket settings
      websocket: {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        initializationDelay: 2000  // Delay before monitoring starts (milliseconds)
      },
      // Alert settings
      alert: {
        newLogHighlightDuration: 3000  // milliseconds
      },
      // Query settings
      query: {
        defaultTimeRangeDays: 7  // Default: query logs from last 7 days
      }
    },
    {
      id: 'data-service',
      displayName: 'Data Service',
      loki: {
        // API base path (default: '/loki/api/v1')
        apiBasePath: '/loki/api/v1',
        // WebSocket settings (optional, leave empty for auto-detection)
        wsProtocol: '',  // 'ws' or 'wss', auto-detect if empty
        wsHost: '',      // hostname:port, use window.location.host if empty
        // Service-specific labels
        fixedLabels: {
          job: 'api',
          service: 'Data-Service'
        },
        taskLabel: 'endpoint'
      },
      defaultLogLevel: 'WARN',
      logsPerPage: 1000,
      // WebSocket settings
      websocket: {
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        initializationDelay: 2000  // Delay before monitoring starts (milliseconds)
      },
      // Alert settings
      alert: {
        newLogHighlightDuration: 3000  // milliseconds
      },
      // Query settings
      query: {
        defaultTimeRangeDays: 7  // Default: query logs from last 7 days
      }
    }
  ],

  // ============================================================
  // GLOBAL CONFIGURATION (shared by all services)
  // ============================================================

  // Routing configuration
  routing: {
    basePath: '/view'  // Base path for task routes (e.g., /logs/:serviceId/:taskName)
  },

  // Virtual scroll settings
  virtualScroll: {
    estimatedItemHeight: 60,
    bufferSize: 10,
    loadMoreThreshold: 0.2  // Load more when scrolled to 20% from bottom
  }
}
