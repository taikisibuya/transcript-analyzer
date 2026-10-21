import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Spinner from '../../components/ui/Spinner'
import { useDocuments } from '../../context/documents'
import { Link } from '../../router/Router'
import { paths } from '../../router/paths'
import { formatDateTime, formatGpa, initials } from '../../utils/format'

export default function StudentListPage() {
  const { approved, loading } = useDocuments()
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase()
    return approved.filter((d) => !k || [d.student_name, d.student_id, d.major].some((v) => v?.toLowerCase().includes(k)))
  }, [approved, q])

  return (
    <>
      <PageHeader
        title="นักศึกษาในคลังข้อมูล"
        description="รายชื่อนักศึกษาจากทรานสคริปต์ที่ผ่านการตรวจทานและอนุมัติแล้ว"
        actions={<Button variant="secondary" to={paths.export()}>ส่งออกทั้งหมด</Button>}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-lg font-bold">{approved.length} คน</h2>
          <label className="flex min-h-[40px] w-full items-center gap-2 rounded-[10px] border border-[#D5DDEA] px-3 text-muted focus-within:border-ksu-blue sm:w-[300px]">
            <Search size={16} aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ รหัส หรือสาขา" aria-label="ค้นหานักศึกษา" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" />
          </label>
        </div>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={approved.length ? 'ไม่พบนักศึกษาที่ตรงคำค้น' : 'ยังไม่มีนักศึกษาในคลังข้อมูล'} description={approved.length ? undefined : 'อนุมัติทรานสคริปต์ในหน้าตรวจทาน แล้วข้อมูลจะปรากฏที่นี่'} action={!approved.length && <Button to={paths.reviewQueue()}>ไปที่คิวตรวจทาน</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">นักศึกษา</th>
                  <th className="table-th">สาขาวิชา</th>
                  <th className="table-th">GPAX</th>
                  <th className="table-th">อนุมัติเมื่อ</th>
                  <th className="table-th text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.document_id} className="hover:bg-ksu-mist/60">
                    <td className="table-td">
                      <Link to={paths.student(d.document_id)} className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ksu-tint text-[13px] font-bold text-ksu-blue">{initials(d.student_name)}</span>
                        <span>
                          <span className="block font-semibold text-ink hover:text-ksu-blue">{d.student_name || 'ไม่ระบุชื่อ'}</span>
                          <span className="block font-mono text-xs text-muted">{d.student_id || '—'}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="table-td">{d.major || '—'}</td>
                    <td className="table-td font-mono font-semibold">{formatGpa(d.gpa_cumulative)}</td>
                    <td className="table-td text-[13px] text-muted">{formatDateTime(d.reviewed_at || d.created_at)}</td>
                    <td className="table-td text-right"><Button size="sm" variant="secondary" to={paths.student(d.document_id)}>ดูโปรไฟล์</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
