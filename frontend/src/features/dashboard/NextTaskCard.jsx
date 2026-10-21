import { ArrowRight, CircleCheck, Upload } from 'lucide-react'
import logo from '../../assets/ksu-logo.png'
import Button from '../../components/ui/Button'
import { useDocuments } from '../../context/documents'
import { paths } from '../../router/paths'
import { getDocStatus } from '../../utils/documentStatus'

/** การ์ด "งานถัดไปที่แนะนำ" — ดึงเอกสารลำดับแรกของคิว (ไม่ผ่านเกณฑ์ก่อน → ปัญหามากก่อน) */
export default function NextTaskCard() {
  const { reviewQueue, loading } = useDocuments()
  if (loading) return null
  const next = reviewQueue[0]

  if (!next) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-ksu-line bg-white px-7 py-6">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success"><CircleCheck size={24} /></span>
          <div>
            <p className="text-lg font-bold text-ink">ไม่มีเอกสารค้างตรวจ</p>
            <p className="text-sm text-muted">อัปโหลดทรานสคริปต์ใหม่ ระบบจะสกัดข้อมูลและจัดคิวให้อัตโนมัติ</p>
          </div>
        </div>
        <Button icon={Upload} to={paths.upload()}>อัปโหลดเอกสาร</Button>
      </section>
    )
  }

  const status = getDocStatus(next)
  const issues = next.issues_count ?? 0
  const headline =
    status === 'failed'
      ? `แก้ไข “${next.file_name}” — พบปัญหาร้ายแรง ${next.critical_count || issues} จุด`
      : issues > 0
        ? `ตรวจทาน “${next.file_name}” — เหลือ ${issues} จุดที่ต้องยืนยัน`
        : `ยืนยัน “${next.file_name}” — ผ่านการตรวจอัตโนมัติแล้ว`

  return (
    <section className="relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-[18px] bg-ksu-sky px-7 py-[26px] text-white">
      <img src={logo} alt="" aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-[300px] w-[300px] opacity-[.12]" />
      <div className="relative flex max-w-[640px] flex-col gap-2">
        <span className="self-start rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ksu-blue">งานถัดไปที่แนะนำ</span>
        <p className="break-all text-xl font-bold sm:text-[21px]">{headline}</p>
        <p className="text-sm leading-relaxed text-[#E3ECFA]">
          ระบบเรียงคิวให้อัตโนมัติ: เอกสารที่ไม่ผ่านเกณฑ์ขึ้นก่อน ตามด้วยเอกสารที่มีฟิลด์ความมั่นใจต่ำกว่า 0.85 มากที่สุด
          {next.student_name ? ` · ${next.student_name}` : ''}
        </p>
      </div>
      <Button variant="inverse" size="lg" iconRight={ArrowRight} to={paths.review(next.document_id)} className="relative">
        เริ่มตรวจทานคิว
      </Button>
    </section>
  )
}
