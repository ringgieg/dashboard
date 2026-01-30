# 配置指南 (Configuration Guide)

本文档说明如何通过修改 `public/config.js` 来配置 Loki Viewer，无需重新编译应用。

## 配置文件位置

- **开发环境**: `public/config.js`
- **生产环境**: `dist/config.js` (构建后可直接修改)

## 配置选项

### 基础配置

#### `pageTitle` (可选)
- **类型**: `string`
- **默认值**: `''` (空字符串)
- **说明**: 浏览器标签页标题。如果为空，使用默认标题 "Loki Log Viewer"
- **示例**:
  ```javascript
  pageTitle: '数据中台日志监控'
  ```

#### `appName` (可选)
- **类型**: `string`
- **默认值**: `''` (空字符串)
- **说明**: 导航栏显示的应用名称。如果为空，显示 `service` 的值
- **用途**: 用于区分应用名称和服务名称。例如应用名可以是"日志监控平台"，而服务名是"Batch-Sync"
- **示例**:
  ```javascript
  appName: '日志监控平台'
  ```

#### `service`
- **类型**: `string`
- **默认值**: `'Batch-Sync'`
- **说明**: 要监控的服务名称，对应 Loki 标签 `service="xxx"`
- **重要**: 此值必须与 Loki 中的 service 标签完全匹配
- **示例**:
  ```javascript
  service: 'Data-Service'
  ```

#### `defaultLogLevel`
- **类型**: `string`
- **默认值**: `''` (显示所有级别)
- **可选值**: `''`, `'ERROR'`, `'WARN'`, `'INFO'`, `'DEBUG'`
- **说明**: 默认日志级别过滤器
- **示例**:
  ```javascript
  defaultLogLevel: 'ERROR'  // 默认只显示 ERROR 日志
  ```

#### `logsPerPage`
- **类型**: `number`
- **默认值**: `500`
- **说明**: 每页加载的日志条数
- **建议**: 根据服务器性能调整，一般在 100-1000 之间
- **示例**:
  ```javascript
  logsPerPage: 1000
  ```

### Loki API 配置

#### `loki.apiBasePath`
- **类型**: `string`
- **默认值**: `'/loki/api/v1'`
- **说明**: Loki API 的基础路径
- **使用场景**: 当使用反向代理或非标准路径时
- **示例**:
  ```javascript
  loki: {
    apiBasePath: '/api/loki/v1'
  }
  ```

#### `loki.wsProtocol` (可选)
- **类型**: `string`
- **默认值**: `''` (自动检测)
- **可选值**: `'ws'`, `'wss'`, `''`
- **说明**: WebSocket 协议。为空时自动根据页面协议选择 (HTTPS→wss, HTTP→ws)
- **示例**:
  ```javascript
  loki: {
    wsProtocol: 'wss'  // 强制使用 wss
  }
  ```

#### `loki.wsHost` (可选)
- **类型**: `string`
- **默认值**: `''` (使用当前页面的 host)
- **说明**: WebSocket 服务器地址。为空时使用 `window.location.host`
- **使用场景**: WebSocket 服务器与页面服务器不在同一地址时
- **示例**:
  ```javascript
  loki: {
    wsHost: 'loki.example.com:3100'
  }
  ```

### 路由配置

#### `routing.basePath`
- **类型**: `string`
- **默认值**: `'/logs'`
- **说明**: 任务路由的基础路径
- **格式**: 应该是一个路径字符串，任务详情页面将是 `basePath/:taskName`
- **注意**: 修改后所有路由将使用新路径
- **示例**:
  ```javascript
  routing: {
    basePath: '/tasks'  // 任务页面将是 /tasks/:taskName
  }
  ```

### 虚拟滚动配置

#### `virtualScroll.estimatedItemHeight`
- **类型**: `number`
- **默认值**: `60`
- **说明**: 预估每条日志的高度 (像素)
- **建议**: 根据实际日志内容长度调整

