<template>
  <div
    v-if="alertStore.hasAlert"
    class="alert-overlay"
    @click="alertStore.dismissAlert"
  >
    <div class="alert-border"></div>
  </div>
</template>

<script setup>
import { useAlertStore } from '../stores/alertStore'

const alertStore = useAlertStore()
</script>

<style scoped>
.alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  pointer-events: auto;
  cursor: pointer;
}

.alert-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  box-shadow: inset 0 0 0 4px #ff4d4f;
  animation: flash-border 0.5s ease-in-out infinite;
}

@keyframes flash-border {
  0%, 100% {
    box-shadow: inset 0 0 0 4px #ff4d4f;
    opacity: 1;
  }
  50% {
    box-shadow: inset 0 0 0 4px #ff4d4f;
    opacity: 0.3;
  }
}
</style>
