import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

/** Modal ที่เข้าถึงได้ด้วยคีย์บอร์ด: Esc ปิด, โฟกัสเข้าไปในกล่องเมื่อเปิด */
export default function Modal({ open, onClose, title, description, icon, children, footer, dismissible = true, className }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && dismissible && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, dismissible, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose?.()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn('w-full max-w-lg rounded-2xl bg-white shadow-pop outline-none', className)}
      >
        <div className="flex items-start gap-3 border-b border-[#EEF1F6] px-6 pb-4 pt-5">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-base font-bold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} aria-label="ปิด" className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ksu-tint hover:text-ksu-blue">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[#EEF1F6] px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}
