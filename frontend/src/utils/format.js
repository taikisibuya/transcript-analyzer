const thDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const thDay = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' })

export const formatDateTime = (iso) => (iso ? thDate.format(new Date(iso)) : '—')
export const formatToday = () => thDay.format(new Date())

export function formatRelative(iso) {
  if (!iso) return '—'
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  if (abs < 60) return 'เมื่อสักครู่'
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day')
  return formatDateTime(iso)
}

export const formatNumber = (n, digits = 0) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const formatGpa = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toFixed(2))
export const formatConfidence = (c) => (c === null || c === undefined ? '—' : Number(c).toFixed(2))
export const formatSeconds = (ms) => (ms === null || ms === undefined ? '—' : (ms / 1000).toFixed(1))

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** อักษรย่อจากชื่อไทย/อังกฤษ เช่น "สมชาย ใจดี" → "สจ" */
export function initials(name = '') {
  const parts = name.replace(/^(นาย|นางสาว|นาง|Mr\.?|Ms\.?|Mrs\.?)\s*/i, '').trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?'
}
