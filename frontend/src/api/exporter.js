import { http } from './client'

/** body: { document_ids, format, include_confidence, mask_citizen_id, file_label } */
export const exportApi = {
  preview: (body) => http.post('/export', { ...body, preview: true }).then((r) => r.data),
  download: async (body) => {
    const res = await http.post('/export', { ...body, preview: false }, { responseType: 'blob' })
    return { blob: res.data, fileName: parseFileName(res.headers['content-disposition']) }
  },
}

function parseFileName(header = '') {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf) return decodeURIComponent(utf[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : 'export'
}
