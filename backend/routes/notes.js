import express from 'express';
import { db } from '../app.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

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

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeFtsQuery(query) {
  if (!query) return '';
  const escaped = query.replace(/['"]/g, '').replace(/[^\w\u4e00-\u9fa5\s]/g, ' ');
  const terms = escaped.trim().split(/\s+/).filter(t => t.length > 0);
  return terms.map(t => `${t}*`).join(' OR ');
}

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

router.get('/note/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
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
      res.json(note);
    }
  );
});

router.post('/note', verifyToken, (req, res) => {
  const { id, title, content, sheet_data } = req.body;
  const userId = req.userId;
  const currentTime = getLocalTimeString();
  const plainContent = stripHtml(content);
  
  if (id) {
    db.run(
      'UPDATE note SET title = ?, content = ?, sheet_data = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [title, content, sheet_data, currentTime, id, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '更新笔记失败' });
        }
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
    db.run(
      'INSERT INTO note (user_id, title, content, sheet_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, content, sheet_data, currentTime, currentTime],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '创建笔记失败' });
        }
        const newId = this.lastID;
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
      db.run('DELETE FROM note_fts WHERE id = ?', [id], (ftsErr) => {
        if (ftsErr) {
          console.error('删除FTS索引失败:', ftsErr.message);
        }
      });
      res.json({ message: '删除成功' });
    }
  );
});

router.get('/trash/notes', verifyToken, (req, res) => {
  const userId = req.userId;
  
  db.all(
    'SELECT * FROM note WHERE user_id = ? AND is_del = 1 ORDER BY updated_at DESC',
    [userId],
    (err, notes) => {
      if (err) {
        return res.status(500).json({ error: '获取回收站笔记失败' });
      }
      res.json(notes);
    }
  );
});

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

router.delete('/trash/note/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
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
      db.run('DELETE FROM note_fts WHERE id = ?', [id], (ftsErr) => {
        if (ftsErr) {
          console.error('永久删除FTS索引失败:', ftsErr.message);
        }
      });
      res.json({ message: '永久删除成功' });
    }
  );
});

export default router;
