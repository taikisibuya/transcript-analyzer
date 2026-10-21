import Card from '../../components/ui/Card'
import { formatGpa } from '../../utils/format'
import { summarizeSemester } from '../../utils/grades'

/** กราฟแท่ง GPA รายภาค (ใช้ GPA ในเอกสาร ถ้าไม่มีใช้ค่าที่คำนวณได้) พร้อมเส้น GPAX */
export default function GpaTrendChart({ semesters, gpax }) {
  const data = semesters.map((s) => {
    const calc = summarizeSemester(s).gpa
    const gpa = s.semester_gpa !== null && s.semester_gpa !== undefined && s.semester_gpa !== '' ? Number(s.semester_gpa) : calc
    return { label: `${s.semester}/${s.academic_year}`, gpa }
  })
  if (!data.length) return null
  const g = Number(gpax)

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">GPA รายภาคการศึกษา</h2>
        {g > 0 && <span className="flex items-center gap-2 text-[13px] text-muted"><span className="inline-block w-5 border-t-2 border-dashed border-warning" />GPAX {formatGpa(g)}</span>}
      </div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: data.length * 56 }}>
          <div className="relative flex h-[180px] items-end gap-3 border-b border-[#D5DDEA] pt-6" role="img" aria-label={`GPA รายภาค: ${data.map((d) => `${d.label} ${formatGpa(d.gpa)}`).join(', ')}`}>
            {g > 0 && <div className="pointer-events-none absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-warning" style={{ bottom: `${(g / 4) * (180 - 24)}px` }} />}
            {data.map((d) => (
              <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-mono text-xs font-semibold">{formatGpa(d.gpa)}</span>
                <div className={`w-full max-w-[56px] rounded-t-lg ${d.gpa >= g && g > 0 ? 'bg-ksu-blue' : 'bg-[#9DB6DD]'}`} style={{ height: `${((d.gpa ?? 0) / 4) * (180 - 24 - 20)}px` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            {data.map((d) => <span key={d.label} className="flex-1 text-center text-xs text-muted">{d.label}</span>)}
          </div>
        </div>
      </div>
    </Card>
  )
}
