# 个人笔记本系统 - 项目目录结构

## 项目概述

个人笔记本系统是一个功能完整的前后端分离 Web 应用，采用现代化技术栈构建。系统支持用户认证、笔记管理、富文本编辑、表格编辑、图片上传、邮件分享、链接分享、回收站、全文搜索等核心功能。

***

## 根目录

```
notebook-system/
├── frontend/                 # 前端项目（Vue 3 + Vite）
├── backend/                  # 后端项目（Express + SQLite）
├── DEPLOYMENT.md             # 服务器部署完整指南
├── EMAIL_IMAGE_LIMITATIONS.md # 邮件图片限制分析文档
├── FULLTEXT_SEARCH.md        # 全文搜索技术实现文档
├── KEY_IMPLEMENTATIONS.md    # 关键代码实现文档
├── PROJECT_STRUCTURE.md      # 本文件 - 项目结构说明
├── nginx.conf.example        # Nginx 反向代理配置示例
├── notebook-backend.service  # Systemd 服务配置文件
└── .gitignore                # Git 忽略配置
```

***

## 前端目录结构

```
frontend/
├── public/                   # 静态资源目录（不经过构建处理）
│   └── favicon.ico           # 网站图标
│
├── src/                      # 源代码目录
│   ├── assets/               # 静态资源（会经过构建处理）
│   │   ├── base.css          # 基础样式
│   │   ├── logo.svg          # Logo 图片
│   │   └── main.css          # 主样式文件
│   │
│   ├── components/           # Vue 组件
│   │   ├── icons/            # 图标组件（Vue 默认模板）
│   │   │   ├── IconCommunity.vue
│   │   │   ├── IconDocumentation.vue
│   │   │   ├── IconEcosystem.vue
│   │   │   ├── IconSupport.vue
│   │   │   └── IconTooling.vue
│   │   ├── AdvancedSheetEditor.vue  # Luckysheet 高级表格编辑器组件
│   │   ├── NoteCard.vue             # 笔记卡片组件（显示相对时间）
│   │   ├── RichEditor.vue           # Quill 富文本编辑器组件
│   │   ├── TheWelcome.vue           # 欢迎页组件
│   │   └── WelcomeItem.vue          # 欢迎项组件
│   │
│   ├── config/               # 配置文件
│   │   ├── apiPaths.js       # API 路径集中管理
│   │   └── index.js          # 配置入口（API 基础 URL 等）
│   │
│   ├── router/               # 路由配置
│   │   └── index.js          # Vue Router 路由定义 + 路由守卫
│   │
│   ├── utils/                # 工具函数
│   │   ├── axiosConfig.js    # Axios 实例配置 + 拦截器
│   │   ├── imageUtils.js     # 图片 URL 处理工具（修复 localhost）
│   │   └── tableExport.js    # 表格导出工具
│   │
│   ├── views/                # 页面视图
│   │   ├── Edit.vue          # 笔记编辑页面（富文本+表格）
│   │   ├── Index.vue         # 首页（笔记列表+回收站切换）
│   │   ├── Login.vue         # 登录/注册页面
│   │   └── Share.vue         # 分享页面（公开访问）
│   │
│   ├── App.vue               # 根组件
│   └── main.js               # 应用入口文件（导入 Font Awesome）
│
├── dist/                     # 构建输出目录（部署时上传）
│   ├── assets/               # 打包后的静态资源
│   │   ├── *.css             # 样式文件
│   │   ├── *.js              # JavaScript 文件
│   │   └── *.woff2           # 字体文件
│   ├── favicon.ico           # 网站图标
│   └── index.html            # 入口 HTML
│
├── .env.production           # 生产环境变量
├── .gitignore                # Git 忽略配置
├── index.html                # HTML 入口模板
├── jsconfig.json             # JavaScript 配置
├── package.json              # 项目依赖配置
├── package-lock.json         # 依赖锁定文件
├── vite.config.js            # Vite 构建配置（含开发代理）
└── README.md                 # 前端项目说明文档
```

### 前端核心文件说明

