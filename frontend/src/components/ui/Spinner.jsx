import { LoaderCircle } from 'lucide-react'

export default function Spinner({ label = 'กำลังโหลด…', className = 'py-16' }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-muted ${className}`} role="status">
      <LoaderCircle size={18} className="animate-spin text-ksu-sky" aria-hidden />
      {label}
    </div>
  )
}
