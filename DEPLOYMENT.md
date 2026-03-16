# 个人笔记本系统 - 服务器部署指南

本文档详细说明如何在 Ubuntu 服务器上部署个人笔记本系统，包括环境准备、项目配置、Nginx 反向代理、Systemd 服务管理等完整步骤。

---

## 服务器信息示例

- **服务器IP**: 你的服务器 IP（例如：47.107.47.221）
- **后端路径**: /var/www/html/notebook-system/backend
- **前端路径**: /var/www/html/notebook-system/frontend/dist
- **域名**: notebook-system.xyz（可选）

---

## 快速部署命令

### 上传文件到服务器

```bash
# 上传后端文件
scp -r e:\notebook-system\backend\* root@你的服务器IP:/var/www/html/notebook-system/backend/

# 上传前端构建产物
scp -r e:\notebook-system\frontend\dist\* root@你的服务器IP:/var/www/html/notebook-system/frontend/dist/
```

### 服务器端操作

```bash
# SSH登录服务器
ssh root@你的服务器IP

# 重启后端服务
systemctl restart notebook-backend

# 重载Nginx配置
nginx -s reload
```

---

## 环境要求

| 组件 | 版本要求 | 说明 |
|-----|---------|-----|
| **操作系统** | Ubuntu 20.04+ | 推荐 Ubuntu 24.04 LTS |
| **Node.js** | 20.x 或更高版本 | 使用 NodeSource 安装 |
| **Nginx** | 最新稳定版 | 用于反向代理和静态文件服务 |
| **内存** | 至少 2GB | 推荐 4GB+ |
| **磁盘** | 至少 10GB 可用空间 | 用于存储数据库和上传文件 |

---

## 一、环境准备

### 1. 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. 安装 Node.js

```bash
# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node -v
npm -v
```

### 3. 安装 Nginx

```bash
sudo apt install -y nginx

# 验证安装
nginx -v

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4. 安装 PM2（进程管理器，可选）

```bash
sudo npm install -g pm2

# 验证安装
pm2 -v
```

### 5. 安装编译工具（用于 sqlite3 等原生模块）

```bash
sudo apt install -y build-essential python3
```

---

## 二、项目部署

### 1. 创建项目目录

```bash
sudo mkdir -p /var/www/html/notebook-system
sudo chown -R $USER:$USER /var/www/html/notebook-system
cd /var/www/html/notebook-system
```

### 2. 上传项目文件

**方式 1：使用 scp（从本地 Windows 上传）**

```powershell
# 在本地 PowerShell 中执行
# 上传后端
scp -r e:\notebook-system\backend\* root@你的服务器IP:/var/www/html/notebook-system/backend/

# 上传 nginx 配置
scp e:\notebook-system\nginx.conf.example root@你的服务器IP:/var/www/html/notebook-system/

# 上传 systemd 服务文件
scp e:\notebook-system\notebook-backend.service root@你的服务器IP:/var/www/html/notebook-system/
```

**方式 2：使用 git（推荐）**

```bash
cd /var/www/html/notebook-system
git clone your-repository-url .
```

### 3. 安装后端依赖

```bash
cd /var/www/html/notebook-system/backend
npm install --production
```

**⚠️ 重要提示**：
- 如果是从 Windows 上传的 node_modules，务必删除后重新安装，否则会出现 `invalid ELF header` 错误
- 如果 sqlite3 编译失败，确保已安装 build-essential 和 python3

```bash
# 如有需要，重新安装依赖
rm -rf node_modules package-lock.json
npm install --production
```

### 4. 构建前端（本地操作）

前端需要在本地构建后再上传到服务器：

```powershell
# 在本地 Windows PowerShell 中执行
cd e:\notebook-system\frontend
npm install
npm run build

# 构建完成后，上传 dist 目录到服务器
scp -r dist\* root@你的服务器IP:/var/www/html/notebook-system/frontend/dist/
```

---

## 三、配置 Nginx

### 1. 复制 Nginx 配置

```bash
# 复制配置文件到 Nginx 站点目录
sudo cp /var/www/html/notebook-system/nginx.conf.example /etc/nginx/sites-available/notebook

