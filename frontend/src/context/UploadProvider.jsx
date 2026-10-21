import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { documentsApi, getErrorMessage } from '../api'
import { ACCEPTED_FILE_TYPES, MAX_FILE_MB, POLL_TASK_MS } from '../config/constants'
import { useNavigate } from '../router/hooks'
import { paths } from '../router/paths'
import { useDocuments } from './documents'
import { UploadContext } from './uploads'

/**
 * คิวอัปโหลดระดับแอป — อัปโหลดต่อได้แม้ผู้ใช้เปลี่ยนหน้า
 * item.phase: uploading → processing → done | failed
 */
const FINISHED = new Set(['PASSED', 'WARNING', 'FAILED'])
const ALLOWED_EXT = ACCEPTED_FILE_TYPES.split(',')

export function UploadProvider({ children }) {
  const [items, setItems] = useState([])
  const [openReviewerOnSingle, setOpenReviewerOnSingle] = useState(true)
  const { refresh } = useDocuments()
  const navigate = useNavigate()
  const itemsRef = useRef(items)
  const autoOpenRef = useRef(null)
  const openReviewerOnSingleRef = useRef(openReviewerOnSingle)
  useEffect(() => {
    itemsRef.current = items
    openReviewerOnSingleRef.current = openReviewerOnSingle
  }, [items, openReviewerOnSingle])

  const patch = useCallback((id, data) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...data } : it))), [])

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList ?? [])
      if (!files.length) return
      const batch = files.map((file) => {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
        const invalid = !ALLOWED_EXT.includes(ext)
          ? 'รองรับเฉพาะ PDF, JPG และ PNG'
          : file.size > MAX_FILE_MB * 1024 * 1024
            ? `ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB`
            : null
        return {
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          phase: invalid ? 'failed' : 'queued',
          progress: 0,
          error: invalid,
          task: null,
        }
      })
      setItems((list) => [...batch, ...list])
      const valid = batch.filter((b) => b.phase === 'queued')
      autoOpenRef.current = valid.length === 1 ? valid[0].id : null

      for (const item of valid) {
        patch(item.id, { phase: 'uploading' })
        try {
          const res = await documentsApi.upload(item.file, (progress) => patch(item.id, { progress }))
          patch(item.id, { phase: 'processing', progress: 100, taskId: res.task_id })
        } catch (err) {
          patch(item.id, { phase: 'failed', error: getErrorMessage(err, 'อัปโหลดไม่สำเร็จ') })
        }
      }
      refresh()
    },
    [patch, refresh],
  )

  // ติดตามสถานะ pipeline ของไฟล์ที่กำลังประมวลผล
  const processingCount = items.filter((i) => i.phase === 'processing').length
  useEffect(() => {
    if (!processingCount) return undefined
    const tick = async () => {
      const active = itemsRef.current.filter((i) => i.phase === 'processing' && i.taskId)
      let finishedAny = false
      await Promise.all(
        active.map(async (item) => {
          try {
            const task = await documentsApi.pipelineStatus(item.taskId)
            const done = FINISHED.has(task.status)
            if (done) finishedAny = true
            patch(item.id, { task, phase: done ? 'done' : 'processing' })
            if (done && autoOpenRef.current === item.id && task.doc_id && openReviewerOnSingleRef.current) {
              autoOpenRef.current = null
              setTimeout(() => navigate(paths.review(task.doc_id)), 900)
            }
          } catch (err) {
            if (err?.response?.status === 404) patch(item.id, { phase: 'failed', error: 'ไม่พบงานประมวลผล (เซิร์ฟเวอร์อาจรีสตาร์ต)' })
          }
        }),
      )
      if (finishedAny) refresh()
    }
    const id = setInterval(tick, POLL_TASK_MS)
    return () => clearInterval(id)
  }, [processingCount, patch, refresh, navigate])

  const clearFinished = useCallback(() => setItems((list) => list.filter((i) => i.phase === 'uploading' || i.phase === 'processing' || i.phase === 'queued')), [])

  const value = useMemo(
    () => ({ items, addFiles, clearFinished, openReviewerOnSingle, setOpenReviewerOnSingle, busy: items.some((i) => ['queued', 'uploading', 'processing'].includes(i.phase)) }),
    [items, addFiles, clearFinished, openReviewerOnSingle],
  )
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}
