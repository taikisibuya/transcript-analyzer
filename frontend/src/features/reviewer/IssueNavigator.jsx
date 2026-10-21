import { ChevronDown, ChevronUp, CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react'
import Button, { IconButton } from '../../components/ui/Button'
import ConfidenceChip from '../../components/ui/ConfidenceChip'
import { cn } from '../../utils/cn'

/** รายการจุดที่ต้องตรวจ — คลิกเพื่อเลื่อนไปยังช่องในฟอร์ม, กดยืนยันทีละจุด */
export default function IssueNavigator({ issues, resolved, activeKey, onPick, onToggle, onStep }) {
  if (!issues.length) {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-success-line bg-success-soft px-4 py-3.5">
        <CircleCheck size={20} className="text-success" aria-hidden />
        <div>
          <p className="text-[15px] font-bold text-success">ไม่พบจุดที่ต้องตรวจ</p>
          <p className="text-xs text-body">ตรวจสอบความถูกต้องอีกครั้งแล้วกดอนุมัติได้เลย</p>
        </div>
      </div>
    )
  }

  const hasCritical = issues.some((i) => i.critical)

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      <div className={cn('flex items-center justify-between gap-3 border-b px-4 py-3.5', hasCritical ? 'border-[#F2B8AE] bg-danger-soft' : 'border-[#F3DDAA] bg-[#FFF8E8]')}>
        <div className="flex items-center gap-2.5">
          {hasCritical ? <ShieldAlert size={20} className="text-danger" aria-hidden /> : <TriangleAlert size={20} className="text-[#B26B00]" aria-hidden />}
          <div>
            <h2 className="text-[15px] font-bold">{hasCritical ? 'พบปัญหาร้ายแรงที่ต้องแก้ไข' : 'จุดที่ต้องตรวจสอบ'}</h2>
            <p className="text-xs text-[#6B5320]">ค่าความมั่นใจต่ำกว่า 0.85 หรือผลคำนวณไม่ตรง — คลิกเพื่อไปยังช่องที่เกี่ยวข้อง</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <IconButton icon={ChevronUp} label="จุดก่อนหน้า (K)" size={36} onClick={() => onStep(-1)} />
          <IconButton icon={ChevronDown} label="จุดถัดไป (J)" size={36} onClick={() => onStep(1)} />
        </div>
      </div>

      <ul>
        {issues.map((it, i) => {
          const active = it.key === activeKey
          const ok = resolved[it.key]
          return (
            <li key={it.key} className={cn('flex items-center gap-3 border-t border-[#F0F2F6] px-4 py-2.5 first:border-t-0', active && 'bg-[#FFFBF0] shadow-[inset_3px_0_0_#E9A23B]')}>
              <button type="button" onClick={() => onPick(it.key)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left">
                <span
                  className={cn(
                    'inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold',
                    ok ? 'bg-success text-white' : it.critical ? 'bg-danger text-white' : active ? 'bg-warning text-[#2B1B00]' : 'bg-[#F1F3F7] text-muted',
                  )}
                >
                  {ok ? '✓' : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{it.term && it.target.kind !== 'field' ? `${it.term} · ` : ''}{it.title}</span>
                  <span className="block text-xs leading-snug text-muted">{it.message}</span>
                </span>
              </button>
              {it.confidence !== undefined ? <ConfidenceChip value={it.confidence} resolved={ok} /> : null}
              {it.critical ? (
                <span className="whitespace-nowrap rounded-md bg-danger-soft px-2 py-1 text-xs font-semibold text-danger-text">ต้องแก้ไข</span>
              ) : (
                <Button size="sm" variant={ok ? 'tonal' : 'primary'} className={ok ? '!bg-success-soft !text-success' : ''} onClick={() => onToggle(it.key)}>
                  {ok ? 'ยืนยันแล้ว' : 'ยืนยัน'}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="border-t border-[#F0F2F6] bg-[#FAFBFD] px-4 py-2.5 text-xs text-muted">
        ทางลัด: <kbd className="font-mono">J</kbd>/<kbd className="font-mono">K</kbd> เลื่อนจุด · <kbd className="font-mono">Enter</kbd> ยืนยันจุดที่เลือก · <kbd className="font-mono">Ctrl+S</kbd> บันทึก
        {issues.some((i) => i.critical) && ' · ปัญหาร้ายแรงต้องแก้ไขข้อมูลแล้วกดบันทึกเพื่อตรวจใหม่'}
      </p>
    </div>
  )
}
