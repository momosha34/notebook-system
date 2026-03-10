<template>
  <div class="note-card card" @click="$emit('click')">
    <div class="card-header">
      <h3>{{ note.title || '无标题' }}</h3>
      <div class="card-actions">
        <template v-if="!isTrash">
          <!-- 正常笔记的操作 -->
          <button @click.stop="$emit('share')" class="action-btn" title="分享">
            <i class="fas fa-share"></i>
          </button>
          <button @click.stop="$emit('delete')" class="action-btn" title="删除">
            <i class="fas fa-trash"></i>
          </button>
        </template>
        <template v-else>
          <!-- 回收站笔记的操作 -->
          <button @click.stop="$emit('recover')" class="action-btn" title="恢复">
            <i class="fas fa-undo"></i>
          </button>
          <button @click.stop="$emit('delete-permanent')" class="action-btn" title="永久删除">
            <i class="fas fa-times"></i>
          </button>
        </template>
      </div>
    </div>
    
    <div class="card-content" v-html="getPreview(note.content)"></div>
    
    <div class="card-footer">
      <span class="time">{{ formattedTime }}</span>
      <span v-if="isTrash" class="trash-tag">回收站</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NoteCard',
  props: {
    note: {
      type: Object,
      required: true
    },
    isTrash: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      currentTime: Date.now()
    }
  },
  computed: {
    formattedTime() {
      if (!this.note.updated_at) {
        return ''
      }
      
      let noteTimeStr = this.note.updated_at
      if (typeof noteTimeStr === 'string' && noteTimeStr.includes(' ')) {
        // 处理 'YYYY-MM-DD HH:MM:SS' 本地时间格式
        noteTimeStr = noteTimeStr.replace(' ', 'T')
      }
      
      const noteTime = new Date(noteTimeStr).getTime()
      const now = this.currentTime
      const diff = now - noteTime
      
      if (isNaN(noteTime)) {
        return '未知时间'
      }
      
      if (diff < 0 || diff < 60000) {
        return '刚刚'
      } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`
      } else {
        const date = new Date(noteTime)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      }
    }
  },
  mounted() {
    console.log('NoteCard 组件挂载，note:', this.note)
    
    this.updateTime()
    this.timeUpdater = setInterval(() => {
      this.updateTime()
    }, 30000)
  },
  beforeUnmount() {
    if (this.timeUpdater) {
      clearInterval(this.timeUpdater)
    }
  },
  methods: {
    updateTime() {
      this.currentTime = Date.now()
    },
    getPreview(content) {
      if (!content) return '暂无内容'
      const text = content.replace(/<[^>]*>/g, '')
      return text.length > 100 ? text.substring(0, 100) + '...' : text
    }
  }
}
</script>

<style scoped>
.note-card {
  padding: 20px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.note-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
  flex: 1;
  margin-right: 10px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px;
  border: none;
  background: transparent;
  color: var(--gray);
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.3s;
}

.action-btn:hover {
  background: var(--bg);
}

.card-content {
  color: var(--gray);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 15px;
  max-height: 60px;
  overflow: hidden;
}

.card-footer {
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
  font-size: 12px;
  color: var(--gray);
}

.trash-tag {
  background: #ef4444;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  margin-left: 8px;
}
</style>