| 文件                                   | 用途                              |
| ------------------------------------ | ------------------------------- |
| `main.js`                            | 应用入口，初始化 Vue 应用，导入本地 Font Awesome |
| `App.vue`                            | 根组件，包含路由视图                      |
| `router/index.js`                    | 路由配置，定义页面路径，包含路由守卫（登录校验） |
| `views/Index.vue`                    | 首页，展示笔记列表、回收站、搜索功能            |
| `views/Edit.vue`                     | 编辑页，支持富文本和表格编辑，保存、分享、邮件发送 |
| `views/Login.vue`                    | 登录页，用户登录/注册                   |
| `views/Share.vue`                    | 分享页，展示分享的笔记内容（无需登录）           |
| `components/RichEditor.vue`          | Quill 富文本编辑器封装，支持图片上传        |
| `components/AdvancedSheetEditor.vue` | Luckysheet 表格编辑器封装              |
| `components/NoteCard.vue`            | 笔记卡片展示组件，相对时间显示，每30秒实时同步   |
| `utils/axiosConfig.js`               | Axios 配置，请求/响应拦截器，JWT 处理    |
| `utils/imageUtils.js`                | 修复图片 URL 中的 localhost 硬编码       |
| `config/apiPaths.js`                 | API 路径集中管理                      |
| `config/index.js`                    | API 基础 URL 配置                   |
| `vite.config.js`                     | Vite 配置，开发环境代理设置               |

***

## 后端目录结构

```
backend/
├── middleware/              # 中间件
│   └── auth.js              # JWT 认证中间件（生成+验证token）
│
├── routes/                  # API 路由模块
│   ├── auth.js              # 认证相关 API（登录、注册）
│   ├── notes.js             # 笔记 CRUD API + 全文搜索 + 回收站
│   ├── share.js             # 分享功能 API + 邮件发送 + CID 图片
│   └── upload.js            # 文件上传 API + 图片自动压缩
│
├── uploads/                 # 上传文件存储目录（Git 忽略）
│   └── {userId}/            # 按用户 ID 分组存储图片
│       └── image-*.jpg      # 上传的图片文件
│
├── app.js                   # Express 应用入口 + 数据库初始化 + FTS5
├── scheduledTasks.js        # 定时任务（自动清理30天前回收站）
├── benchmark.js             # 性能测试脚本
├── notebook.db              # SQLite 数据库文件（Git 忽略）
├── package.json             # 项目依赖配置
└── package-lock.json        # 依赖锁定文件
```

### 后端核心文件说明

| 文件                  | 用途                          |
| ------------------- | --------------------------- |
| `app.js`            | Express 应用入口，配置中间件、路由、启动服务器、初始化数据库表 |
| `middleware/auth.js`| JWT 认证中间件：生成 token（7天过期）、验证 token，向后兼容 user-id header |
| `routes/auth.js`    | 用户认证：登录、注册（bcrypt 加密）             |
| `routes/notes.js`   | 笔记管理：增删改查、回收站、全文搜索（FTS5 + LIKE 降级） |
| `routes/share.js`   | 分享功能：获取分享内容、SendCloud 邮件发送、CID 内嵌图片、图片压缩 |
| `routes/upload.js`  | 图片上传：Multer 处理、按用户分目录、5MB 限制、Sharp 自动压缩 |
| `scheduledTasks.js` | 定时任务：每24小时自动清理回收站中超过30天的笔记     |
| `notebook.db`       | SQLite 数据库文件，存储所有数据         |

***

## 数据库表结构

### user 表 - 用户信息

| 字段       | 类型      | 说明            |
| -------- | ------- | ------------- |
| id       | INTEGER | 主键            |
| username | TEXT    | 用户名（唯一）       |
| password | TEXT    | 密码（bcrypt 加密，salt rounds=10） |

### note 表 - 笔记

| 字段          | 类型       | 说明                    |
| ----------- | -------- | --------------------- |
| id          | INTEGER  | 主键                    |
| user\_id    | INTEGER  | 用户 ID（外键）             |
| title       | TEXT     | 标题                    |
| content     | TEXT     | 内容（HTML 格式）            |
| sheet\_data | TEXT     | 表格数据（Luckysheet JSON） |
| is\_del     | INTEGER  | 是否删除（0=正常，1=已删除）      |
| created\_at | DATETIME | 创建时间（本地时间 YYYY-MM-DD HH:MM:SS） |
| updated\_at | DATETIME | 更新时间（本地时间 YYYY-MM-DD HH:MM:SS） |

### note\_fts 表 - 全文索引（FTS5 虚拟表）

| 字段       | 类型      | 说明                     |
| -------- | ------- | ---------------------- |
| id       | INTEGER | 笔记 ID（UNINDEXED，不参与索引） |
| user\_id | INTEGER | 用户 ID（UNINDEXED，不参与索引） |
| title    | TEXT    | 标题（参与全文索引）             |
| content  | TEXT    | 内容纯文本（去除HTML标签，参与全文索引） |

> 使用 SQLite FTS5 全文索引技术，搜索性能提升 100-1000 倍，详见 [FULLTEXT\_SEARCH.md](FULLTEXT_SEARCH.md)

