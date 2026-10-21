import ConfidenceChip from '../../components/ui/ConfidenceChip'
import { STUDENT_FIELDS } from '../../config/constants'
import { cn } from '../../utils/cn'
import { FIELD_STATE_CLASS } from './fieldStyles'

export default function StudentInfoForm({ student = {}, targetState, onChange }) {
  const conf = student.field_confidence ?? {}

  return (
    <section className="rounded-[14px] border border-line bg-white p-[18px]">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">ข้อมูลนักศึกษา</h2>
        <span className="font-mono text-xs text-subtle">student_info</span>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
        {STUDENT_FIELDS.map((f) => {
          const domId = `field-student-${f.key}`
          const state = targetState[domId]
          const value = student[f.key] ?? ''
          const missing = f.required && !value
          return (
            <div key={f.key} id={domId} className={cn('scroll-mt-24', f.wide && 'sm:col-span-2')}>
              <label htmlFor={`${domId}-input`} className="mb-1.5 flex items-center justify-between gap-2">
                <span className={cn('label', f.key === 'gpa_cumulative' && 'text-ksu-blue')}>{f.label}{f.required && <span className="text-danger"> *</span>}</span>
                {conf[f.key] !== undefined ? (
                  <ConfidenceChip value={conf[f.key]} resolved={state === 'resolved'} />
                ) : !value ? (
                  <span className="text-[11px] text-warning-text">ยังไม่มีข้อมูล</span>
                ) : null}
              </label>
              <input
                id={`${domId}-input`}
                type={f.type ?? 'text'}
                step={f.step}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                value={value}
                placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, f.type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value)}
                className={cn(
                  'input',
                  f.mono && 'font-mono',
                  f.key === 'gpa_cumulative' && 'font-bold text-ksu-blue',
                  FIELD_STATE_CLASS[state] ?? (missing ? FIELD_STATE_CLASS.critical : ''),
                )}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
