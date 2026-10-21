import { cn } from '../../utils/cn'

export default function Card({ as: Tag = 'section', className, children, ...rest }) {
  return <Tag className={cn('card', className)} {...rest}>{children}</Tag>
}

export function CardHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 pb-3.5 pt-[18px]', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
