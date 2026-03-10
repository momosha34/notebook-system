# 个人笔记本系统 - 服务器部署指南

## 服务器信息
- **服务器IP**: 你的服务器ip
- **后端路径**: /var/www/html/notebook-system/backend
- **前端路径**: /var/www/html/notebook-system/frontend/dist

## 快速部署命令

### 上传文件到服务器
```bash
# 上传后端文件
scp -r e:\notebook-system\backend\* root@47.107.47.221:/var/www/html/notebook-system/backend/

# 上传前端构建产物
scp -r e:\notebook-system\frontend\dist\* root@47.107.47.221:/var/www/html/notebook-system/frontend/dist/
```

### 服务器端操作
```bash
# SSH登录服务器
ssh root@你的服务器ip

# 重启后端服务
systemctl restart notebook-backend

# 重载Nginx配置
nginx -s reload
```

## 环境要求

- Ubuntu 24.04
- Node.js 20.x 或更高版本
- Nginx
- 至少2GB内存

## 一、环境准备

### 1. 更新系统
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. 安装Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. 安装Nginx
```bash
sudo apt install -y nginx
```

### 4. 安装PM2（进程管理器）
```bash
sudo npm install -g pm2
```

## 二、项目部署

### 1. 创建项目目录
```bash
sudo mkdir -p /var/www/html/notebook-system
sudo chown -R $USER:$USER /var/www/html/notebook-system
```

### 2. 上传项目文件
将项目文件上传到服务器（服务器IP: 47.107.47.221）：
```bash
# 方式1：使用scp上传后端
scp -r e:\notebook-system\backend\* root@47.107.47.221:/var/www/html/notebook-system/backend/

# 使用scp上传前端构建产物
scp -r e:\notebook-system\frontend\dist\* root@47.107.47.221:/var/www/html/notebook-system/frontend/dist/

# 方式2：使用git
cd /var/www/html/notebook-system
git clone your-repository-url .
```

### 3. 安装依赖

#### 后端依赖
```bash
cd /var/www/html/notebook-system/backend
npm install --production
```

#### 前端依赖（本地构建后上传，服务器无需安装）
前端在本地构建完成后，只需上传 `dist` 目录到服务器，无需在服务器安装依赖。

### 4. 构建前端（本地操作）
```bash
cd e:\notebook-system\frontend
npm run build
# 构建完成后上传 dist 目录到服务器
```

## 三、配置Nginx

### 1. 复制Nginx配置
```bash
sudo cp /var/www/html/notebook-system/nginx.conf.example /etc/nginx/sites-available/notebook
sudo ln -s /etc/nginx/sites-available/notebook /etc/nginx/sites-enabled/
```

### 2. 修改配置文件
编辑 `/etc/nginx/sites-available/notebook`，将 `your-domain.com` 替换为你的实际域名。

### 3. 测试并重启Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 四、启动后端服务

### 方式1：使用PM2（推荐）
```bash
cd /var/www/html/notebook-system/backend
pm2 start app.js --name notebook-backend
pm2 save
pm2 startup
```

### 方式2：使用systemd
```bash
sudo cp /var/www/html/notebook-system/notebook-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable notebook-backend
sudo systemctl start notebook-backend
```

## 五、配置防火墙

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

## 六、配置SSL（可选但推荐）

### 使用Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 七、验证部署

### 1. 检查服务状态
```bash
# 检查后端服务
pm2 status
# 或
sudo systemctl status notebook-backend

# 检查Nginx
sudo systemctl status nginx
```

### 2. 测试访问
- 前端：http://47.107.47.221
- 后端API：http://47.107.47.221/api

### 3. 查看日志
```bash
# 后端日志
pm2 logs notebook-backend
# 或
sudo journalctl -u notebook-backend -f

# Nginx日志
sudo tail -f /var/log/nginx/error.log
```

## 八、常见问题排查

### 1. 图片无法显示
- 检查 `/uploads` 目录权限
- 检查Nginx配置中的 `/uploads/` 代理设置

### 2. API请求失败
- 检查后端服务是否运行
- 检查Nginx配置中的 `/api/` 代理设置
- 检查防火墙设置

### 3. 邮件发送失败
- 检查SMTP配置是否正确
- 检查服务器是否允许发送邮件

### 4. 分享链接无法访问
- 检查前端路由配置
- 检查Nginx的 `try_files` 配置

## 九、维护命令

### 更新代码
```bash
cd /var/www/html/notebook-system
git pull

# 更新后端
cd backend
npm install --production
pm2 restart notebook-backend

# 更新前端（本地构建后上传）
# 本地执行：
# cd e:\notebook-system\frontend
# npm run build
# scp -r e:\notebook-system\frontend\dist\* root@47.107.47.221:/var/www/html/notebook-system/frontend/dist/
```

### 备份数据库
```bash
cp /var/www/html/notebook-system/backend/notebook.db /backup/notebook-$(date +%Y%m%d).db
```

### 查看系统资源
```bash
pm2 monit
```

## 十、性能优化建议

### 1. 启用Gzip压缩
已在Nginx配置中启用

### 2. 静态资源缓存
已在Nginx配置中设置7天缓存

### 3. 数据库优化
定期清理回收站中的旧数据

### 4. 日志轮转
配置logrotate管理日志文件大小

## 十一、安全建议

1. 定期更新系统和依赖包
2. 使用强密码
3. 启用HTTPS
4. 配置防火墙规则
5. 定期备份数据
6. 限制文件上传大小（已在Nginx中配置为50MB）

## 十二、监控建议

1. 使用PM2监控进程状态
2. 配置Nginx访问日志分析
3. 设置服务器资源监控
4. 配置错误报警机制
