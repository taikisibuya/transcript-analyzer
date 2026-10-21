import { http } from './client'

export const skillsApi = {
  categories: () => http.get('/skills/categories').then((r) => r.data.categories ?? []),
  facets: () => http.get('/skills/facets').then((r) => r.data),
  /** params: { query, min_grade_point, min_gpa, majors[], min_similarity, sort, top_k } */
  search: (params) =>
    http
      .get('/skills/search', {
        params,
        paramsSerializer: { indexes: null }, // majors=a&majors=b (รูปแบบที่ FastAPI รับ)
      })
      .then((r) => r.data),
  studentProfile: (docId) => http.get(`/students/${docId}/skills`).then((r) => r.data),
}