#### `virtualScroll.bufferSize`
- **类型**: `number`
- **默认值**: `10`
- **说明**: 可视区域外缓冲的日志条数
- **建议**: 较大的值提供更流畅的滚动，但占用更多内存

#### `virtualScroll.loadMoreThreshold`
- **类型**: `number`
- **默认值**: `0.2`
- **说明**: 触发加载更多的滚动阈值 (0-1 之间的小数)
- **示例**: `0.2` 表示滚动到距离底部 20% 时加载更多

### WebSocket 配置

#### `websocket.maxReconnectAttempts`
- **类型**: `number`
- **默认值**: `5`
- **说明**: WebSocket 断开后的最大重连次数

#### `websocket.reconnectDelay`
- **类型**: `number`
- **默认值**: `3000`
- **说明**: 重连延迟时间 (毫秒)

#### `websocket.initializationDelay`
- **类型**: `number`
- **默认值**: `2000`
- **说明**: 初始化完成后多久开始监控新错误 (毫秒)
- **用途**: 防止页面加载时的历史错误日志触发告警
- **建议**: 根据日志量调整，日志量大时可适当增加

### 告警配置

#### `alert.newLogHighlightDuration`
- **类型**: `number`
- **默认值**: `3000`
- **说明**: 新日志高亮显示的持续时间 (毫秒)

## 配置示例

### 示例 1: 基础自定义
```javascript
window.APP_CONFIG = {
  pageTitle: '我的日志监控系统',
  appName: '日志监控平台',
  service: 'My-Service',
  defaultLogLevel: 'WARN',
  logsPerPage: 1000,

  routing: {
    basePath: '/logs'
  }
}
```

### 示例 2: 使用外部 Loki 服务器
```javascript
window.APP_CONFIG = {
  loki: {
    apiBasePath: '/loki/api/v1',
    wsProtocol: 'wss',
    wsHost: 'loki.example.com:3100'
  }
}
```

### 示例 3: 完整配置
```javascript
window.APP_CONFIG = {
  pageTitle: '数据中台日志监控',
  appName: '数据中台监控平台',
  service: 'Batch-Sync',
  defaultLogLevel: '',
  logsPerPage: 500,

  loki: {
    apiBasePath: '/loki/api/v1',
    wsProtocol: '',  // 自动检测
    wsHost: ''       // 使用当前 host
  },

  routing: {
    basePath: '/logs'
  },

  virtualScroll: {
    estimatedItemHeight: 60,
    bufferSize: 10,
    loadMoreThreshold: 0.2
  },

  websocket: {
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,
    initializationDelay: 2000
  },

  alert: {
    newLogHighlightDuration: 3000
  }
}
```

## 生产环境修改配置

1. 构建应用: `npm run build`
2. 部署到服务器
3. 直接修改 `dist/config.js` 文件
4. 刷新浏览器页面 (无需重新构建)

## 注意事项

1. **配置验证**: 应用会使用默认值处理缺失或无效的配置项
2. **类型安全**: 确保配置值的类型与文档一致
3. **路径格式**: 所有路径配置应以 `/` 开头
4. **字符串为空**: 某些选项使用空字符串 (`''`) 表示"使用默认值"或"自动检测"
5. **生产环境**: 修改配置后需要刷新页面才能生效

## 故障排查

### 配置未生效
- 检查 `config.js` 语法是否正确 (使用 JavaScript 语法检查工具)
- 确保 `window.APP_CONFIG` 对象正确定义
- 清除浏览器缓存后重试

### WebSocket 连接失败
- 检查 `loki.wsProtocol` 和 `loki.wsHost` 配置
- 确认 Loki 服务器可访问
- 检查浏览器控制台的错误信息

### 路由不工作
- 确保 `routing.basePath` 格式正确 (以 `/` 开头，不以 `/` 结尾)
- 清除浏览器缓存
- 检查服务器路由配置是否支持 SPA

## 技术支持

如有问题，请查看:
- 浏览器开发者工具的 Console 面板
- Network 面板中的 WebSocket 连接状态
- `src/utils/config.js` 中的配置读取逻辑
