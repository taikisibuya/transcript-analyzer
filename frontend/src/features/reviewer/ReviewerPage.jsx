import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, Plus } from 'lucide-react'
import { documentsApi, getErrorMessage } from '../../api'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useDocuments } from '../../context/documents'
import { useFeedback } from '../../context/feedback'
import { useDeleteDocument } from '../../hooks/useDeleteDocument'
import { useNavigate, useParams } from '../../router/hooks'
import { paths } from '../../router/paths'
import ApproveDialog from './ApproveDialog'
import DocumentViewer from './DocumentViewer'
import IssueNavigator from './IssueNavigator'
import ReviewerTopBar from './ReviewerTopBar'
import ReviewFooter from './ReviewFooter'
import SemesterCard from './SemesterCard'
import StudentInfoForm from './StudentInfoForm'
import { useReviewer } from './useReviewer'
import { normalizeIssues } from '../../utils/issues'

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export default function ReviewerPage() {
  const { docId } = useParams()
  const r = useReviewer(docId)
  const { reviewQueue, refresh } = useDocuments()
  const { toast } = useFeedback()
  const deleteDocument = useDeleteDocument()
  const navigate = useNavigate()
  const [showEnglish, setShowEnglish] = useState(false)
  const [approve, setApprove] = useState({ open: false, phase: 'running', step: 0, error: null })
  const rRef = useRef(r)
  rRef.current = r

  // แสดงคอลัมน์ชื่ออังกฤษอัตโนมัติเมื่อเอกสารเป็นภาษาอังกฤษ
  useEffect(() => {
    const courses = r.form?.semesters?.flatMap((s) => s.courses ?? []) ?? []
    setShowEnglish(courses.some((c) => c.course_name_en && !c.course_name_th))
  }, [r.doc?.document_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // เลื่อนไปยังช่องที่เกี่ยวข้องเมื่อเลือกจุดที่ต้องตรวจ
  useEffect(() => {
    const issue = r.issues.find((i) => i.key === r.activeKey)
    if (!issue?.domId) return
    const el = document.getElementById(issue.domId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('issue-flash')
    void el.offsetWidth
    el.classList.add('issue-flash')
    const input = el.matches('input') ? el : el.querySelector('input[aria-invalid], input')
    setTimeout(() => input?.focus({ preventScroll: true }), 350)
  }, [r.activeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    try {
      const report = await rRef.current.save()
      const n = report?.issues?.length ?? 0
      toast.success(report?.status === 'FAILED' ? 'บันทึกแล้ว แต่ยังมีปัญหาร้ายแรงที่ต้องแก้ไข' : `บันทึกและตรวจใหม่เรียบร้อย${n ? ` · พบ ${n} จุดที่ต้องตรวจ` : ''}`)
      refresh()
      return report
    } catch (err) {
      toast.error(`บันทึกไม่สำเร็จ: ${getErrorMessage(err)}`)
      return null
    }
  }, [toast, refresh])

  // คีย์ลัด: J/K เลื่อนจุด, Enter ยืนยัน, Ctrl/Cmd+S บันทึก
  useEffect(() => {
    const onKey = (e) => {
      const cur = rRef.current
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (cur.dirty && !cur.saving) handleSave()
        return
      }
      if (isTyping(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'j') cur.step(1)
      else if (e.key === 'k') cur.step(-1)
      else if (e.key === 'Enter' && cur.activeKey && document.activeElement?.tagName !== 'BUTTON') cur.toggleResolved(cur.activeKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  // เตือนก่อนออกจากหน้าเมื่อมีการแก้ไขที่ยังไม่บันทึก
  useEffect(() => {
    if (!r.dirty) return undefined
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [r.dirty])

  const queueIndex = reviewQueue.findIndex((d) => d.document_id === docId)
  const nextDoc = reviewQueue.filter((d) => d.document_id !== docId)[queueIndex >= 0 ? queueIndex : 0]
  const queueInfo = { position: queueIndex >= 0 ? queueIndex + 1 : null, total: reviewQueue.length, next: nextDoc }

  const runApprove = useCallback(async () => {
    setApprove({ open: true, phase: 'running', step: 0, error: null })
    const t = setTimeout(() => setApprove((a) => (a.phase === 'running' ? { ...a, step: 1 } : a)), 1200)
    try {
      await documentsApi.approve(docId)
      clearTimeout(t)
      setApprove({ open: true, phase: 'done', step: 2, error: null })
      refresh()
    } catch (err) {
      clearTimeout(t)
      setApprove((a) => ({ ...a, phase: 'error', error: getErrorMessage(err) }))
    }
  }, [docId, refresh])

  const handleApprove = useCallback(async () => {
    if (r.dirty) {
      const report = await handleSave()
      if (!report) return
      // คำนวณจุดที่ยังไม่ยืนยันใหม่จากผลตรวจล่าสุด
      const verified = new Set(r.form?._review?.verified ?? [])
      const fresh = normalizeIssues(report, r.form)
      if (report.status === 'FAILED' || fresh.some((i) => !i.critical && !verified.has(i.key))) {
        toast.info('ผลตรวจใหม่ยังมีจุดที่ต้องยืนยัน กรุณาตรวจให้ครบก่อนอนุมัติ')
        return
      }
    }
    runApprove()
  }, [r.dirty, r.form, handleSave, runApprove, toast])

  if (r.loading) return <div className="min-h-screen bg-ground"><Spinner label="กำลังเปิดเอกสาร…" className="py-32" /></div>
  if (r.error || !r.doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground p-4">
        <div className="card w-full max-w-lg">
          <EmptyState icon={CircleAlert} tone="danger" title="เปิดเอกสารไม่ได้" description={r.error} action={<div className="flex gap-2"><Button variant="secondary" onClick={r.reload}>ลองใหม่</Button><Button to={paths.dashboard()}>กลับหน้าภาพรวม</Button></div>} />
        </div>
      </div>
    )
  }

  const failed = r.report?.status === 'FAILED'
  const blockers = failed && !r.dirty
    ? 'แก้ไขปัญหาร้ายแรงก่อนอนุมัติ'
    : !r.dirty && r.unresolved.length > 0
      ? `อนุมัติได้เมื่อตรวจครบ (เหลือ ${r.unresolved.length} จุด)`
      : r.dirty && r.unresolved.some((i) => !i.critical)
        ? `อนุมัติได้เมื่อตรวจครบ (เหลือ ${r.unresolved.filter((i) => !i.critical).length} จุด)`
        : null

  return (
    <div className="flex min-h-screen flex-col bg-ground font-sans text-ink lg:h-screen">
      <ReviewerTopBar
        doc={r.doc}
        form={r.form}
        issues={r.issues}
        unresolved={r.unresolved}
        queueInfo={queueInfo}
        savedAt={r.savedAt}
        dirty={r.dirty}
        onDelete={async () => { if (await deleteDocument(r.doc)) navigate(paths.dashboard()) }}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-col lg:w-1/2 lg:border-r lg:border-line">
          <DocumentViewer doc={r.doc} />
        </div>

        <section aria-label="ข้อมูลที่ AI สกัดได้" className="flex min-h-0 flex-col lg:w-1/2">
          <div className="flex flex-col gap-[18px] px-4 py-5 sm:px-6 lg:flex-1 lg:overflow-y-auto [&>*]:shrink-0">
            <IssueNavigator
              issues={r.issues}
              resolved={r.resolved}
              activeKey={r.activeKey}
              onPick={r.setActiveKey}
              onToggle={r.toggleResolved}
              onStep={r.step}
            />

            <StudentInfoForm student={r.form.student} targetState={r.targetState} onChange={r.updateStudent} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">ผลการเรียน ({r.form.semesters?.length ?? 0} ภาคการศึกษา)</h2>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={showEnglish} onChange={(e) => setShowEnglish(e.target.checked)} className="h-4 w-4" />
                แสดงชื่อวิชาภาษาอังกฤษ
              </label>
            </div>

            {(r.form.semesters ?? []).map((sem, i) => (
              <SemesterCard
                key={i}
                sem={sem}
                index={i}
                targetState={r.targetState}
                showEnglish={showEnglish}
                onSemester={r.updateSemester}
                onCourse={r.updateCourse}
                onAddCourse={r.addCourse}
                onRemoveCourse={r.removeCourse}
              />
            ))}

            <Button variant="tonal" icon={Plus} onClick={r.addSemester} className="self-start">เพิ่มภาคการศึกษา</Button>
          </div>

          <ReviewFooter
            form={r.form}
            dirty={r.dirty}
            saving={r.saving}
            approving={approve.open && approve.phase === 'running'}
            blockers={blockers}
            approved={r.doc.review_status === 'APPROVED'}
            onSave={handleSave}
            onApprove={handleApprove}
          />
        </section>
      </div>

      <ApproveDialog
        open={approve.open}
        phase={approve.phase}
        step={approve.step}
        error={approve.error}
        docId={docId}
        nextDocId={nextDoc?.document_id}
        onClose={() => setApprove((a) => ({ ...a, open: false }))}
        onRetry={runApprove}
      />
    </div>
  )
}
