import { createContext, useContext } from 'react'

export const FeedbackContext = createContext(null)

/** toast.success/error/info และ confirm({...}) → Promise<boolean> (ดู FeedbackProvider) */
export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return ctx
}
