// 导入所需模块
import express from 'express'; // Express框架，用于创建路由
import { db } from '../app.js'; // 导入数据库实例
import bcrypt from 'bcryptjs'; // 加密库，用于密码加密和校验
import { generateToken } from '../middleware/auth.js'; // 导入JWT生成函数

const router = express.Router(); // 创建路由对象

// 注册接口：用于新用户注册
router.post('/register', async (req, res) => {
  const { username, password } = req.body; // 获取请求体中的用户名和密码
  
  if (!username || !password) {
    // 校验参数
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10); // 对密码进行加密
    
    db.run(
      'INSERT INTO user (username, password) VALUES (?, ?)', // 插入新用户
      [username, hashedPassword],
      function(err) {
        if (err) {
          // 用户名重复
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

// 登录接口：用于用户登录
router.post('/login', (req, res) => {
  const { username, password } = req.body; // 获取请求体中的用户名和密码
  console.log('登录请求:', { username, password });
  if (!username || !password) {
    // 校验参数
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  db.get(
    'SELECT * FROM user WHERE username = ?', // 查询用户
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' });
      }
      
      if (!user) {
        return res.status(400).json({ error: '用户不存在' });
      }
      
      const isValid = await bcrypt.compare(password, user.password); // 校验密码
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

export default router;