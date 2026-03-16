# 国内主流邮箱服务邮件内嵌图片大小限制分析

## 概述

本文档系统性地调研和分析了国内主流邮箱服务对邮件内嵌图片的大小限制，旨在解决 QQ 邮箱等主流邮箱无法正常显示邮件中图片内容的问题。系统在图片上传和邮件发送两个环节都实现了自动压缩功能，确保邮件在各大邮箱平台都能正常显示。

---

## 1. QQ 邮箱限制标准

### 1.1 普通附件限制
- **单个附件最大大小**: 50MB
- **整封邮件总大小**: ≤55MB
- **24小时累计发送**: ≤200MB

### 1.2 超大附件限制
- **免费用户单个文件**: ≤2GB
- **VIP 用户单个文件**: ≤3GB
- **有效期**: 30天

### 1.3 内嵌图片（CID）最佳实践
虽然 QQ 邮箱没有明确规定单个内嵌图片的大小限制，但根据行业最佳实践和邮箱服务商的通用策略，建议：
- **单个内嵌图片**: ≤2MB
- **所有内嵌图片总大小**: ≤10MB
- **推荐图片格式**: JPEG, PNG
- **避免使用**: BMP, TIFF 等未压缩格式

---

## 2. 其他国内主流邮箱服务限制

| 邮箱服务商 | 单个附件限制 | 整封邮件限制 | 内嵌图片建议 | 备注 |
|-----------|-------------|-------------|-------------|------|
| **QQ邮箱** | 50MB | 55MB | ≤2MB/张，≤10MB总 | 腾讯旗下 |
| **网易163/126邮箱** | 50MB | 50MB | ≤2MB/张，≤10MB总 | 网易旗下 |
| **新浪邮箱** | 50MB | 50MB | ≤1.5MB/张，≤8MB总 | 新浪旗下 |
| **搜狐邮箱** | 50MB | 50MB | ≤1.5MB/张，≤8MB总 | 搜狐旗下 |
| **阿里云邮箱** | 50MB | 50MB | ≤2MB/张，≤10MB总 | 阿里巴巴旗下 |
| **Outlook/Hotmail** | 25MB | 25MB | ≤1MB/张，≤5MB总 | 微软旗下 |
| **Gmail** | 25MB | 25MB | ≤1MB/张，≤5MB总 | 谷歌旗下 |

---

## 3. 各邮箱服务商图片处理机制差异

### 3.1 QQ 邮箱
- 优势：对大图片的容忍度较高
- 特点：会自动压缩超大图片，但可能影响显示
- 建议：主动压缩图片至≤2MB，避免自动压缩导致的质量损失

### 3.2 网易邮箱
- 特点：对邮件大小严格控制
- 建议：单张图片不超过 1.5MB

### 3.3 新浪/搜狐邮箱
- 特点：保守的大小限制策略
- 建议：单张图片不超过 1.5MB，总图片不超过 8MB

### 3.4 阿里云邮箱
- 特点：企业级稳定性，与 QQ 邮箱类似
- 建议：遵循 QQ 邮箱的标准即可

---

## 4. 问题分析与解决方案

### 4.1 QQ 邮箱图片无法显示的可能原因

1. **图片文件过大**
   - 超过邮箱服务商的隐性限制
   - 触发邮箱的自动过滤机制

2. **图片格式不兼容**
   - 使用了不支持的图片格式
   - 文件扩展名与实际格式不符

3. **邮件总大小超限**
   - 虽然单个图片可能不大，但多个图片累加超过总限制

4. **CID 引用方式问题**
   - CID 格式不正确
   - 图片文件与 CID 不匹配

### 4.2 推荐的解决方案

**方案一：图片自动压缩（推荐，本系统已实现）**
- 上传时自动压缩图片
- 邮件发送前检查和压缩图片
- 使用 Sharp 图片处理库

**方案二：限制上传大小**
- 前端限制上传图片大小
- 后端二次检查和压缩

**方案三：图片链接替代**
- 对于超大图片，提供下载链接
- 配合云存储服务使用

---

## 5. 系统实际实现

### 5.1 图片上传时的压缩（upload.js）

系统在图片上传时已实现自动压缩功能：

| 参数 | 值 | 说明 |
|-----|---|-----|
| **最大宽度** | 1920px | 图片最大宽度 |
| **最大高度** | 1080px | 图片最大高度 |
| **JPEG 质量** | 85% | JPEG 压缩质量 |
| **PNG 质量** | 90% | PNG 压缩质量 |
| **WebP 质量** | 85% | WebP 压缩质量 |
| **上传限制** | 5MB | 原始文件最大大小 |
| **压缩逻辑** | 超过尺寸或质量优化后自动替换原图 | |

