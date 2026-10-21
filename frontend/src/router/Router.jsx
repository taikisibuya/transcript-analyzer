/**
 * Router ขนาดเล็กบน History API (ใช้แทน react-router-dom โดยไม่เพิ่ม dependency)
 * - ทุกหน้ามี URL ของตัวเอง, ปุ่ม Back/Forward ของเบราว์เซอร์ใช้งานได้, รีเฟรชแล้วยังอยู่หน้าเดิม
 * - Components: <RouterProvider>, <Routes>, <Link>, <NavLink>, <Navigate>
 * - Hooks (router/hooks.js): useNavigate(), useParams(), useLocation(), useSearchParams()
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { matchPath, ParamsContext, RouterContext, useNavigate, useRouter } from './hooks'

function readLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    state: window.history.state?.usr ?? null,
  }
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const onPop = () => setLocation(readLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to, { replace = false, state = null } = {}) => {
    if (typeof to === 'number') {
      window.history.go(to)
      return
    }
    const url = new URL(to, window.location.origin)
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method]({ usr: state }, '', url.pathname + url.search + url.hash)
    setLocation({ pathname: url.pathname, search: url.search, state })
    if (!url.hash) window.scrollTo({ top: 0 })
  }, [])

  const value = useMemo(() => ({ location, navigate }), [location, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

/** routes: [{ path, element }] — แสดงเส้นทางแรกที่ตรง, path "*" = หน้าไม่พบ */
export function Routes({ routes }) {
  const { location } = useRouter()
  for (const route of routes) {
    const params = route.path === '*' ? {} : matchPath(route.path, location.pathname)
    if (params) return <ParamsContext.Provider value={params}>{route.element}</ParamsContext.Provider>
  }
  return null
}

function isModifiedClick(e) {
  return e.metaKey || e.altKey || e.ctrlKey || e.shiftKey || e.button !== 0
}

export function Link({ to, state, replace, onClick, target, ...rest }) {
  const navigate = useNavigate()
  const handleClick = (e) => {
    onClick?.(e)
    if (e.defaultPrevented || isModifiedClick(e) || target === '_blank') return
    e.preventDefault()
    navigate(to, { state, replace })
  }
  return <a href={to} onClick={handleClick} target={target} {...rest} />
}

/** className รับเป็น function ({ isActive }) => string ได้ */
export function NavLink({ to, end = false, className, children, ...rest }) {
  const { location } = useRouter()
  const isActive = end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`)
  const cls = typeof className === 'function' ? className({ isActive }) : className
  return (
    <Link to={to} className={cls} aria-current={isActive ? 'page' : undefined} {...rest}>
      {typeof children === 'function' ? children({ isActive }) : children}
    </Link>
  )
}

export function Navigate({ to, replace = true, state }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace, state })
  }, [navigate, to, replace, state])
  return null
}
