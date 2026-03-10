export function normalizeImageUrl(url) {
  if (!url) return url
  
  if (url.startsWith('http://localhost:3000')) {
    return url.replace('http://localhost:3000', '')
  }
  
  if (url.startsWith('http://localhost:5173')) {
    return url.replace('http://localhost:5173', '')
  }
  
  return url
}

export function normalizeContentImages(content) {
  if (!content) return content
  
  return content
    .replace(/http:\/\/localhost:3000/g, '')
    .replace(/http:\/\/localhost:5173/g, '')
}

export function getFullImageUrl(relativePath) {
  if (!relativePath) return relativePath
  
  if (relativePath.startsWith('http')) {
    return relativePath
  }
  
  return relativePath
}
