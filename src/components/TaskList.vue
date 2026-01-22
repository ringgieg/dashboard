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
    </div>

    <div class="task-list-content" v-loading="store.loading">
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
          <span class="task-icon" :class="{ watched: task.watched }">●</span>
          <span class="task-name">{{ task.name }}</span>
        </div>

        <span
          v-if="getErrorCount(task.name) > 0"
          class="error-count"
          :class="{ 'is-gray': !task.watched }"
        >
          {{ getErrorCount(task.name) }}
        </span>
      </div>

      <div v-if="filteredTasks.length === 0" class="no-tasks">
        暂无任务
      </div>
    </div>

    <div class="task-list-footer">
      共 {{ store.tasks.length }} 个任务
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
import { useTaskStore } from '../stores/taskStore'
import { Search } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const store = useTaskStore()

const searchQuery = ref('')
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTask = ref(null)

const filteredTasks = computed(() => {
  if (!searchQuery.value) {
    return store.sortedTasks
  }
  const query = searchQuery.value.toLowerCase()
  return store.sortedTasks.filter(task =>
    task.name.toLowerCase().includes(query)
  )
})

function getErrorCount(taskName) {
  return store.errorCounts[taskName] || 0
}

function selectTask(taskName) {
  router.push(`/batch-sync/${taskName}`)
}

function showContextMenu(event, task) {
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuTask.value = task
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuTask.value = null
}

function toggleWatched() {
  if (contextMenuTask.value) {
    store.toggleWatched(contextMenuTask.value.name)
  }
  closeContextMenu()
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.task-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e0e0e0;
}

.task-list-header {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.search-input {
  width: 100%;
}

.task-list-content {
  flex: 1;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  user-select: none;
}

.task-item:hover {
  background: #f5f5f5;
}

.task-item.is-selected {
  background: #e6f7ff;
  border-left: 3px solid #1890ff;
  padding-left: 9px;
}

.task-item.is-unwatched {
  color: #999;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.task-icon {
  font-size: 8px;
  color: #ccc;
}

.task-icon.watched {
  color: #faad14;
}

.task-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-count {
  font-size: 12px;
  padding: 2px 6px;
  background: #ff4d4f;
  color: #fff;
}

.error-count.is-gray {
  background: #999;
}

.no-tasks {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.task-list-footer {
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #999;
  background: #fafafa;
}

/* Context Menu */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 120px;
  background: #fff;
  border: 1px solid #e0e0e0;
  padding: 4px 0;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
}

.context-menu-item:hover {
  background: #f5f5f5;
}
</style>
