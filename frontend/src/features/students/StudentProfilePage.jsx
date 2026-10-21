import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, ExternalLink, PencilLine } from 'lucide-react'
import { documentsApi, getErrorMessage, skillsApi } from '../../api'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { Link } from '../../router/Router'
import { useParams } from '../../router/hooks'
import { paths } from '../../router/paths'
import { formatGpa, initials } from '../../utils/format'
import ExportMenu from '../export/ExportMenu'
import GpaTrendChart from './GpaTrendChart'
import ProvenanceCard from './ProvenanceCard'
import SemesterRecords from './SemesterRecords'
import SkillProfile from './SkillProfile'

export default function StudentProfilePage() {
  const { docId } = useParams()
  const [result, setResult] = useState({ id: null, doc: null, error: null })
  const [skillResult, setSkillResult] = useState({ id: null, data: null, error: null })

  useEffect(() => {
    let alive = true
    documentsApi.get(docId).then(
      (doc) => alive && setResult({ id: docId, doc, error: null }),
      (e) => alive && setResult({ id: docId, doc: null, error: getErrorMessage(e) }),
    )
    skillsApi.studentProfile(docId).then(
      (data) => alive && setSkillResult({ id: docId, data, error: null }),
      (e) => alive && setSkillResult({ id: docId, data: null, error: getErrorMessage(e) }),
    )
    return () => {
      alive = false
    }
  }, [docId])

  const doc = result.id === docId ? result.doc : null
  const error = result.id === docId ? result.error : null
  const skills = skillResult.id === docId ? { loading: false, ...skillResult } : { loading: true, data: null, error: null }

  if (error) return <Card><EmptyState icon={CircleAlert} tone="danger" title="ไม่พบข้อมูลนักศึกษา" description={error} action={<Button to={paths.students()}>กลับไปรายชื่อนักศึกษา</Button>} /></Card>
  if (!doc) return <Spinner label="กำลังโหลดโปรไฟล์…" />

  const st = doc.raw_json?.student ?? {}
  const semesters = doc.raw_json?.semesters ?? []
  const approved = doc.review_status === 'APPROVED'
  const totalCredits = st.total_credits_earned ?? semesters.reduce((n, s) => n + (s.courses ?? []).reduce((m, c) => m + (Number(c.credits) || 0), 0), 0)
  const name = st.name_th || st.name_en || 'ไม่ระบุชื่อ'

  return (
    <>
      <nav aria-label="breadcrumb" className="text-[13px] text-muted">
        <Link to={paths.students()} className="text-ksu-blue hover:underline">นักศึกษา</Link> / {name}
      </nav>

      <Card className="overflow-hidden">
        <div className="h-2.5 bg-ksu-sky" />
        <div className="flex flex-wrap items-center gap-6 px-6 py-[22px]">
          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-ksu-sky text-[26px] font-bold text-white">{initials(name)}</div>
          <div className="min-w-0 flex-[1_1_300px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-ink sm:text-[26px]">{name}</h1>
              {st.name_en && st.name_th && <span className="text-[15px] text-muted">{st.name_en}</span>}
              {approved ? (
                <Badge tone="success"><CircleCheck size={13} aria-hidden />ตรวจทานและอนุมัติแล้ว</Badge>
              ) : (
                <Badge tone="warning">ยังไม่อนุมัติ</Badge>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted">
              <span className="font-mono">{st.student_id || '—'}</span>
              {[st.faculty && `คณะ${st.faculty.replace(/^คณะ/, '')}`, st.major && `สาขา${st.major.replace(/^สาขา(วิชา)?/, '')}`, st.institution].filter(Boolean).map((t) => ` · ${t}`)}
            </p>
          </div>
          <dl className="flex flex-wrap gap-7">
            <div><dt className="text-xs text-muted">GPAX</dt><dd className="text-[30px] font-bold leading-tight text-ksu-blue">{formatGpa(st.gpa_cumulative)}</dd></div>
            <div><dt className="text-xs text-muted">หน่วยกิตสะสม</dt><dd className="text-[30px] font-bold leading-tight">{totalCredits || '—'}</dd></div>
            <div><dt className="text-xs text-muted">ภาคการศึกษา</dt><dd className="text-[30px] font-bold leading-tight">{semesters.length}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={ExternalLink} href={doc.file_url} target="_blank" rel="noreferrer">เอกสารต้นฉบับ</Button>
            <Button variant="secondary" icon={PencilLine} to={paths.review(doc.document_id)}>แก้ไข</Button>
            <ExportMenu docId={doc.document_id} variant="primary" />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <GpaTrendChart semesters={semesters} gpax={st.gpa_cumulative} />
          <SemesterRecords semesters={semesters} />
        </div>
        <div className="flex flex-col gap-5 xl:w-[340px] xl:shrink-0">
          <SkillProfile state={skills} approved={approved} />
          <ProvenanceCard doc={doc} />
        </div>
      </div>
    </>
  )
}
