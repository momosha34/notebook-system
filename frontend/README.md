# notebook-frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

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

**解决方法**: 使用本地 Font Awesome

```bash
# 安装本地依赖
npm install @fortawesome/fontawesome-free

# 在 main.js 中导入
import '@fortawesome/fontawesome-free/css/all.min.css'
```

### 3. 502 Bad Gateway

**原因**: 后端服务未运行或端口未监听。

**排查步骤**:

```bash
# 检查服务状态
pm2 status

# 检查端口监听
ss -tlnp | grep 3000

# 查看日志
pm2 logs notebook-backend --lines 50
```

### 4. 图片无法显示

**原因**: 图片 URL 中包含 `localhost:3000` 硬编码。

**解决方法**: 使用相对路径，已在 `imageUtils.js` 中处理。

### 5. 分享链接显示 JSON 而非页面

**原因**: Nginx 未正确配置前端路由的 `try_files`。

**解决方法**: 确保 Nginx 配置包含：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```
