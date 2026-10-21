import Card from '../../components/ui/Card'
import { formatConfidence, formatDateTime, formatSeconds } from '../../utils/format'

export default function ProvenanceCard({ doc }) {
  const verified = doc.raw_json?._review?.verified?.length ?? 0
  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <h2 className="text-base font-bold">ที่มาของข้อมูล</h2>
      <div>
        <div className="text-xs text-muted">ไฟล์ต้นฉบับ</div>
        <div className="mt-0.5 break-all font-mono text-[13px] font-semibold">{doc.file_name}</div>
      </div>
      <div>
        <div className="text-xs text-muted">SHA-256 Checksum</div>
        <div className="mt-0.5 break-all font-mono text-xs text-body">{doc.file_hash || '—'}</div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {[
          ['ความมั่นใจรวม', formatConfidence(doc.overall_confidence)],
          ['จุดที่คนยืนยัน', `${verified} จุด`],
          ['เวลาประมวลผล', doc.processing_ms ? `${formatSeconds(doc.processing_ms)} วินาที` : '—'],
          ['จำนวนหน้า', doc.page_count ?? '—'],
          ['ประมวลผลเมื่อ', formatDateTime(doc.created_at)],
          ['อนุมัติเมื่อ', formatDateTime(doc.reviewed_at)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 text-[13px] font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
