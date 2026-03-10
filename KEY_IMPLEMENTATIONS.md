# 个人笔记本系统 - 关键代码实现

本文档记录了系统各功能模块的关键代码片段，便于快速理解和维护。

---

## 目录

1. [用户认证](#1-用户认证)
2. [笔记管理](#2-笔记管理)
3. [邮件发送](#3-邮件发送)
4. [图片上传](#4-图片上传)
5. [定时任务](#5-定时任务)
6. [前端编辑器](#6-前端编辑器)

---

## 1. 用户认证

### 1.1 密码加密存储

**文件**: [backend/routes/auth.js](backend/routes/auth.js)

```javascript
import bcrypt from 'bcryptjs';

// 注册时密码加密
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  // 使用 bcrypt 加密密码，salt rounds = 10
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run(
    'INSERT INTO user (username, password) VALUES (?, ?)',
    [username, hashedPassword],
    function(err) {
      // 处理结果...
    }
  );
});
```

### 1.2 密码验证

```javascript
// 登录时密码校验
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM user WHERE username = ?', [username], async (err, user) => {
    if (!user) {
      return res.status(400).json({ error: '用户不存在' });
    }
    
    // 使用 bcrypt 比较明文密码和加密后的密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: '密码错误' });
    }
    
    // 返回用户ID作为简单token
    const token = user.id.toString();
    res.json({ token, username, user: { id: user.id, username: user.username } });
  });
});
```

---

## 2. 笔记管理

### 2.1 笔记列表查询（支持搜索）

**文件**: [backend/routes/notes.js](backend/routes/notes.js)

```javascript
router.get('/notes', (req, res) => {
  const { s } = req.query;  // 搜索关键字
  const userId = req.headers['user-id'];
  
  let sql = 'SELECT * FROM note WHERE user_id = ? AND is_del = 0';
  let params = [userId];
  
  // 支持标题和内容的模糊搜索
  if (s) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${s}%`);
    params.push(`%${s}%`);
  }
  
  sql += ' ORDER BY updated_at DESC';
  
  db.all(sql, params, (err, notes) => {
    res.json(notes);
  });
});
```

### 2.2 笔记新建/更新（合并接口）

```javascript
function getLocalTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

router.post('/note', (req, res) => {
  const { id, title, content, sheet_data } = req.body;
  const userId = req.headers['user-id'];
  const currentTime = getLocalTimeString();
  
  if (id) {
    // 更新现有笔记
    db.run(
      'UPDATE note SET title = ?, content = ?, sheet_data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [title, content, sheet_data, currentTime, id, userId],
      function(err) {
        res.json({ id, message: '更新成功' });
      }
    );
  } else {
    // 新建笔记
    db.run(
      'INSERT INTO note (user_id, title, content, sheet_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, content, sheet_data, currentTime, currentTime],
      function(err) {
        res.json({ id: this.lastID, message: '创建成功' });
      }
    );
  }
});
```

### 2.3 软删除与回收站

```javascript
// 软删除：标记 is_del = 1
router.delete('/note/:id', (req, res) => {
  db.run(
    'UPDATE note SET is_del = 1 WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      res.json({ message: '删除成功' });
    }
  );
});

// 恢复笔记
router.put('/note/:id/recover', (req, res) => {
  db.run(
    'UPDATE note SET is_del = 0 WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      res.json({ message: '恢复成功' });
    }
  );
});

