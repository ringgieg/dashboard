<template>
  <div class="log-viewer-container">
    <!-- Header -->
    <div class="log-viewer-header" v-if="currentTask">
      <div class="header-left">
        <span class="task-name">{{ currentTask }}</span>
        <span class="connection-status" :class="connectionStatus">
          ● {{ connectionStatusText }}
        </span>
      </div>

      <div class="header-filters">
        <el-select
          v-model="selectedLevel"
          placeholder="级别"
          size="small"
          style="width: 100px"
        >
          <el-option label="ALL" value="" />
          <el-option label="ERROR" value="ERROR" />
          <el-option label="WARN" value="WARN" />
          <el-option label="INFO" value="INFO" />
          <el-option label="DEBUG" value="DEBUG" />
        </el-select>
      </div>
    </div>

    <!-- Content -->
    <div class="log-viewer-content">
      <template v-if="currentTask">
        <div v-if="initialLoading" class="loading-state">
          加载中...
        </div>

        <VirtualLogList
          v-else-if="logs.length > 0"
          :logs="logs"
          :loading="loading"
          :has-more="hasMore"
          @load-more="loadMoreLogs"
        />

        <div v-else class="empty-state">
          等待日志...
        </div>
      </template>

      <div v-else class="empty-state">
        请选择一个任务
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { queryTaskLogs } from '../api/loki'
import { useWsStore } from '../stores/wsStore'
import VirtualLogList from './VirtualLogList.vue'

const route = useRoute()
const wsStore = useWsStore()

const currentTask = computed(() => route.params.taskName || null)

const logs = ref([])
const loading = ref(false)
const initialLoading = ref(false)
const hasMore = ref(true)
const nextCursor = ref(null)
const selectedLevel = ref('WARN')

let unsubscribe = null

const connectionStatus = computed(() => {
  if (wsStore.isConnected) return 'connected'
  return 'disconnected'
})

const connectionStatusText = computed(() => {
  if (wsStore.isConnected) return '已连接'
  return '连接断开'
})

watch(currentTask, async (newTask, oldTask) => {
  stopStreaming()
  logs.value = []
  nextCursor.value = null
  hasMore.value = true

  if (newTask) {
    await fetchInitialLogs()
    startStreaming()
  }
}, { immediate: true })

// Reload logs when level filter changes
watch(selectedLevel, async () => {
  if (currentTask.value) {
    stopStreaming()
    logs.value = []
    nextCursor.value = null
    hasMore.value = true
    await fetchInitialLogs()
    startStreaming()
  }
})

async function fetchInitialLogs() {
  if (!currentTask.value) return

  console.log('[LogViewer] Fetching initial logs for task:', currentTask.value)
  initialLoading.value = true
  logs.value = []
  nextCursor.value = null
  hasMore.value = true

  try {
    const options = { service: 'Batch-Sync', limit: 500 }
    if (selectedLevel.value) options.level = selectedLevel.value

    console.log('[LogViewer] Query options:', options)
    const result = await queryTaskLogs(currentTask.value, options)
    console.log('[LogViewer] Got logs:', result.logs.length)
    logs.value = result.logs
    nextCursor.value = result.nextCursor
    hasMore.value = result.hasMore
  } catch (error) {
    console.error('[LogViewer] Error fetching logs:', error)
  } finally {
    initialLoading.value = false
  }
}

async function loadMoreLogs() {
  if (loading.value || !hasMore.value || !currentTask.value) return

  loading.value = true

  try {
    const options = {
      service: 'Batch-Sync',
      limit: 500,
      cursor: nextCursor.value
    }
    if (selectedLevel.value) options.level = selectedLevel.value

    const result = await queryTaskLogs(currentTask.value, options)
    logs.value = [...logs.value, ...result.logs]
    nextCursor.value = result.nextCursor
    hasMore.value = result.hasMore
  } catch (error) {
    console.error('Error loading more:', error)
  } finally {
    loading.value = false
  }
}

function startStreaming() {
  if (!currentTask.value || unsubscribe) return

  // Subscribe to logs for this specific task
  unsubscribe = wsStore.subscribe(currentTask.value, (newLogs) => {
    // Filter by level if needed
    let filteredLogs = newLogs
    if (selectedLevel.value) {
      const levelOrder = ['ERROR', 'WARN', 'INFO', 'DEBUG']
      const selectedIndex = levelOrder.indexOf(selectedLevel.value)
      if (selectedIndex >= 0) {
        const allowedLevels = levelOrder.slice(0, selectedIndex + 1)
        filteredLogs = newLogs.filter(log =>
          allowedLevels.includes((log.level || 'INFO').toUpperCase())
        )
      }
    }

    if (filteredLogs.length === 0) return

    const markedLogs = filteredLogs.map(log => ({ ...log, isNew: true }))
    logs.value = [...markedLogs, ...logs.value]

    setTimeout(() => {
      logs.value = logs.value.map(log => {
        if (markedLogs.find(nl => nl.id === log.id)) {
          return { ...log, isNew: false }
        }
        return log
      })
    }, 3000)
  })
}

function stopStreaming() {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}



onUnmounted(() => {
  stopStreaming()
})
</script>

<style scoped>
.log-viewer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.log-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.connection-status {
  font-size: 12px;
  color: #999;
}

.connection-status.connected {
  color: #52c41a;
}

.connection-status.disconnected {
  color: #ff4d4f;
}

.header-filters {
  display: flex;
  align-items: center;
  gap: 12px;
}

.log-viewer-content {
  flex: 1;
  overflow: hidden;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}
</style>
