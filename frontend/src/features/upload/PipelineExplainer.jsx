import Card from '../../components/ui/Card'
import { cn } from '../../utils/cn'

const STEPS = [
  ['ปรับปรุงภาพ', 'OpenCV แก้มุมเอียง ครอปขอบ ปรับแสง และแปลง PDF เป็น 300 DPI'],
  ['สกัดข้อมูลด้วย Vision-LLM', 'แยกส่วนหัวเอกสารและตารางรายวิชา พร้อมค่าความมั่นใจรายฟิลด์'],
  ['ตรวจสอบอัตโนมัติ', 'Pydantic schema, คำนวณ GPA/หน่วยกิตซ้ำ และความครบถ้วนของเอกสาร'],
  ['คุณตรวจทาน (HITL)', 'ยืนยันเฉพาะจุดที่ความมั่นใจ < 0.85 แล้วกดอนุมัติ', true],
  ['บันทึกและสร้างเวกเตอร์', 'PostgreSQL (normalized + JSONB) และ pgvector สำหรับค้นหาทักษะ'],
]

export default function PipelineExplainer() {
  return (
    <aside className="xl:w-[340px] xl:shrink-0">
      <Card className="p-5">
        <h2 className="mb-4 text-base font-bold">ไฟล์ของคุณผ่านขั้นตอนอะไรบ้าง</h2>
        <ol className="flex flex-col gap-4">
          {STEPS.map(([title, desc, human], i) => (
            <li key={title} className="flex gap-3">
              <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold', human ? 'bg-warning-soft text-warning-text ring-[1.5px] ring-inset ring-warning' : 'bg-ksu-sky text-white')}>
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-[13px] leading-relaxed text-muted">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </aside>
  )
}