// 永久删除
router.delete('/trash/note/:id', (req, res) => {
  db.run(
    'DELETE FROM note WHERE id = ? AND user_id = ? AND is_del = 1',
    [id, userId],
    function(err) {
      res.json({ message: '永久删除成功' });
    }
  );
});
```

### 2.4 本地时间显示（实时同步）

**文件**: 
- [backend/routes/notes.js](backend/routes/notes.js)
- [frontend/src/components/NoteCard.vue](frontend/src/components/NoteCard.vue)
- [frontend/src/views/Share.vue](frontend/src/views/Share.vue)

> **重要说明**: 系统现在使用服务器本地时间存储和显示，不再进行手动时区转换。修复了之前 UTC 时间导致的 8 小时时差问题。

**后端实现**: 使用 JavaScript 本地时间方法生成时间字符串

```javascript
// backend/routes/notes.js - 生成本地时间字符串
function getLocalTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
```

**前端实现 - NoteCard.vue**: 简化时间显示逻辑，直接使用本地时间

```javascript
// frontend/src/components/NoteCard.vue - computed property
computed: {
  formattedTime() {
    if (!this.note.updated_at) {
      return ''
    }
    
    let noteTimeStr = this.note.updated_at
    if (typeof noteTimeStr === 'string' && noteTimeStr.includes(' ')) {
      // 处理 'YYYY-MM-DD HH:MM:SS' 本地时间格式
      noteTimeStr = noteTimeStr.replace(' ', 'T')
    }
    
    const noteTime = new Date(noteTimeStr).getTime()
    const now = this.currentTime
    const diff = now - noteTime
    
    if (isNaN(noteTime)) {
      return '未知时间'
    }
    
    if (diff < 0 || diff < 60000) {
      return '刚刚'
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`
    } else {
      const date = new Date(noteTime)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
  }
}

// 实时同步，每30秒更新一次
mounted() {
  this.updateTime()
  this.timeUpdater = setInterval(() => {
    this.updateTime()
  }, 30000)
}
```

**前端实现 - Share.vue**: 同样简化时间格式化

```javascript
// frontend/src/views/Share.vue - 格式化时间为本地时间
const formatTime = (timeString) => {
  if (!timeString) return '未知时间'
  
  let noteTimeStr = timeString
  if (typeof noteTimeStr === 'string' && noteTimeStr.includes(' ')) {
    // 处理 'YYYY-MM-DD HH:MM:SS' 本地时间格式
    noteTimeStr = noteTimeStr.replace(' ', 'T')
  }
  
  const time = new Date(noteTimeStr)
  
  if (isNaN(time.getTime())) {
    return '未知时间'
  }
  
  return `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
}
```

---

## 3. 邮件发送

### 3.1 SendCloud API 配置

**文件**: [backend/routes/share.js](backend/routes/share.js)

```javascript
const EMAIL_API_CONFIG = {
  apiUser: 'sc_sbxylb_test_TOaisC',
  apiKey: '0ca7b199cd905c534e1d42c92bac0550',
  from: 'sendcloud@sbxylb.sendcloud.org',
  fromName: '笔记本系统'
};
```

### 3.2 邮件图片压缩功能

```javascript
async function compressImageForEmail(imagePath) {
  try {
    const ext = path.extname(imagePath).toLowerCase();
    const MAX_EMAIL_IMAGE_WIDTH = 1920;
    const MAX_EMAIL_IMAGE_HEIGHT = 1080;
    const MAX_EMAIL_IMAGE_SIZE = 2 * 1024 * 1024;
    
    let image = sharp(imagePath);
    const metadata = await image.metadata();
    const originalSize = fs.statSync(imagePath).size;
    
    if (originalSize <= MAX_EMAIL_IMAGE_SIZE && 
        metadata.width <= MAX_EMAIL_IMAGE_WIDTH && 
        metadata.height <= MAX_EMAIL_IMAGE_HEIGHT) {
      return { success: true, compressed: false, path: imagePath };
    }
    
    let needsResize = false;
    let targetWidth = metadata.width;
    let targetHeight = metadata.height;
    
    if (metadata.width > MAX_EMAIL_IMAGE_WIDTH) {
      targetWidth = MAX_EMAIL_IMAGE_WIDTH;
      targetHeight = Math.round((metadata.height / metadata.width) * MAX_EMAIL_IMAGE_WIDTH);
      needsResize = true;
    }
    
    if (targetHeight > MAX_EMAIL_IMAGE_HEIGHT) {
      targetHeight = MAX_EMAIL_IMAGE_HEIGHT;
      targetWidth = Math.round((metadata.width / metadata.height) * MAX_EMAIL_IMAGE_HEIGHT);
      needsResize = true;
    }
    
    if (needsResize) {
      image = image.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    if (ext === '.jpg' || ext === '.jpeg') {
      image = image.jpeg({ quality: 80 });
    } else if (ext === '.png') {
      image = image.png({ quality: 85 });
    } else if (ext === '.webp') {
      image = image.webp({ quality: 80 });
    } else if (ext === '.gif') {
      return { success: true, compressed: false, path: imagePath };
    }
    
    const tempPath = imagePath + '.email_compressed';
    await image.toFile(tempPath);
    
    const tempStats = fs.statSync(tempPath);
    if (tempStats.size < originalSize) {
      return { success: true, compressed: true, path: tempPath, originalPath: imagePath };
    } else {
      fs.unlinkSync(tempPath);
      return { success: true, compressed: false, path: imagePath };
    }
  } catch (error) {
    console.error('邮件图片压缩失败:', error);
    return { success: false, error: error.message, path: imagePath };
  }
}
```

### 3.3 API 邮件发送核心函数（支持 CID 内嵌图片）

```javascript
async function sendEmailViaApi(toEmail, subject, htmlContent, textContent, imagesInfo = []) {
  const form = new FormData();
  
  form.append('apiUser', EMAIL_API_CONFIG.apiUser);
  form.append('apiKey', EMAIL_API_CONFIG.apiKey);
  form.append('from', EMAIL_API_CONFIG.from);
  form.append('fromName', EMAIL_API_CONFIG.fromName);
  form.append('to', toEmail);
  form.append('subject', subject);
  form.append('html', htmlContent);
  form.append('plain', textContent);

  // 添加内嵌图片（使用 SendCloud API V2 的 attachments + embeddedCid 参数）
  for (const imageInfo of imagesInfo) {
    try {
      if (fs.existsSync(imageInfo.path)) {
        const fileStats = fs.statSync(imageInfo.path);
        
        form.append('attachments', fs.createReadStream(imageInfo.path), {
          filename: imageInfo.filename,
          contentType: imageInfo.mimeType,
          knownLength: fileStats.size
        });
        form.append('embeddedCid', imageInfo.cid);
      }
    } catch (error) {
      console.error(`添加图片失败：${imageInfo.filename}`, error);
    }
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.sendcloud.net',
      port: 443,
      path: '/apiv2/mail/send',
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => { data += chunk; });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.statusCode === 200 || response.result === true) {
            const emailId = response.info?.emailIdList?.[0] || 'unknown';
            resolve({
              success: true,
              messageId: emailId,
              message: '邮件发送成功'
            });
          } else {
            reject(new Error(response.message || '邮件发送失败'));
          }
        } catch (parseError) {
          if (res.statusCode === 200) {
            resolve({
              success: true,
              messageId: 'unknown',
              message: '邮件发送成功'
            });
          } else {
            reject(new Error(`API响应解析失败: ${data}`));
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`网络请求失败: ${error.message}`));
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('请求超时，请检查网络连接'));
    });

    form.pipe(req);
  });
}
```

### 3.4 邮件内容构建（使用 CID 内嵌图片）

```javascript
async function processContentImagesToCidFormat(content, userId) {
  try {
    const { load } = await import('cheerio');
    const $ = load(content);
    
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const imagesInfo = [];
    const compressedFiles = [];
    
    $('img').each((i, img) => {
      const src = $(img).attr('src');
      
      if (src && src.startsWith('/uploads/')) {
        const match = src.match(/\/uploads\/(\d+)\/(image-[^/]+\.(jpg|jpeg|png|gif|webp|bmp))/i);
        if (match) {
          const imageUserId = match[1];
          const imageFilename = match[2];
          
          if (imageUserId === String(userId)) {
            const cid = `note_image_${i}_${Date.now()}`;
            const imagePath = path.join(__dirname, '..', 'uploads', imageUserId, imageFilename);
            
            const ext = path.extname(imageFilename).toLowerCase();
            let mimeType = 'image/jpeg';
            if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.gif') mimeType = 'image/gif';
            else if (ext === '.webp') mimeType = 'image/webp';
            else if (ext === '.bmp') mimeType = 'image/bmp';
            
            imagesInfo.push({
              index: i,
              filename: imageFilename,
              originalPath: imagePath,
              path: imagePath,
              cid: cid,
              mimeType: mimeType
            });
            
            $(img).attr('src', `cid:${cid}`);
            $(img).attr('style', 'max-width: 100% !important; height: auto !important; display: block !important; margin: 10px auto !important; border-radius: 4px !important; border: 2px solid #e9ecef !important;');
            $(img).attr('alt', `图片 ${i + 1}: ${imageFilename}`);
          }
        }
      }
    });
    
    for (const imageInfo of imagesInfo) {
      const compressResult = await compressImageForEmail(imageInfo.originalPath);
      if (compressResult.success) {
        imageInfo.path = compressResult.path;
        if (compressResult.compressed) {
          imageInfo.compressed = true;
          if (compressResult.originalPath) {
            compressedFiles.push(compressResult.path);
          }
        }
      }
    }
    
    const processedHtml = $.html();
    return { html: processedHtml, imagesInfo, compressedFiles };
  } catch (error) {
    console.error('处理内容图片失败:', error);
    return { html: content, imagesInfo: [], compressedFiles: [] };
  }
}

