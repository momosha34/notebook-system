# 个人笔记本系统 - 项目目录结构

## 项目概述

个人笔记本系统是一个前后端分离的 Web 应用，前端使用 Vue 3 + Vite，后端使用 Express + SQLite。

---

## 根目录

```
notebook-system/
├── frontend/                 # 前端项目
├── backend/                  # 后端项目
├── DEPLOYMENT.md             # 服务器部署指南
├── nginx.conf.example        # Nginx 配置示例
└── notebook-backend.service  # Systemd 服务配置
```

---

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
│   │   ├── AdvancedSheetEditor.vue  # 高级表格编辑器组件
│   │   ├── NoteCard.vue             # 笔记卡片组件
│   │   ├── RichEditor.vue           # 富文本编辑器组件
│   │   ├── TheWelcome.vue           # 欢迎页组件
│   │   └── WelcomeItem.vue          # 欢迎项组件
│   │
│   ├── config/               # 配置文件
│   │   ├── apiPaths.js       # API 路径集中管理
│   │   └── index.js          # 配置入口（API 基础 URL 等）
│   │
│   ├── router/               # 路由配置
│   │   └── index.js          # Vue Router 路由定义
│   │
│   ├── utils/                # 工具函数
│   │   ├── imageUtils.js     # 图片 URL 处理工具
│   │   └── tableExport.js    # 表格导出工具
│   │
│   ├── views/                # 页面视图
│   │   ├── Edit.vue          # 笔记编辑页面
│   │   ├── Index.vue         # 首页（笔记列表）
│   │   ├── Login.vue         # 登录页面
│   │   └── Share.vue         # 分享页面
│   │
│   ├── App.vue               # 根组件
│   └── main.js               # 应用入口文件
│
├── dist/                     # 构建输出目录
│   ├── assets/               # 打包后的静态资源
│   │   ├── *.css             # 样式文件
│   │   ├── *.js              # JavaScript 文件
│   │   └── *.woff2           # 字体文件
│   ├── favicon.ico           # 网站图标
│   └── index.html            # 入口 HTML
│
├── .vscode/                  # VS Code 配置
│   ├── extensions.json       # 推荐扩展
│   └── settings.json         # 编辑器设置
│
├── .env.production           # 生产环境变量
├── .gitignore                # Git 忽略配置
├── index.html                # HTML 入口模板
├── jsconfig.json             # JavaScript 配置
├── package.json              # 项目依赖配置
├── package-lock.json         # 依赖锁定文件
├── vite.config.js            # Vite 构建配置
└── README.md                 # 项目说明文档
```

### 前端核心文件说明

| 文件 | 用途 |
|------|------|
| `main.js` | 应用入口，初始化 Vue 应用，导入 Font Awesome |
| `App.vue` | 根组件，包含路由视图 |
| `router/index.js` | 路由配置，定义页面路径 |
| `views/Index.vue` | 首页，展示笔记列表 |
| `views/Edit.vue` | 编辑页，支持富文本和表格编辑 |
| `views/Login.vue` | 登录页，用户认证 |
| `views/Share.vue` | 分享页，展示分享的笔记内容 |
| `components/RichEditor.vue` | Quill 富文本编辑器封装 |
| `components/AdvancedSheetEditor.vue` | Luckysheet 表格编辑器封装 |
| `components/NoteCard.vue` | 笔记卡片展示组件 |
| `utils/imageUtils.js` | 修复图片 URL 中的 localhost 硬编码 |
| `config/index.js` | API 基础 URL 配置 |
| `vite.config.js` | Vite 配置，包含代理设置 |

---

## 后端目录结构

```
backend/
├── routes/                   # API 路由模块
│   ├── auth.js               # 认证相关 API（登录、注册）
│   ├── notes.js              # 笔记 CRUD API
│   ├── share.js              # 分享功能 API
│   └── upload.js             # 文件上传 API
│
├── uploads/                  # 上传文件存储目录
│   └── {userId}/             # 按用户 ID 分组存储图片
│       └── *.jpg             # 上传的图片文件
│
├── app.js                    # 应用入口文件
├── scheduledTasks.js         # 定时任务（清理回收站等）
├── notebook.db               # SQLite 数据库文件
├── package.json              # 项目依赖配置
└── package-lock.json         # 依赖锁定文件
```

### 后端核心文件说明

| 文件 | 用途 |
|------|------|
| `app.js` | Express 应用入口，配置中间件、路由、启动服务器 |
| `routes/auth.js` | 用户认证：登录、注册、修改密码 |
| `routes/notes.js` | 笔记管理：增删改查、回收站功能 |
| `routes/share.js` | 分享功能：生成分享链接、获取分享内容 |
| `routes/upload.js` | 图片上传：处理图片上传、压缩存储 |
| `scheduledTasks.js` | 定时任务：自动清理回收站过期数据 |
| `notebook.db` | SQLite 数据库文件，存储所有数据 |

---

## 数据库表结构

### user 表 - 用户信息
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名（唯一） |
| password | TEXT | 密码（bcrypt 加密） |

### note 表 - 笔记
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 用户 ID（外键） |
| title | TEXT | 标题 |
| content | TEXT | 内容 |
| sheet_data | TEXT | 表格数据（Luckysheet JSON） |
| is_del | INTEGER | 是否删除（0=正常，1=已删除） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

---

## 部署相关文件

| 文件 | 用途 |
|------|------|
| `DEPLOYMENT.md` | Ubuntu 服务器部署完整指南 |
| `nginx.conf.example` | Nginx 反向代理配置示例 |
| `notebook-backend.service` | Systemd 服务配置文件 |
| `frontend/.env.production` | 前端生产环境变量 |

---

## 技术栈

### 前端
- **框架**: Vue 3
- **构建工具**: Vite
- **路由**: Vue Router 4
- **HTTP 客户端**: Axios
- **富文本编辑器**: Quill
- **表格编辑器**: Luckysheet
- **图标**: Font Awesome（本地化）

### 后端
- **运行时**: Node.js
- **框架**: Express
- **数据库**: SQLite3
- **认证**: bcryptjs
- **文件处理**: Multer、Sharp、Cheerio
- **邮件**: SendCloud API
