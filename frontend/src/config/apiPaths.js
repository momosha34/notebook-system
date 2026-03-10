export const API_PATHS = {
  AUTH: {
    LOGIN: '/api/login',
    REGISTER: '/api/register'
  },
  NOTES: {
    LIST: '/api/notes',
    DETAIL: (id) => `/api/note/${id}`,
    CREATE: '/api/note',
    UPDATE: (id) => `/api/note/${id}`,
    DELETE: (id) => `/api/note/${id}`,
    RECOVER: (id) => `/api/note/${id}/recover`
  },
  TRASH: {
    LIST: '/api/trash/notes',
    DELETE_PERMANENT: (id) => `/api/trash/note/${id}`
  },
  SHARE: {
    DETAIL: (id) => `/api/s/${id}`
  },
  UPLOAD: {
    IMAGE: '/api/upload-image'
  },
  EMAIL: {
    SEND: '/send-email'
  }
}

export default API_PATHS