async function buildEmailContentWithCidImages(note, userId) {
  let tableHtml = '';
  if (note.sheet_data) {
    try {
      const sheetData = JSON.parse(note.sheet_data);
      tableHtml = generateTableHtml(sheetData);
    } catch (error) {
      console.error('解析表格数据失败:', error);
      tableHtml = '<p style="color: #666; font-style: italic;">表格数据解析失败</p>';
    }
  }

  let processedContent = note.content || '<p style="color: #666; font-style: italic;">暂无内容</p>';
  let imagesInfo = [];
  let compressedFiles = [];
  
  if (note.content && note.content.includes('/uploads/')) {
    const result = await processContentImagesToCidFormat(note.content, userId);
    processedContent = result.html;
    imagesInfo = result.imagesInfo;
    compressedFiles = result.compressedFiles || [];
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 15px;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    
    .email-container {
      max-width: 100%;
      margin: 0 auto;
    }
    
    .email-header {
      border-bottom: 3px solid #2c5aa0;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .email-title {
      color: #2c5aa0;
      font-size: 20px;
      margin: 0;
      word-wrap: break-word;
      line-height: 1.3;
    }
    
    .content-section {
      margin-bottom: 20px;
    }
    
    .section-title {
      color: #2c5aa0;
      font-size: 16px;
      border-left: 4px solid #2c5aa0;
      padding-left: 10px;
      margin-bottom: 12px;
    }
    
    .note-content {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e9ecef;
      max-width: 100%;
      overflow: hidden;
    }
    
    .note-content img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 4px;
      margin: 8px 0;
      display: block;
    }
    
    .note-content * {
      max-width: 100%;
    }
    
    .table-container {
      overflow-x: auto;
      margin: 12px 0;
      -webkit-overflow-scrolling: touch;
    }
    
    .email-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      min-width: 300px;
    }
    
    .email-table th {
      background-color: #2c5aa0;
      color: white;
      font-weight: bold;
      text-align: left;
      padding: 8px 10px;
      font-size: 14px;
    }
    
    .email-table td {
      border: 1px solid #dee2e6;
      padding: 8px 10px;
      text-align: left;
      font-size: 14px;
    }
    
    .email-table tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    
    .email-footer {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #e9ecef;
      color: #666;
      font-size: 12px;
      text-align: center;
    }
    
    .meta-info {
      background: #e7f3ff;
      padding: 10px 12px;
      border-radius: 6px;
      margin-bottom: 15px;
      font-size: 13px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 class="email-title">${note.title || '无标题笔记'}</h1>
    </div>

    <div class="meta-info">
      <strong>创建时间：</strong>${formatDate(note.created_at)}<br>
      <strong>更新时间：</strong>${formatDate(note.updated_at)}<br>
      <strong>发送时间：</strong>${formatDate(new Date())}
    </div>

    <div class="content-section">
      <h2 class="section-title">笔记内容</h2>
      <div class="note-content">
        ${processedContent}
      </div>
    </div>

    ${tableHtml ? `
    <div class="content-section">
      <h2 class="section-title">表格数据</h2>
      <div class="table-container">
        ${tableHtml}
      </div>
    </div>
    ` : ''}

    <div class="email-footer">
      <p>此邮件由个人笔记本系统自动发送</p>
    </div>
  </div>
</body>
</html>
  `;

  return { html, imagesInfo, compressedFiles };
}
```

---

## 4. 图片上传

### 4.1 Multer 存储配置

**文件**: [backend/routes/upload.js](backend/routes/upload.js)

```javascript
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1080;
const JPEG_QUALITY = 85;
const TARGET_IMAGE_SIZE = 2 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.headers['user-id'];
    if (!userId) {
      return cb(new Error('未授权访问'), null);
    }
    
    const userUploadsDir = path.join(__dirname, '../uploads', userId);
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }
    cb(null, userUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'image-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
  
  if (isAllowedExt && isAllowedMime) {
    cb(null, true);
  } else if (!isAllowedExt) {
    cb(new Error(`不支持的文件扩展名: ${ext}。支持的格式: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});