# 创建软链接到 sites-enabled
sudo ln -s /etc/nginx/sites-available/notebook /etc/nginx/sites-enabled/

# 删除默认站点（可选）
sudo rm /etc/nginx/sites-enabled/default
```

### 2. 修改配置文件

编辑 `/etc/nginx/sites-available/notebook`，将 `your-domain.com` 替换为你的实际域名或服务器 IP：

```bash
sudo nano /etc/nginx/sites-available/notebook
```

主要修改项：
- `server_name`: 改为你的域名或服务器 IP
- `root`: 确认前端路径正确
- 检查代理配置中的端口是否正确（默认 3000）

### 3. 测试并重启 Nginx

```bash
# 测试配置文件语法
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 查看 Nginx 状态
sudo systemctl status nginx
```

### 4. nginx.conf.example 配置说明

```nginx
server {
    listen 80;
    server_name notebook-system.xyz www.notebook-system.xyz;  # 改为你的域名
    
    root /var/www/notebook-system/frontend/dist;  # 前端构建产物路径
    index index.html;
    
    client_max_body_size 50M;  # 最大上传大小 50MB
    
    # 前端路由，支持 Vue Router history 模式
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;  # 邮件发送可能需要较长时间
        proxy_connect_timeout 75s;
    }
    
    # 邮件发送接口代理
    location /send-email {
        proxy_pass http://localhost:3000;
        # ... 其他配置同 /api/
    }
    
    # 上传文件代理
    location /uploads/ {
        proxy_pass http://localhost:3000;
        expires 7d;  # 缓存 7 天
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
}
```

---

## 四、启动后端服务

### 方式 1：使用 Systemd（推荐，生产环境）

```bash
# 复制服务文件
sudo cp /var/www/html/notebook-system/notebook-backend.service /etc/systemd/system/

# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable notebook-backend

# 启动服务
sudo systemctl start notebook-backend

# 查看服务状态
sudo systemctl status notebook-backend

# 查看服务日志
sudo journalctl -u notebook-backend -f
```

**notebook-backend.service 配置说明：**

```ini
[Unit]
Description=Notebook Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/html/notebook-system/backend
ExecStart=/usr/bin/node /var/www/html/notebook-system/backend/app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 方式 2：使用 PM2

```bash
cd /var/www/html/notebook-system/backend

# 启动服务
pm2 start app.js --name notebook-backend

# 设置开机自启
pm2 save
pm2 startup

# 查看服务状态
pm2 status

# 查看日志
pm2 logs notebook-backend

# 重启服务
pm2 restart notebook-backend
```

---

## 五、配置防火墙

```bash
# 允许 SSH
sudo ufw allow ssh

# 允许 Nginx Full（HTTP 和 HTTPS）
sudo ufw allow 'Nginx Full'

# 启用防火墙
sudo ufw enable

# 查看防火墙状态
sudo ufw status
```

---

## 六、配置 SSL（可选但推荐）

### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot 和 Nginx 插件
sudo apt install -y certbot python3-certbot-nginx

# 获取并安装证书（自动配置 Nginx）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 证书自动续期（Certbot 会自动配置）
sudo certbot renew --dry-run
```

Certbot 会自动：
- 获取 SSL 证书
- 配置 Nginx 重定向 HTTP 到 HTTPS
- 设置自动续期任务

---

## 七、验证部署

### 1. 检查服务状态

```bash
# 检查后端服务（Systemd）
sudo systemctl status notebook-backend

# 或检查 PM2
pm2 status

# 检查 Nginx
sudo systemctl status nginx

