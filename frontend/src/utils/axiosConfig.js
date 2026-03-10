import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/',
  timeout: 30000
});

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    if (error.response && error.response.status === 401) {
      // 未授权，跳转到登录页
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;