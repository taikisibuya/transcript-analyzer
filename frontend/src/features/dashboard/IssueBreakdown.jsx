import Card from '../../components/ui/Card'
import { ISSUE_TYPE_LABELS } from '../../config/constants'
import { useDocuments } from '../../context/documents'

const CRITICAL = new Set(['MISSING_FIELD', 'MISSING_SEMESTERS', 'INCOMPLETE_TRANSCRIPT'])

export default function IssueBreakdown() {
  const { stats } = useDocuments()
  const entries = Object.entries(stats?.issue_types ?? {}).slice(0, 6)
  const max = Math.max(1, ...entries.map(([, n]) => n))

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-base font-bold">ปัญหาที่พบบ่อยในคิว</h2>
      {entries.length === 0 ? (
        <p className="text-[13px] text-muted">ไม่มีข้อสังเกตค้างอยู่ในคิว</p>
      ) : (
        <ul className="flex flex-col gap-2.5 text-[13px]">
          {entries.map(([type, n]) => (
            <li key={type}>
              <div className="mb-1 flex justify-between gap-2"><span>{ISSUE_TYPE_LABELS[type] ?? type}</span><b>{n}</b></div>
              <div className="h-1.5 rounded-full bg-[#E6EBF3]">
                <div className={`h-1.5 rounded-full ${CRITICAL.has(type) ? 'bg-danger' : 'bg-warning'}`} style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
