/**
 * Loki Viewer 运行时配置
 *
 * 此文件可在构建后修改，无需重新编译。
 * 它将作为静态文件从 public 目录提供。
 */
window.APP_CONFIG = {
  // ============================================================
  // 全局配置
  // ============================================================

  // 页面标题（浏览器标签页，可选，默认值: "Loki Log Viewer"）
  pageTitle: 'Grafana Stack Dashboard',

  // 活动服务 ID（启动时监控哪个服务，可选，默认值: 第一个服务的 ID）
  activeService: 'batch-sync',

  // 服务配置（必需，至少配置一个服务）
  // 每个服务都有自己的完整配置
  services: [
    {
      // ========== 服务基本信息 ==========
      id: 'batch-sync',                           // 必需：服务唯一标识符
      displayName: 'Batch-Sync Service',          // 必需：服务显示名称

      // ========== Loki 连接配置 ==========
      loki: {
        // API 配置
        apiBasePath: '/loki/api/v1',              // 可选，默认值：'/loki/api/v1'

        // WebSocket 连接配置（可选，留空则自动检测）
        wsProtocol: '',                           // 可选，默认值：自动检测（'ws' 或 'wss'）
        wsHost: '',                               // 可选，默认值：window.location.host

        // WebSocket 尾部日志参数
        tailLimit: 100,                           // 可选，默认值：100（尾部日志数量）
        tailDelayFor: '0',                        // 可选，默认值：'0'（尾部日志延迟）

        // API 重试设置
        maxRetries: 3,                            // 可选，默认值：3（最大重试次数）
        retryBaseDelay: 1000,                     // 可选，默认值：1000（指数退避基础延迟，毫秒）

        // Loki 查询标签（必需）
        fixedLabels: {                            // 必需：固定查询标签
          job: 'tasks',
          service: 'Batch-Sync'
        },
        taskLabel: 'task_name'                    // 可选，默认值：'task_name'（任务标签字段名）
      },

      // ========== 日志显示配置 ==========
      defaultLogLevel: 'WARN',                    // 可选，默认值：''（默认显示的日志级别）
      logsPerPage: 500,                           // 可选，默认值：500（每页显示日志条数）

      // ========== WebSocket 连接配置 ==========
      websocket: {
        maxReconnectAttempts: 5,                  // 可选，默认值：5（最大重连次数）
        reconnectDelay: 3000,                     // 可选，默认值：3000（重连延迟，毫秒）
        initializationDelay: 2000                 // 可选，默认值：2000（监控开始前延迟，毫秒）
      },

      // ========== 告警配置 ==========
      alert: {
        level: 'ERROR',                           // 可选，默认值：'ERROR'（告警级别：ERROR/WARN/INFO/DEBUG）
        newLogHighlightDuration: 3000             // 可选，默认值：3000（新日志高亮持续时间，毫秒）
      },

      // ========== 查询配置 ==========
      query: {
        defaultTimeRangeDays: 30                  // 可选，默认值：7（查询时间范围，天数）
      },

      // ========== 日志级别配置 ==========
      logLevels: {                                // 可选，有完整默认配置
        order: ['ERROR', 'WARN', 'INFO', 'DEBUG'], // 级别顺序（从高到低）
        mapping: {                                 // 级别映射：告警级别 → 触发的日志级别
          'ERROR': ['ERROR'],
          'WARN': ['ERROR', 'WARN'],
          'INFO': ['ERROR', 'WARN', 'INFO'],
          'DEBUG': ['ERROR', 'WARN', 'INFO', 'DEBUG']
        }
      }
    },
    {
      // ========== 服务基本信息 ==========
      id: 'data-service',                         // 必需：服务唯一标识符
      displayName: 'Data Service',                // 必需：服务显示名称

      // ========== Loki 连接配置 ==========
      loki: {
        apiBasePath: '/loki/api/v1',              // 可选，默认值：'/loki/api/v1'
        wsProtocol: '',                           // 可选，默认值：自动检测
        wsHost: '',                               // 可选，默认值：window.location.host
        tailLimit: 100,                           // 可选，默认值：100
        tailDelayFor: '0',                        // 可选，默认值：'0'
        maxRetries: 3,                            // 可选，默认值：3
        retryBaseDelay: 1000,                     // 可选，默认值：1000
        fixedLabels: {                            // 必需：固定查询标签
          job: 'api',
          service: 'Data-Service'
        },
        taskLabel: 'endpoint'                     // 可选，默认值：'task_name'
      },

      // ========== 日志显示配置 ==========
      defaultLogLevel: 'WARN',                    // 可选，默认值：''
      logsPerPage: 1000,                          // 可选，默认值：500

      // ========== WebSocket 连接配置 ==========
      websocket: {
        maxReconnectAttempts: 5,                  // 可选，默认值：5
        reconnectDelay: 3000,                     // 可选，默认值：3000
        initializationDelay: 2000                 // 可选，默认值：2000
      },

      // ========== 告警配置 ==========
      alert: {
        level: 'ERROR',                           // 可选，默认值：'ERROR'
        newLogHighlightDuration: 3000             // 可选，默认值：3000
      },

      // ========== 查询配置 ==========
      query: {
        defaultTimeRangeDays: 30                  // 可选，默认值：7
      },

      // ========== 日志级别配置 ==========
      logLevels: {                                // 可选，有完整默认配置
        order: ['ERROR', 'WARN', 'INFO', 'DEBUG'],
        mapping: {
          'ERROR': ['ERROR'],
          'WARN': ['ERROR', 'WARN'],
          'INFO': ['ERROR', 'WARN', 'INFO'],
          'DEBUG': ['ERROR', 'WARN', 'INFO', 'DEBUG']
        }
      }
    }
  ],

  // ============================================================
  // 全局配置（所有服务共享，均为可选）
  // ============================================================

  // 虚拟滚动设置（可选，有完整默认配置）
  virtualScroll: {
    estimatedItemHeight: 60,                      // 可选，默认值：60（预估每条日志高度，像素）
    bufferSize: 10,                               // 可选，默认值：10（缓冲区大小）
    loadMoreThreshold: 0.2                        // 可选，默认值：0.2（滚动到距离底部 20% 时加载更多）
  }
}
