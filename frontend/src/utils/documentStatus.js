/**
 * สถานะเอกสารที่แสดงใน UI รวมมาจาก review_status (HITL) + validation_status (ตรวจอัตโนมัติ)
 * key: processing | failed | warning | passed | approved
 */
export const STATUS_META = {
  processing: { label: 'กำลังประมวลผล', tone: 'neutral' },
  failed: { label: 'ไม่ผ่านเกณฑ์', tone: 'danger' },
  warning: { label: 'มีข้อสังเกต', tone: 'warning' },
  passed: { label: 'ผ่านเกณฑ์', tone: 'success' },
  approved: { label: 'อนุมัติแล้ว', tone: 'info' },
}

export function getDocStatus(doc) {
  if (!doc) return 'processing'
  if (doc.review_status === 'APPROVED') return 'approved'
  if (!doc.validation_status) return 'processing'
  return { FAILED: 'failed', WARNING: 'warning', PASSED: 'passed' }[doc.validation_status] ?? 'processing'
}

export const isReadyForReview = (doc) => getDocStatus(doc) === 'failed' || getDocStatus(doc) === 'warning' || getDocStatus(doc) === 'passed'

const PRIORITY = { failed: 0, warning: 1, passed: 2 }

/** คิวตรวจทาน: ไม่ผ่านเกณฑ์ขึ้นก่อน → มีข้อสังเกต (ปัญหามากก่อน) → ผ่านเกณฑ์ (เก่าก่อน) */
export function sortReviewQueue(docs = []) {
  return docs
    .filter(isReadyForReview)
    .sort((a, b) => {
      const pa = PRIORITY[getDocStatus(a)]
      const pb = PRIORITY[getDocStatus(b)]
      if (pa !== pb) return pa - pb
      if ((b.issues_count ?? 0) !== (a.issues_count ?? 0)) return (b.issues_count ?? 0) - (a.issues_count ?? 0)
      return new Date(a.created_at) - new Date(b.created_at)
    })
}

export const isImageFile = (name = '') => /\.(png|jpe?g)$/i.test(name)
