import { ArrowLeft, SkipForward, Trash2 } from 'lucide-react'
import logo from '../../assets/ksu-logo.png'
import { StatusBadge } from '../../components/ui/Badge'
import Button, { IconButton } from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import { Link } from '../../router/Router'
import { paths } from '../../router/paths'
import { getDocStatus } from '../../utils/documentStatus'
import ExportMenu from '../export/ExportMenu'

export default function ReviewerTopBar({ doc, form, issues, unresolved, queueInfo, savedAt, dirty, onDelete }) {
  const total = issues.length
  const done = total - unresolved.length
  const name = form?.student?.name_th || form?.student?.name_en || 'ไม่ระบุชื่อนักศึกษา'

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line border-t-4 border-t-ksu-sky bg-white px-4 py-3 sm:px-6">
      <Link to={paths.dashboard()} aria-label="กลับไปหน้าคิวเอกสาร" className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#D5DDEA] text-body hover:bg-ksu-tint hover:text-ksu-blue">
        <ArrowLeft size={18} />
      </Link>
      <img src={logo} alt="" aria-hidden className="hidden h-8 w-8 sm:block" />
      <div className="min-w-0 flex-[1_1_260px]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h1 className="text-[17px] font-bold text-ink">{name}</h1>
          <span className="max-w-[260px] truncate font-mono text-[13px] text-muted">{doc.file_name}</span>
          <StatusBadge status={getDocStatus(doc)} />
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {queueInfo.position ? `คิวที่ ${queueInfo.position} จาก ${queueInfo.total} · ` : ''}
          {dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : savedAt ? `บันทึกล่าสุด ${savedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : 'ยังไม่มีการแก้ไข'}
        </p>
      </div>

      {total > 0 && (
        <div className="min-w-[200px] flex-[0_1_240px]">
          <div className="mb-1.5 flex justify-between text-xs font-semibold"><span>ตรวจแล้ว</span><span>{done} / {total} จุด</span></div>
          <ProgressBar value={done} max={total} barClassName="bg-success" className="h-1.5" label="ความคืบหน้าการตรวจ" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ExportMenu docId={doc.document_id} />
        {queueInfo.next && (
          <Button variant="secondary" icon={SkipForward} to={paths.review(queueInfo.next.document_id)}>ฉบับถัดไป</Button>
        )}
        <IconButton icon={Trash2} label="ลบเอกสารนี้" onClick={onDelete} className="hover:bg-danger-soft hover:text-danger" />
      </div>
    </header>
  )
}
