import { http } from './client'

export const documentsApi = {
  list: (params) => http.get('/documents', { params }).then((r) => r.data.documents ?? []),
  get: (docId) => http.get(`/documents/${docId}`).then((r) => r.data),
  saveJson: (docId, payload) => http.put(`/documents/${docId}/json`, payload).then((r) => r.data),
  approve: (docId) => http.post(`/documents/${docId}/approve`, null, { timeout: 600000 }).then((r) => r.data),
  remove: (docId) => http.delete(`/documents/${docId}`).then((r) => r.data),
  upload: (file, onProgress) => {
    const data = new FormData()
    data.append('file', file)
    return http
      .post('/upload', data, {
        timeout: 600000,
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)),
      })
      .then((r) => r.data)
  },
  pipelineStatus: (taskId) => http.get(`/pipeline/status/${taskId}`).then((r) => r.data),
  exportUrl: (docId, format) => `/api/documents/${docId}/export?format=${format}`,
}
