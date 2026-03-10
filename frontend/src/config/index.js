const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  isProduction: import.meta.env.PROD
}

export function getApiUrl(path) {
  if (config.isProduction) {
    const baseUrl = config.apiBaseUrl || window.location.origin
    return `${baseUrl}${path}`
  }
  return path
}

export default config
