import { ChartColumn, Download, FileCheck2, LayoutGrid, Search, Upload, Users } from 'lucide-react'
import logo from '../../assets/ksu-logo.png'
import { useDocuments } from '../../context/documents'
import { Link, NavLink } from '../../router/Router'
import { paths } from '../../router/paths'
import { cn } from '../../utils/cn'

const NAV_GROUPS = [
  {
    title: 'งานเอกสาร',
    items: [
      { to: paths.dashboard(), label: 'ภาพรวม', icon: LayoutGrid, end: true },
      { to: paths.upload(), label: 'อัปโหลดเอกสาร', icon: Upload },
      { to: paths.reviewQueue(), label: 'คิวตรวจทาน', icon: FileCheck2, badge: 'queue' },
    ],
  },
  {
    title: 'ข้อมูลและการค้นหา',
    items: [
      { to: paths.search(), label: 'ค้นหาทักษะ', icon: Search },
      { to: paths.students(), label: 'นักศึกษา', icon: Users },
      { to: paths.export(), label: 'ส่งออกข้อมูล', icon: Download },
    ],
  },
  {
    title: 'รายงาน',
    items: [{ to: paths.evaluation(), label: 'ผลการทดสอบ', icon: ChartColumn }],
  },
]

export function Brand({ compact = false }) {
  return (
    <Link to={paths.dashboard()} className="flex items-center gap-3 rounded-lg">
      <img src={logo} alt="ตรามหาวิทยาลัยกาฬสินธุ์" className={cn('shrink-0 object-contain', compact ? 'h-9 w-9' : 'h-11 w-11')} />
      <span className="min-w-0">
        <span className="block text-[15px] font-bold leading-tight text-ksu-blue">KSU Transcript AI</span>
        <span className="block text-xs text-muted">มหาวิทยาลัยกาฬสินธุ์</span>
      </span>
    </Link>
  )
}

export default function Sidebar({ onNavigate }) {
  const { reviewQueue } = useDocuments()

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="border-b border-[#E6EBF3] px-1.5 pb-[18px] pt-1">
        <Brand />
      </div>
      <nav aria-label="เมนูหลัก" className="flex flex-col gap-1">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} className="flex flex-col gap-1">
            <div className={cn('px-3.5 pb-1.5 text-[11px] font-semibold tracking-[.8px] text-subtle', gi > 0 && 'pt-4')}>{group.title}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[44px] items-center gap-3 rounded-[10px] px-3.5 text-sm transition-colors',
                    isActive
                      ? 'bg-ksu-sky font-semibold text-white shadow-[0_4px_12px_rgba(46,100,181,.28)]'
                      : 'font-medium text-[#34476A] hover:bg-[#EEF3FB] hover:text-ksu-blue',
                  )
                }
              >
                <item.icon size={18} strokeWidth={1.8} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge === 'queue' && reviewQueue.length > 0 && (
                  <span className="rounded-full bg-gold px-2 py-px text-xs font-bold text-[#3D2600]" aria-label={`${reviewQueue.length} ฉบับรอตรวจ`}>
                    {reviewQueue.length}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </div>
  )
}
