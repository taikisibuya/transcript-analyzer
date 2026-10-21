import { useCallback, useEffect, useMemo, useState } from 'react'
import { documentsApi, getErrorMessage } from '../../api'
import { buildTargetState, normalizeIssues } from '../../utils/issues'

const clone = (obj) => (typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)))
const EMPTY_COURSE = { course_code: '', course_name_th: '', course_name_en: '', credits: 3, grade: '', confidence: 1 }

/**
 * สถานะทั้งหมดของหน้าตรวจทาน (HITL)
 * - form: raw_json ที่กำลังแก้ไข
 * - จุดที่ผู้ตรวจยืนยันแล้วเก็บใน form._review.verified (บันทึกไปกับ raw_json เพื่อไม่ต้องยืนยันซ้ำหลังบันทึก)
 */
export function useReviewer(docId) {
  const [doc, setDoc] = useState(null)
  const [form, setForm] = useState(null)
  const [report, setReport] = useState(null)
  const [loaded, setLoaded] = useState({ id: null, error: null })
  const [reloadToken, setReloadToken] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [activeKey, setActiveKey] = useState(null)

  useEffect(() => {
    let alive = true
    documentsApi.get(docId).then(
      (d) => {
        if (!alive) return
        setDoc(d)
        setForm(d.raw_json && Object.keys(d.raw_json).length ? clone(d.raw_json) : { student: {}, semesters: [] })
        setReport(d.validation_report)
        setDirty(false)
        setSavedAt(null)
        setActiveKey(null)
        setLoaded({ id: docId, error: null })
      },
      (err) => alive && setLoaded({ id: docId, error: getErrorMessage(err, 'ไม่สามารถดึงข้อมูลเอกสารได้') }),
    )
    return () => {
      alive = false
    }
  }, [docId, reloadToken])

  const loading = loaded.id !== docId
  const error = loaded.id === docId ? loaded.error : null
  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  // ---------- การแก้ไขข้อมูล ----------
  const mutate = useCallback((fn) => {
    setForm((prev) => {
      const next = clone(prev)
      fn(next)
      return next
    })
    setDirty(true)
  }, [])

  const updateStudent = useCallback((key, value) => mutate((f) => { f.student = { ...(f.student ?? {}), [key]: value } }), [mutate])
  const updateSemester = useCallback((s, key, value) => mutate((f) => { f.semesters[s][key] = value }), [mutate])
  const updateCourse = useCallback((s, c, key, value) => mutate((f) => { f.semesters[s].courses[c][key] = value }), [mutate])
  const addCourse = useCallback((s) => mutate((f) => { (f.semesters[s].courses ??= []).push({ ...EMPTY_COURSE }) }), [mutate])
  const removeCourse = useCallback((s, c) => mutate((f) => { f.semesters[s].courses.splice(c, 1) }), [mutate])
  const addSemester = useCallback(
    () =>
      mutate((f) => {
        const last = f.semesters?.at(-1)
        const year = last ? Number(last.academic_year) + (String(last.semester) === '2' ? 1 : 0) : new Date().getFullYear() + 543
        const term = last ? (String(last.semester) === '1' ? '2' : '1') : '1'
        ;(f.semesters ??= []).push({ academic_year: year, semester: term, semester_gpa: null, semester_credits_earned: null, courses: [{ ...EMPTY_COURSE }] })
      }),
    [mutate],
  )

  // ---------- จุดที่ต้องตรวจ ----------
  const issues = useMemo(() => normalizeIssues(report, form), [report, form])
  const verified = useMemo(() => new Set(form?._review?.verified ?? []), [form])
  const resolved = useMemo(() => Object.fromEntries(issues.map((i) => [i.key, !i.critical && verified.has(i.key)])), [issues, verified])
  const targetState = useMemo(() => buildTargetState(issues, resolved, activeKey), [issues, resolved, activeKey])

  const toggleResolved = useCallback(
    (key) => {
      const issue = issues.find((i) => i.key === key)
      if (!issue || issue.critical) return
      mutate((f) => {
        const set = new Set(f._review?.verified ?? [])
        set.has(key) ? set.delete(key) : set.add(key)
        f._review = { ...(f._review ?? {}), verified: [...set] }
      })
      // เลื่อนไปจุดถัดไปที่ยังไม่ยืนยันอัตโนมัติ
      if (!resolved[key]) {
        const idx = issues.findIndex((i) => i.key === key)
        const next = [...issues.slice(idx + 1), ...issues.slice(0, idx)].find((i) => !resolved[i.key] && i.key !== key)
        setActiveKey(next?.key ?? key)
      }
    },
    [issues, resolved, mutate],
  )

  const step = useCallback(
    (dir) => {
      if (!issues.length) return
      const idx = issues.findIndex((i) => i.key === activeKey)
      const next = idx === -1 ? (dir > 0 ? 0 : issues.length - 1) : (idx + dir + issues.length) % issues.length
      setActiveKey(issues[next].key)
    },
    [issues, activeKey],
  )

  const unresolved = issues.filter((i) => !resolved[i.key])
  const criticalCount = issues.filter((i) => i.critical).length

  // ---------- บันทึก / อนุมัติ ----------
  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await documentsApi.saveJson(docId, form)
      setReport(res.validation_report)
      setDoc((d) => ({ ...d, validation_status: res.validation_status, validation_report: res.validation_report, raw_json: form }))
      setDirty(false)
      setSavedAt(new Date())
      return res.validation_report
    } finally {
      setSaving(false)
    }
  }, [docId, form])

  return {
    doc, form, report, loading, error, reload,
    dirty, saving, savedAt, save,
    updateStudent, updateSemester, updateCourse, addCourse, removeCourse, addSemester,
    issues, resolved, unresolved, criticalCount, targetState,
    activeKey, setActiveKey, step, toggleResolved,
  }
}
