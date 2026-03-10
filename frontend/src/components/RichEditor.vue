<template>
  <div 
    class="rich-editor"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <div class="editor-toolbar">
      <button @click="execFormat('bold')" type="button" class="toolbar-btn" title="加粗">
        <i class="fas fa-bold"></i>
      </button>
      <button @click="execFormat('italic')" type="button" class="toolbar-btn" title="斜体">
        <i class="fas fa-italic"></i>
      </button>
      <button @click="triggerImageUpload" type="button" class="toolbar-btn" title="插入图片" :disabled="uploading">
        <i class="fas fa-image"></i>
        {{ uploading ? '上传中...' : '' }}
      </button>
      <button @click="openTableEditor" type="button" class="toolbar-btn" title="插入表格">
        <i class="fas fa-table"></i>
      </button>
    </div>

    <div v-if="isDragging" class="drop-overlay">
      <div class="drop-content">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>释放图片以上传</p>
      </div>
    </div>

    <div v-if="uploading" class="upload-progress-overlay">
      <div class="upload-progress-content">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <p>{{ uploadProgress }}% - 正在上传...</p>
      </div>
    </div>

    <input
      type="file"
      ref="fileInput"
      accept="image/*"
      multiple
      style="display: none"
      @change="handleFileSelect"
    >

    <div ref="editor" class="editor-container"></div>
  </div>
</template>

<script>
import Quill from 'quill'
import api from '../utils/axiosConfig'

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml'
]

const MAX_FILE_SIZE = 5 * 1024 * 1024

