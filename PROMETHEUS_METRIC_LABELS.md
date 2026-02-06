# Prometheus Metric Labels 功能文档

## 概述

本功能实现了**基于优先队列的 Prometheus Rule Query 调度器**，用于定期执行告警规则的 PromQL 查询，从而获取 metric 的原始标签（如 `instance`, `job`, `device` 等），并将这些标签合并到告警对象中，使得层级配置可以使用这些 metric 标签进行分组显示。

## 核心特性

### 1. 优先队列调度器 (RuleQueryScheduler)

- **精确的间隔调度**: 按照每个 rule 的 `interval` (如 30s, 1m, 5m) 进行独立调度
- **优先队列管理**: 使用最小堆结构，确保最早到期的任务优先执行
- **分散执行**: 每秒检查一次队列，避免任务集中执行导致性能峰值
- **失败容错**: 查询失败时保留上一次成功的结果，确保数据连续性
- **动态更新**: 当告警规则更新时（新增、删除、间隔变更），自动调整调度队列

### 2. Metric Labels 合并

- **智能匹配**: 根据 alert 的 `instance` 或 `job` 标签匹配对应的 metric 结果
- **透明集成**: metric labels 作为 `alert.metricLabels` 存储，不影响原有 `alert.labels`
- **回退机制**: 如果 metric labels 不存在，自动回退到 alert labels

### 3. 层级配置增强

支持在每一层（Column / Grid / Item）指定标签来源：

- `labelSource: 'alertLabels'` - 使用告警规则定义的标签（默认）
- `labelSource: 'metricLabels'` - 使用从 metric 查询获得的标签

## 文件结构

```
dashboard/
├── src/
│   ├── utils/
│   │   ├── RuleQueryScheduler.js       # 优先队列调度器
│   │   └── RuleQueryScheduler.test.js  # Node.js 测试套件
│   ├── api/
│   │   └── prometheus.js               # 增加 labelSource 支持
│   └── stores/
│       └── prometheusStore.js          # 集成调度器
├── public/
│   └── config.js                       # 场景 2 配置示例
└── test-scheduler.html                 # 浏览器测试页面
```

## 配置示例

### 场景 1: severity → alertname（仅使用 alert labels）

```javascript
columns: [
  {
    label: 'severity',
    labelSource: 'alertLabels',
    grids: {
      label: 'alertname',
      labelSource: 'alertLabels',
      displayNameAnnotation: 'summary'
    }
  }
]
```

### 场景 2: severity → instance → alertname（使用 metric labels）

```javascript
columns: [
  {
    label: 'severity',              // 从 alert labels 读取
    labelSource: 'alertLabels',
    grids: {
      label: 'instance',            // 从 metric labels 读取
      labelSource: 'metricLabels',
      items: {
        label: 'alertname',         // 从 alert labels 读取
        labelSource: 'alertLabels'
      }
    }
  }
]
```

## 调度器工作流程

### 初始化

```
1. fetchAlerts() 获取所有告警规则
   ↓
2. updateRules(alerts) 更新调度器
   ↓
3. 为每个规则创建任务，设置 nextExecutionTime = now（立即执行）
   ↓
4. 将任务加入优先队列（按 nextExecutionTime 排序）
   ↓
5. 启动 1 秒定时器，每秒检查队列
```

### 执行循环

```
每 1 秒检查队列:
  while (queue 有任务 && 队首任务已到期) {
    1. 出队任务
    2. 执行 queryInstant(rule.query)
    3. 成功 → 存储 lastResult
       失败 → 保留 lastResult 不变
    4. 设置 nextExecutionTime = now + interval
    5. 重新入队（自动按时间排序）
  }
```

### 数据合并

```
执行完成后触发回调:
  mergeMetricLabels(queryResults)
    ↓
  遍历每个 alert:
    - 从 queryResults 中查找对应的 query 结果
    - 按 instance/job 匹配具体的 metric
    - 将 metric.labels 存储到 alert.metricLabels
    ↓
  触发 UI 更新（通过 Vue reactive）
```

## 测试

### 浏览器测试

1. 打开 `test-scheduler.html`
2. 点击 "运行所有测试" 按钮
3. 查看测试结果和日志

测试涵盖：
- ✅ 时间间隔解析 (30s, 1m, 5m, 无效值)
- ✅ 优先队列排序
- ✅ 执行时机验证
- ✅ 失败处理与数据持久化
- ✅ 动态规则更新

### Node.js 测试

```bash
cd dashboard/src/utils
node RuleQueryScheduler.test.js
```

## 性能优化

### 1. 分散执行

- 不同 interval 的规则执行时间天然分散
- 首次执行立即触发，后续按各自间隔进行
- 避免所有规则同时执行造成 Prometheus 压力

### 2. 查询缓存

- 每个 rule 保留 `lastResult`
- 查询失败时使用缓存数据
- 减少因临时故障导致的数据丢失

