import { createRouter, createWebHistory } from 'vue-router'
import { getConfig } from '../utils/config'

const basePath = getConfig('routing.basePath', '/logs')

const routes = [
  {
    path: '/',
    redirect: basePath
  },
  {
    path: basePath,
    name: 'batch-sync'
  },
  {
    path: `${basePath}/:taskName`,
    name: 'batch-sync-task'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
