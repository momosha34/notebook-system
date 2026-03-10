// 导入所需模块
import express from 'express'; // Express框架，用于创建路由
import { db } from '../app.js'; // 导入数据库实例
import { verifyToken } from '../middleware/auth.js'; // 导入JWT验证中间件

const router = express.Router(); // 创建路由对象

// 获取笔记列表接口：支持按标题模糊搜索，返回当前用户所有未删除的笔记
router.get('/notes', verifyToken, (req, res) => {
  const { s } = req.query; // 获取搜索关键字
  const userId = req.userId; // 从JWT中间件获取用户ID
  
  let sql = 'SELECT * FROM note WHERE user_id = ? AND is_del = 0'; // 查询语句
  let params = [userId];
  
  if (s) {
    // 如果有搜索关键字，同时按标题和内容模糊查询
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${s}%`);
    params.push(`%${s}%`);
  }
  
  sql += ' ORDER BY updated_at DESC'; // 按更新时间倒序
  
  db.all(sql, params, (err, notes) => {
    if (err) {
      return res.status(500).json({ error: '获取笔记失败' });
    }
    res.json(notes); // 返回笔记列表
  });
});

// 获取单篇笔记接口：根据ID返回当前用户的指定笔记
router.get('/note/:id', verifyToken, (req, res) => {
  const { id } = req.params; // 获取笔记ID
  const userId = req.userId; // 从JWT中间件获取用户ID
  
  db.get(
    'SELECT * FROM note WHERE id = ? AND user_id = ? AND is_del = 0',
    [id, userId],
    (err, note) => {
      if (err) {
        return res.status(500).json({ error: '获取笔记失败' });
      }
      if (!note) {
        return res.status(404).json({ error: '笔记不存在' });
      }
      res.json(note); // 返回笔记内容
    }
  );
});

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

// 新建/保存笔记接口：根据是否有id决定新建或更新
router.post('/note', verifyToken, (req, res) => {
  const { id, title, content, sheet_data } = req.body; // 获取笔记内容
  const userId = req.userId; // 从JWT中间件获取用户ID
  const currentTime = getLocalTimeString();
  
  if (id) {
    // 更新现有笔记
    db.run(
      'UPDATE note SET title = ?, content = ?, sheet_data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [title, content, sheet_data, currentTime, id, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '更新笔记失败' });
        }
        res.json({ id, message: '更新成功' }); // 返回更新结果
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
        res.json({ id: this.lastID, message: '创建成功' }); // 返回新建结果
      }
    );
  }
});

// 删除笔记接口（软删除）：将笔记标记为已删除
router.delete('/note/:id', verifyToken, (req, res) => {
  const { id } = req.params; // 获取笔记ID
  const userId = req.userId; // 从JWT中间件获取用户ID
  
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
      res.json({ message: '删除成功' }); // 返回删除结果
    }
  );
});

// 获取回收站笔记列表接口：返回当前用户所有已删除（is_del=1）的笔记
router.get('/trash/notes', verifyToken, (req, res) => {
  const userId = req.userId; // 从JWT中间件获取用户ID
  
  db.all(
    'SELECT * FROM note WHERE user_id = ? AND is_del = 1 ORDER BY updated_at DESC',
    [userId],
    (err, notes) => {
      if (err) {
        return res.status(500).json({ error: '获取回收站笔记失败' });
      }
      res.json(notes); // 返回回收站笔记列表
    }
  );
});

// 恢复笔记接口：将回收站中的笔记还原为未删除状态
router.put('/note/:id/recover', verifyToken, (req, res) => {
  const { id } = req.params; // 获取笔记ID
  const userId = req.userId; // 从JWT中间件获取用户ID
  
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
      res.json({ message: '恢复成功' }); // 返回恢复结果
    }
  );
});

// 永久删除笔记接口：彻底删除回收站中的笔记
// 永久删除回收站中的笔记
router.delete('/trash/note/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId; // 从JWT中间件获取用户ID
  
  db.run(
    'DELETE FROM note WHERE id = ? AND user_id = ? AND is_del = 1',
    [id, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '永久删除失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '笔记不存在或不在回收站' });
      }
      res.json({ message: '永久删除成功' });
    }
  );
});

export default router;