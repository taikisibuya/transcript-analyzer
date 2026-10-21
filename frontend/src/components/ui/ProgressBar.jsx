import { cn } from '../../utils/cn'

export default function ProgressBar({ value = 0, max = 100, className, barClassName = 'bg-ksu-blue', label }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      className={cn('h-2 w-full rounded-full bg-[#E6EBF3]', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', barClassName)} style={{ width: `${pct}%` }} />
    </div>
  )
}
