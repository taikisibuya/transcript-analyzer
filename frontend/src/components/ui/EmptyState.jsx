import { cn } from '../../utils/cn'

export default function EmptyState({ icon: Icon, title, description, action, className, tone = 'neutral' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {Icon && (
        <span className={cn('mb-1 inline-flex h-14 w-14 items-center justify-center rounded-2xl', tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-ksu-tint text-ksu-sky')}>
          <Icon size={26} aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
