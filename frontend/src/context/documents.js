import { createContext, useContext } from 'react'

export const DocumentsContext = createContext(null)

/** รายการเอกสาร + สถิติ ที่ใช้ร่วมกันทั้งแอป (ดู DocumentsProvider) */
export function useDocuments() {
  const ctx = useContext(DocumentsContext)
  if (!ctx) throw new Error('useDocuments must be used inside <DocumentsProvider>')
  return ctx
}
