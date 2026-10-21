import Button from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import { Link } from '../../router/Router'
import { paths } from '../../router/paths'
import { formatGpa } from '../../utils/format'

export default function ResultCard({ result: r, rank }) {
  return (
    <article className="flex flex-wrap gap-[18px] rounded-2xl border border-line bg-white px-5 py-[18px]">
      <div className="flex min-w-0 flex-[1_1_240px] gap-3.5">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-ksu-sky font-mono text-[15px] font-bold text-white">#{rank}</div>
        <div className="min-w-0">
          <Link to={paths.student(r.document_id)} className="text-[17px] font-bold text-ink hover:text-ksu-blue hover:underline">{r.student_name || 'ไม่ระบุชื่อ'}</Link>
          <p className="mt-0.5 text-[13px] text-muted"><span className="font-mono">{r.student_id || '—'}</span>{r.major ? ` · ${r.major}` : ''}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="rounded-lg bg-ground px-2.5 py-0.5 text-[13px]">GPAX <b>{formatGpa(r.gpa_cumulative)}</b></span>
            <span className="rounded-lg bg-ground px-2.5 py-0.5 text-[13px]">ตรง {r.match_count} วิชา</span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-1.5">
        <div className="text-xs font-semibold text-muted">หลักฐานจากรายวิชา</div>
        {r.courses.map((c) => (
          <div key={`${c.course_code}-${c.similarity}`} className="flex items-center gap-2.5 rounded-[9px] bg-[#FAFBFD] px-2.5 py-1.5 text-sm">
            <span className="font-mono text-xs text-muted">{c.course_code}</span>
            <span className="min-w-0 flex-1 truncate">{c.course_name_th || c.course_name_en}</span>
            <span className="rounded-md bg-success-soft px-2 py-px font-mono text-xs font-bold text-success">{c.grade}</span>
            <span className="w-11 text-right font-mono text-xs text-muted">{c.similarity.toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <div className="flex flex-[0_1_150px] flex-col items-end justify-between gap-2.5">
        <div className="text-right">
          <div className="text-[26px] font-bold leading-none text-ksu-blue">{r.score.toFixed(0)}%</div>
          <div className="text-xs text-muted">ความสอดคล้อง</div>
        </div>
        <ProgressBar value={r.score} className="h-1.5" label="ความสอดคล้อง" />
        <Button size="sm" variant="secondary" to={paths.student(r.document_id)}>ดูโปรไฟล์</Button>
      </div>
    </article>
  )
}
