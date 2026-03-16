# notebook-frontend

个人笔记本系统前端项目，使用 Vue 3 + Vite 构建。

## 技术栈

- **框架**: Vue 3
- **构建工具**: Vite 7.x
- **路由**: Vue Router 4
- **HTTP 客户端**: Axios
- **富文本编辑器**: Quill 1.3.7
- **表格编辑器**: Luckysheet 2.1.13
- **图标库**: Font Awesome 7.2.0（本地安装）

## 推荐 IDE 设置

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (并禁用 Vetur)。

## 推荐浏览器设置

- Chromium 内核浏览器（Chrome、Edge、Brave 等）：
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [在 Chrome DevTools 中启用自定义对象格式化](http://bit.ly/object-formatters)
- Firefox：
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [在 Firefox DevTools 中启用自定义对象格式化](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## 自定义配置

参阅 [Vite 配置参考](https://vite.dev/config/)。

## 项目设置

```bash
# 安装依赖
npm install
```

### 开发模式（编译和热重载）

```bash
npm run dev
```

开发服务器默认运行在 http://localhost:5173，Vite 会自动代理 API 请求到后端（http://localhost:3000）。

### 生产模式构建（编译和压缩）

```bash
npm run build
```

构建产物输出到 `dist` 目录，包含优化后的静态文件，可直接部署到 Web 服务器。

### 预览生产构建

```bash
npm run preview
```

在本地预览生产构建结果。

---

## 项目结构

```
frontend/
├── public/                   # 静态资源（不经过构建）
│   └── favicon.ico
├── src/
│   ├── assets/               # 静态资源（经过构建）
│   │   ├── base.css
│   │   ├── logo.svg
│   │   └── main.css
│   ├── components/           # Vue 组件
│   │   ├── icons/            # 图标组件
│   │   ├── AdvancedSheetEditor.vue  # Luckysheet 表格编辑器
│   │   ├── NoteCard.vue             # 笔记卡片
│   │   ├── RichEditor.vue           # Quill 富文本编辑器
│   │   ├── TheWelcome.vue
│   │   └── WelcomeItem.vue
│   ├── config/               # 配置
│   │   ├── apiPaths.js       # API 路径定义
│   │   └── index.js          # 配置入口
│   ├── router/               # 路由
│   │   └── index.js          # 路由配置 + 守卫
│   ├── utils/                # 工具函数
│   │   ├── axiosConfig.js    # Axios 实例 + 拦截器
│   │   ├── imageUtils.js     # 图片 URL 处理
│   │   └── tableExport.js    # 表格导出
│   ├── views/                # 页面视图
│   │   ├── Edit.vue          # 笔记编辑页
│   │   ├── Index.vue         # 首页（笔记列表）
│   │   ├── Login.vue         # 登录页
│   │   └── Share.vue         # 分享页
│   ├── App.vue               # 根组件
│   └── main.js               # 应用入口
├── dist/                     # 构建输出
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 核心功能

### 1. 用户认证
- 登录/注册页面
- JWT Token 存储（sessionStorage）
- 路由守卫（未登录跳转登录页）
- Axios 请求拦截器（自动添加 Authorization header）
- 401 自动跳转登录

### 2. 笔记管理
- 笔记列表展示
- 笔记卡片（相对时间显示，每30秒同步）
- 全文搜索
- 创建/编辑笔记
- 软删除/恢复/永久删除
- 回收站功能

### 3. 富文本编辑
- Quill 富文本编辑器
- 图片上传（支持拖拽）
- 图片自动压缩
- 按用户分目录存储

### 4. 表格编辑
- Luckysheet 在线表格编辑器
- 表格数据 JSON 存储
- 表格数据邮件渲染

### 5. 分享功能
- 分享链接生成（/s/{id}）
- 分享页面公开访问
- 邮件发送（SendCloud API）
- CID 内嵌图片

---

## 环境变量

可以创建 `.env` 文件进行环境配置：

```env
# API 基础 URL（生产环境）
VITE_API_BASE_URL=https://your-domain.com
```

---

## 服务器部署常见问题

### 1. sqlite3 模块报错 `invalid ELF header`

**原因**: `node_modules` 从 Windows 上传到 Linux 服务器，原生模块（如 sqlite3）的二进制文件不兼容。

**解决方法**: 在服务器上重新安装依赖

```bash
cd /var/www/notebook-system/backend
rm -rf node_modules package-lock.json
npm install
pm2 restart notebook-backend
```

如果编译失败，先安装编译工具：

```bash
sudo apt install -y build-essential python3
npm install
```

### 2. Font Awesome CDN 被浏览器阻止

**原因**: 浏览器的跟踪防护功能会阻止某些 CDN 资源。

**解决方法**: 系统已使用本地 Font Awesome，确保前端构建时包含该依赖。

```bash
# 安装本地依赖
npm install @fortawesome/fontawesome-free

# 在 main.js 中导入（已配置）
import '@fortawesome/fontawesome-free/css/all.min.css'
```

### 3. 502 Bad Gateway

**原因**: 后端服务未运行或端口未监听。

**排查步骤**:

```bash
# 检查服务状态
pm2 status
# 或
sudo systemctl status notebook-backend

# 检查端口监听
ss -tlnp | grep 3000

# 查看日志
pm2 logs notebook-backend --lines 50
# 或
sudo journalctl -u notebook-backend -n 50 -f
```

### 4. 图片无法显示

**原因**: 图片 URL 中包含 `localhost:3000` 硬编码，或上传目录权限问题。

**解决方法**:
- 系统已使用相对路径，已在 `imageUtils.js` 中处理
- 检查上传目录权限：`sudo chown -R www-data:www-data /var/www/html/notebook-system/backend/uploads`

### 5. 分享链接显示 JSON 而非页面

**原因**: Nginx 未正确配置前端路由的 `try_files`。

**解决方法**: 确保 Nginx 配置包含：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 6. 时间显示相差 8 小时

**原因**: 旧版本使用 UTC 时间，当前版本已改为本地时间。

**解决方法**: 系统已修复，使用服务器本地时间存储和显示，前端直接解析本地时间字符串。

---

## 开发代理配置

`vite.config.js` 中已配置开发环境代理，将 API 请求代理到后端：

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    },
    '/send-email': {
      target: 'http://localhost:3000',
      changeOrigin: true
    },
    '/uploads': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

---

## 相关文档

- [项目结构文档](../PROJECT_STRUCTURE.md)
- [关键代码实现](../KEY_IMPLEMENTATIONS.md)
- [部署指南](../DEPLOYMENT.md)
- [全文搜索](../FULLTEXT_SEARCH.md)
- [邮件图片限制](../EMAIL_IMAGE_LIMITATIONS.md)

---

**文档版本**: 2.0  
**最后更新**: 2026-03-16
