import { cn } from '../../utils/cn'
import { STATUS_META } from '../../utils/documentStatus'

const TONES = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  info: 'bg-ksu-tint text-ksu-blue',
  neutral: 'bg-[#F1F3F7] text-muted',
}

export default function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {dot && <span className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

/** ป้ายสถานะเอกสาร (processing | failed | warning | passed | approved) */
export function StatusBadge({ status, className }) {
  const meta = STATUS_META[status] ?? STATUS_META.processing
  return (
    <Badge tone={meta.tone} dot className={cn(status === 'processing' && '[&>span]:animate-pulse', className)}>
      {meta.label}
    </Badge>
  )
}
