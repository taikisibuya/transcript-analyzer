import { CircleCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useDocuments } from '../../context/documents'
import { Navigate } from '../../router/Router'
import { paths } from '../../router/paths'

/** เมนู "คิวตรวจทาน" → เปิดเอกสารลำดับแรกของคิวทันที */
export default function ReviewQueueRedirect() {
  const { reviewQueue, loading } = useDocuments()
  if (loading) return <Spinner label="กำลังเปิดคิวตรวจทาน…" />
  if (reviewQueue[0]) return <Navigate to={paths.review(reviewQueue[0].document_id)} />
  return (
    <Card>
      <EmptyState
        icon={CircleCheck}
        title="ตรวจทานครบทุกฉบับแล้ว"
        description="ไม่มีเอกสารค้างในคิว เมื่อมีการอัปโหลดใหม่ ระบบจะจัดลำดับให้อัตโนมัติ"
        action={<Button to={paths.upload()}>อัปโหลดเอกสาร</Button>}
      />
    </Card>
  )
}
