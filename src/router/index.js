import { createRouter, createWebHistory } from 'vue-router'
import { getCurrentServiceId, getServiceType } from '../utils/config'
import LokiMultitaskMode from '../views/loki/LokiMultitaskMode.vue'
import PrometheusMultitaskMode from '../views/prometheus/PrometheusMultitaskMode.vue'

const logsBasePath = '/logs'
const prometheusBasePath = '/prometheus'

const routes = [
  {
    path: '/',
    redirect: () => {
      const serviceId = getCurrentServiceId()
      const serviceType = getServiceType(serviceId)

      if (serviceType === 'prometheus-multitask') {
        return `${prometheusBasePath}/${serviceId}`
      } else {
        return `${logsBasePath}/${serviceId}`
      }
    }
  },
  // Loki routes
  {
    path: `${logsBasePath}/:serviceId`,
    name: 'service-logs',
    component: LokiMultitaskMode,
    props: true
  },
  {
    path: `${logsBasePath}/:serviceId/:taskName`,
    name: 'service-task-logs',
    component: LokiMultitaskMode,
    props: true
  },
  // Prometheus routes
  {
    path: `${prometheusBasePath}/:serviceId`,
    name: 'service-prometheus',
    component: PrometheusMultitaskMode,
    props: true
  },
  {
    path: `${prometheusBasePath}/:serviceId/:taskName`,
    name: 'service-task-prometheus',
    component: PrometheusMultitaskMode,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