***

## 部署相关文件

| 文件                         | 用途               |
| -------------------------- | ---------------- |
| `DEPLOYMENT.md`            | Ubuntu 服务器部署完整指南 |
| `nginx.conf.example`       | Nginx 反向代理配置示例（Gzip、缓存、代理设置） |
| `notebook-backend.service` | Systemd 服务配置文件   |
| `frontend/.env.production` | 前端生产环境变量         |

***

## 技术栈

### 前端

| 技术 | 版本/说明 | 用途 |
| --- | ------- | --- |
| **Vue** | 3.x | 前端框架 |
| **Vite** | 7.x | 构建工具，快速热更新 |
| **Vue Router** | 4.x | 路由管理 |
| **Axios** | 1.x | HTTP 客户端 |
| **Quill** | 1.3.7 | 富文本编辑器 |
| **Luckysheet** | 2.1.13 | 在线表格编辑器 |
| **Font Awesome** | 7.2.0 | 图标库（本地化） |
| **Node.js** | ^20.19.0 \|\| >=22.12.0 | 开发环境要求 |

### 后端

| 技术 | 版本/说明 | 用途 |
| --- | ------- | --- |
| **Node.js** | 20.x+ | 运行时 |
| **Express** | 4.x | Web 框架 |
| **SQLite3** | 5.x | 数据库 |
| **bcryptjs** | 2.4.3 | 密码加密 |
| **jsonwebtoken** | 9.x | JWT 认证 |
| **Multer** | 2.x | 文件上传处理 |
| **Sharp** | 0.34.x | 图片压缩处理 |
| **Cheerio** | 1.1.x | HTML 解析（处理邮件图片） |
| **Form-Data** | 4.x | 表单数据处理（SendCloud API） |
| **compression** | 1.x | Gzip 压缩 |
| **cors** | 2.x | 跨域处理 |
| **body-parser** | 1.x | 请求体解析 |

***

## 核心功能清单

### 用户功能
- [x] 用户注册
- [x] 用户登录
- [x] JWT Token 认证（7天有效期）
- [x] 向后兼容 user-id header

### 笔记管理
- [x] 创建笔记
- [x] 编辑笔记
- [x] 删除笔记（软删除）
- [x] 恢复笔记
- [x] 永久删除笔记
- [x] 笔记列表
- [x] 回收站
- [x] 全文搜索（FTS5 + LIKE 降级）
- [x] 本地时间存储和显示

### 富文本编辑
- [x] Quill 富文本编辑器
- [x] 图片上传（支持拖拽）
- [x] 图片自动压缩（1920x1080，JPEG 85%）
- [x] 按用户分目录存储

### 表格编辑
- [x] Luckysheet 表格编辑器
- [x] 表格数据 JSON 存储
- [x] 表格数据邮件渲染

### 分享功能
- [x] 分享链接生成（/s/{id}）
- [x] 分享页面公开访问
- [x] 邮件发送（SendCloud API）
- [x] CID 内嵌图片
- [x] 邮件图片自动压缩（≤2MB）
- [x] 响应式邮件模板

### 系统功能
- [x] 定时清理回收站（30天过期）
- [x] Gzip 压缩
- [x] 静态资源缓存（7天）
- [x] 请求体大小限制（50MB）

***

## API 接口概览

### 认证接口
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录

### 笔记接口
- `GET /api/notes?s=关键词` - 获取笔记列表（支持搜索）
- `GET /api/note/:id` - 获取单条笔记
- `POST /api/note` - 创建/更新笔记
- `DELETE /api/note/:id` - 软删除笔记
- `PUT /api/note/:id/recover` - 恢复笔记
- `GET /api/trash/notes` - 获取回收站笔记
- `DELETE /api/trash/note/:id` - 永久删除笔记

### 分享接口
- `GET /api/s/:shareId` - 获取分享笔记（无需登录）
- `POST /send-email` - 发送邮件分享

### 上传接口
- `POST /api/upload-image` - 上传图片

***

## 项目特点

1. **轻量级部署**：使用 SQLite 数据库，无需额外数据库服务
2. **高性能搜索**：FTS5 全文索引，搜索速度提升 100-1000 倍
3. **安全认证**：JWT + bcrypt，向后兼容旧版本
4. **智能图片处理**：上传和邮件发送双重压缩，优化存储和带宽
5. **完善的回收站**：软删除 + 恢复 + 自动清理
6. **本地时间**：使用服务器本地时间，无时区问题
7. **响应式设计**：前端支持移动端，邮件支持多种设备
8. **易部署**：提供 Nginx 配置和 Systemd 服务文件
