import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sharp from 'sharp';
import { verifyToken } from '../middleware/auth.js'; // 导入JWT验证中间件

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const userId = req.userId; // 从JWT中间件获取用户ID
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
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

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

router.post('/upload-image', verifyToken, upload.single('image'), async (req, res) => {
    const userId = req.userId; // 从JWT中间件获取用户ID
  
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
        originalName: req.file.originalname,
        originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
        finalSize: `${(finalSize / 1024).toFixed(1)}KB`,
        compressed: compressResult.compressed,
        mimeType: req.file.mimetype
      });
      
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

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `文件大小不能超过${MAX_FILE_SIZE / 1024 / 1024}MB` 
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: '意外的文件字段' });
    }
    return res.status(400).json({ error: '文件上传错误: ' + error.message });
  }
  
  if (error) {
    console.error('上传错误:', error.message);
    return res.status(400).json({ error: error.message });
  }
  
  next();
});

export default router;
