<template>
  <div class="task-list-container">
    <div class="task-list-header">
      <el-input
        v-model="searchQuery"
        placeholder="搜索任务..."
        size="small"
        :prefix-icon="Search"
        clearable
        class="search-input"
      />
      <el-button
        size="small"
        @click="refreshTasks"
        class="refresh-button"
        :disabled="prometheusStore.loading"
      >
        <el-icon :class="{ 'is-loading': prometheusStore.loading }">
          <Refresh />
        </el-icon>
      </el-button>
    </div>

    <div class="task-list-content" v-loading="prometheusStore.loading">
      <!-- All Alerts Option -->
      <div
        class="task-item"
        :class="{ 'is-selected': !route.params.taskName }"
        @click="selectTask(null)"
      >
        <div class="task-info">
          <span class="task-icon all-alerts">●</span>
          <span class="task-name">全部告警</span>
          <span class="alert-count">{{ prometheusStore.alertCounts.total }}</span>
        </div>
      </div>

      <!-- Task List -->
      <div
        v-for="task in filteredTasks"
        :key="task.name"
        class="task-item"
        :class="{
          'is-selected': route.params.taskName === task.name,
          'is-unwatched': !task.watched
        }"
        @click="selectTask(task.name)"
        @contextmenu.prevent="showContextMenu($event, task)"
      >
        <div class="task-info">
          <span class="task-icon" :class="getTaskIconClass(task)">●</span>
          <span class="task-name">{{ task.name }}</span>
          <span
            v-if="!task.existsInPrometheus"
            class="not-in-prometheus-badge"
            title="此任务在Prometheus中暂无告警"
          >
            无告警
          </span>
          <span class="alert-count">{{ getTaskAlertCount(task.name) }}</span>
        </div>
      </div>

      <div v-if="filteredTasks.length === 0" class="no-tasks">
        暂无任务
      </div>
    </div>

    <div class="task-list-footer">
      <span class="task-count">共 {{ prometheusStore.tasks.length }} 个任务</span>
      <div class="footer-actions">
        <MuteButton v-if="kioskMode" size="small" />
        <el-button
          v-if="!kioskMode"
          size="small"
          @click="enterKioskMode"
          title="进入Kiosk模式"
          class="kiosk-button"
        >
          <el-icon><FullScreen /></el-icon>
        </el-button>
        <el-button
          v-else
          size="small"
          type="primary"
          @click="exitKioskMode"
          title="退出Kiosk模式"
          class="kiosk-button kiosk-active"
        >
          <el-icon><FullScreen /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="toggleWatched">
        {{ contextMenuTask?.watched ? '取消关注' : '设为关注' }}
      </div>
    </div>

    <div
      v-if="contextMenuVisible"
      class="context-menu-overlay"
      @click="closeContextMenu"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePrometheusStore } from '../../../stores/prometheusStore'
import { useServiceStore } from '../../../stores/serviceStore'
import { Search, Refresh, FullScreen } from '@element-plus/icons-vue'
import { filterAlerts } from '../../../api/prometheus'
import { getPrometheusTaskLabel } from '../../../utils/config'
import MuteButton from '../../../components/MuteButton.vue'

// Props
const props = defineProps({
  kioskMode: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const route = useRoute()
const prometheusStore = usePrometheusStore()
const serviceStore = useServiceStore()

const searchQuery = ref('')
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref(null)

const filteredTasks = computed(() => {
  if (!searchQuery.value) {
    return prometheusStore.sortedTasks
  }
  const query = searchQuery.value.toLowerCase()
  return prometheusStore.sortedTasks.filter(task =>
    task.name.toLowerCase().includes(query)
  )
})

function getTaskIconClass(task) {
  if (!task.watched) {
    return 'unwatched'
  }

  // Get alert count for this task
  const count = getTaskAlertCount(task.name)

  if (count === 0) {
    return 'normal'
  }

  // Check if any firing alerts
  const taskLabel = getPrometheusTaskLabel()
  const taskAlerts = filterAlerts(prometheusStore.alerts, { [taskLabel]: task.name })
  const hasFiring = taskAlerts.some(alert => alert.state === 'firing')

  return hasFiring ? 'has-firing' : 'has-pending'
}

function getTaskAlertCount(taskName) {
  const taskLabel = getPrometheusTaskLabel()
  const taskAlerts = filterAlerts(prometheusStore.alerts, { [taskLabel]: taskName })
  return taskAlerts.length
}

function selectTask(taskName) {
  const serviceId = serviceStore.getCurrentServiceId()
  if (taskName) {
    router.push(`/prometheus/${serviceId}/${taskName}`)
  } else {
    router.push(`/prometheus/${serviceId}`)
  }
}

function refreshTasks() {
  prometheusStore.refresh()
}

function showContextMenu(event, task) {
  contextMenuTask.value = task
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuTask.value = null
}

function toggleWatched() {
  if (contextMenuTask.value) {
    prometheusStore.toggleTaskWatch(contextMenuTask.value.name)
  }
  closeContextMenu()
}

function enterKioskMode() {
  router.push({ query: { ...route.query, kiosk: '1' } })
}

function exitKioskMode() {
  const query = { ...route.query }
  delete query.kiosk
  router.push({ query })
}

// Close context menu on click outside
function handleClickOutside() {
  if (contextMenuVisible.value) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.task-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
}

.task-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.search-input {
  flex: 1;
}

.refresh-button {
  flex-shrink: 0;
}

.task-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.task-item {
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--el-bg-color);
  border: 1px solid transparent;
}

.task-item:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color);
}

.task-item.is-selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.task-item.is-unwatched {
  opacity: 0.6;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.task-icon.all-alerts {
  color: var(--el-color-primary);
}

.task-icon.unwatched {
  color: var(--el-text-color-placeholder);
}

.task-icon.normal {
  color: var(--el-color-success);
}

.task-icon.has-pending {
  color: var(--el-color-warning);
}

.task-icon.has-firing {
  color: var(--el-color-danger);
}

.task-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.not-in-prometheus-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  border-radius: 4px;
}

.alert-count {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
  border-radius: 10px;
  font-weight: 600;
}

.no-tasks {
  text-align: center;
  padding: 32px 16px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.task-list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
}

.task-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.kiosk-button {
  padding: 8px;
}

.kiosk-button.kiosk-active {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Context Menu */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  min-width: 120px;
}

.context-menu-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.context-menu-item:hover {
  background: var(--el-fill-color-light);
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
}
</style>