# 检查端口监听
ss -tlnp | grep -E ':(80|443|3000)'
```

### 2. 测试访问

- **前端**: http://你的服务器IP 或 https://你的域名
- **后端 API**: http://你的服务器IP/api 或 https://你的域名/api
- **健康检查**: 访问根路径应该返回 JSON 响应

### 3. 查看日志

```bash
# 后端日志（Systemd）
sudo journalctl -u notebook-backend -n 50 -f

# 或后端日志（PM2）
pm2 logs notebook-backend --lines 50

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 八、常见问题排查

### 1. sqlite3 模块报错 `invalid ELF header`

**原因**: `node_modules` 从 Windows 上传到 Linux 服务器，原生模块二进制文件不兼容。

**解决方法**: 在服务器上重新安装依赖

```bash
cd /var/www/html/notebook-system/backend
rm -rf node_modules package-lock.json
npm install --production
sudo systemctl restart notebook-backend
```

如果编译失败，先安装编译工具：
```bash
sudo apt install -y build-essential python3
npm install --production
```

### 2. 图片无法显示

**排查步骤**:
1. 检查 `/var/www/html/notebook-system/backend/uploads` 目录权限
2. 检查 Nginx 配置中的 `/uploads/` 代理设置
3. 检查上传目录是否存在：`ls -la /var/www/html/notebook-system/backend/uploads/`
4. 修复权限：`sudo chown -R www-data:www-data /var/www/html/notebook-system/backend/uploads`

### 3. API 请求失败（502 Bad Gateway）

**原因**: 后端服务未运行或端口未监听。

**排查步骤**:
```bash
# 检查服务状态
sudo systemctl status notebook-backend

# 检查端口监听
ss -tlnp | grep 3000

# 查看后端日志
sudo journalctl -u notebook-backend -n 50

# 尝试手动启动后端
cd /var/www/html/notebook-system/backend
node app.js
```

### 4. 邮件发送失败

**排查步骤**:
1. 检查 SendCloud API 配置是否正确
2. 检查服务器是否允许出站 HTTPS 连接（443端口）
3. 查看后端日志，确认具体错误信息
4. 检查邮件内容大小是否超限

### 5. 分享链接显示 JSON 而非页面

**原因**: Nginx 未正确配置前端路由的 `try_files`。

**解决方法**: 确保 Nginx 配置包含：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 6. Font Awesome 图标不显示

**原因**: 浏览器的跟踪防护功能阻止 CDN 资源，或本地 Font Awesome 未正确安装。

**解决方法**: 系统已使用本地 Font Awesome，确保前端构建时包含了该依赖。

### 7. 时间显示相差 8 小时

**原因**: 旧版本使用 UTC 时间，当前版本已改为本地时间。

**解决方法**: 系统已修复，使用服务器本地时间存储和显示。

---

## 九、维护命令

### 更新代码

```bash
cd /var/www/html/notebook-system
git pull

# 更新后端依赖
cd backend
npm install --production
sudo systemctl restart notebook-backend

# 更新前端（本地构建后上传）
# 本地执行：
# cd e:\notebook-system\frontend
# npm run build
# scp -r dist\* root@你的服务器IP:/var/www/html/notebook-system/frontend/dist/
```

### 备份数据库

```bash
# 创建备份目录
sudo mkdir -p /var/backups/notebook

# 备份数据库
sudo cp /var/www/html/notebook-system/backend/notebook.db /var/backups/notebook/notebook-$(date +%Y%m%d).db

# 保留最近 30 天的备份
sudo find /var/backups/notebook -name "notebook-*.db" -mtime +30 -delete
```

### 备份上传文件

```bash
sudo tar -czf /var/backups/notebook/uploads-$(date +%Y%m%d).tar.gz /var/www/html/notebook-system/backend/uploads
```

### 查看系统资源

```bash
# Systemd 服务状态
sudo systemctl status notebook-backend

# PM2 监控（如使用 PM2）
pm2 monit

# 系统资源使用
htop

# 磁盘使用
df -h

# 内存使用
free -h
```

### 日志轮转

配置 logrotate 管理日志文件大小：

```bash
sudo nano /etc/logrotate.d/notebook-backend
```