### 3. 资源管理

- 调度器生命周期与 store 绑定
- cleanup() 时自动停止调度器
- 避免内存泄漏

## 数据结构

### Alert 对象（增强后）

```javascript
{
  // 原有字段
  labels: {
    alertname: 'HighCPUUsage',
    severity: 'warning',
    component: 'node-exporter'
  },
  annotations: {
    summary: 'CPU 使用率过高',
    description: 'CPU usage is above 80%'
  },
  rule: {
    name: 'HighCPUUsage',
    query: '100 - (avg by (instance) (rate(...)))',
    duration: '5m',
    health: 'ok'
  },
  state: 'firing',

  // 新增字段
  metricLabels: {
    instance: 'node-exporter-1:9100',
    job: 'node-exporter',
    // ... 其他 metric 标签
  }
}
```

### Scheduler Rule 对象

```javascript
{
  ruleId: 'HighCPUUsage',
  query: '100 - (avg by (instance) (rate(...)))',
  interval: '30s',
  intervalMs: 30000,
  nextExecutionTime: 1643723456789,  // 时间戳
  lastResult: { /* query result */ },
  executing: false
}
```

## 调试

### 查看调度器状态

```javascript
const prometheusStore = usePrometheusStore()

// 如果调度器已初始化（通过 cleanup 前访问 ruleQueryScheduler）
// 可以在浏览器控制台查看统计信息
console.log('[Scheduler Stats]', scheduler.getStats())

// 输出示例:
// {
//   running: true,
//   totalRules: 15,
//   queueSize: 15,
//   nextExecution: 28,  // 下次执行距现在 28 秒
//   rules: [
//     { ruleId: 'Alert1', interval: '30s', nextExecution: 28, hasResult: true },
//     { ruleId: 'Alert2', interval: '1m', nextExecution: 45, hasResult: true },
//     ...
//   ]
// }
```

### 查看 Console 日志

调度器会输出详细日志：

```
[RuleQueryScheduler] Starting scheduler (check interval: 1s)
[RuleQueryScheduler] Updating rules from 25 alerts
[RuleQueryScheduler] Found 15 unique rules
[RuleQueryScheduler] Added rule Alert1 (interval: 30s)
[RuleQueryScheduler] Executing rule Alert1 (query: up{job="test"}...)
[RuleQueryScheduler] Rule Alert1 executed successfully (took 245ms)
[PrometheusStore] Merging metric labels from 15 query results
[PrometheusStore] Merged metric labels into 25 alerts
```

## 故障排查

### 1. Metric labels 为空

**可能原因:**
- Query 执行失败
- Query 返回结果为空
- Scheduler 未启动

**检查方法:**
```javascript
// 检查 alert 是否有 metricLabels
console.log(alert.metricLabels) // 应该是对象，不是 undefined

// 检查调度器是否运行
// （需要在 prometheusStore 暴露 scheduler 或通过其他方式访问）
```

### 2. 层级显示不正确

**可能原因:**
- `labelSource` 配置错误
- Metric labels 中没有预期的标签
- 配置的 label 名称拼写错误

**检查方法:**
```javascript
// 查看第一个 alert 的完整结构
console.log(JSON.stringify(alerts[0], null, 2))

// 检查是否有 instance 标签
console.log('Alert labels:', alert.labels)
console.log('Metric labels:', alert.metricLabels)
```

### 3. 性能问题

**症状:** Prometheus 查询响应缓慢

**解决方案:**
- 增加 rule interval（从 30s 改为 1m）
- 优化 PromQL 查询
- 减少规则数量

## 限制和注意事项

1. **单个 metric 匹配**
   - 如果一个 rule query 返回多个 metric instances，目前只匹配第一个
   - 通过 alert.labels.instance 进行智能匹配

2. **内存使用**
   - 每个 rule 保存一份 lastResult
   - 如果规则数量很大（>100），需要注意内存使用

3. **时钟精度**
   - 调度器每秒检查一次，理论误差 ±1 秒
   - 对于大部分监控场景（30s 以上 interval）可接受

## 未来改进

- [ ] 支持为单个 rule 查询结果创建多个 alert（每个 instance 一个）
- [ ] 添加查询缓存过期机制
- [ ] 支持手动触发特定 rule 查询
- [ ] 提供调度器状态的 UI 展示
- [ ] 支持查询批处理优化

## 总结

本功能通过优先队列调度器实现了：

1. ✅ 精确按 rule interval 执行 PromQL 查询
2. ✅ 获取 metric 的原始标签并合并到 alert
3. ✅ 支持层级配置使用 metric labels
4. ✅ 失败容错，保持数据连续性
5. ✅ 动态更新，自动适应规则变化
6. ✅ 完整的测试覆盖

配置示例已更新为**场景 2**（severity → instance → alertname），可直接使用！
