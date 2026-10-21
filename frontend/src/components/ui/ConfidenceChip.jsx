import { CONFIDENCE_THRESHOLD } from '../../config/constants'
import { cn } from '../../utils/cn'

/** ชิปค่าความมั่นใจ: ต่ำกว่าเกณฑ์ = สีเตือน, ยืนยันแล้ว = สีเขียว */
export default function ConfidenceChip({ value, resolved = false, className }) {
  if (value === null || value === undefined || value === '') return <span className="font-mono text-[11px] text-subtle">—</span>
  const n = Number(value)
  const low = n < CONFIDENCE_THRESHOLD
  return (
    <span
      title={low && !resolved ? `ความมั่นใจต่ำกว่า ${CONFIDENCE_THRESHOLD}` : 'ค่าความมั่นใจของ AI'}
      className={cn(
        'inline-flex rounded-[5px] px-1.5 py-px font-mono text-[11px] font-semibold',
        resolved ? 'bg-success-soft text-success' : low ? 'bg-warning-soft text-warning-text' : 'bg-[#F1F3F7] text-muted',
        className,
      )}
    >
      {n.toFixed(2)}
    </span>
  )
}

/** แถบความมั่นใจแนวนอนสำหรับตาราง */
export function ConfidenceBar({ value }) {
  if (value === null || value === undefined) return <span className="text-sm text-subtle">—</span>
  const n = Number(value)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-[72px] rounded-full bg-[#E6EBF3]" aria-hidden>
        <div className={cn('h-1.5 rounded-full', n < CONFIDENCE_THRESHOLD ? 'bg-warning' : 'bg-ksu-blue')} style={{ width: `${Math.round(n * 100)}%` }} />
      </div>
      <span className="font-mono text-[13px]">{n.toFixed(2)}</span>
    </div>
  )
}
