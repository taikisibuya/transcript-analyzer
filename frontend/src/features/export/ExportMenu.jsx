import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { documentsApi } from '../../api'
import Button from '../../components/ui/Button'
import { EXPORT_FORMATS } from '../../config/constants'

/** ปุ่มส่งออกเอกสารเดียว (JSON / CSV / Parquet) */
export default function ExportMenu({ docId, size = 'md', variant = 'secondary' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button variant={variant} size={size} icon={Download} iconRight={ChevronDown} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        ส่งออก
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop">
          {EXPORT_FORMATS.map((f) => (
            <a
              key={f.id}
              role="menuitem"
              href={documentsApi.exportUrl(docId, f.id)}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 hover:bg-ksu-tint"
            >
              <span className="block font-mono text-sm font-semibold text-ink">{f.name}</span>
              <span className="block text-xs text-muted">{f.desc}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
