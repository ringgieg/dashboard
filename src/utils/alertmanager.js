const IGNORED_MATCH_LABEL_KEYS = new Set(['alertgroup', 'component', 'name'])

export function extractAlertmanagerReceivers(alert) {
  if (!alert) return []

  if (Array.isArray(alert.receivers)) {
    return alert.receivers
      .map(receiver => (receiver?.name ? receiver.name : receiver))
      .map(name => (name == null ? '' : String(name).trim()))
      .filter(Boolean)
  }

  if (alert.receiver) {
    const name = String(alert.receiver).trim()
    return name ? [name] : []
  }

  return []
}

export function filterAlertmanagerAlertsByReceivers(alertsList, receiverNames) {
  if (!Array.isArray(alertsList) || receiverNames.length === 0) {
    return []
  }

  const receiverSet = new Set(receiverNames)

  return alertsList.filter(alert => {
    const receivers = extractAlertmanagerReceivers(alert)
    return receivers.some(name => receiverSet.has(name))
  })
}

function getMatchableLabelEntries(labels) {
  if (!labels || typeof labels !== 'object') return []
  return Object.entries(labels).filter(([key, value]) => {
    if (!key) return false
    if (key.startsWith('__')) return false
    if (IGNORED_MATCH_LABEL_KEYS.has(key)) return false
    return value !== null && value !== undefined && String(value).length > 0
  })
}

export function buildAlertmanagerMatchKey(alert) {
  const entries = getMatchableLabelEntries(alert?.labels)
  if (entries.length > 0) {
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('|')
  }

  const fingerprint = alert?.fingerprint || alert?.labels?.fingerprint
  if (fingerprint) {
    return `fingerprint:${fingerprint}`
  }

  return ''
}

export function applyAlertmanagerReceiverMapping(vmalertAlerts, receiverAlerts) {
  const receiverMap = new Map()

  receiverAlerts.forEach(alert => {
    const key = buildAlertmanagerMatchKey(alert)
    if (!key) return

    const receivers = extractAlertmanagerReceivers(alert)
    if (receivers.length === 0) return

    if (!receiverMap.has(key)) {
      receiverMap.set(key, new Set())
    }
    const receiverSet = receiverMap.get(key)
    receivers.forEach(name => receiverSet.add(name))
  })

  vmalertAlerts.forEach(alert => {
    const key = buildAlertmanagerMatchKey(alert)
    const receiverSet = receiverMap.get(key)
    alert.alertmanagerReceivers = receiverSet ? Array.from(receiverSet) : []
    alert.alertmanagerMatched = !!receiverSet
  })
}

export function resolveAlertmanagerState(alert) {
  if (!alert) return 'inactive'
  if (alert.state) return alert.state
  const statusState = alert.status?.state
  if (statusState) return statusState
  return 'inactive'
}

export function isAlertmanagerSilenceActive(silence) {
  const state = silence?.status?.state
  if (state && state !== 'active' && state !== 'pending') {
    return false
  }
  const endsAt = silence?.endsAt
  if (endsAt) {
    const endTime = new Date(endsAt).getTime()
    if (Number.isFinite(endTime) && endTime <= Date.now()) {
      return false
    }
  }
  return true
}

export function getRemainingDurationMs(endsAt, nowMs = Date.now()) {
  if (!endsAt) return 0
  const endTime = new Date(endsAt).getTime()
  if (!Number.isFinite(endTime)) return 0
  const remainingMs = endTime - nowMs
  if (remainingMs <= 0) return 0
  return remainingMs
}

export function formatRemainingDurationCompact(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return ''
  const totalMinutes = Math.ceil(remainingMs / 60000)
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return ''

  const minutesPerHour = 60
  const minutesPerDay = 60 * 24

  if (totalMinutes >= minutesPerDay) {
    const days = Math.floor(totalMinutes / minutesPerDay)
    const hours = Math.floor((totalMinutes % minutesPerDay) / minutesPerHour)
    let result = `${days}d`
    if (hours > 0) {
      result += `${hours}h`
    }
    return result
  }

  if (totalMinutes >= minutesPerHour) {
    const hours = Math.floor(totalMinutes / minutesPerHour)
    const minutes = totalMinutes % minutesPerHour
    let result = `${hours}h`
    if (minutes > 0) {
      result += `${minutes}m`
    }
    return result
  }

  return `${totalMinutes}m`
}

export function doesAlertmanagerSilenceMatchLabels(silence, labels) {
  const matchers = Array.isArray(silence?.matchers) ? silence.matchers : []
  if (matchers.length === 0) return false
  const labelMap = labels || {}

  return matchers.every(matcher => {
    const name = matcher?.name
    if (!name) return false
    const value = labelMap[name]
    if (value === null || value === undefined) return false
    const labelValue = String(value)
    const matcherValue = matcher?.value == null ? '' : String(matcher.value)

    if (matcher?.isRegex) {
      try {
        return new RegExp(matcherValue).test(labelValue)
      } catch (error) {
        return false
      }
    }

    return labelValue === matcherValue
  })
}

export function doesAlertmanagerSilenceMatchAlert(silence, alert) {
  return doesAlertmanagerSilenceMatchLabels(silence, alert?.labels || {})
}
