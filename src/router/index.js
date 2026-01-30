import { createRouter, createWebHistory } from 'vue-router'
import { getConfig, getCurrentServiceId } from '../utils/config'

const basePath = getConfig('routing.basePath', '/logs')

// Dummy component for routes (App.vue handles all rendering)
const RouteView = { template: '<div></div>' }

const routes = [
  {
    path: '/',
    redirect: () => {
      const serviceId = getCurrentServiceId()
      return `${basePath}/${serviceId}`
    }
  },
  {
    path: `${basePath}/:serviceId`,
    name: 'service-logs',
    component: RouteView,
    props: true
  },
  {
    path: `${basePath}/:serviceId/:taskName`,
    name: 'service-task-logs',
    component: RouteView,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
