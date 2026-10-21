import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Inbox, RefreshCw, Search, Trash2 } from 'lucide-react'
import { StatusBadge } from '../../components/ui/Badge'
import Button, { IconButton } from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { ConfidenceBar } from '../../components/ui/ConfidenceChip'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Tabs from '../../components/ui/Tabs'
import { useDocuments } from '../../context/documents'
import { useDeleteDocument } from '../../hooks/useDeleteDocument'
import { paths } from '../../router/paths'
import { getDocStatus } from '../../utils/documentStatus'
import { formatRelative } from '../../utils/format'

const PAGE_SIZE = 10
const TABS = [
  { id: 'all', label: 'ทั้งหมด', match: () => true },
  { id: 'review', label: 'ต้องตรวจทาน', match: (s) => s === 'warning' || s === 'passed' || s === 'failed' },
  { id: 'failed', label: 'ไม่ผ่านเกณฑ์', match: (s) => s === 'failed' },
  { id: 'processing', label: 'กำลังประมวลผล', match: (s) => s === 'processing' },
  { id: 'approved', label: 'อนุมัติแล้ว', match: (s) => s === 'approved' },
]

function rowAction(doc) {
  const s = getDocStatus(doc)
  if (s === 'processing') return { label: 'รอสักครู่', variant: 'secondary', disabled: true }
  if (s === 'approved') return { label: 'ดูข้อมูล', variant: 'secondary', to: paths.student(doc.document_id) }
  if (s === 'failed') return { label: 'แก้ไข', variant: 'danger', to: paths.review(doc.document_id) }
  if (s === 'passed') return { label: 'ยืนยัน', variant: 'secondary', to: paths.review(doc.document_id) }
  return { label: 'ตรวจทาน', variant: 'primary', to: paths.review(doc.document_id) }
}

export default function DocumentQueue() {
  const { documents, loading, refresh } = useDocuments()
  const deleteDocument = useDeleteDocument()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const tabs = useMemo(
    () => TABS.map((t) => ({ ...t, count: documents.filter((d) => t.match(getDocStatus(d))).length })),
    [documents],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = TABS.find((t) => t.id === tab).match
    return documents.filter((d) => {
      if (!match(getDocStatus(d))) return false
      if (!q) return true
      return [d.file_name, d.student_name, d.student_id].some((v) => v?.toLowerCase().includes(q))
    })
  }, [documents, tab, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3.5 pt-[18px]">
        <h2 className="text-lg font-bold">คิวเอกสาร</h2>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <label className="flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[#D5DDEA] px-3 text-muted focus-within:border-ksu-blue sm:max-w-[300px]">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0) }}
              placeholder="ค้นหาชื่อไฟล์ รหัส หรือชื่อนักศึกษา"
              aria-label="ค้นหาเอกสาร"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
          </label>
          <IconButton icon={RefreshCw} label="รีเฟรชรายการ" onClick={refresh} />
        </div>
      </div>

      <Tabs items={tabs} value={tab} onChange={(id) => { setTab(id); setPage(0) }} label="กรองตามสถานะ" />

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={documents.length === 0 ? 'ยังไม่มีเอกสารในระบบ' : 'ไม่พบเอกสารที่ตรงเงื่อนไข'}
          description={documents.length === 0 ? 'เริ่มจากอัปโหลดใบทรานสคริปต์ (PDF, JPG หรือ PNG) ระบบจะสกัดข้อมูลให้อัตโนมัติ' : 'ลองเปลี่ยนแท็บหรือคำค้นหา'}
          action={documents.length === 0 && <Button to={paths.upload()}>อัปโหลดเอกสาร</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="table-th">เอกสาร / นักศึกษา</th>
                <th className="table-th">สถานะ</th>
                <th className="table-th">ความมั่นใจ AI</th>
                <th className="table-th">ต้องแก้</th>
                <th className="table-th">นำเข้าเมื่อ</th>
                <th className="table-th text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((doc) => {
                const action = rowAction(doc)
                const status = getDocStatus(doc)
                return (
                  <tr key={doc.document_id} className="hover:bg-ksu-mist/60">
                    <td className="table-td max-w-[320px]">
                      <div className="truncate font-semibold">{doc.student_name || (status === 'processing' ? 'กำลังอ่านข้อมูล…' : 'ไม่ระบุชื่อ')}</div>
                      <div className="truncate font-mono text-xs text-muted">{doc.file_name}</div>
                    </td>
                    <td className="table-td"><StatusBadge status={status} /></td>
                    <td className="table-td"><ConfidenceBar value={doc.overall_confidence} /></td>
                    <td className="table-td text-[13px] text-muted">
                      {status === 'processing' || status === 'approved' ? '—' : doc.issues_count ? `${doc.issues_count} จุด` : 'ไม่มี'}
                    </td>
                    <td className="table-td text-[13px] text-muted" title={doc.created_at}>{formatRelative(doc.created_at)}</td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant={action.variant} to={action.to} disabled={action.disabled}>{action.label}</Button>
                        <IconButton
                          icon={Trash2}
                          label={`ลบ ${doc.file_name}`}
                          size={36}
                          className="border-transparent text-subtle hover:bg-danger-soft hover:text-danger"
                          onClick={() => deleteDocument(doc)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-[#E6EBF3] px-5 py-3.5 text-[13px] text-muted">
          <span>แสดง {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} จาก {filtered.length} รายการ</span>
          <span className="flex gap-1.5">
            <IconButton icon={ChevronLeft} label="หน้าก่อนหน้า" size={36} disabled={current === 0} onClick={() => setPage(current - 1)} />
            <IconButton icon={ChevronRight} label="หน้าถัดไป" size={36} disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} />
          </span>
        </div>
      )}
    </Card>
  )
}
