import express from 'express';
import { db } from '../app.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import FormData from 'form-data';
import { verifyToken } from '../middleware/auth.js'; // 导入JWT验证中间件

const require = createRequire(import.meta.url);
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const router = express.Router();

const EMAIL_API_CONFIG = {
  apiUser: 'sc_sbxylb_test_TOaisC',
  apiKey: '0ca7b199cd905c534e1d42c92bac0550',
  from: 'sendcloud@sbxylb.sendcloud.org',
  fromName: '笔记本系统'
};

router.get('/api/s/:shareId', (req, res) => {
  const { shareId } = req.params;
  
  db.get(
    'SELECT * FROM note WHERE id = ? AND is_del = 0',
    [shareId],
    (err, note) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' });
      }
      
      if (!note) {
        return res.status(404).json({ error: '笔记不存在或已被删除' });
      }
      
      res.json({
        id: note.id,
        title: note.title,
        content: note.content,
        sheet_data: note.sheet_data,
        updated_at: note.updated_at,
        shared: true
      });
    }
  );
});

function getCellValue(cell) {
  if (!cell) return '';
  
  if (cell.v !== null && cell.v !== undefined) {
    if (typeof cell.v === 'object' && cell.v !== null) {
      return cell.v.m !== undefined ? cell.v.m : 
             cell.v.v !== undefined ? cell.v.v : 
             cell.v !== null ? cell.v : '';
    }
    return cell.v;
  }
  
  if (cell.m !== null && cell.m !== undefined) {
    return cell.m;
  }
  
  return '';
}

function generateTableHtml(sheetData) {
  if (!Array.isArray(sheetData) || sheetData.length === 0) return '';

  let html = '';
  
  sheetData.forEach((sheet, sheetIndex) => {
    if (!sheet.data || sheet.data.length === 0) return;
    
    const sheetName = sheet.name || `表格${sheetIndex + 1}`;
    html += `<h3 style="color: #495057; margin: 20px 0 10px 0;">${sheetName}</h3>`;
    html += '<table class="email-table">';
    
    const firstRow = sheet.data[0];
    if (firstRow && firstRow.some(cell => cell && (cell.v || cell.m))) {
      html += '<thead><tr>';
      firstRow.forEach(cell => {
        const value = getCellValue(cell);
        html += `<th>${value}</th>`;
      });
      html += '</tr></thead>';
    }
    
    html += '<tbody>';
    const startRow = firstRow && firstRow.some(cell => cell && (cell.v || cell.m)) ? 1 : 0;
    
    for (let r = startRow; r < sheet.data.length; r++) {
      html += '<tr>';
      const row = sheet.data[r];
      if (row) {
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          const value = getCellValue(cell);
          html += `<td>${value}</td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
  });
  
  return html;
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '未知时间';
  }
}

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
            $(img).removeAttr('loading');
            $(img).removeAttr('decoding');
            $(img).removeAttr('decoding');
            
            console.log(`图片处理：${imageFilename} -> CID: ${cid}, 路径：${imagePath}`);
          } else {
            $(img).replaceWith(`<p style="color: #999; font-style: italic; font-size: 14px;">[无权访问]</p>`);
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
    
    @media (max-width: 480px) {
      body {
        padding: 10px;
      }
      
      .email-title {
        font-size: 18px;
      }
      
      .section-title {
        font-size: 15px;
      }
      
      .note-content {
        padding: 12px;
      }
      
      .email-table th,
      .email-table td {
        padding: 6px 8px;
        font-size: 13px;
      }
      
      .meta-info {
        padding: 8px 10px;
        font-size: 12px;
      }
    }
    
    @media (max-width: 320px) {
      body {
        padding: 8px;
      }
      
      .email-title {
        font-size: 16px;
      }
      
      .note-content {
        padding: 10px;
      }
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

  // 添加内嵌图片（使用 SendCloud API V2 的 embeddedCid 参数）
  for (const imageInfo of imagesInfo) {
    try {
      if (fs.existsSync(imageInfo.path)) {
        const fileStats = fs.statSync(imageInfo.path);
        console.log(`添加内嵌图片：${imageInfo.filename} (CID: ${imageInfo.cid}, 大小：${(fileStats.size/1024).toFixed(1)}KB)`);
        
        // 使用 attachments 参数添加内嵌图片，并指定 embeddedCid
        form.append('attachments', fs.createReadStream(imageInfo.path), {
          filename: imageInfo.filename,
          contentType: imageInfo.mimeType,
          knownLength: fileStats.size
        });
        form.append('embeddedCid', imageInfo.cid);
      } else {
        console.error(`图片文件不存在：${imageInfo.path}`);
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
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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

router.post('/send-email', verifyToken, async (req, res) => {
  const { email, noteId } = req.body;
  const userId = req.userId; // 从JWT中间件获取用户ID
  
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

    const { html, imagesInfo, compressedFiles } = await buildEmailContentWithCidImages(note, userId);

    console.log('=== 邮件发送调试信息 ===');
    console.log('笔记 ID:', noteId);
    console.log('笔记标题:', note.title);
    console.log('笔记内容长度:', note.content ? note.content.length : 0);
    console.log('笔记内容预览:', note.content ? note.content.substring(0, 200) : '无内容');
    console.log('图片数量:', imagesInfo.length);
    console.log('HTML 大小:', Buffer.byteLength(html, 'utf8'), 'bytes');
    console.log('========================');

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

    let totalImageSize = 0;
    for (const imgInfo of imagesInfo) {
      try {
        if (fs.existsSync(imgInfo.path)) {
          totalImageSize += fs.statSync(imgInfo.path).size;
        }
      } catch (e) {
      }
    }

    console.log(`发送邮件: HTML大小 ${(htmlSize/1024).toFixed(1)}KB, 图片总大小 ${(totalImageSize/1024).toFixed(1)}KB, 内嵌图片数量: ${imagesInfo.length}`);

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

export default router;
