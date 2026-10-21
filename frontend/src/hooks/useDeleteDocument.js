import { useCallback } from 'react'
import { documentsApi, getErrorMessage } from '../api'
import { useDocuments } from '../context/documents'
import { useFeedback } from '../context/feedback'

/** ลบเอกสาร (ถามยืนยันก่อน) — คืนค่า true เมื่อลบสำเร็จ */
export function useDeleteDocument() {
  const { confirm, toast } = useFeedback()
  const { refresh, removeLocal } = useDocuments()

  return useCallback(
    async (doc) => {
      const ok = await confirm({
        title: 'ลบเอกสารนี้?',
        message: `“${doc.file_name}” และข้อมูลนักศึกษาที่นำเข้าจากเอกสารนี้จะถูกลบออกจากระบบถาวร`,
        confirmLabel: 'ลบเอกสาร',
        tone: 'danger',
      })
      if (!ok) return false
      try {
        await documentsApi.remove(doc.document_id)
        removeLocal(doc.document_id)
        toast.success('ลบเอกสารเรียบร้อย')
        refresh()
        return true
      } catch (err) {
        toast.error(`ลบไม่สำเร็จ: ${getErrorMessage(err)}`)
        return false
      }
    },
    [confirm, toast, refresh, removeLocal],
  )
}
