import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('./test_benchmark.db');
const run = promisify(db.run.bind(db));
const all = promisify(db.all.bind(db));

const TEST_SIZES = [1000, 10000, 50000];
const SAMPLE_TITLE = '测试笔记标题关于JavaScript和Vue开发';
const SAMPLE_CONTENT = '这是一篇关于前端开发的笔记内容，包含了JavaScript、Vue.js、React等技术栈的学习心得和实践经验。'.repeat(10);

async function setupDatabase() {
  console.log('初始化测试数据库...\n');
  
  await run(`DROP TABLE IF EXISTS note`);
  await run(`DROP TABLE IF EXISTS note_fts`);
  
  await run(`CREATE TABLE note (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    is_del INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  await run(`CREATE VIRTUAL TABLE note_fts USING fts5(
    id UNINDEXED,
    user_id UNINDEXED,
    title,
    content,
    tokenize = 'unicode61'
  )`);
  
  console.log('数据库初始化完成\n');
}

async function insertData(count) {
  console.log(`插入 ${count} 条测试数据...`);
  const start = Date.now();
  
  for (let i = 0; i < count; i++) {
    const title = `${SAMPLE_TITLE} ${i}`;
    const content = `${SAMPLE_CONTENT} 编号${i}`;
    
    await run(
      'INSERT INTO note (user_id, title, content, is_del) VALUES (?, ?, ?, 0)',
      [1, title, content]
    );
    
    const result = await new Promise((resolve, reject) => {
      db.get('SELECT last_insert_rowid() as id', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    const plainContent = content.replace(/<[^>]*>/g, ' ');
    await run(
      'INSERT INTO note_fts (id, user_id, title, content) VALUES (?, ?, ?, ?)',
      [result.id, 1, title, plainContent]
    );
  }
  
  console.log(`插入完成，耗时: ${Date.now() - start}ms\n`);
}

async function benchmarkLike(count, keyword) {
  const sql = `SELECT * FROM note WHERE user_id = 1 AND is_del = 0 AND (title LIKE ? OR content LIKE ?)`;
  const params = [`%${keyword}%`, `%${keyword}%`];
  
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await all(sql, params);
    times.push(Date.now() - start);
  }
  
  return Math.round(times.reduce((a, b) => a + b) / times.length);
}

async function benchmarkFTS(count, keyword) {
  const ftsQuery = `${keyword}*`;
  const sql = `
    SELECT n.* FROM note n
    JOIN note_fts fts ON n.id = fts.id
    WHERE n.user_id = 1 AND n.is_del = 0
    AND note_fts MATCH ?
  `;
  
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    await all(sql, [ftsQuery]);
    times.push(Date.now() - start);
  }
  
  return Math.round(times.reduce((a, b) => a + b) / times.length);
}

async function runBenchmark() {
  console.log('========================================');
  console.log('   全文搜索性能测试');
  console.log('========================================\n');
  
  await setupDatabase();
  
  const results = [];
  
  for (const size of TEST_SIZES) {
    await insertData(size);
    
    const keyword = 'JavaScript';
    
    console.log(`测试数据量: ${size} 条`);
    console.log('搜索关键词: ' + keyword);
    console.log('----------------------------------------');
    
    const likeTime = await benchmarkLike(size, keyword);
    const ftsTime = await benchmarkFTS(size, keyword);
    const improvement = Math.round(likeTime / ftsTime);
    
    console.log(`LIKE 查询平均耗时: ${likeTime}ms`);
    console.log(`FTS5 查询平均耗时: ${ftsTime}ms`);
    console.log(`性能提升: ${improvement}x`);
    console.log('----------------------------------------\n');
    
    results.push({ size, likeTime, ftsTime, improvement });
    
    await run('DELETE FROM note');
    await run('DELETE FROM note_fts');
  }
  
  console.log('\n========================================');
  console.log('   测试结果汇总');
  console.log('========================================\n');
  console.log('| 数据量 | LIKE耗时 | FTS5耗时 | 性能提升 |');
  console.log('|--------|----------|----------|----------|');
  for (const r of results) {
    console.log(`| ${r.size.toLocaleString()}条 | ${r.likeTime}ms | ${r.ftsTime}ms | ${r.improvement}x |`);
  }
  
  db.close();
}

runBenchmark().catch(console.error);
