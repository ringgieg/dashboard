<template>
  <el-dropdown
    :disabled="disabled"
    trigger="click"
    :placement="placement"
    @command="handleCommand"
    @visible-change="handleVisibleChange"
    @click.stop
  >
    <el-button
      class="am-silence-button"
      :class="`variant-${variant}`"
      :size="size"
      :disabled="disabled"
      :loading="creating"
      :circle="iconOnly"
      :title="showTooltip ? tooltipText : ''"
    >
      <el-icon>
        <MuteNotification />
      </el-icon>
      <span v-if="!iconOnly" class="am-silence-label">{{ resolvedButtonLabel }}</span>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <template v-if="showSilenceSection">
          <el-dropdown-item disabled class="am-silence-section-title">
            &#x5f53;&#x524d;&#x9759;&#x9ed8;
          </el-dropdown-item>
          <el-dropdown-item v-if="loadingSilences" disabled class="am-silence-status">
            &#x52a0;&#x8f7d;&#x4e2d;...
          </el-dropdown-item>
          <template v-else>
            <el-dropdown-item
              v-if="matchingSilences.length === 0"
              disabled
              class="am-silence-status"
            >
              &#x6682;&#x65e0;&#x9759;&#x9ed8;
            </el-dropdown-item>
            <el-dropdown-item
              v-for="silence in matchingSilences"
              :key="silence.id"
              class="am-silence-item"
            >
              <div class="am-silence-row">
                <div class="am-silence-info">
                  <div class="am-silence-comment">
                    {{ silence.comment || 'Alertmanager Silence' }}
                  </div>
                  <div class="am-silence-meta">
                    {{ formatRemainingLabel(silence) || silence.endsAt || '' }}
                  </div>
                </div>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click.stop="handleCancelSilence(silence)"
                >
                  &#x53d6;&#x6d88;
                </el-button>
              </div>
            </el-dropdown-item>
          </template>
          <el-dropdown-item divided disabled class="am-silence-divider"></el-dropdown-item>
        </template>
        <el-dropdown-item
          v-for="option in durationOptions"
          :key="option.minutes"
          :command="option.minutes"
          :disabled="!canSilence"
        >
          <el-icon><Clock /></el-icon>
          <span>{{ option.label }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, MuteNotification } from '@element-plus/icons-vue'
import {
  createAlertmanagerSilence,
  deleteAlertmanagerSilence,
  getAlertmanagerSilences
} from '../api/alertmanager'
import {
  doesAlertmanagerSilenceMatchLabels,
  formatRemainingDurationCompact,
  getRemainingDurationMs,
  isAlertmanagerSilenceActive
} from '../utils/alertmanager'