export default {
  name: 'RichEditor',
  props: {
    modelValue: String
  },
  emits: ['update:modelValue', 'open-table', 'show-alert'],
  data() {
    return {
      quill: null,
      isComposing: false,
      uploading: false,
      uploadProgress: 0,
      isDragging: false
    }
  },
  mounted() {
    this.initQuill()
  },
  methods: {
    initQuill() {
      const options = {
        theme: 'snow',
        modules: {
          toolbar: {
            container: '.editor-toolbar',
            handlers: {}
          }
        },
        placeholder: '开始编写您的内容...',
        formats: ['bold', 'italic', 'image']
      }

      this.quill = new Quill(this.$refs.editor, options)

      if (this.modelValue) {
        this.quill.root.innerHTML = this.modelValue
      }

      this.quill.on('text-change', () => {
        this.$emit('update:modelValue', this.quill.root.innerHTML)
      })

      this.quill.on('selection-change', (range) => {
        if (range) console.log('选区变化:', range)
      })

      this.quill.root.addEventListener('compositionstart', () => {
        this.isComposing = true
      })
      this.quill.root.addEventListener('compositionend', () => {
        this.isComposing = false
      })
    },

    triggerImageUpload() {
      this.$refs.fileInput.click()
    },

    openTableEditor() {
      console.log('打开表格编辑器')
      this.$emit('open-table')
    },

    handleDrop(event) {
      this.isDragging = false
      const files = event.dataTransfer.files
      if (files.length > 0) {
        this.processFiles(files)
      }
    },

    handleFileSelect(event) {
      const files = event.target.files
      if (files.length > 0) {
        this.processFiles(files)
      }
      event.target.value = ''
    },

    async processFiles(files) {
      const imageFiles = Array.from(files).filter(file => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          this.$emit('show-alert', '提示', `文件 "${file.name}" 不是支持的图片格式`)
          return false
        }
        if (file.size > MAX_FILE_SIZE) {
          this.$emit('show-alert', '提示', `文件 "${file.name}" 超过5MB限制`)
          return false
        }
        return true
      })

      if (imageFiles.length === 0) return

      this.uploading = true
      this.uploadProgress = 0

      const totalFiles = imageFiles.length
      let uploadedCount = 0

      for (const file of imageFiles) {
        try {
          const url = await this.uploadFile(file, (progress) => {
            this.uploadProgress = Math.round(((uploadedCount + progress / 100) / totalFiles) * 100)
          })
          this.insertImageToEditor(url)
          uploadedCount++
          this.uploadProgress = Math.round((uploadedCount / totalFiles) * 100)
        } catch (error) {
          console.error('图片上传失败:', error)
          this.$emit('show-alert', '上传失败', `图片 "${file.name}" 上传失败，请重试`)
        }
      }

      this.uploading = false
      this.uploadProgress = 0
    },

    async uploadFile(file, onProgress) {
      return new Promise((resolve, reject) => {
        const formData = new FormData()
        formData.append('image', file)

        const token = sessionStorage.getItem('token')
        
        api.post('/api/upload-image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              onProgress(progress)
            }
          }
        }).then(response => {
          if (response.data.url) {
            resolve(response.data.url)
          } else {
            reject(new Error('上传失败'))
          }
        }).catch(error => {
          reject(error)
        })
      })
    },

    insertImageToEditor(imageUrl) {
      try {
        const range = this.quill.getSelection()
        const index = range ? range.index : this.quill.getLength()
        this.quill.insertEmbed(index, 'image', imageUrl)
        this.quill.setSelection(index + 1, 0)
      } catch (error) {
        console.error('插入图片失败:', error)
        this.$emit('show-alert', '错误', '插入图片失败')
      }
    },

    execFormat(format) {
      if (!this.quill) return

      setTimeout(() => {
        try {
          const selection = window.getSelection()
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            document.execCommand(format, false, null)
          } else {
            this.quill.format(format, !this.getCurrentFormat(format))
          }
        } catch (error) {
          console.error('格式操作失败:', error)
          try {
            this.quill.root.focus()
            this.quill.format(format, !this.getCurrentFormat(format))
          } catch (e) {
            console.error('回退方案也失败:', e)
          }
        }
      }, 10)
    },

    getCurrentFormat(format) {
      try {
        const range = this.quill.getSelection()
        if (range) {
          return this.quill.getFormat(range)[format] || false
        }
        return false
      } catch (error) {
        console.error('获取格式状态失败:', error)
        return false
      }
    }
  },

  watch: {
    modelValue(newValue) {
      if (this.quill && newValue !== this.quill.root.innerHTML) {
        const selection = this.quill.getSelection()
        this.quill.root.innerHTML = newValue || ''
        if (selection) {
          setTimeout(() => this.quill.setSelection(selection), 0)
        }
      }
    }
  },

  beforeUnmount() {
    if (this.quill) {
      this.quill.off('text-change')
      this.quill.off('selection-change')
    }
  }
}
</script>

<style scoped>
.rich-editor {
  border: 1px solid #abaeb3;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.editor-toolbar {
  background: #9c9ea0;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px;
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  padding: 8px 12px;
  border: 1px solid #9a9ca0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 40px;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.toolbar-btn:active:not(:disabled) {
  background: #e5e7eb;
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-container {
  height: 500px;
}

.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(44, 90, 160, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.drop-content {
  text-align: center;
  color: white;
}

.drop-content i {
  font-size: 48px;
  margin-bottom: 16px;
}

.drop-content p {
  font-size: 18px;
  margin: 0;
}

.upload-progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.upload-progress-content {
  text-align: center;
  width: 80%;
  max-width: 300px;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2c5aa0, #4a90d9);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.upload-progress-content p {
  color: #666;
  font-size: 14px;
  margin: 0;
}

:deep(.ql-editor) {
  font-size: 16px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 20px;
}

:deep(.ql-editor.ql-blank::before) {
  color: #8a9099;
  font-style: normal;
  font-size: 16px;
}

:deep(.ql-editor p) {
  margin-bottom: 1em;
}

:deep(.ql-editor img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 10px 0;
}

:deep(.ql-toolbar.ql-snow) {
  border: none;
  padding: 0;
}

:deep(.ql-container.ql-snow) {
  border: none;
  font-size: 16px;
}
</style>
