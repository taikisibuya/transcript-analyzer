import { useCallback, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { cn } from '../utils/cn'
import { FeedbackContext } from './feedback'

/**
 * Feedback กลางของแอป (แทน alert / confirm ของเบราว์เซอร์)
 * - toast.success / toast.error / toast.info
 * - confirm({ title, description, confirmLabel, tone }) → Promise<boolean>
 */
const TOAST_ICON = { success: CircleCheck, error: CircleAlert, info: Info }
const TOAST_STYLE = {
  success: 'border-success-line bg-white text-success',
  error: 'border-[#F2B8AE] bg-white text-danger-text',
  info: 'border-ksu-line bg-white text-ksu-blue',
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (type, message, timeout = 4500) => {
      const id = ++idRef.current
      setToasts((t) => [...t.slice(-3), { id, type, message }])
      if (timeout) setTimeout(() => dismiss(id), timeout)
    },
    [dismiss],
  )

  const toast = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m, 7000),
      info: (m) => push('info', m),
    }),
    [push],
  )

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setDialog(options)
      }),
    [],
  )

  const close = (result) => {
    resolver.current?.(result)
    resolver.current = null
    setDialog(null)
  }

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.type]
          return (
            <div key={t.id} className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-pop', TOAST_STYLE[t.type])}>
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
              <p className="flex-1 text-sm text-body">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="ปิดข้อความ" className="text-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title}
        description={dialog?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>{dialog?.cancelLabel ?? 'ยกเลิก'}</Button>
            <Button variant={dialog?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {dialog?.confirmLabel ?? 'ยืนยัน'}
            </Button>
          </>
        }
      >
        {dialog?.body ?? <p className="text-sm text-body">{dialog?.message}</p>}
      </Modal>
    </FeedbackContext.Provider>
  )
}
