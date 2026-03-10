// scheduledTasks.js
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

// 设置定时任务，每天凌晨执行一次（例如凌晨2点）
// 24 * 60 * 60 * 1000 = 86400000 毫秒 (1天)
function startScheduledTasks() {
  // 先立即执行一次，用于测试和服务器启动时的清理
  autoCleanTrash();
  
  // 设置每天执行
  setInterval(autoCleanTrash, 24 * 60 * 60 * 1000);
  
  console.log('定时任务已启动：回收站自动清理（每24小时执行一次）');
}

export { startScheduledTasks };