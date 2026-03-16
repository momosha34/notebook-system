# 个人笔记本系统 - 关键代码实现

本文档详细记录了系统各功能模块的关键代码实现，便于快速理解和维护。

***

## 目录

1. [JWT 认证中间件](#1-jwt-认证中间件)
2. [用户认证](#2-用户认证)
3. [笔记管理与全文搜索](#3-笔记管理与全文搜索)
4. [邮件发送与 CID 内嵌图片](#4-邮件发送与-cid-内嵌图片)
5. [图片上传与自动压缩](#5-图片上传与自动压缩)
6. [定时任务](#6-定时任务)
7. [数据库初始化](#7-数据库初始化)
8. [前端路由与认证](#8-前端路由与认证)
9. [前端编辑器与笔记保存](#9-前端编辑器与笔记保存)

***

## 1. JWT 认证中间件

**文件**: [backend/middleware/auth.js](backend/middleware/auth.js)

### 1.1 Token 生成

```javascript
import jwt from 'jsonwebtoken';

const SECRET_KEY = 'your-secret-key-change-in-production';

// 生成JWT token，有效期7天
function generateToken(userId, username) {
  return jwt.sign(
    { userId: userId, username: username },
    SECRET_KEY,
    { expiresIn: '7d' }
  );
}
```

### 1.2 Token 验证中间件

```javascript
// JWT验证中间件
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // 向后兼容：如果没有Authorization头，尝试使用user-id头
  if (!authHeader) {
    const userId = req.headers['user-id'];
    if (userId) {
      req.userId = userId;
      return next();
    }
    return res.status(401).json({ error: '未授权访问' });
  }
  
  // 提取token
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '无效的token格式' });
  }
  
  try {
    // 验证token
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId.toString();
    next();
  } catch (error) {
    return res.status(401).json({ error: '无效的token' });
  }
}
```

**设计要点**:

- 使用 `jsonwebtoken` 库生成和验证 JWT
- Token 有效期 7 天
- 向后兼容旧版本的 `user-id` header
- 验证失败返回 401 状态码

***

## 2. 用户认证

**文件**: [backend/routes/auth.js](backend/routes/auth.js)

### 2.1 用户注册

```javascript
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    // 使用 bcrypt 加密密码，salt rounds = 10
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO user (username, password) VALUES (?, ?)',
      [username, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '用户名已存在' });
          }
          return res.status(500).json({ error: '注册失败' });
        }
        // 注册成功，生成JWT token
        const token = generateToken(this.lastID, username);
        res.json({ 
          token, 
          username, 
          message: '注册成功',
          user: { id: this.lastID, username }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.2 用户登录

```javascript
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  db.get(
    'SELECT * FROM user WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' });
      }
      
      if (!user) {
        return res.status(400).json({ error: '用户不存在' });
      }
      
      // 使用 bcrypt 比较明文密码和加密后的密码
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(400).json({ error: '密码错误' });
      }
      
      // 登录成功，生成JWT token
      const token = generateToken(user.id, user.username);
      res.json({ 
        token, 
        username, 
        message: '登录成功',
        user: { id: user.id, username: user.username }
      });
    }
  );
});
```

***

## 3. 笔记管理与全文搜索

**文件**: [backend/routes/notes.js](backend/routes/notes.js)

### 3.1 本地时间生成

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
```

### 3.2 HTML 标签去除（用于搜索索引）

```javascript
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
```

### 3.3 FTS 查询语句转义

```javascript
function escapeFtsQuery(query) {
  if (!query) return '';
  const escaped = query.replace(/['"]/g, '').replace(/[^\w\u4e00-\u9fa5\s]/g, ' ');
  const terms = escaped.trim().split(/\s+/).filter(t => t.length > 0);
  return terms.map(t => `${t}*`).join(' OR ');
}
```

### 3.4 笔记列表查询（支持 FTS5 全文搜索）

```javascript
router.get('/notes', verifyToken, (req, res) => {
  const { s } = req.query;
  const userId = req.userId;
  
  if (s && s.trim()) {
    const ftsQuery = escapeFtsQuery(s);
    const sql = `
      SELECT n.* FROM note n
      JOIN note_fts fts ON n.id = fts.id
      WHERE n.user_id = ? AND n.is_del = 0
      AND note_fts MATCH ?
      ORDER BY n.updated_at DESC
    `;
    db.all(sql, [userId, ftsQuery], (err, notes) => {
      if (err) {
        console.error('FTS搜索失败，回退到LIKE搜索:', err.message);
        const fallbackSql = 'SELECT * FROM note WHERE user_id = ? AND is_del = 0 AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC';
        db.all(fallbackSql, [userId, `%${s}%`, `%${s}%`], (err2, notes2) => {
          if (err2) {
            return res.status(500).json({ error: '获取笔记失败' });
          }
          res.json(notes2);
        });
        return;
      }
      res.json(notes);
    });
  } else {
    const sql = 'SELECT * FROM note WHERE user_id = ? AND is_del = 0 ORDER BY updated_at DESC';
    db.all(sql, [userId], (err, notes) => {
      if (err) {
        return res.status(500).json({ error: '获取笔记失败' });
      }
      res.json(notes);
    });
  }
});
```

### 3.5 笔记创建/更新（同步 FTS 索引）

```javascript
router.post('/note', verifyToken, (req, res) => {
  const { id, title, content, sheet_data } = req.body;
  const userId = req.userId;
  const currentTime = getLocalTimeString();
  const plainContent = stripHtml(content);
  
  if (id) {
    // 更新现有笔记
    db.run(
      'UPDATE note SET title = ?, content = ?, sheet_data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [title, content, sheet_data, currentTime, id, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '更新笔记失败' });
        }
        // 更新 FTS 索引
        db.run(
          'UPDATE note_fts SET title = ?, content = ? WHERE id = ?',
          [title, plainContent, id],
          (ftsErr) => {
            if (ftsErr) {
              console.error('更新FTS索引失败:', ftsErr.message);
            }
          }
        );
        res.json({ id, message: '更新成功' });
      }
    );
  } else {
    // 新建笔记
    db.run(
      'INSERT INTO note (user_id, title, content, sheet_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, content, sheet_data, currentTime, currentTime],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '创建笔记失败' });
        }
        const newId = this.lastID;
        // 插入 FTS 索引
        db.run(
          'INSERT INTO note_fts (id, user_id, title, content) VALUES (?, ?, ?, ?)',
          [newId, userId, title, plainContent],
          (ftsErr) => {
            if (ftsErr) {
              console.error('插入FTS索引失败:', ftsErr.message);
            }
          }
        );
        res.json({ id: newId, message: '创建成功' });
      }
    );
  }
});
```

### 3.6 软删除与 FTS 索引清理

```javascript
router.delete('/note/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  db.run(
    'UPDATE note SET is_del = 1 WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '删除失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '笔记不存在' });
      }
      // 从 FTS 索引中删除
      db.run('DELETE FROM note_fts WHERE id = ?', [id], (ftsErr) => {
        if (ftsErr) {
          console.error('删除FTS索引失败:', ftsErr.message);
        }
      });
      res.json({ message: '删除成功' });
    }
  );
});
```

### 3.7 恢复笔记（重建 FTS 索引）

```javascript
router.put('/note/:id/recover', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  db.run(
    'UPDATE note SET is_del = 0 WHERE id = ? AND user_id = ?',
    [id, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '恢复笔记失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '笔记不存在' });
      }
      // 重建 FTS 索引
      db.get('SELECT title, content FROM note WHERE id = ?', [id], (err, note) => {
        if (note) {
          const plainContent = stripHtml(note.content);
          db.run(
            'INSERT OR REPLACE INTO note_fts (id, user_id, title, content) VALUES (?, ?, ?, ?)',
            [id, userId, note.title, plainContent],
            (ftsErr) => {
              if (ftsErr) {
                console.error('恢复FTS索引失败:', ftsErr.message);
              }
            }
          );
        }
      });
      res.json({ message: '恢复成功' });
    }
  );
});
```

***

## 4. 邮件发送与 CID 内嵌图片

**文件**: [backend/routes/share.js](backend/routes/share.js)

### 4.1 SendCloud API 配置

```javascript
const EMAIL_API_CONFIG = {
  apiUser: 'sc_sbxylb_test_TOaisC',
  apiKey: '0ca7b199cd905c534e1d42c92bac0550',
  from: 'sendcloud@sbxylb.sendcloud.org',
  fromName: '笔记本系统'
};
```

### 4.2 邮件图片压缩

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
    
    // 如果图片已经符合要求，直接返回
    if (originalSize <= MAX_EMAIL_IMAGE_SIZE && 
        metadata.width <= MAX_EMAIL_IMAGE_WIDTH && 
        metadata.height <= MAX_EMAIL_IMAGE_HEIGHT) {
      return { success: true, compressed: false, path: imagePath };
    }
    
    // 计算目标尺寸
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
    
    // 调整尺寸
    if (needsResize) {
      image = image.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // 根据格式设置压缩质量
    if (ext === '.jpg' || ext === '.jpeg') {
      image = image.jpeg({ quality: 80 });
    } else if (ext === '.png') {
      image = image.png({ quality: 85 });
    } else if (ext === '.webp') {
      image = image.webp({ quality: 80 });
    } else if (ext === '.gif') {
      return { success: true, compressed: false, path: imagePath };
    }
    
    // 保存临时压缩文件
    const tempPath = imagePath + '.email_compressed';
    await image.toFile(tempPath);
    
    // 检查压缩效果
    const tempStats = fs.statSync(tempPath);
    if (tempStats.size < originalSize) {
      console.log(`邮件图片压缩成功: ${path.basename(imagePath)} (${(originalSize/1024).toFixed(1)}KB -> ${(tempStats.size/1024).toFixed(1)}KB)`);
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

### 4.3 处理内容图片为 CID 格式

```javascript
async function processContentImagesToCidFormat(content, userId) {
  try {
    const { load } = await import('cheerio');
    const $ = load(content);
    
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const imagesInfo = [];
    const compressedFiles = [];
    
    // 遍历所有图片标签
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
            
            // 替换 src 为 cid
            $(img).attr('src', `cid:${cid}`);
            $(img).attr('style', 'max-width: 100% !important; height: auto !important; display: block !important; margin: 10px auto !important; border-radius: 4px !important; border: 2px solid #e9ecef !important;');
            $(img).attr('alt', `图片 ${i + 1}: ${imageFilename}`);
            $(img).removeAttr('loading');
            $(img).removeAttr('decoding');
            
            console.log(`图片处理：${imageFilename} -> CID: ${cid}, 路径：${imagePath}`);
          } else {
            $(img).replaceWith(`<p style="color: #999; font-style: italic; font-size: 14px;">[无权访问]</p>`);
          }
        }
      }
    });
    
    // 压缩所有图片
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
```

### 4.4 邮件发送核心函数

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
        console.log(`添加内嵌图片：${imageInfo.filename} (CID: ${imageInfo.cid}, 大小：${(fileStats.size/1024).toFixed(1)}KB)`);
        
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

### 4.5 邮件发送接口

```javascript
router.post('/send-email', verifyToken, async (req, res) => {
  const { email, noteId } = req.body;
  const userId = req.userId;
  
  if (!email) {
    return res.status(400).json({ error: '邮箱不能为空' });
  }
  if (!noteId) {
    return res.status(400).json({ error: '笔记ID不能为空' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }

  try {
    // 获取笔记
    const note = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM note WHERE id = ? AND is_del = 0',
        [noteId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    // 构建邮件内容
    const { html, imagesInfo, compressedFiles } = await buildEmailContentWithCidImages(note, userId);

    console.log('=== 邮件发送调试信息 ===');
    console.log('笔记 ID:', noteId);
    console.log('笔记标题:', note.title);
    console.log('HTML 大小:', Buffer.byteLength(html, 'utf8'), 'bytes');
    console.log('图片数量:', imagesInfo.length);
    console.log('========================');

    // 检查邮件大小
    const htmlSize = Buffer.byteLength(html, 'utf8');
    const maxSize = 15 * 1024 * 1024;
    
    if (htmlSize > maxSize) {
      for (const tempFile of compressedFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (cleanupError) {
          console.error('清理临时文件失败:', cleanupError);
        }
      }
      return res.status(400).json({ 
        error: `邮件内容过大 (${(htmlSize/1024/1024).toFixed(1)}MB)，请减少图片数量或降低图片质量` 
      });
    }

    // 计算图片总大小
    let totalImageSize = 0;
    for (const imgInfo of imagesInfo) {
      try {
        if (fs.existsSync(imgInfo.path)) {
          totalImageSize += fs.statSync(imgInfo.path).size;
        }
      } catch (e) {}
    }

    console.log(`发送邮件: HTML大小 ${(htmlSize/1024).toFixed(1)}KB, 图片总大小 ${(totalImageSize/1024).toFixed(1)}KB, 内嵌图片数量: ${imagesInfo.length}`);

    // 纯文本版本
    const textContent = `
笔记分享: ${note.title || '无标题笔记'}
创建时间: ${formatDate(note.created_at)}
更新时间: ${formatDate(note.updated_at)}
笔记内容:
${note.content ? note.content.replace(/<[^>]*>/g, '').substring(0, 500) + '...' : '暂无内容'}
---
此邮件由个人笔记本系统自动发送
    `.trim();

    const subject = `笔记分享: ${note.title || '无标题笔记'}`;

    try {
      const result = await sendEmailViaApi(email, subject, html, textContent, imagesInfo);
      
      console.log('邮件发送成功:', result.messageId);
      res.json({ 
        message: '邮件发送成功',
        stats: {
          htmlSize: `${(htmlSize/1024).toFixed(1)}KB`,
          imageSize: `${(totalImageSize/1024).toFixed(1)}KB`,
          imageCount: imagesInfo.length,
          compressedCount: imagesInfo.filter(i => i.compressed).length
        }
      });
    } finally {
      // 清理临时压缩文件
      for (const tempFile of compressedFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            console.log('已清理临时压缩文件:', tempFile);
          }
        } catch (cleanupError) {
          console.error('清理临时文件失败:', cleanupError);
        }
      }
    }
    
  } catch (error) {
    console.error('邮件发送失败:', error);
    let errorMessage = '邮件发送失败';
    if (error.message.includes('网络请求失败') || error.message.includes('请求超时')) {
      errorMessage = '网络连接失败，请检查网络后重试';
    } else if (error.message.includes('API响应解析失败')) {
      errorMessage = '邮件服务响应异常，请稍后重试';
    } else if (error.message.includes('邮箱格式')) {
      errorMessage = '收件人邮箱地址无效';
    } else {
      errorMessage = `邮件发送失败: ${error.message}`;
    }
    res.status(500).json({ error: errorMessage });
  }
});
```

***

## 5. 图片上传与自动压缩

**文件**: [backend/routes/upload.js](backend/routes/upload.js)

### 5.1 Multer 存储配置

```javascript
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;  // 5MB
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1080;
const JPEG_QUALITY = 85;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.userId;
    if (!userId) {
      return cb(new Error('未授权访问'), null);
    }
    
    // 按用户 ID 创建目录
    const userUploadsDir = path.join(__dirname, '../uploads', userId);
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }
    
    cb(null, userUploadsDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
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
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});
```

### 5.2 图片自动压缩

```javascript
async function compressImage(imagePath, mimeType) {
  try {
    const ext = path.extname(imagePath).toLowerCase();
    let compressed = false;
    
    let image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // 计算目标尺寸
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
    
    // 根据格式设置质量
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

### 5.3 上传接口

```javascript
router.post('/upload-image', verifyToken, upload.single('image'), async (req, res) => {
    const userId = req.userId;
  
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
      
      console.log('上传成功:', {
        url: imageUrl,
        originalName: req.file.originalName,
        originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
        finalSize: `${(finalSize / 1024).toFixed(1)}KB`,
        compressed: compressResult.compressed,
        mimeType: req.file.mimeType
      });
      
      res.json({
        success: true,
        url: imageUrl,
        filename: req.file.filename,
        originalName: req.file.originalName,
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

***

## 6. 定时任务

**文件**: [backend/scheduledTasks.js](backend/scheduledTasks.js)

```javascript
import { db } from './app.js';

// 定期清理回收站中超过30天的笔记
function autoCleanTrash() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 格式化日期为SQLite支持的格式 (YYYY-MM-DD HH:MM:SS)
  const formattedDate = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

  const sql = `DELETE FROM note WHERE is_del = 1 AND updated_at < ?`;
  
  db.run(sql, [formattedDate], function(err) {
    if (err) {
      console.error('自动清理回收站失败:', err.message);
    } else {
      if (this.changes > 0) {
        console.log(`[${new Date().toLocaleString()}] 自动清理了 ${this.changes} 条过期笔记`);
      }
    }
  });
}

function startScheduledTasks() {
  // 启动时立即执行一次
  autoCleanTrash();
  
  // 每24小时执行一次
  setInterval(autoCleanTrash, 24 * 60 * 60 * 1000);
  
  console.log('定时任务已启动：回收站自动清理（每24小时执行一次）');
}

export { startScheduledTasks };
```

***

## 7. 数据库初始化

**文件**: [backend/app.js](backend/app.js)

```javascript
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./notebook.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
    initDatabase();
    startScheduledTasks();
  }
});

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

  // FTS5全文索引虚拟表
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
    id UNINDEXED,
    user_id UNINDEXED,
    title,
    content,
    tokenize = 'unicode61'
  )`, (err) => {
    if (err) {
      console.log('FTS5表已存在或创建失败:', err.message);
    } else {
      console.log('FTS5全文索引表创建成功');
    }
  });
}

export { db };
```

***

## 8. 前端路由与认证

**文件**: [frontend/src/router/index.js](frontend/src/router/index.js)

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Index from '@/views/Index.vue'
import Edit from '@/views/Edit.vue'
import Share from '@/views/Share.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: Login },
  { path: '/index', name: 'Index', component: Index },
  { path: '/edit', name: 'Edit', component: Edit },
  { path: '/edit/:id', name: 'EditNote', component: Edit },
  { path: '/s/:shareId', name: 'Share', component: Share }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = sessionStorage.getItem('token')
  console.log('路由守卫: ', to.path, 'token:', token)
  
  // 允许分享页面无需登录
  if (to.path.startsWith('/s/')) {
    next()
  } else if (to.path !== '/login' && !token) {
    console.log('未登录，跳转到登录页')
    next('/login')
  } else if (to.path === '/login' && token) {
    console.log('已登录，跳转到首页')
    next('/index')
  } else {
    console.log('正常导航')
    next()
  }
})

export default router
```

**文件**: [frontend/src/utils/axiosConfig.js](frontend/src/utils/axiosConfig.js)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 30000
});

// 请求拦截器：自动添加 Authorization header
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

// 响应拦截器：401 自动跳转登录
api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

***

## 9. 前端编辑器与笔记保存

**文件**: [frontend/src/views/Edit.vue](frontend/src/views/Edit.vue)

```javascript
async saveNote() {
  this.saving = true;
  try {
    const response = await api.post('/api/note', this.note);
    
    // 新建笔记时更新URL
    if (!this.note.id) {
      this.note.id = response.data.id;
      this.$router.replace(`/edit/${this.note.id}`);
    }
    
    this.showAlert('保存成功', '笔记已成功保存');
  } catch (error) {
    console.error('保存失败:', error);
    this.showAlert('保存失败', '保存笔记时出现错误，请稍后重试');
  } finally {
    this.saving = false;
  }
},

async handleEmailSubmit() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(this.emailTo)) {
    this.showAlert('提示', '请输入有效的邮箱地址');
    return;
  }
  
  this.sendingEmail = true;
  try {
    const response = await api.post('/send-email', {
      email: this.emailTo.trim(),
      noteId: this.note.id.toString()
    }, {
      timeout: 30000
    });
    
    this.showAlert('发送成功', '邮件发送成功！');
    this.showEmailModal = false;
  } catch (error) {
    this.showAlert('发送失败', '邮件发送失败: ' + (error.response?.data?.error || error.message));
  } finally {
    this.sendingEmail = false;
  }
}
```

***

## 关键技术要点总结

| 功能     | 技术要点                                                   |
| ------ | ------------------------------------------------------ |
| 密码安全   | bcrypt 加密，salt rounds = 10                             |
| JWT 认证 | jsonwebtoken，7天有效期，向后兼容 user-id header                 |
| 用户隔离   | 通过 JWT 中间件获取 userId，所有操作带用户校验                          |
| 软删除    | is\_del 字段标记，支持恢复和定时清理                                 |
| 本地时间   | 使用服务器本地时间存储，格式 YYYY-MM-DD HH:MM:SS                     |
| 全文搜索   | SQLite FTS5 + unicode61 分词器，失败自动降级到 LIKE               |
| 邮件发送   | SendCloud API V2，FormData multipart/form-data，CID 内嵌图片 |
| 图片压缩   | Sharp 库，上传时 1920x1080 + JPEG 85%，邮件时 ≤2MB              |
| 图片存储   | Multer 处理，按用户 ID 分目录，5MB 限制，双重验证                       |
| 定时任务   | setInterval，每24小时清理30天前回收站                             |
| 前端状态   | sessionStorage 存储 token，axios 拦截器统一处理                  |
| 路由守卫   | 未登录跳转登录页，分享页无需登录                                       |

