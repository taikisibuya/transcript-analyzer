/** Context + hooks ของ router (แยกจากไฟล์ component เพื่อให้ Fast Refresh ทำงานได้) */
import { createContext, useContext, useMemo } from 'react'

export const RouterContext = createContext(null)
export const ParamsContext = createContext({})

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}

export const useNavigate = () => useRouter().navigate
export const useLocation = () => useRouter().location
export const useParams = () => useContext(ParamsContext)

export function useSearchParams() {
  const { location } = useRouter()
  return useMemo(() => new URLSearchParams(location.search), [location.search])
}

/** เทียบ path กับรูปแบบ เช่น "/review/:docId" — คืนค่า params หรือ null */
export function matchPath(pattern, pathname) {
  const clean = (p) => p.replace(/\/+$/, '') || '/'
  const pParts = clean(pattern).split('/')
  const uParts = clean(pathname).split('/')
  if (pParts.length !== uParts.length) return null
  const params = {}
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = decodeURIComponent(uParts[i])
    else if (pParts[i] !== uParts[i]) return null
  }
  return params
}
