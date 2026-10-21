import Card from '../../components/ui/Card'
import { useDocuments } from '../../context/documents'
import { formatNumber } from '../../utils/format'

export default function SystemStatus() {
  const { stats, error } = useDocuments()
  const processing = stats?.processing ?? 0
  const ok = !error

  const rows = [
    ['กำลังประมวลผล', `${formatNumber(processing)} ไฟล์`],
    ['นักศึกษาในคลังข้อมูล', `${formatNumber(stats?.approved ?? 0)} คน`],
    ['รายวิชาที่สร้างเวกเตอร์แล้ว', `${formatNumber(stats?.indexed_courses ?? 0)} วิชา`],
  ]

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">สถานะระบบ</h2>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-success' : 'text-danger-text'}`}>
          <span className={`h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-danger'}`} />
          {ok ? 'ปกติ' : 'เชื่อมต่อไม่ได้'}
        </span>
      </div>
      <dl className="flex flex-col gap-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt>{k}</dt>
            <dd className="font-mono text-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-[#E6EBF3] pt-3 text-[13px] text-muted">
        Pipeline: OpenCV 300 DPI → Vision-LLM → ตรวจสอบ Pydantic/GPA → pgvector
      </p>
    </Card>
  )
}
