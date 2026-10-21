import { http } from './client'

export const statsApi = {
  get: () => http.get('/stats').then((r) => r.data),
}
