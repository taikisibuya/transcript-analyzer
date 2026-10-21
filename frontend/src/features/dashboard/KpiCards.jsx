import Card from '../../components/ui/Card'
import ProgressBar from '../../components/ui/ProgressBar'
import { CONFIDENCE_THRESHOLD } from '../../config/constants'
import { useDocuments } from '../../context/documents'
import { formatConfidence, formatNumber, formatSeconds } from '../../utils/format'

function Kpi({ label, children }) {
  return (
    <Card className="flex flex-col gap-2.5 p-5">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      {children}
    </Card>
  )
}

export default function KpiCards() {
  const { stats, documents } = useDocuments()
  const total = stats?.total ?? documents.length
  const approved = stats?.approved ?? 0
  const needs = stats?.needs_review ?? 0
  const failed = stats?.by_validation?.FAILED ?? 0
  const latency = (stats?.latency ?? []).slice(0, 12).reverse()
  const maxMs = Math.max(1, ...latency.map((l) => l.ms_per_page))

  return (
    <section aria-label="สรุปตัวเลข" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="เอกสารทั้งหมด">
        <div className="flex items-baseline gap-2">
          <span className="text-[32px] font-bold leading-none">{formatNumber(total)}</span>
          {stats?.last_7_days > 0 && <span className="text-[13px] font-semibold text-success">+{stats.last_7_days} สัปดาห์นี้</span>}
        </div>
        {total > 0 && (
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-[#E6EBF3]" aria-hidden>
            <div className="bg-success" style={{ flex: approved }} />
            <div className="bg-warning" style={{ flex: Math.max(needs - failed, 0) }} />
            <div className="bg-danger" style={{ flex: failed }} />
            <div className="bg-[#C9D3E2]" style={{ flex: stats?.processing ?? 0 }} />
          </div>
        )}
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted">
          <span>อนุมัติ {approved}</span><span>รอตรวจ {needs}</span><span>ไม่ผ่าน {failed}</span>
        </div>
      </Kpi>

      <Kpi label="รอตรวจทาน (HITL)">
        <div className="flex items-baseline gap-2">
          <span className="text-[32px] font-bold leading-none text-warning-text">{formatNumber(needs)}</span>
          <span className="text-[13px] text-muted">ฉบับ</span>
        </div>
        <p className="text-[13px] leading-relaxed text-muted">
          จุดที่ต้องยืนยัน <b className="text-ink">{formatNumber(stats?.pending_issues ?? 0)} จุด</b>
          {needs > 0 && ` · เฉลี่ย ${((stats?.pending_issues ?? 0) / needs).toFixed(1)} ต่อฉบับ`}
        </p>
      </Kpi>

      <Kpi label="ค่าความมั่นใจเฉลี่ยของ AI">
        <div className="flex items-baseline gap-2">
          <span className="text-[32px] font-bold leading-none">{formatConfidence(stats?.avg_confidence)}</span>
          <span className="text-[13px] text-muted">เกณฑ์ {CONFIDENCE_THRESHOLD}</span>
        </div>
        <ProgressBar
          value={(stats?.avg_confidence ?? 0) * 100}
          barClassName={(stats?.avg_confidence ?? 1) < CONFIDENCE_THRESHOLD ? 'bg-warning' : 'bg-ksu-blue'}
          label="ค่าความมั่นใจเฉลี่ย"
        />
      </Kpi>

      <Kpi label="เวลาประมวลผลเฉลี่ย">
        <div className="flex items-baseline gap-2">
          <span className="text-[32px] font-bold leading-none">{formatSeconds(stats?.avg_ms_per_page)}</span>
          <span className="text-[13px] text-muted">วินาที / หน้า</span>
        </div>
        {latency.length > 0 ? (
          <div className="flex h-7 items-end gap-1" aria-label="เวลาประมวลผลต่อหน้าของเอกสารล่าสุด">
            {latency.map((l, i) => (
              <div
                key={l.document_id}
                title={`${l.file_name}: ${formatSeconds(l.ms_per_page)} วินาที/หน้า`}
                className={i === latency.length - 1 ? 'flex-1 rounded-[3px] bg-ksu-blue' : 'flex-1 rounded-[3px] bg-[#C9D7EE]'}
                style={{ height: `${Math.max(12, (l.ms_per_page / maxMs) * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-subtle">ยังไม่มีข้อมูลเวลาประมวลผล</p>
        )}
      </Kpi>
    </section>
  )
}
