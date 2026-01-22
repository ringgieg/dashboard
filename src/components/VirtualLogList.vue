<template>
  <div
    ref="containerRef"
    class="virtual-log-list"
    @scroll="handleScroll"
  >
    <!-- Top spacer -->
    <div :style="{ height: topSpacerHeight + 'px' }"></div>

    <!-- Visible items -->
    <div
      v-for="item in visibleItems"
      :key="item.log.id"
      :ref="el => setItemRef(el, item.index)"
      class="log-entry"
      :class="'level-' + (item.log.level || 'info').toLowerCase()"
      :data-index="item.index"
    >
      <div class="log-meta">
        <span class="log-time">{{ formatTime(item.log.timestamp) }}</span>
        <span class="log-level" :class="'level-' + (item.log.level || 'info').toLowerCase()">
          {{ item.log.level || 'INFO' }}
        </span>
        <span v-if="item.log.isNew" class="new-tag">NEW</span>
      </div>
      <div class="log-content" v-html="escapeHtml(item.log.line)"></div>
    </div>

    <!-- Bottom spacer -->
    <div :style="{ height: bottomSpacerHeight + 'px' }"></div>

    <!-- Loading indicator -->
    <div v-if="loading" class="loading-more">
      加载更多...
    </div>

    <!-- End indicator -->
    <div v-if="!hasMore && logs.length > 0" class="no-more">
      已加载全部
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import dayjs from 'dayjs'

const props = defineProps({
  logs: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: true },
  estimatedItemHeight: { type: Number, default: 60 },
  bufferSize: { type: Number, default: 10 }
})

const emit = defineEmits(['load-more'])

const containerRef = ref(null)
const itemHeights = ref({})
const scrollTop = ref(0)
const containerHeight = ref(0)

const BUFFER = props.bufferSize

const visibleRange = computed(() => {
  if (!containerRef.value || props.logs.length === 0) {
    return { start: 0, end: 0 }
  }

  let accumulatedHeight = 0
  let startIndex = 0
  let endIndex = props.logs.length

  for (let i = 0; i < props.logs.length; i++) {
    const itemHeight = itemHeights.value[i] || props.estimatedItemHeight
    if (accumulatedHeight + itemHeight >= scrollTop.value) {
      startIndex = Math.max(0, i - BUFFER)
      break
    }
    accumulatedHeight += itemHeight
  }

  accumulatedHeight = 0
  for (let i = 0; i < props.logs.length; i++) {
    accumulatedHeight += itemHeights.value[i] || props.estimatedItemHeight
    if (accumulatedHeight > scrollTop.value + containerHeight.value) {
      endIndex = Math.min(props.logs.length, i + BUFFER)
      break
    }
  }

  return { start: startIndex, end: endIndex }
})

const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  return props.logs.slice(start, end).map((log, i) => ({
    log,
    index: start + i
  }))
})

const topSpacerHeight = computed(() => {
  let height = 0
  for (let i = 0; i < visibleRange.value.start; i++) {
    height += itemHeights.value[i] || props.estimatedItemHeight
  }
  return height
})

const bottomSpacerHeight = computed(() => {
  let height = 0
  for (let i = visibleRange.value.end; i < props.logs.length; i++) {
    height += itemHeights.value[i] || props.estimatedItemHeight
  }
  return height
})

function setItemRef(el, index) {
  if (el) {
    nextTick(() => {
      if (el && el.offsetHeight) {
        itemHeights.value[index] = el.offsetHeight
      }
    })
  }
}

function handleScroll(event) {
  const target = event.target
  scrollTop.value = target.scrollTop

  const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (scrollBottom < 200 && !props.loading && props.hasMore) {
    emit('load-more')
  }
}

function formatTime(timestamp) {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS')
}

function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function updateContainerHeight() {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
  }
}

watch(() => props.logs.length, () => {
  nextTick(() => {
    updateContainerHeight()
  })
})

let resizeObserver = null

onMounted(() => {
  updateContainerHeight()
  resizeObserver = new ResizeObserver(() => {
    updateContainerHeight()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
.virtual-log-list {
  height: 100%;
  overflow-y: auto;
  background: #fff;
}

.log-entry {
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  border-left: 3px solid #1890ff;
}

.log-entry.level-error {
  border-left-color: #ff4d4f;
  background: #fff2f0;
}

.log-entry.level-warn {
  border-left-color: #faad14;
  background: #fffbe6;
}

.log-entry.level-debug {
  border-left-color: #999;
}

.log-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.log-time {
  font-size: 12px;
  color: #999;
  font-family: Consolas, Monaco, monospace;
}

.log-level {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 4px;
  background: #e6f7ff;
  color: #1890ff;
}

.log-level.level-error {
  background: #fff2f0;
  color: #ff4d4f;
}

.log-level.level-warn {
  background: #fffbe6;
  color: #faad14;
}

.log-level.level-debug {
  background: #f5f5f5;
  color: #999;
}

.new-tag {
  font-size: 10px;
  padding: 1px 4px;
  background: #52c41a;
  color: #fff;
}

.log-content {
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  font-family: Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.loading-more,
.no-more {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
