import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/c/:id(\\d+)', name: 'thread', component: () => import('@/views/ThreadView.vue') },
    { path: '/me', name: 'me', component: () => import('@/views/MeView.vue') },
    { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
    {
      path: '/moderation',
      name: 'moderation',
      component: () => import('@/views/ModerationView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? undefined,
})

/** The feed as it was last seen (page and sort): "← All comments" returns there */
export const feedPath = ref('/')
router.afterEach((to) => {
  if (to.name === 'home') feedPath.value = to.fullPath
})

export default router
