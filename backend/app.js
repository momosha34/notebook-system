// 导入所需模块
import express from 'express'; // Express框架，用于创建Web服务器
import cors from 'cors'; // 处理跨域请求
import bodyParser from 'body-parser'; // 解析请求体
import sqlite3 from 'sqlite3'; // SQLite数据库驱动
import { fileURLToPath } from 'url'; // 用于获取当前文件路径
import { dirname, join } from 'path'; // 路径处理工具
import compression from 'compression'; // 启用gzip压缩
import authRoutes from './routes/auth.js'; // 用户认证相关路由
import noteRoutes from './routes/notes.js'; // 笔记相关路由
import shareRoutes from './routes/share.js'; // 分享相关路由
import uploadRoutes from './routes/upload.js'; // 上传相关路由
import { startScheduledTasks } from './scheduledTasks.js';

// 获取当前文件和目录名
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000; // 服务器端口，默认3000

// 注册中间件
app.use(compression()); // 启用gzip压缩
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// 静态文件服务 - 用于访问上传的图片
app.use('/uploads', express.static(join(__dirname, 'uploads'), {
  maxAge: '7d' // 缓存7天
}));

// 初始化并连接SQLite数据库
const db = new sqlite3.Database('./notebook.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
    initDatabase(); // 初始化数据表
    startScheduledTasks(); // 启动定时任务
  }
});

// 数据库表结构初始化函数
function initDatabase() {
  // 用户表，存储用户名和密码
  db.run(`CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // 笔记表，存储笔记内容、所属用户等信息
  db.run(`CREATE TABLE IF NOT EXISTS note (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    sheet_data TEXT,
    is_del INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

// 健康检查接口，返回服务状态
app.get('/', (req, res) => {
  res.json({ message: '个人笔记本系统后端服务运行中', timestamp: new Date().toISOString() });
});

// 注册路由
app.use('/api', authRoutes); // 用户认证相关接口
app.use('/api', noteRoutes); // 笔记相关接口
app.use('/', shareRoutes); // 分享相关接口
app.use('/api', uploadRoutes); // 上传相关接口


// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});

// 导出数据库实例，供其他模块使用
export { db };