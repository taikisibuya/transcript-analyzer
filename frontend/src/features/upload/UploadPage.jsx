import PageHeader from '../../components/ui/PageHeader'
import { paths } from '../../router/paths'
import Dropzone from './Dropzone'
import PipelineExplainer from './PipelineExplainer'
import UploadQueue from './UploadQueue'

export default function UploadPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'ภาพรวม', to: paths.dashboard() }, { label: 'อัปโหลดเอกสาร' }]}
        title="อัปโหลดใบทรานสคริปต์"
        description="ระบบจะปรับภาพ สกัดข้อมูลด้วย AI และตรวจสอบความถูกต้องให้อัตโนมัติ คุณแค่ตรวจทานจุดที่ระบบไม่มั่นใจ"
      />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Dropzone />
          <UploadQueue />
        </div>
        <PipelineExplainer />
      </div>
    </>
  )
}