添加以下内容：
```
/var/www/html/notebook-system/backend/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload notebook-backend > /dev/null 2>&1 || true
    endscript
}
```

---

## 十、性能优化建议

### 1. 启用 Gzip 压缩
已在 Nginx 配置中启用。

### 2. 静态资源缓存
已在 Nginx 配置中设置 7 天缓存。

### 3. 数据库优化
- 定期清理回收站中的旧数据（系统已自动处理）
- 定期备份数据库
- 监控数据库文件大小

### 4. Node.js 性能
- 使用生产模式：`NODE_ENV=production`
- 确保启用了 compression 中间件（已在 app.js 中启用）

### 5. 上传文件管理
- 定期检查上传目录大小
- 考虑实现用户存储空间限制
- 定期清理未引用的上传文件

---

## 十一、安全建议

1. **定期更新系统和依赖包**
   ```bash
   sudo apt update && sudo apt upgrade -y
   cd /var/www/html/notebook-system/backend
   npm audit
   ```

2. **使用强密码**
   - 服务器 root 密码
   - 数据库密码（如使用外部数据库）
   - SendCloud API Key（注意保密）

3. **启用 HTTPS**
   - 使用 Let's Encrypt 免费证书
   - 强制 HTTP 重定向到 HTTPS

4. **配置防火墙规则**
   - 只开放必要端口（22, 80, 443）
   - 限制 SSH 访问 IP（可选）

5. **定期备份数据**
   - 数据库每日备份
   - 上传文件定期备份
   - 备份存储在异地（可选）

6. **限制文件上传大小**
   - 已在 Nginx 中配置为 50MB
   - 已在后端 Multer 中配置为 5MB

7. **修改 JWT Secret Key**
   - 编辑 `backend/middleware/auth.js`
   - 将 `SECRET_KEY` 改为强密码
   - 生产环境应使用环境变量

8. **文件权限安全**
   ```bash
   # 设置正确的所有者
   sudo chown -R www-data:www-data /var/www/html/notebook-system
   
   # 设置正确的权限
   sudo chmod -R 755 /var/www/html/notebook-system
   sudo chmod -R 700 /var/www/html/notebook-system/backend/uploads
   ```

---

## 十二、监控建议

1. **使用 Systemd 监控服务状态**
   ```bash
   sudo systemctl status notebook-backend
   sudo journalctl -u notebook-backend -f
   ```

2. **配置 Nginx 访问日志分析**
   - 使用 goaccess 或其他工具分析访问日志
   - 监控异常访问模式

3. **设置服务器资源监控**
   - 使用 htop, iotop, nethogs 等工具
   - 配置告警（CPU、内存、磁盘）

4. **配置错误报警机制**
   - 监控服务崩溃
   - 监控 5xx 错误
   - 配置邮件或短信通知

---

## 部署检查清单

部署完成后，确认以下各项：

- [ ] 系统已更新到最新版本
- [ ] Node.js 20.x+ 已安装
- [ ] Nginx 已安装并运行
- [ ] 项目文件已上传到正确目录
- [ ] 后端依赖已安装（在服务器上重新安装）
- [ ] 前端已构建并上传 dist 目录
- [ ] Nginx 配置已正确设置
- [ ] 后端服务已启动（Systemd 或 PM2）
- [ ] 后端服务已设置开机自启
- [ ] 防火墙已配置（允许 80, 443, 22）
- [ ] SSL 证书已配置（可选但推荐）
- [ ] 前端页面可以正常访问
- [ ] 后端 API 可以正常访问
- [ ] 用户可以注册和登录
- [ ] 可以创建和编辑笔记
- [ ] 可以上传图片
- [ ] 可以搜索笔记
- [ ] 可以发送邮件
- [ ] 回收站功能正常
- [ ] 数据库和上传文件已定期备份
- [ ] 日志轮转已配置

---

**文档版本**: 2.0  
**最后更新**: 2026-03-16
