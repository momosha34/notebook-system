<template>
  <div class="advanced-sheet-editor">
    <div class="editor-header">
      <h3>高级表格编辑器</h3>
      <div class="header-actions">
        <button @click="saveAndClose" class="btn-primary">保存并关闭</button>
        <button @click="close" class="cancel-btn">取消</button>
      </div>
    </div>
    
    <div class="sheet-container">
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
      luckysheet: null
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
      // 等待 Luckysheet 加载完成
      if (window.luckysheet) {
        this.createSheet();
      } else {
        // 如果 Luckysheet 尚未加载，等待一段时间
        setTimeout(() => {
          if (window.luckysheet) {
            this.createSheet();
          } else {
            console.error('Luckysheet 加载失败');
            alert('表格编辑器加载失败，请刷新页面重试');
          }
        }, 1000);
      }
    },
    
    createSheet() {
      try {
        const options = {
          container: 'luckysheet-container',
          title: '笔记表格',
          lang: 'zh',
          showinfobar: false,
          showsheetbar: false,
          showtoolbar: true,
          showstatisticBar: true,
          row: 20,
          column: 15,
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

        // 如果有现有数据，加载它
        if (this.modelValue) {
          try {
            const parsedData = JSON.parse(this.modelValue);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              options.data = parsedData;
            }
          } catch (error) {
            console.error('解析表格数据失败:', error);
          }
        }

        // 先销毁可能存在的实例
        if (window.luckysheet) {
          try {
            window.luckysheet.destroy();
          } catch (e) {
            console.warn('销毁现有表格实例失败:', e);
          }
        }

        // 创建新实例
        this.luckysheet = window.luckysheet.create(options);
      } catch (error) {
        console.error('初始化表格失败:', error);
        alert('表格初始化失败');
      }
    },
    
    destroySheet() {
      if (this.luckysheet && window.luckysheet) {
        try {
          window.luckysheet.destroy();
        } catch (error) {
          console.error('销毁表格失败:', error);
        }
      }
    },
    
    saveAndClose() {
      if (window.luckysheet) {
        try {
          const data = window.luckysheet.getAllSheets();
          this.$emit('save', JSON.stringify(data));
        } catch (error) {
          console.error('保存表格数据失败:', error);
          // 尝试使用实例方法
          if (this.luckysheet) {
            try {
              const data = this.luckysheet.getAllSheets();
              this.$emit('save', JSON.stringify(data));
            } catch (e) {
              console.error('使用实例方法保存失败:', e);
              alert('保存失败');
            }
          } else {
            alert('保存失败');
          }
        }
      } else {
        alert('表格编辑器未初始化');
      }
      this.close();
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
}

.btn-primary {
  padding: 10px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.cancel-btn {
  padding: 10px 20px;
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1e3a8a;
}

.cancel-btn:hover {
  background: #f9fafb;
}
</style>