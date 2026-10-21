import { Check, CircleAlert, Save } from 'lucide-react'
import Button from '../../components/ui/Button'
import { cn } from '../../utils/cn'
import { formatGpa } from '../../utils/format'
import { summarizeTranscript } from '../../utils/grades'

function Check_({ ok, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', ok ? 'text-success' : 'text-warning-text')}>
      {ok ? <Check size={15} strokeWidth={2.6} aria-hidden /> : <CircleAlert size={15} aria-hidden />}
      {children}
    </span>
  )
}

export default function ReviewFooter({ form, dirty, saving, approving, blockers, onSave, onApprove, approved }) {
  const s = summarizeTranscript(form)
  const stated = form?.student?.gpa_cumulative

  return (
    <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3.5 border-t border-line bg-white px-4 py-3.5 shadow-[0_-6px_20px_rgba(14,39,71,.05)] sm:px-6">
      <div className="hidden flex-[1_1_280px] flex-wrap gap-x-3.5 gap-y-1 text-[13px] sm:flex">
        <Check_ ok={s.creditsMatch}>หน่วยกิตรวม {s.credits}{s.statedTotal ? ` / เอกสาร ${s.statedTotal}` : ''}</Check_>
        <Check_ ok={!!stated}>GPAX {formatGpa(stated)}{s.gpax !== null ? ` (คำนวณ ${formatGpa(s.gpax)})` : ''}</Check_>
        <Check_ ok={s.mismatchedSemesters === 0}>{s.mismatchedSemesters === 0 ? `GPA ตรงทุกภาค (${s.semesters} ภาค)` : `GPA ไม่ตรง ${s.mismatchedSemesters} ภาค`}</Check_>
      </div>
      <Button variant="secondary" icon={Save} loading={saving} onClick={onSave} disabled={!dirty}>
        {dirty ? 'บันทึกและตรวจใหม่' : 'บันทึกแล้ว'}
      </Button>
      {blockers ? (
        <Button size="lg" disabled title={blockers} className="flex-1 sm:flex-none">{blockers}</Button>
      ) : (
        <Button size="lg" variant="success" icon={Check} loading={approving} onClick={onApprove} className="flex-1 sm:flex-none">
          {approved ? 'อนุมัติซ้ำ (อัปเดตฐานข้อมูล)' : 'อนุมัติและบันทึกเข้าฐานข้อมูล'}
        </Button>
      )}
    </footer>
  )
}
