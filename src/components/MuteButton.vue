<template>
  <el-dropdown @command="handleMuteCommand" trigger="click" placement="bottom-end">
    <el-button
      :type="alertStore.muteUntil === -1 ? 'danger' : (alertStore.isMuted ? 'warning' : 'default')"
      :size="size"
    >
      <el-icon>
        <MuteNotification v-if="alertStore.muteUntil === -1" />
        <Bell v-else />
      </el-icon>
      <span v-if="alertStore.muteUntil === -1">&#x6c38;&#x4e45;&#x9759;&#x97f3;</span>
      <span v-else>&#x9759;&#x97f3;&#x8bbe;&#x7f6e;</span>
      <el-badge
        v-if="alertStore.isMuted && alertStore.muteUntil !== -1"
        :value="alertStore.getRemainingMuteMinutes() + 'm'"
        class="mute-badge"
      />
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="0" :disabled="!alertStore.isMuted">
          <el-icon><CircleClose /></el-icon>
          <span>&#x53d6;&#x6d88;&#x9759;&#x97f3;</span>
        </el-dropdown-item>
        <el-dropdown-item divided command="5">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 5 &#x5206;&#x949f;</span>
        </el-dropdown-item>
        <el-dropdown-item command="15">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 15 &#x5206;&#x949f;</span>
        </el-dropdown-item>
        <el-dropdown-item command="30">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 30 &#x5206;&#x949f;</span>
        </el-dropdown-item>
        <el-dropdown-item command="60">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 1 &#x5c0f;&#x65f6;</span>
        </el-dropdown-item>
        <el-dropdown-item command="120">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 2 &#x5c0f;&#x65f6;</span>
        </el-dropdown-item>
        <el-dropdown-item command="300">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 5 &#x5c0f;&#x65f6;</span>
        </el-dropdown-item>
        <el-dropdown-item command="480">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 8 &#x5c0f;&#x65f6;</span>
        </el-dropdown-item>
        <el-dropdown-item command="600">
          <el-icon><Clock /></el-icon>
          <span>&#x9759;&#x97f3; 10 &#x5c0f;&#x65f6;</span>
        </el-dropdown-item>
        <el-dropdown-item divided command="-1">
          <el-icon><BellFilled /></el-icon>
          <span>&#x6c38;&#x4e45;&#x9759;&#x97f3;</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { useAlertStore } from '../stores/alertStore'
import { Bell, BellFilled, Clock, CircleClose, MuteNotification } from '@element-plus/icons-vue'

// Props
const props = defineProps({
  size: {
    type: String,
    default: 'default'
  }
})

const alertStore = useAlertStore()

function handleMuteCommand(minutes) {
  const min = parseInt(minutes, 10)
  alertStore.setMute(min)
}
</script>

<style scoped>
.mute-badge {
  position: absolute;
  top: -8px;
  right: -8px;
}
</style>