**关键代码：**
```javascript
async function compressImage(imagePath, mimeType) {
  let image = sharp(imagePath);
  const metadata = await image.metadata();
  
  // 尺寸调整
  if (metadata.width > MAX_IMAGE_WIDTH) {
    targetWidth = MAX_IMAGE_WIDTH;
    targetHeight = Math.round((metadata.height / metadata.width) * MAX_IMAGE_WIDTH);
    image = image.resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  
  // 质量压缩
  if (ext === '.jpg' || ext === '.jpeg') {
    image = image.jpeg({ quality: JPEG_QUALITY });
  } else if (ext === '.png') {
    image = image.png({ quality: 90 });
  } else if (ext === '.webp') {
    image = image.webp({ quality: 85 });
  }
}
```

### 5.2 邮件发送时的图片压缩（share.js）

系统在邮件发送前会再次压缩图片，确保符合邮箱要求：

| 参数 | 值 | 说明 |
|-----|---|-----|
| **最大宽度** | 1920px | 邮件图片最大宽度 |
| **最大高度** | 1080px | 邮件图片最大高度 |
| **单张最大** | 2MB | 邮件图片最大大小 |
| **JPEG 质量** | 80% | 邮件 JPEG 压缩质量 |
| **PNG 质量** | 85% | 邮件 PNG 压缩质量 |
| **WebP 质量** | 80% | 邮件 WebP 压缩质量 |
| **GIF 格式** | 不压缩 | 保持原样 |
| **压缩文件处理** | 生成临时压缩文件，发送后自动清理 | |

**关键代码：**
```javascript
async function compressImageForEmail(imagePath) {
  const MAX_EMAIL_IMAGE_WIDTH = 1920;
  const MAX_EMAIL_IMAGE_HEIGHT = 1080;
  const MAX_EMAIL_IMAGE_SIZE = 2 * 1024 * 1024;
  
  // 如果图片已经符合要求，直接返回
  if (originalSize <= MAX_EMAIL_IMAGE_SIZE && 
      metadata.width <= MAX_EMAIL_IMAGE_WIDTH && 
      metadata.height <= MAX_EMAIL_IMAGE_HEIGHT) {
    return { success: true, compressed: false, path: imagePath };
  }
  
  // 调整尺寸和质量
  // ... 压缩逻辑 ...
  
  // 保存临时文件
  const tempPath = imagePath + '.email_compressed';
  await image.toFile(tempPath);
  
  // 检查压缩效果
  if (tempStats.size < originalSize) {
    return { success: true, compressed: true, path: tempPath, originalPath: imagePath };
  }
}
```

### 5.3 CID 内嵌图片处理

系统使用 Cheerio 解析 HTML 内容，将图片 URL 替换为 CID 引用：

```javascript
async function processContentImagesToCidFormat(content, userId) {
  const { load } = await import('cheerio');
  const $ = load(content);
  
  const imagesInfo = [];
  const compressedFiles = [];
  
  // 遍历所有图片标签
  $('img').each((i, img) => {
    const src = $(img).attr('src');
    
    if (src && src.startsWith('/uploads/')) {
      const cid = `note_image_${i}_${Date.now()}`;
      
      // 替换为 CID 引用
      $(img).attr('src', `cid:${cid}`);
      
      imagesInfo.push({
        index: i,
        filename: imageFilename,
        path: imagePath,
        cid: cid,
        mimeType: mimeType
      });
    }
  });
  
  // 压缩所有图片
  for (const imageInfo of imagesInfo) {
    const compressResult = await compressImageForEmail(imageInfo.originalPath);
    if (compressResult.success) {
      imageInfo.path = compressResult.path;
    }
  }
  
  return { html: $.html(), imagesInfo, compressedFiles };
}
```

### 5.4 SendCloud API 邮件发送

