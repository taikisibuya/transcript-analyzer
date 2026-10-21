import { useCallback, useEffect, useMemo, useState } from 'react'
import { documentsApi, getErrorMessage, statsApi } from '../api'
import { POLL_PROCESSING_MS } from '../config/constants'
import { getDocStatus, sortReviewQueue } from '../utils/documentStatus'
import { DocumentsContext } from './documents'

const fetchAll = () => Promise.all([documentsApi.list(), statsApi.get().catch(() => null)])

/**
 * แหล่งข้อมูลกลางของรายการเอกสาร + สถิติ (ใช้ร่วมกันระหว่าง Sidebar, Dashboard, คิวตรวจทาน, นักศึกษา, ส่งออก)
 * - polling อัตโนมัติเฉพาะตอนมีเอกสารกำลังประมวลผล
 */
export function DocumentsProvider({ children }) {
  const [state, setState] = useState({ documents: [], stats: null, loading: true, error: null })

  const apply = useCallback(([documents, stats]) => {
    setState((s) => ({ documents, stats: stats ?? s.stats, loading: false, error: null }))
  }, [])
  const fail = useCallback((err) => setState((s) => ({ ...s, loading: false, error: getErrorMessage(err) })), [])

  const refresh = useCallback(() => fetchAll().then(apply, fail), [apply, fail])

  useEffect(() => {
    fetchAll().then(apply, fail)
  }, [apply, fail])

  const hasProcessing = state.documents.some((d) => getDocStatus(d) === 'processing')
  useEffect(() => {
    if (!hasProcessing) return undefined
    const id = setInterval(() => fetchAll().then(apply, fail), POLL_PROCESSING_MS)
    return () => clearInterval(id)
  }, [hasProcessing, apply, fail])

  const removeLocal = useCallback((docId) => setState((s) => ({ ...s, documents: s.documents.filter((x) => x.document_id !== docId) })), [])

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      removeLocal,
      reviewQueue: sortReviewQueue(state.documents),
      approved: state.documents.filter((d) => d.review_status === 'APPROVED'),
    }),
    [state, refresh, removeLocal],
  )

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
}
