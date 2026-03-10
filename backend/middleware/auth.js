import jwt from 'jsonwebtoken';

const SECRET_KEY = 'your-secret-key-change-in-production';

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

// 生成JWT token
function generateToken(userId, username) {
  return jwt.sign(
    { userId: userId, username: username },
    SECRET_KEY,
    { expiresIn: '7d' }
  );
}

export { verifyToken, generateToken };