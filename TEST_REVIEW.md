# 测试复盘报告

## 概览

在将 Loki Viewer 改为默认多服务模式后，需要更新以下测试文件以确保测试用例与新架构一致。

## 测试文件状态

### ✅ 已完成 (无需修改)

#### 1. `src/utils/config.test.js`
**状态**: 已更新完成
- ✅ 移除了 `isMultiServiceMode` 相关测试
- ✅ 移除了单服务模式测试用例
- ✅ 保留了服务管理相关测试
- ✅ 测试覆盖: getServices, getCurrentServiceId, getServiceById, getServiceConfig, getCurrentServiceConfig
- **测试数量**: 13 个服务管理测试用例

#### 2. `src/stores/taskStore.test.js`
**状态**: 无需修改
- ✅ 测试完全独立，通过 mock loki API
- ✅ 不依赖配置模式
- **测试数量**: 10 个测试用例
- **覆盖**: initialization, fetchTasks, toggleWatched, sortedTasks, initialize

### ⚠️ 需要修改

#### 3. `src/api/loki.test.js`
**状态**: 需要检查 beforeEach 配置

**当前问题**:
```javascript
// Line 19-28
window.APP_CONFIG = {
  loki: {
    apiBasePath: '/loki/api/v1',
    fixedLabels: {
      job: 'tasks',
      service: 'Batch-Sync'
    },
    taskLabel: 'task_name'
  }
}
```

**建议修改**:
```javascript
window.APP_CONFIG = {
  activeService: 'batch-sync',
  services: [
    {
      id: 'batch-sync',
      displayName: 'Batch-Sync Service',
      loki: {
        fixedLabels: {
          job: 'tasks',
          service: 'Batch-Sync'
        },
        taskLabel: 'task_name'
      }
    }
  ],
  loki: {
    apiBasePath: '/loki/api/v1'
  }
}
```

**影响**:
- 测试可能仍然通过（因为有 fallback），但不符合新的配置结构
- 测试应该反映实际的生产配置格式

#### 4. `src/components/LogViewer.test.js`
**状态**: 需要重大修改

**问题 1: 过时的 config mock** (Line 16-26)
```javascript
// ❌ 错误: defaultService 配置已不存在
vi.mock('../utils/config', () => ({
  getConfig: vi.fn((key, fallback) => {
    const config = {
      'defaultLogLevel': '',
      'defaultService': 'Batch-Sync',  // ❌ 已废弃
      'logsPerPage': 500,
      'alert.newLogHighlightDuration': 3000
    }
    return config[key] !== undefined ? config[key] : fallback
  })
}))
```

**修复**: 移除 `'defaultService': 'Batch-Sync'`

**问题 2: API 调用期望错误** (Line 101-104)
```javascript
// ❌ 错误: queryTaskLogs 不再接受 service 参数
expect(loki.queryTaskLogs).toHaveBeenCalledWith('test-task', {
  service: 'Batch-Sync',  // ❌ 已移除
  limit: 500
})
```

**修复**:
```javascript
expect(loki.queryTaskLogs).toHaveBeenCalledWith('test-task', {
  limit: 500
})
```

**问题 3: 路由路径过时** (Line 50, 58, 182, 222)
```javascript
// ❌ 错误: 旧路由格式
{ path: '/batch-sync/:taskName', name: 'task', component: LogViewer }
await router.push('/batch-sync/task-1')
```

**修复**:
```javascript
// ✅ 正确: 新路由格式
{ path: '/logs/:serviceId/:taskName', name: 'task', component: LogViewer }
await router.push('/logs/batch-sync/task-1')
```

**问题 4: 同样的 service 参数问题** (Line 126-129)
```javascript
expect(lastCall[1]).toMatchObject({
  service: 'Batch-Sync',  // ❌ 需要移除
  limit: 500,
  level: 'ERROR'
})
```

**影响**: 4 个测试用例需要修复

#### 5. `src/components/TaskList.test.js`
**状态**: 需要路由修改

**问题: 路由路径过时** (Line 33, 127, 176)
```javascript
// ❌ 错误: 旧路由格式
{ path: '/batch-sync/:taskName', component: { template: '<div>Task</div>' } }
await router.push('/batch-sync/task-1')
expect(pushSpy).toHaveBeenCalledWith('/batch-sync/my-task')
```

