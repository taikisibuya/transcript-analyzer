import { useEffect, useState } from 'react'
import { ChartColumn } from 'lucide-react'
import Card, { CardHeader } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import ProgressBar from '../../components/ui/ProgressBar'
import { useDocuments } from '../../context/documents'
import { formatConfidence, formatDateTime, formatSeconds } from '../../utils/format'

const SAMPLE = `{
  "dataset": "KSU benchmark (ไทย-อังกฤษ 30 ตัวอย่าง)",
  "samples": 30,
  "overall_accuracy": 0.974,
  "by_language": { "th": 0.968, "en": 0.981 },
  "fields": [
    { "field": "student_id", "accuracy": 1.0 },
    { "field": "course_code", "accuracy": 0.982 },
    { "field": "grade", "accuracy": 0.975 }
  ]
}`

/** ผลการทดสอบ (สเปคข้อ 5 · Performance Evaluation)
 *  - Latency: คำนวณจากข้อมูลจริงในฐานข้อมูล (/api/stats)
 *  - Accuracy: ต้องเทียบกับชุดเฉลย จึงอ่านจากไฟล์ public/evaluation.json ที่ได้จากสคริปต์ทดสอบ */
export default function EvaluationPage() {
  const { stats } = useDocuments()
  const [evalData, setEvalData] = useState({ loading: true, data: null })

  useEffect(() => {
    fetch('/evaluation.json', { cache: 'no-store' })
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .then((data) => setEvalData({ loading: false, data }))
      .catch(() => setEvalData({ loading: false, data: null }))
  }, [])

  const latency = stats?.latency ?? []
  const ev = evalData.data
  const pct = (v) => `${(v * 100).toFixed(1)}%`

  return (
    <>
      <PageHeader title="ผลการทดสอบระบบ" description="ความแม่นยำการสกัดข้อมูลเทียบชุดเฉลย และเวลาประมวลผลต่อหน้า สำหรับรายงานและการนำเสนอ" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5"><div className="text-[13px] text-muted">ความแม่นยำรวม (ชุดทดสอบ)</div><div className="mt-2 text-[32px] font-bold leading-none text-ksu-blue">{ev ? pct(ev.overall_accuracy) : '—'}</div><div className="mt-2 text-xs text-muted">{ev ? `${ev.samples} ตัวอย่าง` : 'ยังไม่มีไฟล์ผลทดสอบ'}</div></Card>
        <Card className="p-5"><div className="text-[13px] text-muted">เวลาเฉลี่ยต่อหน้า</div><div className="mt-2 text-[32px] font-bold leading-none">{formatSeconds(stats?.avg_ms_per_page)}<span className="ml-1.5 text-sm font-normal text-muted">วินาที</span></div><div className="mt-2 text-xs text-muted">จาก {latency.length} เอกสารล่าสุด</div></Card>
        <Card className="p-5"><div className="text-[13px] text-muted">ค่าความมั่นใจเฉลี่ยของ AI</div><div className="mt-2 text-[32px] font-bold leading-none">{formatConfidence(stats?.avg_confidence)}</div><div className="mt-2 text-xs text-muted">ทุกเอกสารในระบบ</div></Card>
      </section>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <Card className="min-w-0 flex-1 overflow-hidden">
          <CardHeader title="ความแม่นยำการสกัดข้อมูล" subtitle={ev?.dataset ?? 'เทียบผลสกัดกับชุดเฉลยที่ตรวจด้วยมือ'} />
          {evalData.loading ? null : !ev ? (
            <div className="px-5 pb-5">
              <EmptyState icon={ChartColumn} title="ยังไม่มีผลทดสอบความแม่นยำ" description="รันสคริปต์ทดสอบกับชุดข้อมูล 30 ตัวอย่าง แล้ววางผลเป็นไฟล์ frontend/public/evaluation.json ตามรูปแบบนี้" className="py-6" />
              <pre className="overflow-auto rounded-xl bg-ksu-mist p-4 font-mono text-xs leading-relaxed text-body">{SAMPLE}</pre>
            </div>
          ) : (
            <div className="flex flex-col gap-5 px-5 pb-5">
              {ev.by_language && (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(ev.by_language).map(([lang, v]) => (
                    <div key={lang} className="rounded-xl bg-ground p-3.5">
                      <div className="text-xs text-muted">{lang === 'th' ? 'ทรานสคริปต์ภาษาไทย' : lang === 'en' ? 'ทรานสคริปต์ภาษาอังกฤษ' : lang}</div>
                      <div className="text-xl font-bold">{pct(v)}</div>
                    </div>
                  ))}
                </div>
              )}
              <ul className="flex flex-col gap-3">
                {(ev.fields ?? []).map((f) => (
                  <li key={f.field}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-mono">{f.field}</span><b>{pct(f.accuracy)}</b></div>
                    <ProgressBar value={f.accuracy * 100} label={f.field} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden xl:w-[520px] xl:shrink-0">
          <CardHeader title="เวลาประมวลผลรายเอกสาร" subtitle="วัดจากการรัน pipeline จริง (ปรับภาพ → สกัด → ตรวจสอบ)" />
          {latency.length === 0 ? (
            <EmptyState icon={ChartColumn} title="ยังไม่มีข้อมูลเวลา" description="อัปโหลดเอกสารใหม่ ระบบจะบันทึกเวลาประมวลผลอัตโนมัติ" />
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0"><tr><th className="table-th">เอกสาร</th><th className="table-th text-right">หน้า</th><th className="table-th text-right">วินาที/หน้า</th><th className="table-th text-right">ความมั่นใจ</th></tr></thead>
                <tbody>
                  {latency.map((l) => (
                    <tr key={l.document_id}>
                      <td className="table-td max-w-[220px]"><div className="truncate font-mono text-xs">{l.file_name}</div><div className="text-xs text-muted">{formatDateTime(l.created_at)}</div></td>
                      <td className="table-td text-right">{l.page_count}</td>
                      <td className="table-td text-right font-mono">{formatSeconds(l.ms_per_page)}</td>
                      <td className="table-td text-right font-mono">{formatConfidence(l.overall_confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