```

### 4.2 图片自动压缩功能

```javascript
async function compressImage(imagePath, mimeType) {
  try {
    const ext = path.extname(imagePath).toLowerCase();
    let outputPath = imagePath;
    let compressed = false;
    
    let image = sharp(imagePath);
    const metadata = await image.metadata();
    
    let needsResize = false;
    let targetWidth = metadata.width;
    let targetHeight = metadata.height;
    
    if (metadata.width > MAX_IMAGE_WIDTH) {
      targetWidth = MAX_IMAGE_WIDTH;
      targetHeight = Math.round((metadata.height / metadata.width) * MAX_IMAGE_WIDTH);
      needsResize = true;
    }
    
    if (targetHeight > MAX_IMAGE_HEIGHT) {
      targetHeight = MAX_IMAGE_HEIGHT;
      targetWidth = Math.round((metadata.width / metadata.height) * MAX_IMAGE_HEIGHT);
      needsResize = true;
    }
    
    if (needsResize) {
      image = image.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
      compressed = true;
    }
    
    if (ext === '.jpg' || ext === '.jpeg') {
      image = image.jpeg({ quality: JPEG_QUALITY });
      compressed = true;
    } else if (ext === '.png') {
      image = image.png({ quality: 90 });
      compressed = true;
    } else if (ext === '.webp') {
      image = image.webp({ quality: 85 });
      compressed = true;
    }
    
    if (compressed) {
      const tempPath = imagePath + '.temp';
      await image.toFile(tempPath);
      
      const tempStats = fs.statSync(tempPath);
      if (tempStats.size < fs.statSync(imagePath).size) {
        fs.unlinkSync(imagePath);
        fs.renameSync(tempPath, imagePath);
        return { success: true, compressed: true, newSize: tempStats.size };
      } else {
        fs.unlinkSync(tempPath);
        return { success: true, compressed: false, newSize: fs.statSync(imagePath).size };
      }
    }
    
    return { success: true, compressed: false, newSize: fs.statSync(imagePath).size };
  } catch (error) {
    console.error('图片压缩失败:', error);
    return { success: false, error: error.message };
  }
}
```

### 4.3 上传接口（含图片压缩处理）

```javascript
router.post('/upload-image', upload.single('image'), async (req, res) => {
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({ error: '未授权访问' });
    }
  
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
  
    try {
      const imagePath = req.file.path;
      const originalSize = req.file.size;
      
      const compressResult = await compressImage(imagePath, req.file.mimetype);
      
      if (!compressResult.success) {
        console.warn('图片压缩失败，使用原始图片:', compressResult.error);
      }
      
      const finalSize = compressResult.newSize || originalSize;
      const imageUrl = `/uploads/${userId}/${req.file.filename}`;
      
      res.json({
        success: true,
        url: imageUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: finalSize,
        originalSize: originalSize,
        compressed: compressResult.compressed,
        message: compressResult.compressed ? '图片上传并压缩成功' : '图片上传成功'
      });
    } catch (error) {
      console.error('图片上传处理失败:', error);
      res.status(500).json({ error: '图片上传失败' });
    }
  });
