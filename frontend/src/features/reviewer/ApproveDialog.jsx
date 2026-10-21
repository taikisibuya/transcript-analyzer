import { Check, CircleAlert, LoaderCircle } from 'lucide-react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { paths } from '../../router/paths'
import { cn } from '../../utils/cn'

const STEPS = [
  ['บันทึกลงตารางเชิงสัมพันธ์ (Relational ETL)', 'แยกข้อมูลลงตาราง students, academic_semesters, courses'],
  ['สร้าง Vector Embeddings (pgvector)', 'สร้างเวกเตอร์ 768 มิติของรายวิชา สำหรับค้นหาทักษะเชิงความหมาย'],
]

/** phase: running | done | error */
export default function ApproveDialog({ open, phase, step, error, docId, nextDocId, onClose, onRetry }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={phase !== 'running'}
      title={phase === 'done' ? 'อนุมัติข้อมูลสำเร็จ' : phase === 'error' ? 'อนุมัติไม่สำเร็จ' : 'กำลังนำเข้าฐานข้อมูลหลัก'}
      description={phase === 'running' ? 'โปรดอย่าปิดหน้านี้จนกว่าจะเสร็จ' : undefined}
      footer={
        phase === 'done' ? (
          <>
            <Button variant="secondary" to={paths.student(docId)}>ดูโปรไฟล์นักศึกษา</Button>
            {nextDocId ? <Button to={paths.review(nextDocId)}>ตรวจฉบับถัดไป</Button> : <Button to={paths.dashboard()}>กลับหน้าภาพรวม</Button>}
          </>
        ) : phase === 'error' ? (
          <>
            <Button variant="secondary" onClick={onClose}>ปิด</Button>
            <Button onClick={onRetry}>ลองอีกครั้ง</Button>
          </>
        ) : null
      }
    >
      <ol className="flex flex-col gap-4">
        {STEPS.map(([title, desc], i) => {
          const state = phase === 'done' || step > i ? 'done' : phase === 'error' && step === i ? 'error' : step === i ? 'run' : 'todo'
          return (
            <li key={title} className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  state === 'done' && 'bg-success text-white',
                  state === 'run' && 'bg-ksu-sky text-white',
                  state === 'error' && 'bg-danger text-white',
                  state === 'todo' && 'bg-[#F1F3F7] text-subtle',
                )}
              >
                {state === 'done' ? <Check size={14} /> : state === 'error' ? <CircleAlert size={14} /> : i + 4}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted">{desc}</p>
              </div>
              {state === 'run' && <LoaderCircle size={16} className="animate-spin text-ksu-sky" aria-label="กำลังทำงาน" />}
            </li>
          )
        })}
      </ol>
      {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-3 text-[13px] text-danger-text">{error}</p>}
    </Modal>
  )
}
