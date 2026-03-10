<template>
    <div class="share-container">
      <div class="share-header">
        <h1>笔记分享</h1>
        <p class="share-info">由用户分享的笔记内容</p>
      </div>
  
      <div v-if="loading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>加载中...</p>
      </div>
  
      <div v-else-if="error" class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>{{ error }}</p>
        <button @click="goHome" class="btn-primary">返回首页</button>
      </div>
  
      <div v-else-if="note" class="note-content card">
        <div class="note-header">
          <h2 class="note-title">{{ note.title || '无标题' }}</h2>
          <div class="note-meta">
            <span class="update-time">更新时间: {{ formatTime(note.updated_at) }}</span>
          </div>
        </div>
        <div class="content-section">
          <h3>笔记内容</h3>
          <div class="rich-content" v-html="note.content"></div>
        </div>
        <!-- 更新表格显示部分 -->
        <div v-if="tablePrintContent" class="table-section">
          <h3>表格数据</h3>
          <div v-html="tablePrintContent"></div>
        </div>
        <div class="share-actions">
          <button @click="exportPDF" class="action-btn">
            <i class="fas fa-file-pdf"></i> 导出PDF
          </button>
          <button @click="goHome" class="action-btn">
            <i class="fas fa-home"></i> 返回首页
          </button>
        </div>
      </div>
  
      <!-- 打印区域 -->
      <div v-if="note" class="print-area">
        <h1>{{ note.title || '无标题' }}</h1>
        <div class="print-meta">更新时间: {{ formatTime(note.updated_at) }}</div>
        <div v-html="note.content"></div>
        <div v-html="tablePrintContent"></div>
      </div>
    </div>
  </template>
  
  <script>
  import { ref, onMounted, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import axios from 'axios'
  import { normalizeContentImages } from '../utils/imageUtils'
  
  export default {
    name: 'Share',
    setup() {
      const route = useRoute()
      const router = useRouter()
      
      const note = ref(null)
      const loading = ref(true)
      const error = ref('')
  
      // 计算可打印的表格内容
      const tablePrintContent = computed(() => {
        if (!note.value || !note.value.sheet_data) return '';
        try {
          const sheetData = JSON.parse(note.value.sheet_data);
          if (!Array.isArray(sheetData) || sheetData.length === 0) return '';
          return generatePrintableTable(sheetData);
        } catch (error) {
          console.error('解析表格数据失败:', error);
          return generateBasicTableInfo(sheetData);
        }
      });
  
      // 生成可打印的表格
      const generatePrintableTable = (sheets) => {
        let html = '<div class="luckysheet-print-container">';
        sheets.forEach((sheet, sheetIndex) => {
          if (!sheet || !sheet.data) return;
          const { data, name } = sheet;
          const rowCount = data.length;
          const colCount = data[0] ? data[0].length : 0;
          if (rowCount === 0 || colCount === 0) return;
          html += `<div class="sheet-print" data-sheet-index="${sheetIndex}">`;
          html += `<h4 class="sheet-title">${name || `表格${sheetIndex + 1}`}</h4>`;
          html += '<table class="print-table" border="1" cellspacing="0" cellpadding="8">';
          // 生成表格内容
          for (let r = 0; r < rowCount; r++) {
            html += '<tr>';
            for (let c = 0; c < colCount; c++) {
              const cell = data[r] ? data[r][c] : null;
              const value = cell ? getCellValue(cell) : '';
              html += `<td>${value}</td>`;
            }
            html += '</tr>';
          }
          html += '</table></div>';
        });
        html += '</div>';
        return html;
      };
  
      // 获取单元格值
      const getCellValue = (cell) => {
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
      };
  
      // 生成基本表格信息（备用）
      const generateBasicTableInfo = (sheetData) => {
        let html = '<div class="table-section"><h3>表格数据</h3>';
        sheetData.forEach((sheet, sheetIndex) => {
          const rowCount = sheet.data ? sheet.data.length : 0;
          const colCount = sheet.data && sheet.data[0] ? sheet.data[0].length : 0;
          html += `<div class="sheet-info">`;
          html += `<h4>${sheet.name || `表格${sheetIndex + 1}`}</h4>`;
          html += `<p>尺寸: ${rowCount} 行 × ${colCount} 列</p>`;
          html += '</div>';
        });
        html += '</div>';
        return html;
      };
  
      // 加载分享的笔记
      const loadSharedNote = async () => {
        const shareId = route.params.shareId
        
        if (!shareId) {
          error.value = '分享链接无效'
          loading.value = false
          return
        }
  
        try {
          // 使用相对路径访问后端API获取分享笔记
          const response = await axios.get(`/api/s/${shareId}`)
          // 修复图片链接中的硬编码localhost
          if (response.data.content) {
            response.data.content = normalizeContentImages(response.data.content)
          }
          note.value = response.data
        } catch (err) {
          console.error('加载分享笔记失败:', err)
          if (err.response && err.response.status === 404) {
            error.value = '笔记不存在或已被删除'
          } else {
            error.value = '加载笔记失败，请稍后重试'
          }
        } finally {
          loading.value = false
        }
      }
  
      // 导出PDF
      const exportPDF = () => {
        window.print()
      }
  
      // 返回首页
      const goHome = () => {
        router.push('/')
      }
  
      // 格式化时间为本地时间
      const formatTime = (timeString) => {
        if (!timeString) return '未知时间'
        
        let noteTimeStr = timeString
        if (typeof noteTimeStr === 'string' && noteTimeStr.includes(' ')) {
          // 处理 'YYYY-MM-DD HH:MM:SS' 本地时间格式
          noteTimeStr = noteTimeStr.replace(' ', 'T')
        }
        
        const time = new Date(noteTimeStr)
        
        if (isNaN(time.getTime())) {
          return '未知时间'
        }
        
        return `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
      }
  
      onMounted(() => {
        loadSharedNote()
      })
  
      return {
        note,
        loading,
        error,
        tablePrintContent,
        exportPDF,
        goHome,
        formatTime
      }
    }
  }
  </script>
  
  <style scoped>
  .share-container {
    min-height: 100vh;
    background: var(--bg);
    padding: 20px;
  }
  
  .share-header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
  }
  
  .share-header h1 {
    color: var(--primary);
    margin-bottom: 10px;
  }
  
  .share-info {
    color: var(--gray);
    font-size: 16px;
  }
  
  .loading-state,
  .error-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--gray);
  }
  
  .loading-state i,
  .error-state i {
    font-size: 48px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  
  .error-state p {
    margin-bottom: 20px;
    font-size: 18px;
  }
  
  .note-content {
    max-width: 800px;
    margin: 0 auto;
    padding: 30px;
  }
  
  .note-header {
    border-bottom: 2px solid #f3f4f6;
    padding-bottom: 20px;
    margin-bottom: 30px;
  }
  
  .note-title {
    font-size: 28px;
    color: #1f2937;
    margin-bottom: 10px;
    word-break: break-word;
  }
  
  .note-meta {
    color: var(--gray);
    font-size: 14px;
  }
  
  .content-section,
  .table-section {
    margin-bottom: 30px;
  }
  
  .content-section h3,
  .table-section h3 {
    font-size: 20px;
    color: #374151;
    margin-bottom: 15px;
    border-left: 4px solid var(--primary);
    padding-left: 12px;
  }
  
  .rich-content {
    line-height: 1.6;
    font-size: 16px;
    color: #4b5563;
  }
  
  .rich-content :deep(p) {
    margin-bottom: 1em;
  }
  
  .rich-content :deep(strong) {
    font-weight: bold;
  }
  
  .rich-content :deep(em) {
    font-style: italic;
  }
  
  .rich-content :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 10px 0;
  }
  
  .table-container {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  
  .shared-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }
  
  .shared-table td {
    border: 1px solid #d1d5db;
    padding: 12px;
    text-align: left;
    min-width: 100px;
  }
  
  .shared-table tr:nth-child(even) {
    background: #f9fafb;
  }
  
  .share-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    padding-top: 30px;
    border-top: 1px solid #f3f4f6;
  }
  
  .action-btn {
    padding: 12px 24px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s;
    font-size: 14px;
  }
  
  .action-btn:hover {
    background: var(--bg);
    border-color: var(--primary);
    color: var(--primary);
  }
  
  /* 打印样式 */
  .print-area {
    display: none;
  }
  
  @media print {
    .share-container {
      background: white;
      padding: 0;
    }
    
    .share-header,
    .loading-state,
    .error-state,
    .note-content .share-actions {
      display: none !important;
    }
    
    .print-area {
      display: block;
      padding: 40px;
    }
    
    .print-area h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #000;
    }
    
    .print-meta {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    
    .print-table-info {
      padding: 15px;
      background: #f3f4f6;
      border-radius: 4px;
      font-style: italic;
      color: #6b7280;
      margin: 15px 0;
    }
  }
  
  .advanced-table-info {
    padding: 20px;
    text-align: center;
  }
  
  .info-card {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 30px;
    max-width: 400px;
    margin: 0 auto;
  }
  
  .info-card i {
    font-size: 48px;
    color: var(--primary);
    margin-bottom: 15px;
  }
  
  .info-card p {
    margin: 8px 0;
    color: #4b5563;
  }
  
  .info-hint {
    font-size: 14px;
    color: #6b7280;
    font-style: italic;
  }
  
  .luckysheet-print-container {
    margin-top: 20px;
  }
  
  .sheet-print {
    margin-bottom: 30px;
  }
  
  .sheet-title {
    font-size: 18px;
    color: #2c3e50;
    margin-bottom: 10px;
    border-bottom: 1px solid #bdc3c7;
    padding-bottom: 5px;
  }
  
  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  
  .print-table th {
    background-color: #f8f9fa;
    font-weight: bold;
    text-align: center;
  }
  
  .print-table th,
  .print-table td {
    border: 1px solid #dee2e6;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  
  @media (max-width: 768px) {
    .print-table {
      font-size: 12px;
    }
    .print-table th,
    .print-table td {
      padding: 6px 8px;
    }
  }
  
  @media print {
    .luckysheet-print-container {
      margin-top: 15px;
    }
    .print-table {
      font-size: 10px;
    }
    .print-table th,
    .print-table td {
      padding: 4px 6px;
    }
    .sheet-print {
      page-break-inside: avoid;
    }
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .share-container {
      padding: 15px;
    }
    
    .note-content {
      padding: 20px;
    }
    
    .note-title {
      font-size: 24px;
    }
    
    .share-actions {
      flex-direction: column;
    }
    
    .action-btn {
      justify-content: center;
    }
  }
  </style>