```

---

## 5. 定时任务

### 5.1 回收站自动清理

**文件**: [backend/scheduledTasks.js](backend/scheduledTasks.js)

```javascript
import { db } from './app.js';

function autoCleanTrash() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 格式化日期为 SQLite 支持的格式
  const formattedDate = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

  const sql = `DELETE FROM note WHERE is_del = 1 AND updated_at < ?`;
  
  db.run(sql, [formattedDate], function(err) {
    if (this.changes > 0) {
      console.log(`自动清理了 ${this.changes} 条过期笔记`);
    }
  });
}

function startScheduledTasks() {
  // 启动时执行一次
  autoCleanTrash();
  
  // 每24小时执行一次
  setInterval(autoCleanTrash, 24 * 60 * 60 * 1000);
  
  console.log('定时任务已启动：回收站自动清理');
}

export { startScheduledTasks };
```

---

## 6. 前端编辑器

### 6.1 笔记保存流程

**文件**: [frontend/src/views/Edit.vue](frontend/src/views/Edit.vue)

```javascript
async saveNote() {
  this.saving = true;
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post('/api/note', this.note, {
      headers: { 'user-id': token }
    });
    
    // 新建笔记时更新URL
    if (!this.note.id) {
      this.note.id = response.data.id;
      this.$router.replace(`/edit/${this.note.id}`);
    }
    
    this.showAlert('保存成功', '笔记已成功保存');
  } catch (error) {
    this.showAlert('保存失败', '保存笔记时出现错误');
  } finally {
    this.saving = false;
  }
}
```

### 6.2 邮件发送前端调用

```javascript
async handleEmailSubmit() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(this.emailTo)) {
    this.showAlert('提示', '请输入有效的邮箱地址');
    return;
  }
  
  this.sendingEmail = true;
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.post('/send-email', {
      email: this.emailTo.trim(),
      noteId: this.note.id.toString(),
      userId: token
    }, {
      timeout: 30000
    });
    
    this.showAlert('发送成功', '邮件发送成功！');
    this.showEmailModal = false;
  } catch (error) {
    this.showAlert('发送失败', '邮件发送失败: ' + error.message);
  } finally {
    this.sendingEmail = false;
  }
}
```

### 6.3 分享链接生成

```javascript
async shareNote() {
  if (!this.note.id) {
    this.showAlert('提示', '请先保存笔记');
    return;
  }
  
  const shareUrl = window.location.origin + `/s/${this.note.id}`;
  
  try {
    await navigator.clipboard.writeText(shareUrl);
    this.showAlert('分享成功', '分享链接已复制到剪贴板');
  } catch (error) {
    // 降级方案：使用传统复制方法
    const tempInput = document.createElement('input');
    tempInput.value = shareUrl;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    this.showAlert('分享成功', '分享链接已复制到剪贴板');
  }
}
```

---

## 7. 数据库初始化

**文件**: [backend/app.js](backend/app.js)

```javascript
function initDatabase() {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // 笔记表
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
```

---

## 8. API 路径配置

**文件**: [frontend/src/config/apiPaths.js](frontend/src/config/apiPaths.js)

```javascript
export const API_PATHS = {
  AUTH: {
    LOGIN: '/api/login',
    REGISTER: '/api/register'
  },
  NOTES: {
    LIST: '/api/notes',
    DETAIL: (id) => `/api/note/${id}`,
    CREATE: '/api/note',
    UPDATE: (id) => `/api/note/${id}`,
    DELETE: (id) => `/api/note/${id}`,
    RECOVER: (id) => `/api/note/${id}/recover`
  },
  TRASH: {
    LIST: '/api/trash/notes',
    DELETE_PERMANENT: (id) => `/api/trash/note/${id}`
  },
  SHARE: {
    DETAIL: (id) => `/api/s/${id}`
  },
  UPLOAD: {
    IMAGE: '/api/upload-image'
  },
  EMAIL: {
    SEND: '/send-email'
  }
}
```

---

## 关键技术要点

| 功能 | 技术要点 |
|------|----------|
| 密码安全 | bcrypt 加密，salt rounds = 10 |
| 用户隔离 | 通过 user-id header 识别用户，所有操作带用户校验 |
| 软删除 | is_del 字段标记，支持恢复和定时清理 |
| 本地时间显示 | 使用服务器本地时间存储，不再手动时区转换，支持相对时间（刚刚、分钟前、小时前）和绝对时间，每30秒实时同步 |
| 邮件发送 | SendCloud API V2，FormData multipart/form-data，支持 CID 内嵌图片，邮件图片自动压缩至≤2MB |
| 图片上传 | Multer 处理，按用户分目录存储，5MB 限制，双重验证，上传时自动压缩（最大1920x1080，JPEG 85%质量） |
| 图片拖拽 | 支持拖拽上传，多图批量上传，进度显示 |
| 定时任务 | setInterval 实现，每24小时清理一次 |
| 前端状态 | localStorage 存储 token，axios 拦截器统一处理 |
| 错误提示 | 统一模态框提示，替代原生 alert |