const props = defineProps({
  alerts: {
    type: Array,
    default: () => []
  },
  alert: {
    type: Object,
    default: null
  },
  labels: {
    type: Object,
    default: null
  },
  excludeLabelKeys: {
    type: Array,
    default: () => []
  },
  allowInternalLabels: {
    type: Boolean,
    default: false
  },
  contextLabel: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    default: 'dashboard'
  },
  comment: {
    type: String,
    default: ''
  },
  placement: {
    type: String,
    default: 'bottom-end'
  },
  size: {
    type: String,
    default: 'small'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  requireAlertmanagerMatch: {
    type: Boolean,
    default: true
  },
  matchMode: {
    type: String,
    default: 'intersection'
  },
  includeAlertnameFallback: {
    type: Boolean,
    default: true
  },
  confirmBeforeCreate: {
    type: Boolean,
    default: true
  },
  variant: {
    type: String,
    default: 'danger'
  },
  iconOnly: {
    type: Boolean,
    default: true
  },
  buttonLabel: {
    type: String,
    default: ''
  },
  showTooltip: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['silenced'])

const creating = ref(false)
const loadingSilences = ref(false)
const silences = ref([])

const excludeLabelKeySet = computed(() => {
  if (!Array.isArray(props.excludeLabelKeys)) return new Set()
  return new Set(
    props.excludeLabelKeys
      .map(key => (key == null ? '' : String(key).trim()))
      .filter(Boolean)
  )
})

const durationOptions = [
  { minutes: 5, label: '\u9759\u9ed8 5 \u5206\u949f' },
  { minutes: 15, label: '\u9759\u9ed8 15 \u5206\u949f' },
  { minutes: 30, label: '\u9759\u9ed8 30 \u5206\u949f' },
  { minutes: 60, label: '\u9759\u9ed8 1 \u5c0f\u65f6' },
  { minutes: 120, label: '\u9759\u9ed8 2 \u5c0f\u65f6' },
  { minutes: 300, label: '\u9759\u9ed8 5 \u5c0f\u65f6' },
  { minutes: 480, label: '\u9759\u9ed8 8 \u5c0f\u65f6' },
  { minutes: 600, label: '\u9759\u9ed8 10 \u5c0f\u65f6' }
]

const tooltipText = '\u9759\u9ed8\u8bbe\u7f6e'

const resolvedButtonLabel = computed(() => {
  if (props.buttonLabel) return props.buttonLabel
  return '\u9759\u9ed8'
})

const candidateAlerts = computed(() => {
  const list = []
  if (Array.isArray(props.alerts) && props.alerts.length > 0) {
    list.push(...props.alerts)
  }
  if (props.alert) {
    list.push(props.alert)
  }
  if (props.requireAlertmanagerMatch) {
    return list.filter(item => item?.alertmanagerMatched)
  }
  return list
})

function isValidLabelEntry(key, value, excludeKeys = null, allowInternal = false) {
  if (!key) return false
  if (excludeKeys && excludeKeys.has(key)) return false
  if (key.startsWith('__') && !allowInternal) return false
  if (value === null || value === undefined) return false
  const stringValue = String(value)
  if (stringValue.length === 0) return false
  return true
}

function normalizeLabels(labels, excludeKeys = null, allowInternal = false) {
  if (!labels || typeof labels !== 'object') return {}
  const result = {}
  Object.entries(labels).forEach(([key, value]) => {
    if (!isValidLabelEntry(key, value, excludeKeys, allowInternal)) return
    result[key] = String(value)
  })
  return result
}

function getCommonLabels(alerts, excludeKeys = null, allowInternal = false) {
  if (!Array.isArray(alerts) || alerts.length === 0) return {}
  const labelMaps = alerts
    .map(item => normalizeLabels(item?.labels, excludeKeys, allowInternal))
    .filter(map => Object.keys(map).length > 0)
  if (labelMaps.length === 0) return {}

  const base = labelMaps[0]
  const common = {}
  Object.entries(base).forEach(([key, value]) => {
    const isCommon = labelMaps.every(map => map[key] === value)
    if (isCommon) {
      common[key] = value
    }
  })
  return common
}

function getFirstLabels(alerts, excludeKeys = null, allowInternal = false) {
  if (!Array.isArray(alerts) || alerts.length === 0) return {}
  return normalizeLabels(alerts[0]?.labels, excludeKeys, allowInternal)
}

const resolvedLabels = computed(() => {
  if (props.labels && typeof props.labels === 'object') {
    return normalizeLabels(props.labels, excludeLabelKeySet.value, props.allowInternalLabels)
  }

  const list = candidateAlerts.value
  if (!Array.isArray(list) || list.length === 0) return {}

  if (props.matchMode === 'first') {
    return getFirstLabels(list, excludeLabelKeySet.value, props.allowInternalLabels)
  }

  const common = getCommonLabels(list, excludeLabelKeySet.value, props.allowInternalLabels)
  if (Object.keys(common).length > 0) {
    return common
  }

  return getFirstLabels(list, excludeLabelKeySet.value, props.allowInternalLabels)
})

function buildMatchers() {
  const labels = { ...resolvedLabels.value }
  if (props.includeAlertnameFallback && !labels.alertname && !excludeLabelKeySet.value.has('alertname')) {
    const primary = candidateAlerts.value[0]
    const fallbackName = primary?.labels?.alertname || primary?.name || ''
    if (fallbackName) {
      labels.alertname = String(fallbackName)
    }
  }

  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({
      name,
      value: String(value),
      isRegex: false
    }))
}

const matchers = computed(() => buildMatchers())

const canSilence = computed(() => {
  if (creating.value) return false
  if (matchers.value.length === 0) return false
  if (props.requireAlertmanagerMatch && candidateAlerts.value.length === 0) return false
  return true
})

const silenceMatchLabels = computed(() => {
  if (props.labels && typeof props.labels === 'object') {
    const normalized = normalizeLabels(props.labels, excludeLabelKeySet.value, props.allowInternalLabels)
    if (Object.keys(normalized).length > 0) {
      return normalized
    }
  }

  const list = candidateAlerts.value
  if (!Array.isArray(list) || list.length === 0) return {}

  let labels = {}
  if (props.matchMode === 'first') {
    labels = getFirstLabels(list, null, props.allowInternalLabels)
  } else {
    labels = getCommonLabels(list, null, props.allowInternalLabels)
    if (Object.keys(labels).length === 0) {
      labels = getFirstLabels(list, null, props.allowInternalLabels)
    }
  }

  if (props.includeAlertnameFallback && !labels.alertname) {
    const primary = list[0]
    const fallbackName = primary?.labels?.alertname || primary?.name || ''
    if (fallbackName) {
      labels.alertname = String(fallbackName)
    }
  }

  return labels
})

