<template>
  <div class="navbar">
    <span class="service-name">Batch-Sync</span>
    <el-badge
      v-if="store.totalWatchedErrors > 0"
      :value="store.totalWatchedErrors"
      class="error-badge"
    />
  </div>
</template>

<script setup>
import { useTaskStore } from '../stores/taskStore'

const store = useTaskStore()
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.service-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.error-badge :deep(.el-badge__content) {
  background: #ff4d4f;
}
</style>
