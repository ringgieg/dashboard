import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAlertStore = defineStore('alert', () => {
  // Alert state
  const hasAlert = ref(false)
  const alertReasons = ref([])

  /**
   * Trigger an alert
   * @param {string} reason - Reason for the alert
   */
  function triggerAlert(reason) {
    if (!alertReasons.value.includes(reason)) {
      alertReasons.value.push(reason)
    }
    hasAlert.value = true
  }

  /**
   * Dismiss the alert (called when user clicks anywhere)
   */
  function dismissAlert() {
    hasAlert.value = false
    alertReasons.value = []
  }

  /**
   * Remove a specific alert reason
   * @param {string} reason - Reason to remove
   */
  function removeAlertReason(reason) {
    const index = alertReasons.value.indexOf(reason)
    if (index > -1) {
      alertReasons.value.splice(index, 1)
    }
    if (alertReasons.value.length === 0) {
      hasAlert.value = false
    }
  }

  return {
    // State
    hasAlert,
    alertReasons,

    // Actions
    triggerAlert,
    dismissAlert,
    removeAlertReason
  }
})