使用 SendCloud API V2 发送邮件，通过 FormData 上传内嵌图片：

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

  // 添加内嵌图片（使用 attachments + embeddedCid）
  for (const imageInfo of imagesInfo) {
    if (fs.existsSync(imageInfo.path)) {
      form.append('attachments', fs.createReadStream(imageInfo.path), {
        filename: imageInfo.filename,
        contentType: imageInfo.mimeType,
        knownLength: fileStats.size
      });
      form.append('embeddedCid', imageInfo.cid);
    }
  }
  
  // 发送请求...
}
```

### 5.5 临时文件清理

邮件发送完成后自动清理临时压缩文件：

```javascript
try {
  const result = await sendEmailViaApi(email, subject, html, textContent, imagesInfo);
  res.json({ message: '邮件发送成功' });
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
```

### 5.6 推荐的图片格式

| 格式 | 适用场景 | 推荐质量 | 说明 |
|-----|---------|---------|-----|
| **JPEG** | 照片类、复杂图像 | 80-85% | 有损压缩，文件小 |
| **PNG** | 图形类、需要透明背景 | 85-90% | 无损压缩，质量好 |
| **GIF** | 动画类、简单图形 | - | 支持动画 |
| **WebP** | 现代浏览器 | 80-85% | 现代格式，压缩率高 |

---

## 6. 邮件发送完整流程

```
用户点击发送邮件
    ↓
获取笔记数据
    ↓
解析 HTML 内容，提取所有图片
    ↓
验证用户权限（只能发送自己的图片）
    ↓
对每张图片进行压缩（≤2MB, 1920x1080）
    ↓
将图片 URL 替换为 CID 引用
    ↓
构建邮件 HTML 内容（响应式模板）
    ↓
检查邮件总大小（≤15MB）
    ↓
使用 SendCloud API 发送邮件
    ↓
上传内嵌图片（attachments + embeddedCid）
    ↓
清理临时压缩文件
    ↓
返回发送结果
```

---

## 7. 最佳实践总结

1. **统一压缩标准**: 所有图片在发送前压缩至≤2MB
2. **格式标准化**: 优先使用 JPEG 和 PNG 格式
3. **尺寸控制**: 最大尺寸不超过 1920x1080
4. **数量限制**: 单封邮件内嵌图片建议不超过 5-10 张
5. **备选方案**: 提供图片下载链接作为备选
6. **测试验证**: 在发送前在多个邮箱平台测试
7. **双重压缩**: 上传时压缩一次，邮件发送时再压缩一次
8. **临时文件**: 生成临时压缩文件，发送后立即清理
9. **日志记录**: 记录压缩前后的文件大小，便于调试
10. **容错处理**: 压缩失败时使用原图，保证邮件能发送

---

## 8. 系统配置参数总结

| 阶段 | 参数 | 值 | 位置 |
|-----|-----|---|-----|
| **上传阶段** | 最大文件大小 | 5MB | upload.js |
| **上传阶段** | 最大宽度 | 1920px | upload.js |
| **上传阶段** | 最大高度 | 1080px | upload.js |
| **上传阶段** | JPEG 质量 | 85% | upload.js |
| **上传阶段** | PNG 质量 | 90% | upload.js |
| **邮件阶段** | 单张最大 | 2MB | share.js |
| **邮件阶段** | 最大宽度 | 1920px | share.js |
| **邮件阶段** | 最大高度 | 1080px | share.js |
| **邮件阶段** | JPEG 质量 | 80% | share.js |
| **邮件阶段** | PNG 质量 | 85% | share.js |
| **邮件阶段** | 邮件总大小 | 15MB | share.js |

---

## 9. 参考资料

- QQ 邮箱官方帮助文档
- 网易邮箱服务条款
- SendCloud API V2 文档
- 邮件行业最佳实践指南
- Sharp 图片处理库文档
- SQLite FTS5 文档

---

## 10. 常见问题排查

### Q1: 邮件中的图片在 QQ 邮箱中无法显示？

**排查步骤：**
1. 检查图片大小是否超过 2MB
2. 检查邮件总大小是否超过 15MB
3. 查看服务器日志，确认压缩是否成功
4. 尝试在其他邮箱（如 Gmail、Outlook）中测试

### Q2: 如何禁用邮件图片压缩？

**不建议禁用**，但如果必须，可以修改 `share.js` 中的压缩逻辑，直接返回原图。

### Q3: 邮件发送失败，提示"邮件内容过大"？

**解决方法：**
1. 减少图片数量
2. 降低图片质量
3. 移除不必要的图片
4. 使用外部链接替代内嵌图片

### Q4: 临时压缩文件没有被清理？

**排查步骤：**
1. 检查 finally 块是否执行
2. 检查文件路径是否正确
3. 检查文件权限

---

**文档版本**: 2.0  
**最后更新**: 2026-03-16  
**维护者**: 笔记本系统开发团队

---

## 更新日志

### v2.0 (2026-03-16)
- 全面更新系统实现细节
- 新增上传压缩和邮件压缩双重压缩机制说明
- 新增 CID 内嵌图片处理流程
- 新增临时文件清理机制
- 新增邮件发送完整流程图
- 新增配置参数总结表
- 新增常见问题排查章节

### v1.1 (2026-03-10)
- 新增"系统实际实现"章节，详细说明系统在图片上传和邮件发送时的压缩策略
- 补充 upload.js 和 share.js 中的具体实现细节
