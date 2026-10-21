import { Plus, Trash2 } from 'lucide-react'
import ConfidenceChip from '../../components/ui/ConfidenceChip'
import { cn } from '../../utils/cn'
import { formatGpa } from '../../utils/format'
import { isValidGrade, summarizeSemester } from '../../utils/grades'
import { CELL_STATE_CLASS } from './fieldStyles'

const cellInput =
  'w-full rounded-[7px] border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink hover:border-[#D5DDEA] hover:bg-white focus:border-ksu-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-ksu-blue/20'

function SummaryInput({ label, value, onChange, step }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg bg-ground px-2 py-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        className="w-16 rounded-md border border-[#D5DDEA] bg-white px-1.5 py-0.5 text-center font-mono font-semibold focus:border-ksu-blue focus:outline-none"
      />
    </label>
  )
}

/** ตารางรายวิชาของหนึ่งภาคการศึกษา แก้ไขได้ทันที + คำนวณ GPA สดเทียบกับเอกสาร */
export default function SemesterCard({ sem, index, targetState, showEnglish, onSemester, onCourse, onAddCourse, onRemoveCourse }) {
  const summary = summarizeSemester(sem)
  const semState = targetState[`semester-${index}`]
  const flagged = semState === 'active' || semState === 'warn' || semState === 'critical'

  return (
    <section
      id={`semester-${index}`}
      className={cn('scroll-mt-24 overflow-hidden rounded-[14px] border bg-white', flagged ? 'border-warning ring-2 ring-warning/20' : 'border-line')}
    >
      <div className={cn('flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5', flagged && 'bg-warning-bg')}>
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
          ภาคการศึกษาที่
          <input aria-label="ภาคการศึกษา" value={sem.semester ?? ''} onChange={(e) => onSemester(index, 'semester', e.target.value)} className="w-10 rounded-md border border-transparent px-1 text-center hover:border-[#D5DDEA] focus:border-ksu-blue focus:outline-none" />
          /
          <input aria-label="ปีการศึกษา" inputMode="numeric" value={sem.academic_year ?? ''} onChange={(e) => onSemester(index, 'academic_year', e.target.value === '' ? null : Number(e.target.value) || e.target.value)} className="w-16 rounded-md border border-transparent px-1 text-center hover:border-[#D5DDEA] focus:border-ksu-blue focus:outline-none" />
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <SummaryInput label="หน่วยกิต" step="0.5" value={sem.semester_credits_earned} onChange={(v) => onSemester(index, 'semester_credits_earned', v)} />
          <SummaryInput label="GPA เอกสาร" step="0.01" value={sem.semester_gpa} onChange={(v) => onSemester(index, 'semester_gpa', v)} />
          <span className={cn('rounded-lg px-2.5 py-1 text-[13px]', summary.gpaMatches ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning-text')} title="คำนวณจากเกรดและหน่วยกิตในตารางด้านล่าง">
            คำนวณได้ <b className="font-mono">{formatGpa(summary.gpa)}</b> · {summary.credits} นก.
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-ksu-tint text-left text-xs text-ksu-blue">
              <th className="px-3 py-2 pl-[18px] font-semibold">รหัสวิชา</th>
              <th className="px-2 py-2 font-semibold">ชื่อวิชา (ไทย)</th>
              {showEnglish && <th className="px-2 py-2 font-semibold">ชื่อวิชา (อังกฤษ)</th>}
              <th className="w-[76px] px-2 py-2 text-center font-semibold">หน่วยกิต</th>
              <th className="w-[76px] px-2 py-2 text-center font-semibold">เกรด</th>
              <th className="w-[84px] px-2 py-2 text-center font-semibold">ความมั่นใจ</th>
              <th className="w-[52px] px-2 py-2"><span className="sr-only">ลบ</span></th>
            </tr>
          </thead>
          <tbody>
            {(sem.courses ?? []).map((c, ci) => {
              const domId = `course-${index}-${ci}`
              const state = targetState[domId]
              const badGrade = !isValidGrade(c.grade)
              return (
                <tr key={ci} id={domId} className={cn('scroll-mt-24 border-t border-[#E6EBF3]', state === 'active' && 'bg-warning-bg')}>
                  <td className="w-[136px] py-1.5 pl-3 pr-1">
                    <input aria-label="รหัสวิชา" value={c.course_code ?? ''} onChange={(e) => onCourse(index, ci, 'course_code', e.target.value)} className={cn(cellInput, 'font-mono', CELL_STATE_CLASS[state])} />
                  </td>
                  <td className="min-w-[200px] px-1 py-1.5">
                    <input aria-label="ชื่อวิชาภาษาไทย" value={c.course_name_th ?? ''} onChange={(e) => onCourse(index, ci, 'course_name_th', e.target.value)} className={cellInput} />
                  </td>
                  {showEnglish && (
                    <td className="min-w-[200px] px-1 py-1.5">
                      <input aria-label="ชื่อวิชาภาษาอังกฤษ" value={c.course_name_en ?? ''} onChange={(e) => onCourse(index, ci, 'course_name_en', e.target.value)} className={cellInput} />
                    </td>
                  )}
                  <td className="px-1 py-1.5">
                    <input aria-label="หน่วยกิต" type="number" step="0.5" inputMode="decimal" value={c.credits ?? ''} onChange={(e) => onCourse(index, ci, 'credits', e.target.value === '' ? null : parseFloat(e.target.value))} className={cn(cellInput, 'text-center font-mono')} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      aria-label="เกรด"
                      aria-invalid={badGrade || undefined}
                      value={c.grade ?? ''}
                      onChange={(e) => onCourse(index, ci, 'grade', e.target.value.toUpperCase())}
                      className={cn(cellInput, 'text-center font-mono font-semibold', CELL_STATE_CLASS[state], badGrade && '!border-danger !bg-danger-soft')}
                    />
                  </td>
                  <td className="px-1 py-1.5 text-center"><ConfidenceChip value={c.confidence} resolved={state === 'resolved'} /></td>
                  <td className="px-1 py-1.5 pr-3 text-center">
                    <button type="button" onClick={() => onRemoveCourse(index, ci)} aria-label={`ลบรายวิชา ${c.course_code || ci + 1}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-danger-soft hover:text-danger">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onAddCourse(index)} className="flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-dashed border-[#D5DDEA] bg-[#FAFBFD] text-[13px] font-semibold text-ksu-blue hover:bg-ksu-tint">
        <Plus size={15} aria-hidden /> เพิ่มรายวิชาที่ AI อ่านตกหล่น
      </button>
    </section>
  )
}
