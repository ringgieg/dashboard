<template>
  <div class="prometheus-monitor-container">
    <!-- Header -->
    <div class="monitor-header">
      <div class="header-left">
        <span class="task-name">{{ currentTask || '全部告警' }}</span>
        <span
          v-if="isDeadManSwitchEnabled"
          class="polling-status deadman-status"
          :class="{
            active: prometheusStore.deadManSwitchOk && prometheusStore.polling,
            error: !prometheusStore.deadManSwitchOk || !prometheusStore.polling
          }"
        >
          ● {{ deadManStatusText }}
        </span>
        <span class="polling-status" :class="{ active: prometheusStore.polling, error: !prometheusStore.polling }">
          ● {{ pollingStatusText }}
        </span>
      </div>

      <div class="header-stats">
        <el-tag type="danger" size="small" effect="dark">
          Firing: {{ prometheusStore.alertCounts.firing }}
        </el-tag>
        <el-tag type="warning" size="small" effect="dark">
          Pending: {{ prometheusStore.alertCounts.pending }}
        </el-tag>
        <el-tag type="success" size="small" effect="dark">
          Normal: {{ prometheusStore.alertCounts.inactive }}
        </el-tag>
        <el-button
          size="small"
          :icon="Refresh"
          :loading="prometheusStore.loading"
          @click="handleRefresh"
        >
          刷新
        </el-button>
      </div>
    </div>

    <!-- Content -->
    <div class="monitor-content">
      <div v-if="prometheusStore.loading && hierarchy.length === 0" class="loading-state">
        <el-icon class="loading-icon"><Loading /></el-icon>
        加载中...
      </div>

      <div v-else-if="hierarchy.length > 0" class="alert-hierarchy">
        <!-- Flat structure (no columns) -->
        <template v-if="hierarchy[0].type === 'flat'">
          <div class="alert-list">
            <AlertItem
              v-for="(alert, index) in hierarchy[0].alerts"
              :key="index"
              :alert="alert"
              @click="handleAlertClick(alert)"
            />
          </div>
        </template>

        <!-- Hierarchical structure (with columns) -->
        <template v-else>
          <div class="columns-container">
            <div
              v-for="(column, colIndex) in hierarchy"
              :key="colIndex"
              class="column"
            >
              <div class="column-header">
                <span class="column-label">{{ column.label }}</span>
                <span class="column-value">{{ column.value }}</span>
              </div>

              <div class="grids-container">
                <div
                  v-for="(grid, gridIndex) in column.grids"
                  :key="gridIndex"
                  class="grid"
                >
                  <div class="grid-header">
                    <span class="grid-label">{{ grid.label }}</span>
                    <span class="grid-value">{{ grid.value }}</span>
                  </div>

                  <div class="items-container">
                    <div
                      v-for="(item, itemIndex) in grid.items"
                      :key="itemIndex"
                      class="item"
                      :class="`item-${item.state}`"
                      @click="handleItemClick(item)"
                    >
                      <div class="item-label">{{ item.label }}</div>
                      <div class="item-value">{{ item.value }}</div>
                      <div class="item-state">{{ getStateDisplayName(item.state) }}</div>
                      <div class="item-count">{{ item.alerts.length }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="empty-state">
        {{ currentTask ? '该任务暂无告警' : '暂无告警数据' }}
      </div>
    </div>

    <!-- Alert Detail Dialog -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="detailDialogTitle"
      width="60%"
      destroy-on-close
    >
      <div v-if="selectedAlerts.length > 0" class="alert-detail">
        <el-table :data="selectedAlerts" border stripe>
          <el-table-column prop="labels.alertname" label="告警名称" width="200" />
          <el-table-column prop="state" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="getStateTagType(scope.row.state)">
                {{ getStateDisplayName(scope.row.state) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Labels">
            <template #default="scope">
              <div class="labels-container">
                <el-tag
                  v-for="(value, key) in scope.row.labels"
                  :key="key"
                  size="small"
                  class="label-tag"
                >
                  {{ key }}: {{ value }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="Annotations" width="200">
            <template #default="scope">
              <div v-if="scope.row.annotations" class="annotations-container">
                <div
                  v-for="(value, key) in scope.row.annotations"
                  :key="key"
                  class="annotation-item"
                >
                  <strong>{{ key }}:</strong> {{ value }}
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loading, Refresh } from '@element-plus/icons-vue'
import { usePrometheusStore } from '../../../stores/prometheusStore'
import { getAlertStateDisplayName } from '../../../api/prometheus'
import { isDeadManSwitchEnabled as checkDeadManSwitchEnabled } from '../../../utils/config'

const route = useRoute()
const prometheusStore = usePrometheusStore()

const currentTask = computed(() => route.params.taskName || null)

const detailDialogVisible = ref(false)
const detailDialogTitle = ref('')
const selectedAlerts = ref([])

// Check if DeadManSwitch is enabled
const isDeadManSwitchEnabled = computed(() => checkDeadManSwitchEnabled())

// Computed: DeadManSwitch status text
const deadManStatusText = computed(() => {
  if (!prometheusStore.polling) {
    return '监控链路: 轮询已停止'
  }
  return prometheusStore.deadManSwitchOk ? '监控链路: 正常' : '监控链路: 异常'
})

// Computed: Polling status text
const pollingStatusText = computed(() => {
  if (!prometheusStore.polling) return '轮询已停止'
  if (prometheusStore.pollingCountdown > 0) {
    return `下次更新: ${prometheusStore.pollingCountdown}s`
  }
  return '轮询中...'
})

// Computed: Alert hierarchy
const hierarchy = computed(() => {
  return prometheusStore.buildAlertHierarchy()
})

// Watch task changes
watch(currentTask, (newTask) => {
  prometheusStore.selectTask(newTask)
})

// Handle refresh
function handleRefresh() {
  prometheusStore.refresh()
}

// Handle alert click (flat structure)
function handleAlertClick(alert) {
  selectedAlerts.value = [alert]
  detailDialogTitle.value = `告警详情 - ${alert.labels?.alertname || 'Unknown'}`
  detailDialogVisible.value = true
}

// Handle item click (hierarchical structure)
function handleItemClick(item) {
  selectedAlerts.value = item.alerts
  detailDialogTitle.value = `告警详情 - ${item.value || '未知'}`
  detailDialogVisible.value = true
}

// Get state display name
function getStateDisplayName(state) {
  return getAlertStateDisplayName(state)
}

// Get state tag type for Element Plus
function getStateTagType(state) {
  const typeMap = {
    'firing': 'danger',
    'pending': 'warning',
    'inactive': 'success'
  }
  return typeMap[state] || 'info'
}

// Initialize on mount
onMounted(() => {
  prometheusStore.selectTask(currentTask.value)
})
</script>

<style scoped>
.prometheus-monitor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
}

.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.task-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.polling-status {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.polling-status.active {
  color: var(--el-color-success);
}

.polling-status.error {
  color: var(--el-color-danger);
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.monitor-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.loading-icon {
  font-size: 32px;
  margin-bottom: 16px;
  animation: spin 1s linear infinite;
}

/* Flat structure */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Hierarchical structure */
.columns-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.column {
  flex: 1;
  min-width: 300px;
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.column-header {
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 600;
}

.column-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-right: 8px;
}

.column-value {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.grids-container {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.grid {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}

.grid-header {
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.grid-label {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-right: 6px;
}

.grid-value {
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.items-container {
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.item {
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 2px solid;
  cursor: pointer;
  transition: all 0.2s ease;
}

.item-firing {
  background: rgba(245, 108, 108, 0.1);
  border-color: #f56c6c;
}

.item-firing:hover {
  background: rgba(245, 108, 108, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(245, 108, 108, 0.3);
}

.item-pending {
  background: rgba(230, 162, 60, 0.1);
  border-color: #e6a23c;
}

.item-pending:hover {
  background: rgba(230, 162, 60, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(230, 162, 60, 0.3);
}

.item-inactive {
  background: rgba(103, 194, 58, 0.1);
  border-color: #67c23a;
}

.item-inactive:hover {
  background: rgba(103, 194, 58, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(103, 194, 58, 0.3);
}

.item-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.item-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.item-state {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 2px;
}

.item-count {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* Alert detail dialog */
.alert-detail {
  max-height: 60vh;
  overflow-y: auto;
}

.labels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.label-tag {
  margin: 2px;
}

.annotations-container {
  font-size: 12px;
}

.annotation-item {
  margin-bottom: 4px;
}

.annotation-item strong {
  color: var(--el-text-color-primary);
}
</style>
