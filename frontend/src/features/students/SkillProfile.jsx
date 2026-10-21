import Card from '../../components/ui/Card'
import ProgressBar from '../../components/ui/ProgressBar'
import Spinner from '../../components/ui/Spinner'

export default function SkillProfile({ state, approved }) {
  const skills = state.data?.skills ?? []

  return (
    <Card className="p-5">
      <h2 className="text-base font-bold">โปรไฟล์ทักษะ</h2>
      <p className="mb-4 mt-0.5 text-[13px] text-muted">ความคล้ายเชิงความหมายระหว่างหมวดทักษะกับรายวิชาที่ได้เกรด B ขึ้นไป</p>
      {state.loading ? (
        <Spinner className="py-6" label="กำลังวิเคราะห์ทักษะ…" />
      ) : state.error ? (
        <p className="text-[13px] text-danger-text">{state.error}</p>
      ) : !state.data?.indexed ? (
        <p className="rounded-xl bg-ground px-3.5 py-3 text-[13px] text-muted">
          {approved ? 'ยังไม่มีเวกเตอร์ของรายวิชา ลองอนุมัติซ้ำเพื่อสร้าง Embedding' : 'โปรไฟล์ทักษะจะแสดงหลังจากอนุมัติเอกสารและสร้าง Vector Embeddings แล้ว'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {skills.map((s) => (
            <li key={s.id}>
              <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold">{s.label}</span><span className="font-mono text-muted">{s.score.toFixed(0)}%</span></div>
              <ProgressBar value={s.score} label={s.label} />
              {s.courses.length > 0 && <p className="mt-1 truncate text-xs text-muted">{s.courses.map((c) => c.course_name_th).filter(Boolean).slice(0, 2).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
