import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Card from '../../components/ui/Card'
import { cn } from '../../utils/cn'
import { formatGpa } from '../../utils/format'
import { semesterLabel, summarizeSemester } from '../../utils/grades'

/** ผลการเรียนแบบพับเก็บได้ — ภาคล่าสุดเปิดไว้ก่อน */
export default function SemesterRecords({ semesters }) {
  const ordered = [...semesters].map((s, i) => ({ s, i })).reverse()
  const [open, setOpen] = useState(() => new Set(ordered.length ? [ordered[0].i] : []))
  const [q, setQ] = useState('')
  const k = q.trim().toLowerCase()

  const toggle = (i) => setOpen((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4">
        <h2 className="text-base font-bold">ผลการเรียน</h2>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารายวิชา" aria-label="ค้นหารายวิชา" className="input w-full sm:w-[220px]" />
      </div>
      {ordered.map(({ s, i }) => {
        const sum = summarizeSemester(s)
        const courses = (s.courses ?? []).filter((c) => !k || [c.course_code, c.course_name_th, c.course_name_en].some((v) => v?.toLowerCase?.().includes(k)))
        if (k && !courses.length) return null
        const isOpen = open.has(i) || !!k
        return (
          <div key={i} className="border-t border-[#EEF1F6]">
            <button type="button" onClick={() => toggle(i)} aria-expanded={isOpen} className={cn('flex min-h-[48px] w-full items-center justify-between gap-3 px-5 text-left text-sm', isOpen ? 'bg-ksu-tint text-ksu-blue' : 'hover:bg-ksu-mist')}>
              <b>{semesterLabel(s)}</b>
              <span className="flex items-center gap-2 text-muted">
                {sum.credits} หน่วยกิต · GPA {formatGpa(s.semester_gpa ?? sum.gpa)}
                <ChevronDown size={16} className={cn('transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {courses.map((c, ci) => (
                      <tr key={ci}>
                        <td className="table-td w-[120px] font-mono text-muted">{c.course_code}</td>
                        <td className="table-td whitespace-normal">
                          {c.course_name_th || c.course_name_en}
                          {c.course_name_th && c.course_name_en && <span className="block text-xs text-muted">{c.course_name_en}</span>}
                        </td>
                        <td className="table-td w-[70px] text-center">{c.credits}</td>
                        <td className="table-td w-[70px] text-center font-bold">{c.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}
