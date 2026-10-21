import { Search, Upload } from 'lucide-react'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'
import { useDocuments } from '../../context/documents'
import { paths } from '../../router/paths'
import { formatToday } from '../../utils/format'
import DocumentQueue from './DocumentQueue'
import IssueBreakdown from './IssueBreakdown'
import KpiCards from './KpiCards'
import NextTaskCard from './NextTaskCard'
import SystemStatus from './SystemStatus'

export default function DashboardPage() {
  const { reviewQueue, error } = useDocuments()
  const count = reviewQueue.length

  return (
    <>
      <PageHeader
        eyebrow={formatToday()}
        title={count > 0 ? `วันนี้มีเอกสารรอตรวจทาน ${count} ฉบับ` : 'ภาพรวมระบบ'}
        actions={
          <>
            <Button variant="secondary" icon={Search} to={paths.search()}>ค้นหาทักษะ</Button>
            <Button icon={Upload} to={paths.upload()}>อัปโหลดทรานสคริปต์</Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="rounded-xl border border-[#F2B8AE] bg-danger-soft px-4 py-3 text-sm text-danger-text">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </div>
      )}

      <NextTaskCard />
      <KpiCards />

      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start">
        <div className="min-w-0 flex-1">
          <DocumentQueue />
        </div>
        <div className="grid gap-5 md:grid-cols-2 2xl:flex 2xl:w-[320px] 2xl:shrink-0 2xl:flex-col">
          <SystemStatus />
          <IssueBreakdown />
        </div>
      </div>
    </>
  )
}
