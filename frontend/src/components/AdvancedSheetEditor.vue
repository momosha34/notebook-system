<template>
  <div class="advanced-sheet-editor">
    <div class="editor-header">
      <h3>高级表格编辑器</h3>
      <div class="header-actions">
        <button @click="saveAndClose" class="btn-primary" :disabled="isSaving">
          {{ isSaving ? '保存中...' : '保存并关闭' }}
        </button>
        <button @click="close" class="cancel-btn">取消</button>
      </div>
    </div>
    
    <div class="sheet-container">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>表格加载中，请稍候...</p>
      </div>
      <div id="luckysheet-container" style="width: 100%; height: 600px;"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdvancedSheetEditor',
  props: {
    modelValue: String
  },
  emits: ['save', 'close'],
  data() {
    return {
      luckysheet: null,
      isSaving: false,
      isLoading: true
    }
  },
  mounted() {
    this.initSheet();
  },
  beforeUnmount() {
    this.destroySheet();
  },
  methods: {
    initSheet() {
      // 等待 Luckysheet 加载完成，使用轮询方式确保可靠性
      let attempts = 0;
      const maxAttempts = 30; // 最多尝试30次
      const interval = 200; // 每200ms尝试一次
      
      const checkLuckysheet = () => {
        attempts++;
        if (window.luckysheet) {
          this.createSheet();
        } else if (attempts >= maxAttempts) {
          console.error('Luckysheet 加载失败（超时）');
          alert('表格编辑器加载失败，请刷新页面重试');
        } else {
          setTimeout(checkLuckysheet, interval);
        }
      };
      
      checkLuckysheet();
    },
    
    createSheet() {
      try {
        // 基础配置
        const options = {
          container: 'luckysheet-container',
          title: '笔记表格',
          lang: 'zh',
          showinfobar: false,
          showsheetbar: false,
          showtoolbar: true,
          showstatisticBar: true,
          allowEdit: true,
          enableAddRow: true,
          enableAddBackTop: true,
          data: [{
            name: 'Sheet1',
            color: '',
            index: 0,
            status: 1,
            order: 0,
            celldata: [],
            config: {},
            rows: {},
            columns: {}
          }]
        };

        // 如果有现有数据，加载它并根据数据量调整配置
        if (this.modelValue) {
          try {
            const parsedData = JSON.parse(this.modelValue);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              options.data = parsedData;
              
              // 根据数据量动态调整表格配置
              const maxRow = parsedData.reduce((max, sheet) => {
                return Math.max(max, sheet.data ? sheet.data.length : 0);
              }, 0);
              
              const maxCol = parsedData.reduce((max, sheet) => {
                if (sheet.data && sheet.data.length > 0) {
                  return Math.max(max, sheet.data[0].length);
                }
                return max;
              }, 0);
              
              // 设置合适的行数和列数，预留一定空间
              options.row = Math.max(20, maxRow + 10);
              options.column = Math.max(15, maxCol + 5);
              
              // 对于大数据量表格，优化性能
              if (maxRow > 100 || maxCol > 30) {
                options.enableAddRow = false; // 禁用自动添加行
                options.showstatisticBar = false; // 禁用状态栏
              }
            }
          } catch (error) {
            console.error('解析表格数据失败:', error);
            alert('表格数据解析失败，将使用空表格');
          }
        } else {
          // 默认配置
          options.row = 20;
          options.column = 15;
        }

        // 先销毁可能存在的实例
        if (window.luckysheet && window.luckysheet.isInitialized) {
          try {
            window.luckysheet.destroy();
            window.luckysheet = null;
          } catch (e) {
            console.warn('销毁现有表格实例失败:', e);
          }
        }

        // 创建新实例
        this.luckysheet = window.luckysheet.create(options);
        // 标记实例已初始化
        if (window.luckysheet) {
          window.luckysheet.isInitialized = true;
        }
        // 加载完成
        this.isLoading = false;
      } catch (error) {
        console.error('初始化表格失败:', error);
        alert('表格初始化失败，请刷新页面重试');
        this.isLoading = false;
      }
    },
    
    destroySheet() {
      if (this.luckysheet && window.luckysheet) {
        try {
          window.luckysheet.destroy();
          // 清理引用
          this.luckysheet = null;
          if (window.luckysheet) {
            window.luckysheet.isInitialized = false;
          }
        } catch (error) {
          console.error('销毁表格失败:', error);
          // 即使销毁失败，也要清理引用
          this.luckysheet = null;
          if (window.luckysheet) {
            window.luckysheet.isInitialized = false;
          }
        }
      } else {
        // 确保引用被清理
        this.luckysheet = null;
      }
    },
    
    saveAndClose() {
      if (this.isSaving) return; // 防止重复保存
      
      if (window.luckysheet) {
        this.isSaving = true;
        try {
          // 优化大表格数据获取
          const data = window.luckysheet.getAllSheets();
          // 压缩数据，移除空单元格和默认值
          const compressedData = this.compressSheetData(data);
          this.$emit('save', JSON.stringify(compressedData));
        } catch (error) {
          console.error('保存表格数据失败:', error);
          // 尝试使用实例方法
          if (this.luckysheet) {
            try {
              const data = this.luckysheet.getAllSheets();
              const compressedData = this.compressSheetData(data);
              this.$emit('save', JSON.stringify(compressedData));
            } catch (e) {
              console.error('使用实例方法保存失败:', e);
              alert('保存失败');
            }
          } else {
            alert('保存失败');
          }
        } finally {
          this.isSaving = false;
        }
      } else {
        alert('表格编辑器未初始化');
      }
      this.close();
    },
    
    // 压缩表格数据，移除空单元格和默认值
    compressSheetData(data) {
      if (!Array.isArray(data)) return data;
      
      return data.map(sheet => {
        // 移除空的celldata
        if (sheet.celldata && sheet.celldata.length === 0) {
          delete sheet.celldata;
        }
        // 移除空的rows和columns配置
        if (sheet.rows && Object.keys(sheet.rows).length === 0) {
          delete sheet.rows;
        }
        if (sheet.columns && Object.keys(sheet.columns).length === 0) {
          delete sheet.columns;
        }
        // 移除空的config
        if (sheet.config && Object.keys(sheet.config).length === 0) {
          delete sheet.config;
        }
        return sheet;
      });
    },
    
    close() {
      this.destroySheet();
      this.$emit('close');
    },
    
    // 新增：生成可打印的表格 HTML
    generatePrintableTable() {
      if (!window.luckysheet) return '';
      try {
        const sheets = window.luckysheet.getAllSheets();
        if (!sheets || sheets.length === 0) return '';
        let html = '<div class="luckysheet-print-container">';
        sheets.forEach((sheet, sheetIndex) => {
          html += this.generateSheetHTML(sheet, sheetIndex);
        });
        html += '</div>';
        return html;
      } catch (error) {
        console.error('生成可打印表格失败:', error);
        return '';
      }
    },
    
    // 生成单个工作表的 HTML
    generateSheetHTML(sheet, sheetIndex) {
      if (!sheet || !sheet.data) return '';
      const { data, name } = sheet;
      const rowCount = data.length;
      const colCount = data[0] ? data[0].length : 0;
      if (rowCount === 0 || colCount === 0) return '';
      
      let html = '<div class="sheet-print" data-sheet-index="' + sheetIndex + '">';
      html += '<h4 class="sheet-title">' + (name || '表格' + (sheetIndex + 1)) + '</h4>';
      html += '<table class="print-table" border="1" cellspacing="0" cellpadding="8">';
      
      // 生成表头（如果有）
      const hasHeader = this.detectHeader(data);
      if (hasHeader) {
        html += '<thead><tr>';
        for (let c = 0; c < colCount; c++) {
          const cell = data[0][c];
          const value = cell ? this.getCellValue(cell) : '';
          html += '<th>' + value + '</th>';
        }
        html += '</tr></thead>';
      }
      
      // 生成表格主体
      html += '<tbody>';
      const startRow = hasHeader ? 1 : 0;
      for (let r = startRow; r < rowCount; r++) {
        html += '<tr>';
        for (let c = 0; c < colCount; c++) {
          const cell = data[r] ? data[r][c] : null;
          const value = cell ? this.getCellValue(cell) : '';
          html += '<td>' + value + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    },
    
    // 检测是否有表头（第一行是否包含文本）
    detectHeader(data) {
      if (!data || data.length < 2) return false;
      const firstRow = data[0];
      return firstRow.some(cell => {
        const value = cell ? this.getCellValue(cell) : '';
        return value && value.toString().trim() !== '';
      });
    },
    
    // 获取单元格值
    getCellValue(cell) {
      if (!cell) return '';
      // 处理不同的单元格值格式
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
    },
    
    // 新增：获取可打印的表格 HTML（供外部调用）
    getPrintableHTML() {
      return this.generatePrintableTable();
    }
  }
}
</script>

<style scoped>
.advanced-sheet-editor {
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.editor-header h3 {
  margin: 0;
  color: #1f2937;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.sheet-container {
  padding: 20px;
  position: relative;
}

/* 加载状态样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  border-radius: 8px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-overlay p {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 10px 20px;
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #1e3a8a;
}

.cancel-btn:hover {
  background: #f9fafb;
}
</style>