const matchingSilences = computed(() => {
  const list = Array.isArray(silences.value) ? silences.value : []
  const labelMap = silenceMatchLabels.value
  if (!labelMap || Object.keys(labelMap).length === 0) return []

  return list.filter(silence => {
    if (!isAlertmanagerSilenceActive(silence)) return false
    return doesAlertmanagerSilenceMatchLabels(silence, labelMap)
  })
})

const showSilenceSection = computed(() => {
  if (props.requireAlertmanagerMatch && candidateAlerts.value.length === 0) return false
  return true
})

async function fetchSilences() {
  try {
    loadingSilences.value = true
    const response = await getAlertmanagerSilences()
    if (Array.isArray(response)) {
      silences.value = response
    } else if (Array.isArray(response?.data)) {
      silences.value = response.data
    } else {
      silences.value = []
    }
  } catch (error) {
    console.error('[Alertmanager] Failed to fetch silences:', error)
    silences.value = []
  } finally {
    loadingSilences.value = false
  }
}

function formatRemainingLabel(silence) {
  const remainingMs = getRemainingDurationMs(silence?.endsAt)
  const compact = formatRemainingDurationCompact(remainingMs)
  if (!compact) return ''
  return `\u5269\u4f59 ${compact}`
}

async function handleCancelSilence(silence) {
  const silenceId = silence?.id
  if (!silenceId) return

  try {
    await deleteAlertmanagerSilence(silenceId)
    ElMessage.success('\u5df2\u53d6\u6d88 Alertmanager \u9759\u9ed8')
    await fetchSilences()
  } catch (error) {
    console.error('[Alertmanager] Failed to delete silence:', error)
    ElMessage.error('\u53d6\u6d88 Alertmanager \u9759\u9ed8\u5931\u8d25')
  }
}

function handleVisibleChange(visible) {
  if (visible) {
    fetchSilences()
  }
}

async function confirmCreateSilence() {
  if (!props.confirmBeforeCreate) return true

  try {
    await ElMessageBox.confirm(
      '\u8bf7\u786e\u8ba4\u662f\u5426\u9759\u9ed8\u8be5\u544a\u8b66\uff0c\u7535\u8bdd\u3001\u4f01\u4e1a\u5fae\u4fe1\u7b49\u901a\u77e5\u4e5f\u4f1a\u4e00\u5e76\u88ab\u9759\u9ed8\u3002',
      '\u9759\u9ed8\u786e\u8ba4',
      {
        confirmButtonText: '\u786e\u5b9a',
        cancelButtonText: '\u53d6\u6d88',
        type: 'warning',
        closeOnClickModal: false
      }
    )
    return true
  } catch (error) {
    return false
  }
}

function buildComment() {
  if (props.comment) return props.comment
  if (props.contextLabel) {
    return `Dashboard silence: ${props.contextLabel}`
  }
  return 'Dashboard silence'
}

async function handleCommand(minutes) {
  const durationMinutes = Number(minutes)
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return
  }

  if (!canSilence.value || props.disabled) {
    ElMessage.warning('\u65e0\u6cd5\u521b\u5efa\u9759\u9ed8')
    return
  }

  const allowed = await confirmCreateSilence()
  if (!allowed) {
    return
  }

  const payload = {
    matchers: matchers.value,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
    createdBy: props.createdBy,
    comment: buildComment()
  }

  try {
    creating.value = true
    await createAlertmanagerSilence(payload)
    ElMessage.success('\u5df2\u521b\u5efa Alertmanager \u9759\u9ed8')
    await fetchSilences()
    emit('silenced', { durationMinutes, matchers: payload.matchers })
  } catch (error) {
    console.error('[Alertmanager] Failed to create silence:', error)
    ElMessage.error('\u521b\u5efa Alertmanager \u9759\u9ed8\u5931\u8d25')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.am-silence-button {
  border-width: 1px;
  transition: all 0.2s ease;
}

.am-silence-button .el-icon {
  font-size: 14px;
}

.am-silence-button.variant-danger {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.am-silence-button.variant-danger:hover {
  background: var(--el-color-danger-light-8);
  border-color: var(--el-color-danger-light-3);
  color: var(--el-color-danger-dark-2);
}

.am-silence-button.variant-danger:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-danger) 25%, transparent);
}

.am-silence-button.variant-neutral {
  background: var(--el-fill-color-lighter);
  border-color: var(--el-border-color-lighter);
  color: var(--el-text-color-regular);
}

.am-silence-button.variant-neutral:hover {
  background: var(--el-fill-color);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

.am-silence-label {
  margin-left: 6px;
  font-size: 12px;
}

.am-silence-section-title {
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.am-silence-status {
  color: var(--el-text-color-secondary);
}

.am-silence-item {
  padding: 0;
}

.am-silence-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
}

.am-silence-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.am-silence-comment {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.am-silence-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
