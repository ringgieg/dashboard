<template>
  <div class="navbar">
    <div class="navbar-left">
      <!-- Service Selector -->
      <el-dropdown
        @command="handleServiceSwitch"
        trigger="click"
        class="service-selector"
      >
        <span class="service-button">
          <el-icon><Folder /></el-icon>
          <span>{{ serviceStore.currentServiceDisplayName }}</span>
          <el-icon class="arrow-icon"><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="service in serviceStore.services"
              :key="service.id"
              :command="service.id"
              :disabled="service.id === serviceStore.getCurrentServiceId()"
            >
              {{ service.displayName }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <span class="app-title">{{ serviceStore.currentServiceDisplayName }}</span>

    <div class="navbar-actions">
      <!-- Right side slot for custom actions -->
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useServiceStore } from '../stores/serviceStore'
import { useWsStore } from '../stores/wsStore'
import { useTaskStore } from '../stores/taskStore'
import { getConfig } from '../utils/config'
import { Folder, ArrowDown } from '@element-plus/icons-vue'

const router = useRouter()
const serviceStore = useServiceStore()
const wsStore = useWsStore()
const taskStore = useTaskStore()

async function handleServiceSwitch(serviceId) {
  if (serviceId === serviceStore.getCurrentServiceId()) {
    return
  }

  console.log(`Switching to service: ${serviceId}`)

  // 1. Close WebSocket connection
  wsStore.disconnect()

  // 2. Switch service
  serviceStore.setCurrentService(serviceId)

  // 3. Clear task store
  taskStore.clearTasks()

  // 4. Navigate to new service route
  const basePath = getConfig('routing.basePath', '/logs')
  await router.push(`${basePath}/${serviceId}`)

  // 5. Reload tasks for new service
  await taskStore.loadTasks()

  // 6. Reconnect WebSocket (will use new service config)
  wsStore.connect()
}
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  height: 64px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.navbar-left {
  display: flex;
  align-items: center;
  min-width: 200px;
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  flex: 1;
  text-align: center;
  letter-spacing: -0.025em;
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
  justify-content: flex-end;
}

.service-selector {
  margin-right: 16px;
}

.service-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  user-select: none;
  border: 1px solid var(--el-border-color-light);
}

.service-button:hover {
  background: var(--el-fill-color);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

.arrow-icon {
  font-size: 12px;
  margin-left: 4px;
}
</style>
