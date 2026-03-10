<template>
    <div class="index-container">
      <header class="header">
        <div class="header-content">
          <h1>我的笔记本</h1>
          <div class="user-info">
            <span>欢迎，{{ username }}</span>
            <button @click="logout" class="logout-btn">退出</button>
          </div>
        </div>
      </header>

      <div class="main-content">
        <div class="sidebar">
          <div class="search-box">
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="搜索笔记..."
              @input="searchNotes"
            >
            <i class="fas fa-search"></i>
          </div>

          <div class="action-buttons">
            <button @click="createNewNote" class="btn-primary">
              <i class="fas fa-plus"></i> 新建笔记
            </button>
          </div>

          <div class="category-list">
            <div 
              :class="['category-item', { active: activeCategory === 'all' }]" 
              @click="switchCategory('all')"
            >
              全部笔记
            </div>
            <div 
              :class="['category-item', { active: activeCategory === 'trash' }]" 
              @click="switchCategory('trash')"
            >
              回收站
            </div>
          </div>
        </div>

        <div class="content-area">
          <template v-if="activeCategory === 'all'">
            <div class="notes-grid">
              <NoteCard
                v-for="note in notes"
                :key="note.id"
                :note="note"
                @click="editNote(note.id)"
                @share="shareNote(note)"
                @delete="showDeleteConfirm(note.id)"
              />
            </div>
            <div v-if="notes.length === 0" class="empty-state">
              <i class="fas fa-file-alt"></i>
              <p>还没有笔记，点击"新建笔记"开始记录</p>
            </div>
          </template>
          <template v-else>
            <div class="notes-grid">
              <!-- 回收站内的笔记显示恢复和永久删除按钮 -->
              <NoteCard
                v-for="note in trashNotes"
                :key="note.id"
                :note="note"
                :is-trash="true"
                @recover="showRecoverConfirm(note.id)"
                @delete-permanent="showPermanentDeleteConfirm(note.id)"
              />
            </div>
            <div v-if="trashNotes.length === 0" class="empty-state">
              <i class="fas fa-trash"></i>
              <p>回收站是空的</p>
            </div>
          </template>
        </div>
      </div>

      <!-- 确认模态框 -->
      <div v-if="showConfirmModal" class="modal-overlay">
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h2>{{ confirmModal.title }}</h2>
            <button @click="showConfirmModal = false" class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <p>{{ confirmModal.message }}</p>
            <div class="form-actions">
              <button @click="showConfirmModal = false" class="btn-secondary">取消</button>
              <button @click="confirmAction" class="btn-primary">确定</button>
            </div>
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
  </template>
  
  <script>
  import api from '../utils/axiosConfig'
  import NoteCard from '../components/NoteCard.vue'
  import { normalizeContentImages } from '../utils/imageUtils'
  
  export default {
    name: 'Index',
    components: { NoteCard },
    data() {
    return {
      username: '',
      notes: [],
      trashNotes: [], // 回收站笔记
      searchKeyword: '',
      activeCategory: 'all', // 当前激活的分类
      showConfirmModal: false,
      showAlertModal: false,
      confirmModal: {
        title: '',
        message: '',
        action: null,
        params: null
      },
      alertModal: {
        title: '',
        message: ''
      }
    }
  },
    async mounted() {
      this.username = sessionStorage.getItem('username')
      await this.loadNotes()
      await this.loadTrashNotes()
    },
    methods: {
      async loadNotes() {
  try {
    const token = sessionStorage.getItem('token')
    console.log('加载笔记，token:', token)
    
    const params = this.searchKeyword ? { s: this.searchKeyword } : {}
    
    const response = await api.get('/api/notes', {
      params
    })
    
    console.log('笔记列表响应:', response.data)
    // 修复图片链接中的硬编码localhost
    this.notes = response.data.map(note => {
      console.log('笔记时间:', note.updated_at, note.created_at)
      if (note.content) {
        note.content = normalizeContentImages(note.content)
      }
      return note
    })
  } catch (error) {
    console.error('加载笔记失败:', error)
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('username')
      this.$router.push('/login')
    }
  }
},
    async loadTrashNotes() {
      try {
        const token = sessionStorage.getItem('token');
        const response = await api.get('/api/trash/notes');
        this.trashNotes = response.data;
      } catch (error) {
        console.error('加载回收站笔记失败:', error);
      }
    },
    switchCategory(category) {
      this.activeCategory = category;
      if (category === 'all') {
        this.loadNotes();
      } else {
        this.loadTrashNotes();
      }
    },
    showDeleteConfirm(noteId) {
      this.confirmModal = {
        title: '删除笔记',
        message: '确定要删除这篇笔记吗？笔记将移到回收站',
        action: this.deleteNote,
        params: noteId
      };
      this.showConfirmModal = true;
    },

    showRecoverConfirm(noteId) {
      this.confirmModal = {
        title: '恢复笔记',
        message: '确定要恢复这篇笔记吗？',
        action: this.recoverNote,
        params: noteId
      };
      this.showConfirmModal = true;
    },

    showPermanentDeleteConfirm(noteId) {
      this.confirmModal = {
        title: '永久删除',
        message: '确定要永久删除这篇笔记吗？此操作不可恢复！',
        action: this.deletePermanent,
        params: noteId
      };
      this.showConfirmModal = true;
    },

    confirmAction() {
      if (this.confirmModal.action) {
        this.confirmModal.action(this.confirmModal.params);
      }
      this.showConfirmModal = false;
    },

    showAlert(title, message) {
      this.alertModal = {
        title,
        message
      };
      this.showAlertModal = true;
    },

    async deleteNote(noteId) {
      try {
        const token = sessionStorage.getItem('token')
        await api.delete(`/api/note/${noteId}`)
        
        await this.loadNotes()
      } catch (error) {
        console.error('删除失败:', error)
        this.showAlert('删除失败', '删除笔记时出现错误，请稍后重试')
      }
    },

    async recoverNote(noteId) {
      try {
        const token = sessionStorage.getItem('token');
        await api.put(`/api/note/${noteId}/recover`, {});
        
        await this.loadTrashNotes();
        await this.loadNotes(); // 刷新全部笔记列表
      } catch (error) {
        console.error('恢复笔记失败:', error);
        this.showAlert('恢复失败', '恢复笔记时出现错误，请稍后重试')
      }
    },

    async deletePermanent(noteId) {
      try {
        const token = sessionStorage.getItem('token');
        await api.delete(`/api/trash/note/${noteId}`);
        
        await this.loadTrashNotes();
      } catch (error) {
        console.error('永久删除失败:', error);
        this.showAlert('删除失败', '永久删除笔记时出现错误，请稍后重试')
      }
    },
    searchNotes() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.loadNotes()
      }, 300)
    },
    
    createNewNote() {
      this.$router.push('/edit')
    },
    
    editNote(noteId) {
      this.$router.push(`/edit/${noteId}`)
    },
    
    shareNote(note) {
      const shareUrl = `${window.location.origin}/s/${note.id}`
      navigator.clipboard.writeText(shareUrl)
      this.showAlert('分享成功', '分享链接已复制到剪贴板')
    },
    
    logout() {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('username')
      this.$router.push('/login')
    }
  }
  }
  </script>
  
  <style scoped>
  .index-container {
    min-height: 100vh;
    /* 固定珍珠白背景色 */
    background: #2d3748;
  }
  
  .header {
    background: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 0 20px;
  }
  
  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 70px;
  }
  
  .header h1 {
    color: var(--primary);
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .logout-btn {
    padding: 8px 16px;
    border: 1px solid var(--gray);
    border-radius: 6px;
    background: white;
    cursor: pointer;
  }
  
  .main-content {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 30px;
    padding: 30px 20px;
  }
  
  .sidebar {
    background: white;
    border-radius: 12px;
    padding: 20px;
    height: fit-content;
  }
  
  .search-box {
    position: relative;
    margin-bottom: 20px;
  }
  
  .search-box input {
    width: 100%;
    padding: 12px 40px 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  
  .search-box .fa-search {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--gray);
  }
  
  .action-buttons {
    margin-bottom: 30px;
  }
  
  .action-buttons .btn-primary {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .action-buttons .btn-primary:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
  }
  
  .category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid #e5e7eb;
  background: white;
  text-align: center;
  font-weight: 500;
}

.category-item:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.category-item.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* 回收站按钮向下移动8px */
.category-item:last-child {
  margin-top: 8px;
}
  
  .content-area {
    min-height: 400px;
  }
  
  .notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--gray);
  }
  
  .empty-state i {
    font-size: 48px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  
  @media (max-width: 768px) {
    .main-content {
      grid-template-columns: 1fr;
    }
    
    .notes-grid {
      grid-template-columns: 1fr;
    }
  }

  /* 模态框样式 */
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

  .modal-body p {
    margin-bottom: 20px;
    line-height: 1.5;
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

  .btn-primary {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: var(--primary-dark);
    transform: scale(1.02);
  }
  </style>