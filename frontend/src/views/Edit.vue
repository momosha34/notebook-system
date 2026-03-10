<template>
  <div class="edit-container">
    <header class="edit-header">
      <div class="header-actions">
        <button @click="goBack" class="back-btn">
          <i class="fas fa-arrow-left"></i> 返回
        </button>
        <button @click="saveNote" class="btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </header>

    <div class="editor-content">
      <input
        v-model="note.title"
        type="text"
        placeholder="输入标题..."
        class="title-input"
      >
      
      <RichEditor
          v-model="note.content"
          @open-table="showAdvancedSheet = true"
          @show-alert="showAlert"
      />
      
      <div class="editor-actions">
        <button @click="showAdvancedSheet = true" class="action-btn">
          <i class="fas fa-table"></i> 插入表格
        </button>
        <button @click="exportPDF" class="action-btn">
          <i class="fas fa-file-pdf"></i> 导出PDF
        </button>
        <button @click="shareNote" class="action-btn">
          <i class="fas fa-share"></i> 分享
        </button>
        <button @click="sendEmail" class="action-btn">
          <i class="fas fa-envelope"></i> 邮件发送
        </button>
      </div>
      
      <!-- 邮件输入模态框 -->
      <div v-if="showEmailModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h2>发送邮件</h2>
            <button @click="showEmailModal = false" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="handleEmailSubmit">
              <div class="form-group">
                <label>收件人邮箱</label>
                <input v-model="emailTo" type="email" placeholder="请输入收件人邮箱" required>
              </div>
              <div class="form-actions">
                <button type="button" @click="showEmailModal = false" class="btn-secondary">取消</button>
                <button type="submit" class="btn-primary" :disabled="sendingEmail">
                  {{ sendingEmail ? '发送中...' : '发送' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- 提示模态框 -->
      <div v-if="showAlertModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h2>{{ alertModal.title }}</h2>
            <button @click="showAlertModal = false" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ alertModal.message }}</p>
            <div class="form-actions" style="justify-content: flex-end;">
              <button @click="showAlertModal = false" class="btn-primary">确定</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 高级表格编辑器模态框 -->
    <div v-if="showAdvancedSheet" class="modal-overlay">
      <div class="modal-content" style="max-width: 1200px; height: 90vh;">
        <AdvancedSheetEditor
          ref="advancedSheetEditor"
          :model-value="note.sheet_data"
          @save="saveTableData"
          @close="closeAdvancedSheet"
        />
      </div>
    </div>

    <!-- PDF打印区域（隐藏） -->
    <div v-if="false" class="print-area">
      <h1>{{ note.title }}</h1>
      <div v-html="note.content"></div>
      <div v-html="getTablePrintContent()"></div>
    </div>
  </div>
</template>

<script>
import api from '../utils/axiosConfig'
import RichEditor from '../components/RichEditor.vue'
import AdvancedSheetEditor from '../components/AdvancedSheetEditor.vue'
import { convertToPrintableTable, generateTablePreview } from '../utils/tableExport';
import { normalizeContentImages } from '../utils/imageUtils';

