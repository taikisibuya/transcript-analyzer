import { ISSUE_TYPE_LABELS } from '../config/constants'

/**
 * แปลง issues จาก validator ให้มี "เป้าหมาย" ที่ชี้ไปยังช่องในฟอร์มได้
 * target.kind: field | course | semester | general
 * รองรับทั้งรายงานใหม่ (มี sem_index / course_index / field) และรายงานเก่าที่มีแค่ term + course_code
 */
export function normalizeIssues(report, data) {
  const semesters = data?.semesters ?? []
  const findSem = (term) =>
    semesters.findIndex((s) => term && term.includes(`${s.semester}/${s.academic_year}`))

  const seen = {}
  return (report?.issues ?? []).map((issue) => {
    let target = { kind: 'general' }
    if (issue.field?.startsWith('student.')) {
      target = { kind: 'field', field: issue.field.slice('student.'.length) }
    } else if (issue.type === 'MISSING_FACULTY') {
      target = { kind: 'field', field: 'faculty' }
    } else if (issue.type === 'MISSING_MAJOR') {
      target = { kind: 'field', field: 'major' }
    } else if (issue.course_code || issue.course_index !== undefined) {
      const sem = issue.sem_index ?? findSem(issue.term)
      const course =
        issue.course_index ?? semesters[sem]?.courses?.findIndex((c) => String(c.course_code) === String(issue.course_code))
      if (sem >= 0 && course >= 0) target = { kind: 'course', sem, course }
    } else if (issue.sem_index !== undefined || /ภาคเรียน/.test(issue.term ?? '')) {
      const sem = issue.sem_index ?? findSem(issue.term)
      if (sem >= 0) target = { kind: 'semester', sem }
    }

    // key ต้องคงที่ข้ามการบันทึกแต่ละครั้ง (ใช้จำว่าผู้ตรวจยืนยันจุดไหนแล้ว) — ไม่ใช้ลำดับใน array
    const base = [issue.type, issue.field ?? '', target.kind, target.field ?? '', target.sem ?? issue.term ?? '', target.course ?? issue.course_code ?? ''].join('|')
    seen[base] = (seen[base] ?? 0) + 1
    const key = seen[base] > 1 ? `${base}#${seen[base]}` : base
    return {
      ...issue,
      key,
      critical: issue.level === 'CRITICAL',
      title: issueTitle(issue),
      target,
      domId: targetDomId(target),
    }
  })
}

function issueTitle(issue) {
  if (issue.course_code) return `${issue.course_code}${issue.course_name ? ` · ${issue.course_name}` : ''}`
  return ISSUE_TYPE_LABELS[issue.type] ?? issue.term ?? 'ข้อสังเกต'
}

export function targetDomId(target) {
  switch (target.kind) {
    case 'field':
      return `field-student-${target.field}`
    case 'course':
      return `course-${target.sem}-${target.course}`
    case 'semester':
      return `semester-${target.sem}`
    default:
      return null
  }
}

/** สรุปสถานะเตือนของแต่ละเป้าหมาย สำหรับไฮไลต์ช่องในฟอร์ม */
export function buildTargetState(issues, resolved, activeKey) {
  const map = {}
  for (const issue of issues) {
    if (!issue.domId) continue
    const state = issue.key === activeKey ? 'active' : resolved[issue.key] ? 'resolved' : issue.critical ? 'critical' : 'warn'
    const rank = { active: 3, critical: 2, warn: 1, resolved: 0 }
    if (!map[issue.domId] || rank[state] > rank[map[issue.domId]]) map[issue.domId] = state
  }
  return map
}
