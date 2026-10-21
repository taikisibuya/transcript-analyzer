import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage, skillsApi } from '../../api'

const DEFAULT_FILTERS = { minGradePoint: 4, minGpa: 0, majors: [], minSimilarity: 0, sort: 'relevance' }
const CLEARED_FILTERS = { minGradePoint: null, minGpa: 0, majors: [], minSimilarity: 0, sort: 'relevance' }

const toParams = (q, f) => ({
  query: q,
  min_grade_point: f.minGradePoint ?? undefined,
  min_gpa: f.minGpa > 0 ? f.minGpa : undefined,
  majors: f.majors.length ? f.majors : undefined,
  min_similarity: f.minSimilarity || undefined,
  sort: f.sort,
  top_k: 20,
})

/** สถานะการค้นหาทักษะ + ตัวกรอง (ค้นหาใหม่อัตโนมัติเมื่อเปลี่ยนตัวกรองหลังจากค้นหาไปแล้ว) */
export function useSkillSearch() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState({ key: null, results: null, error: null })

  const params = useMemo(() => (submitted ? toParams(submitted, filters) : null), [submitted, filters])
  const key = params ? `${JSON.stringify(params)}#${retry}` : null

  useEffect(() => {
    if (!params) return undefined
    let alive = true
    skillsApi.search(params).then(
      (data) => alive && setResult({ key, results: data.results ?? [], error: null }),
      (err) => alive && setResult({ key, results: [], error: getErrorMessage(err, 'ค้นหาไม่สำเร็จ') }),
    )
    return () => {
      alive = false
    }
  }, [params, key])

  const submit = useCallback(
    (q = query) => {
      setQuery(q)
      setSubmitted(q.trim())
      setRetry((n) => n + 1)
    },
    [query],
  )
  const clearQuery = useCallback(() => {
    setSubmitted('')
    setQuery('')
  }, [])
  const updateFilter = useCallback((k, value) => setFilters((f) => ({ ...f, [k]: value })), [])
  const resetFilters = useCallback(() => setFilters(CLEARED_FILTERS), [])

  const fresh = result.key === key
  return {
    query, setQuery, submitted, submit, clearQuery,
    filters, updateFilter, resetFilters,
    results: submitted ? (fresh ? result.results : null) : null,
    error: fresh ? result.error : null,
    loading: !!submitted && !fresh,
  }
}
