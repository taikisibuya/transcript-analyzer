import { Layers } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ProgressBar from '../../components/ui/ProgressBar'
import { useUploads } from '../../context/uploads'
import { paths } from '../../router/paths'
import { cn } from '../../utils/cn'
import { formatBytes } from '../../utils/format'
import PipelineSteps from './PipelineSteps'

function itemAction(item) {
  const t = item.task
  if (item.phase !== 'done' || !t?.doc_id) return null
  const n = t.issues?.length ?? 0
  if (t.status === 'FAILED') return { label: 'เปิดดูสาเหตุ', variant: 'danger', to: paths.review(t.doc_id) }
  if (t.status === 'WARNING') return { label: `ตรวจทาน ${n} จุด`, variant: 'primary', to: paths.review(t.doc_id) }
  return { label: 'ยืนยันข้อมูล', variant: 'secondary', to: paths.review(t.doc_id) }
}

function statusLine(item) {
  if (item.phase === 'failed') return item.error
  if (item.phase === 'queued') return 'รอคิวอัปโหลด…'
  if (item.phase === 'uploading') return `กำลังอัปโหลด ${item.progress}%`
  return item.task?.message ?? 'กำลังเตรียมเอกสาร…'
}

export default function UploadQueue() {
  const { items, clearFinished, busy } = useUploads()
  if (!items.length) return null

  const done = items.filter((i) => i.phase === 'done').length
  const failed = items.filter((i) => i.phase === 'failed').length
  const active = items.length - done - failed
  const pct = items.reduce((sum, i) => sum + (i.phase === 'done' || i.phase === 'failed' ? 100 : i.phase === 'processing' ? 40 + (i.task?.step ?? 1) * 18 : i.progress * 0.4), 0) / items.length

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EBF3] px-5 py-4">
        <div>
          <h2 className="text-[17px] font-bold">{busy ? `กำลังประมวลผล ${active} ไฟล์` : 'ประมวลผลเสร็จแล้ว'}</h2>
          <p className="text-[13px] text-muted">ทั้งหมด {items.length} · เสร็จ {done} · กำลังทำ {active}{failed ? ` · ล้มเหลว ${failed}` : ''}</p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          {busy && <ProgressBar value={pct} className="max-w-[260px]" label="ความคืบหน้ารวม" />}
          {!busy && <Button variant="secondary" size="sm" onClick={clearFinished}>ล้างรายการ</Button>}
        </div>
      </div>
      <ul>
        {items.map((item) => {
          const action = itemAction(item)
          const ext = item.name.split('.').pop()?.toUpperCase()
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3.5 border-t border-[#F0F2F6] px-5 py-3.5 first:border-t-0">
              <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold', ext === 'PDF' ? 'bg-danger-soft text-danger-text' : 'bg-ksu-tint text-ksu-blue')}>
                {ext}
              </span>
              <div className="min-w-0 flex-[1_1_220px]">
                <div className="truncate text-sm font-semibold">{item.name}</div>
                <div className={cn('truncate text-xs', item.phase === 'failed' ? 'text-danger-text' : 'text-muted')}>
                  {formatBytes(item.size)} · {statusLine(item)}
                  {item.task?.is_duplicate && <span className="ml-1 inline-flex items-center gap-1 text-ksu-blue"><Layers size={12} aria-hidden />ไฟล์ซ้ำ ใช้ผลเดิม ไม่เรียก AI ซ้ำ</span>}
                </div>
              </div>
              <PipelineSteps item={item} />
              {action ? (
                <Button size="sm" variant={action.variant} to={action.to}>{action.label}</Button>
              ) : (
                <Button size="sm" variant="secondary" disabled>{item.phase === 'failed' ? 'ล้มเหลว' : 'รอสักครู่'}</Button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
