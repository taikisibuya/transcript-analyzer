import { createContext, useContext } from 'react'

export const UploadContext = createContext(null)

/** คิวอัปโหลดระดับแอป (ดู UploadProvider) */
export function useUploads() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUploads must be used inside <UploadProvider>')
  return ctx
}
