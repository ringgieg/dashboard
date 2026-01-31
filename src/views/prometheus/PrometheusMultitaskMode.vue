<template>
  <div class="prometheus-multitask-mode">
    <aside class="mode-sidebar">
      <PrometheusTaskList :kiosk-mode="kioskMode" />
    </aside>
    <main class="mode-content">
      <PrometheusMonitor />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePrometheusStore } from '../../stores/prometheusStore'
import { useServiceStore } from '../../stores/serviceStore'
import PrometheusTaskList from './components/PrometheusTaskList.vue'
import PrometheusMonitor from './components/PrometheusMonitor.vue'

const route = useRoute()
const prometheusStore = usePrometheusStore()
const serviceStore = useServiceStore()

// Check if kiosk mode is enabled via URL parameter
const kioskMode = computed(() => route.query.kiosk === '1')

onMounted(async () => {
  console.log('[PrometheusMultitaskMode] Initializing for service:', route.params.serviceId)

  // CRITICAL: Set current service BEFORE initializing stores
  // This ensures stores use the correct serviceId for localStorage keys
  const serviceId = route.params.serviceId
  if (serviceId) {
    serviceStore.setCurrentService(serviceId)
  }

  // Initialize prometheus store
  await prometheusStore.initialize()

  console.log('[PrometheusMultitaskMode] Initialized')
})

onUnmounted(() => {
  console.log('[PrometheusMultitaskMode] Cleaning up...')

  // Cleanup: stop polling
  prometheusStore.cleanup()

  console.log('[PrometheusMultitaskMode] Cleaned up')
})
</script>

<style scoped>
.prometheus-multitask-mode {
  display: flex;
  height: 100%;
  width: 100%;
}

.mode-sidebar {
  width: 280px;
  flex-shrink: 0;
  overflow: hidden;
}

.mode-content {
  flex: 1;
  overflow: hidden;
}
</style>
