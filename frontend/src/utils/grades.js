import { GRADE_POINTS, NON_CALCULATED_GRADES } from '../config/constants'

const toNum = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** แปลงเกรดเป็นแต้ม (คืน null ถ้าเป็นเกรดที่ไม่นำมาคิด GPA หรืออ่านไม่ได้) — ตรรกะเดียวกับ validator.py */
export function gradeToPoint(grade) {
  const g = String(grade ?? '').trim()
  if (!g) return null
  const clean = g.replace(/\./g, '').toUpperCase()
  if (NON_CALCULATED_GRADES.has(g) || NON_CALCULATED_GRADES.has(clean)) return null
  const numeric = parseFloat(g)
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 4 && /^[\d.]+$/.test(g)) return numeric
  return GRADE_POINTS[g.toUpperCase()] ?? null
}

export const isValidGrade = (grade) => {
  const g = String(grade ?? '').trim()
  if (!g) return true
  const clean = g.replace(/\./g, '').toUpperCase()
  return gradeToPoint(g) !== null || NON_CALCULATED_GRADES.has(g) || NON_CALCULATED_GRADES.has(clean)
}

/** คำนวณหน่วยกิตและ GPA ของภาคการศึกษาจากรายวิชา */
export function summarizeSemester(sem) {
  let credits = 0
  let gradedCredits = 0
  let points = 0
  for (const c of sem?.courses ?? []) {
    const cr = toNum(c.credits)
    credits += cr
    const gp = gradeToPoint(c.grade)
    if (gp !== null) {
      gradedCredits += cr
      points += cr * gp
    }
  }
  const gpa = gradedCredits > 0 ? points / gradedCredits : null
  const stated = sem?.semester_gpa === null || sem?.semester_gpa === undefined || sem?.semester_gpa === '' ? null : toNum(sem.semester_gpa)
  const truncated = gpa === null ? null : Math.floor(gpa * 100) / 100
  const gpaMatches =
    stated === null || gpa === null || Math.abs(Math.round(gpa * 100) / 100 - stated) <= 0.02 || Math.abs(truncated - stated) <= 0.02
  return { credits, gradedCredits, points, gpa, statedGpa: stated, gpaMatches }
}

export function summarizeTranscript(data) {
  const semesters = data?.semesters ?? []
  let credits = 0
  let gradedCredits = 0
  let points = 0
  let mismatched = 0
  for (const s of semesters) {
    const r = summarizeSemester(s)
    credits += r.credits
    gradedCredits += r.gradedCredits
    points += r.points
    if (!r.gpaMatches) mismatched += 1
  }
  const statedTotal = toNum(data?.student?.total_credits_earned)
  const creditsMatch = !statedTotal || Math.min(Math.abs(credits - statedTotal), Math.abs(gradedCredits - statedTotal)) <= 0.5
  return {
    semesters: semesters.length,
    courses: semesters.reduce((n, s) => n + (s.courses?.length ?? 0), 0),
    credits,
    gpax: gradedCredits > 0 ? points / gradedCredits : null,
    statedTotal: statedTotal || null,
    creditsMatch,
    mismatchedSemesters: mismatched,
  }
}

export const semesterLabel = (sem) => `ภาคการศึกษาที่ ${sem?.semester ?? '?'} / ${sem?.academic_year ?? '?'}`
