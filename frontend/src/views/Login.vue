<template>
    <div class="login-container">
      <div class="login-card card">
        <h1>个人笔记本系统</h1>
        
        <div class="tab-control">
          <button 
            :class="['tab-btn', { active: activeTab === 'login' }]"
            @click="activeTab = 'login'"
          >
            登录
          </button>
          <button 
            :class="['tab-btn', { active: activeTab === 'register' }]"
            @click="activeTab = 'register'"
          >
            注册
          </button>
        </div>
  
        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="form-group">
            <input
              v-model="form.username"
              type="text"
              placeholder="用户名"
              required
            >
          </div>
          
          <div class="form-group">
            <input
              v-model="form.password"
              type="password"
              placeholder="密码"
              required
            >
          </div>
  
          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? '处理中...' : (activeTab === 'login' ? '登录' : '注册') }}
          </button>
        </form>
  
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import api from '../utils/axiosConfig'
  
  export default {
    name: 'Login',
    data() {
      return {
        activeTab: 'login',
        form: {
          username: '',
          password: ''
        },
        loading: false,
        error: ''
      }
    },
    methods: {
      async handleSubmit() {
  this.loading = true
  this.error = ''

  try {
    const endpoint = this.activeTab === 'login' ? '/api/login' : '/api/register'
    const response = await api.post(endpoint, {
      username: this.form.username,
      password: this.form.password
    })
    
    console.log('登录响应:', response.data) // 添加调试日志
    
    // 确保正确存储token和用户信息
    sessionStorage.setItem('token', response.data.token)
    sessionStorage.setItem('username', response.data.username)
    
    // 添加短暂延迟确保存储完成
    setTimeout(() => {
      this.$router.push('/index')
    }, 100)
    
  } catch (error) {
    console.error('登录失败详情:', error)
    this.error = error.response?.data?.error || '请求失败: ' + error.message
  } finally {
    this.loading = false
  }
}
    }
  }
  </script>
  
  <style scoped>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .login-card {
    width: 100%;
    max-width: 400px;
    padding: 40px;
    text-align: center;
  }
  
  .login-card h1 {
    margin-bottom: 30px;
    color: var(--primary);
  }
  
  .tab-control {
    display: flex;
    margin-bottom: 30px;
    border-radius: 8px;
    background: var(--bg);
    padding: 4px;
  }
  
  .tab-btn {
    flex: 1;
    padding: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.3s;
  }
  
  .tab-btn.active {
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--primary);
  }
  
  .error-message {
    margin-top: 15px;
    padding: 10px;
    background: #fee2e2;
    color: #dc2626;
    border-radius: 6px;
    font-size: 14px;
  }
  </style>