export default {
  name: 'Edit',
  components: { RichEditor, AdvancedSheetEditor },
  data() {
    return {
      note: {
        id: null,
        title: '',
        content: '',
        sheet_data: null
      },
      saving: false,
      showAdvancedSheet: false,
      showEmailModal: false,
      showAlertModal: false,
      sendingEmail: false,
      emailTo: '',
      alertModal: {
        title: '',
        message: ''
      }
    }
  },
  async mounted() {
    const noteId = this.$route.params.id
    if (noteId) {
      await this.loadNote(noteId)
    }
  },
  methods: {
    async loadNote(noteId) {
      try {
        const token = sessionStorage.getItem('token')
        const response = await api.get(`/api/note/${noteId}`)
        if (response.data.content) {
          response.data.content = normalizeContentImages(response.data.content)
        }
        this.note = response.data
      } catch (error) {
        console.error('加载笔记失败:', error)
        this.showAlert('加载失败', '加载笔记时出现错误，请稍后重试')
      }
    },
    
    async saveNote() {
      this.saving = true
      try {
        const response = await api.post('/api/note', this.note);
        
        if (!this.note.id) {
          this.note.id = response.data.id
          this.$router.replace(`/edit/${this.note.id}`)
        }
        
        this.showAlert('保存成功', '笔记已成功保存')
      } catch (error) {
        console.error('保存失败:', error)
        this.showAlert('保存失败', '保存笔记时出现错误，请稍后重试')
      } finally {
        this.saving = false
      }
    },
    
    saveTableData(data) {
      this.note.sheet_data = data
      this.showAdvancedSheet = false
    },
    
    closeAdvancedSheet() {
      this.showAdvancedSheet = false
    },
    
    getTablePrintContent() {
      if (!this.note.sheet_data) return '';
      
      try {
        const sheetData = JSON.parse(this.note.sheet_data);
        if (!Array.isArray(sheetData) || sheetData.length === 0) return '';
        
        const printableHTML = convertToPrintableTable(sheetData);
        if (printableHTML) {
          return printableHTML;
        }
        
        return generateTablePreview(sheetData);
      } catch (error) {
        console.error('解析表格数据失败:', error);
        return '';
      }
    },
    
    async exportPDF() {
      if (!this.note.title && !this.note.content && !this.note.sheet_data) {
        alert('没有可打印的内容');
        return;
      }
      
      if (this.showAdvancedSheet && this.$refs.advancedSheetEditor) {
        this.$refs.advancedSheetEditor.saveAndClose();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const printWindow = window.open('', '_blank');
      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this.note.title || '无标题笔记'}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
              }
              .note-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
                border-bottom: 2px solid #ccc;
                padding-bottom: 10px;
              }
              .note-content {
                font-size: 16px;
                line-height: 1.8;
              }
              .note-content img {
                max-width: 100%;
                height: auto;
              }
              
              .luckysheet-print-container {
                margin-top: 30px;
              }
              .sheet-print {
                margin-bottom: 30px;
                page-break-inside: avoid;
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
                font-size: 12px;
                margin-bottom: 15px;
              }
              .print-table th {
                background-color: #f8f9fa;
                font-weight: bold;
                text-align: center;
              }
              .print-table th,
              .print-table td {
                border: 1px solid #dee2e6;
                padding: 6px 8px;
                text-align: left;
                vertical-align: top;
              }
              
              .table-section {
                margin-top: 30px;
              }
              .table-section h3 {
                border-bottom: 1px solid #ddd;
                padding-bottom: 8px;
              }
              .sheet-info {
                margin: 20px 0;
                padding: 15px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
              }
              .sheet-info h4 {
                margin-top: 0;
                color: #4b5563;
              }
              .preview-table {
                width: auto;
                border-collapse: collapse;
                font-size: 11px;
                margin-top: 10px;
              }
              .preview-table td {
                border: 1px solid #d1d5db;
                padding: 3px 6px;
                max-width: 100px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .data-preview {
                margin-top: 10px;
              }
              
              @media print {
                body {
                  padding: 0;
                  font-size: 12px;
                }
                .note-title {
                  font-size: 20px;
                }
                .note-content {
                  font-size: 14px;
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
            </style>
          </head>
          <body>
            <div class="note-title">${this.note.title || '无标题笔记'}</div>
            <div class="note-content">${this.note.content || '暂无内容'}</div>
            ${this.getTablePrintContent()}
            <div class="print-meta" style="margin-top: 30px; font-size: 12px; color: #666;">
              打印时间: ${new Date().toLocaleString('zh-CN')}
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      printWindow.onload = () => {
        printWindow.print();
      };
    },
    
    async shareNote() {
      if (!this.note.id) {
        this.showAlert('提示', '请先保存笔记');
        return;
      }
      const shareUrl = window.location.origin + `/s/${this.note.id}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        this.showAlert('分享成功', '分享链接已复制到剪贴板');
      } catch (error) {
        console.error('复制失败:', error);
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        this.showAlert('分享成功', '分享链接已复制到剪贴板');
      }
    },
    
    showAlert(title, message) {
      this.alertModal = {
        title,
        message
      };
      this.showAlertModal = true;
    },
    
    sendEmail() {
      if (!this.note.id) {
        this.showAlert('提示', '请先保存笔记');
        return;
      }
      this.emailTo = '';
      this.showEmailModal = true;
    },

    async handleEmailSubmit() {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.emailTo)) {
        this.showAlert('提示', '请输入有效的邮箱地址');
        return;
      }
      
      this.sendingEmail = true;
      try {
        const token = sessionStorage.getItem('token');
        console.log('发送邮件请求:', { email: this.emailTo, noteId: this.note.id, userId: token });
        
        if (this.showAdvancedSheet && this.$refs.advancedSheetEditor) {
          this.$refs.advancedSheetEditor.saveAndClose();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const response = await api.post('/send-email', {
          email: this.emailTo.trim(),
          noteId: this.note.id.toString()
        }, {
          timeout: 30000
        });
        
        console.log('邮件发送响应:', response.data);
        this.showAlert('发送成功', '邮件发送成功！笔记内容已发送到指定邮箱。');
        this.showEmailModal = false;
      } catch (error) {
        console.error('邮件发送失败详情:', error);
        
        if (error.response) {
          console.error('服务器响应状态:', error.response.status);
          console.error('服务器响应数据:', error.response.data);
          this.showAlert('发送失败', '邮件发送失败: ' + (error.response.data?.error || error.response.statusText));
        } else if (error.request) {
          console.error('无响应:', error.request);
          this.showAlert('发送失败', '邮件发送失败: 无法连接到服务器，请检查后端服务是否运行');
        } else if (error.code === 'ECONNABORTED') {
          this.showAlert('发送失败', '邮件发送失败: 请求超时，请稍后重试');
        } else {
          this.showAlert('发送失败', '邮件发送失败: ' + error.message);
        }
      } finally {
        this.sendingEmail = false;
      }
    },
    
    goBack() {
      this.$router.push('/index');
    }
  }
};
</script>

<style scoped>
.edit-container {
  min-height: 100vh;
  background: white;
}

.edit-header {
  border-bottom: 1px solid #e5e7eb;
  padding: 16px 20px;
}

.header-actions {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 20px;
}

.title-input {
  width: 100%;
  font-size: 32px;
  font-weight: bold;
  border: none;
  outline: none;
  margin-bottom: 30px;
  padding: 10px 0;
  border-bottom: 2px solid #e5e7eb;
  background: transparent;
}

.title-input:focus {
  border-bottom-color: var(--primary);
}

.title-input::placeholder {
  color: #d1d5db;
}

.editor-actions {
  margin-top: 30px;
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s;
}

.action-btn:hover {
  background: var(--bg);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
}

.print-area {
  display: none;
}

@media print {
  .edit-header,
  .editor-actions,
  .title-input {
    display: none;
  }
  
  .print-area {
    display: block;
    padding: 40px;
  }
}
.editor-container {
  margin-bottom: 20px;
}

:deep(.ql-editor) {
  min-height: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  color: var(--primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 16px;
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: 8px;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: #f9fafb;
}
</style>
