import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar, { Brand } from './Sidebar'

/** โครงหน้าหลัก: แถบเมนูซ้าย (เดสก์ท็อป) / แถบบน + ลิ้นชักเมนู (มือถือ) */
export default function AppLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-ground lg:flex">
      <div className="hidden w-[248px] shrink-0 border-r border-line bg-white shadow-[2px_0_12px_rgba(14,39,71,.04)] lg:block">
        <aside className="sticky top-0 h-screen overflow-y-auto">
          <Sidebar />
        </aside>
      </div>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <Brand compact />
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="เปิดเมนู" className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ksu-blue hover:bg-ksu-tint">
          <Menu size={22} />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูหลัก">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-pop">
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="ปิดเมนู" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-ksu-tint">
              <X size={20} />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-9 lg:pt-7">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
      </main>
    </div>
  )
}