**修复**:
```javascript
// ✅ 正确: 新路由格式
{ path: '/logs/:serviceId/:taskName', component: { template: '<div>Task</div>' } }
await router.push('/logs/batch-sync/task-1')
expect(pushSpy).toHaveBeenCalledWith('/logs/batch-sync/my-task')
```

**影响**: 3 个测试用例需要修复

## 需要新增的测试

### 1. `src/stores/serviceStore.test.js`
**建议**: 创建新的测试文件

**应测试的功能**:
- `initialize()` - 初始化服务并设置 ID getter
- `setCurrentService()` - 切换服务
- `getCurrentServiceId()` - 获取当前服务 ID
- `services` computed - 获取服务列表
- `currentService` computed - 获取当前服务
- `currentServiceDisplayName` computed - 获取当前服务显示名

**预计测试数量**: 8-10 个用例

### 2. `src/router/index.js` 测试
**建议**: 创建路由测试文件 `src/router/index.test.js`

**应测试的功能**:
- 根路径 `/` 重定向到 `/logs/:serviceId`
- 服务日志路由 `/logs/:serviceId`
- 任务日志路由 `/logs/:serviceId/:taskName`
- 使用正确的 serviceId 进行重定向

**预计测试数量**: 4-5 个用例

## 修改优先级

### 🔴 高优先级 (必须修复)
1. **LogViewer.test.js** - API 调用期望错误会导致测试失败
2. **TaskList.test.js** - 路由路径错误会导致导航测试失败

### 🟡 中优先级 (建议修复)
3. **loki.test.js** - 配置格式不匹配，但有 fallback 可能不会失败
4. **创建 serviceStore.test.js** - 新增核心功能缺少测试覆盖

### 🟢 低优先级 (可选)
5. **创建 router/index.test.js** - 路由逻辑较简单，但测试会提高信心

## 修改工作量估算

| 文件 | 需修改行数 | 预计时间 | 难度 |
|------|-----------|---------|------|
| LogViewer.test.js | ~20 行 | 15 分钟 | 简单 |
| TaskList.test.js | ~10 行 | 10 分钟 | 简单 |
| loki.test.js | ~30 行 | 20 分钟 | 简单 |
| serviceStore.test.js (新建) | ~150 行 | 45 分钟 | 中等 |
| router/index.test.js (新建) | ~80 行 | 30 分钟 | 中等 |
| **总计** | ~290 行 | ~2 小时 | - |

## 测试覆盖率目标

### 当前状态
- ✅ Config 工具: 完整覆盖
- ✅ Task Store: 完整覆盖
- ⚠️ Loki API: 配置格式不匹配
- ⚠️ LogViewer 组件: API 调用期望错误
- ⚠️ TaskList 组件: 路由路径错误
- ❌ Service Store: 无测试
- ❌ Router: 无测试

### 目标状态
- ✅ 所有核心功能都有测试覆盖
- ✅ 所有测试使用正确的多服务配置格式
- ✅ 所有路由测试使用新的路径格式
- ✅ 所有 API 调用测试反映最新的函数签名

## 总结

### 关键发现
1. **架构变更未完全反映到测试**: 从单服务到多服务的转变只部分更新了测试
2. **路由更新遗漏**: 新路由格式 `/logs/:serviceId/:taskName` 未反映到组件测试
3. **API 签名变更**: `queryTaskLogs` 移除 `service` 参数后测试未更新
4. **新功能缺少测试**: `serviceStore` 是核心新功能但没有测试覆盖

### 建议行动
1. **立即修复**: LogViewer.test.js 和 TaskList.test.js 中的错误
2. **尽快完成**: loki.test.js 配置格式更新
3. **计划添加**: serviceStore.test.js 和 router/index.test.js

### 风险评估
- **当前风险**: 中等 - 部分测试可能失败或给出误导性结果
- **修复后风险**: 低 - 完整的测试覆盖将提供高信心

## 后续步骤

1. [ ] 修复 LogViewer.test.js (移除 service 参数，更新路由)
2. [ ] 修复 TaskList.test.js (更新路由路径)
3. [ ] 更新 loki.test.js (使用多服务配置格式)
4. [ ] 创建 serviceStore.test.js
5. [ ] 创建 router/index.test.js
6. [ ] 运行完整测试套件验证
7. [ ] 更新 CI/CD 配置（如适用）
