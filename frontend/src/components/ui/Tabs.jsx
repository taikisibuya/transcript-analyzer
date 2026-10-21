import { cn } from '../../utils/cn'

/** แท็บแบบเส้นใต้ items: [{ id, label, count }] */
export default function Tabs({ items, value, onChange, className, label }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b border-[#E6EBF3] px-5', className)}>
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'min-h-[44px] whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
              active ? 'border-ksu-blue font-semibold text-ksu-blue' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', active ? 'bg-ksu-tint' : 'bg-[#F1F3F7]')}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** ปุ่มกลุ่มแบบ segmented: options [{ value, label }] */
export function Segmented({ options, value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-1 rounded-[10px] bg-[#F1F3F7] p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('min-h-[36px] rounded-lg text-[13px] transition', active ? 'bg-white font-bold text-ink shadow-[0_1px_3px_rgba(14,39,71,.12)]' : 'text-muted hover:text-ink')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
