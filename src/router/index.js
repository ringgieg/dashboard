import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/batch-sync'
  },
  {
    path: '/batch-sync',
    name: 'batch-sync',
    children: [
      {
        path: '',
        name: 'batch-sync-home'
      },
      {
        path: ':taskName',
        name: 'batch-sync-task'
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
