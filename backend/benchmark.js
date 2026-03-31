import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

const db = new sqlite3.Database('./test_benchmark.db');
const run = promisify(db.run.bind(db));
const all = promisify(db.all.bind(db));
const get = promisify(db.get.bind(db));

const TEST_SIZES = [1000, 10000, 100000, 500000, 1000000];
const WARMUP_RUNS = 3;
const TEST_RUNS = 10;
const SAMPLE_TITLE = '测试笔记标题关于JavaScript和Vue开发技术分享';
const SAMPLE_CONTENT = '这是一篇关于前端开发的笔记内容，包含了JavaScript、Vue.js、React等技术栈的学习心得和实践经验，以及项目开发中的问题解决方案。'.repeat(5);

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

async function insertDataBatch(count, batchSize = 1000) {
  console.log(`插入 ${count.toLocaleString()} 条测试数据...`);
  const start = performance.now();
  
  let inserted = 0;
  while (inserted < count) {
    const currentBatch = Math.min(batchSize, count - inserted);
    
    await run('BEGIN TRANSACTION');
    
    for (let i = 0; i < currentBatch; i++) {
      const title = `${SAMPLE_TITLE} 编号${inserted + i}`;
      const content = `${SAMPLE_CONTENT} 数据${inserted + i}`;
      
      await run(
        'INSERT INTO note (user_id, title, content, is_del) VALUES (?, ?, ?, 0)',
        [1, title, content]
      );
      
      const result = await get('SELECT last_insert_rowid() as id');
      const plainContent = content.replace(/<[^>]*>/g, ' ');
      
      await run(
        'INSERT INTO note_fts (id, user_id, title, content) VALUES (?, ?, ?, ?)',
        [result.id, 1, title, plainContent]
      );
    }
    
    await run('COMMIT');
    inserted += currentBatch;
    
    if (inserted % 10000 === 0 || inserted === count) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      process.stdout.write(`\r已插入 ${inserted.toLocaleString()} 条，耗时 ${elapsed}s`);
    }
  }
  
  console.log(`\n插入完成，总耗时: ${((performance.now() - start) / 1000).toFixed(1)}s\n`);
}

async function benchmarkLike(keyword) {
  const sql = `SELECT * FROM note WHERE user_id = 1 AND is_del = 0 AND (title LIKE ? OR content LIKE ?)`;
  const params = [`%${keyword}%`, `%${keyword}%`];
  
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await all(sql, params);
  }
  
  const times = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const start = performance.now();
    await all(sql, params);
    times.push(performance.now() - start);
  }
  
  times.sort((a, b) => a - b);
  const trimmedTimes = times.slice(1, -1);
  const avg = trimmedTimes.reduce((a, b) => a + b, 0) / trimmedTimes.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { avg, min, max };
}

async function benchmarkFTS(keyword) {
  const ftsQuery = `${keyword}*`;
  const sql = `
    SELECT n.* FROM note n
    JOIN note_fts fts ON n.id = fts.id
    WHERE n.user_id = 1 AND n.is_del = 0
    AND note_fts MATCH ?
  `;
  
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await all(sql, [ftsQuery]);
  }
  
  const times = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const start = performance.now();
    await all(sql, [ftsQuery]);
    times.push(performance.now() - start);
  }
  
  times.sort((a, b) => a - b);
  const trimmedTimes = times.slice(1, -1);
  const avg = trimmedTimes.reduce((a, b) => a + b, 0) / trimmedTimes.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { avg, min, max };
}

async function runBenchmark() {
  console.log('========================================');
  console.log('   全文搜索性能测试（严谨版）');
  console.log('========================================');
  console.log(`预热次数: ${WARMUP_RUNS}`);
  console.log(`测试次数: ${TEST_RUNS}`);
  console.log('统计方法: 去掉最高最低值，取平均值\n');
  
  await setupDatabase();
  
  const results = [];
  
  for (const size of TEST_SIZES) {
    await insertDataBatch(size);
    
    const keyword = 'JavaScript';
    
    console.log(`测试数据量: ${size.toLocaleString()} 条`);
    console.log('搜索关键词: ' + keyword);
    console.log('----------------------------------------');
    
    const likeResult = await benchmarkLike(keyword);
    const ftsResult = await benchmarkFTS(keyword);
    const improvement = ftsResult.avg > 0 ? Math.round(likeResult.avg / ftsResult.avg) : Math.round(likeResult.min / ftsResult.min);
    
    console.log(`LIKE 查询: 平均 ${likeResult.avg.toFixed(2)}ms, 最小 ${likeResult.min.toFixed(2)}ms, 最大 ${likeResult.max.toFixed(2)}ms`);
    console.log(`FTS5 查询: 平均 ${ftsResult.avg.toFixed(2)}ms, 最小 ${ftsResult.min.toFixed(2)}ms, 最大 ${ftsResult.max.toFixed(2)}ms`);
    console.log(`性能提升: ${improvement}x`);
    console.log('----------------------------------------\n');
    
    results.push({ 
      size, 
      likeAvg: likeResult.avg, 
      likeMin: likeResult.min,
      likeMax: likeResult.max,
      ftsAvg: ftsResult.avg, 
      ftsMin: ftsResult.min,
      ftsMax: ftsResult.max,
      improvement 
    });
    
    if (size < TEST_SIZES[TEST_SIZES.length - 1]) {
      await run('DELETE FROM note');
      await run('DELETE FROM note_fts');
      await run('VACUUM');
    }
  }
  
  console.log('\n========================================');
  console.log('   测试结果汇总');
  console.log('========================================\n');
  console.log('| 数据量 | LIKE平均(ms) | FTS5平均(ms) | 性能提升 |');
  console.log('|--------|--------------|--------------|----------|');
  for (const r of results) {
    console.log(`| ${r.size.toLocaleString()}条 | ${r.likeAvg.toFixed(2)} | ${r.ftsAvg.toFixed(2)} | ${r.improvement}x |`);
  }
  
  console.log('\n详细数据（含最小/最大值）:');
  console.log('| 数据量 | LIKE最小 | LIKE平均 | LIKE最大 | FTS5最小 | FTS5平均 | FTS5最大 |');
  console.log('|--------|----------|----------|----------|----------|----------|----------|');
  for (const r of results) {
    console.log(`| ${r.size.toLocaleString()}条 | ${r.likeMin.toFixed(2)} | ${r.likeAvg.toFixed(2)} | ${r.likeMax.toFixed(2)} | ${r.ftsMin.toFixed(2)} | ${r.ftsAvg.toFixed(2)} | ${r.ftsMax.toFixed(2)} |`);
  }
  
  db.close();
}

runBenchmark().catch(console.error);
