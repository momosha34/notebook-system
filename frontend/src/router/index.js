import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Index from '@/views/Index.vue'
import Edit from '@/views/Edit.vue'
import Share from '@/views/Share.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: Login },
  { path: '/index', name: 'Index', component: Index },
  { path: '/edit', name: 'Edit', component: Edit },
  { path: '/edit/:id', name: 'EditNote', component: Edit },
  { path: '/s/:shareId', name: 'Share', component: Share }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = sessionStorage.getItem('token')
  console.log('路由守卫: ', to.path, 'token:', token) // 添加调试日志
  
  // 允许分享页面无需登录
  if (to.path.startsWith('/s/')) {
    next()
  } else if (to.path !== '/login' && !token) {
    console.log('未登录，跳转到登录页')
    next('/login')
  } else if (to.path === '/login' && token) {
    console.log('已登录，跳转到首页')
    next('/index')
  } else {
    console.log('正常导航')
    next()
  }
})

export default router