import { Link } from '../../router/Router'

/** หัวหน้าเพจ: breadcrumb (optional) + หัวข้อสีน้ำเงิน KSU + คำอธิบาย + ปุ่มด้านขวา */
export default function PageHeader({ title, description, eyebrow, breadcrumbs, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs && (
          <nav aria-label="breadcrumb" className="mb-1.5 text-[13px] text-muted">
            {breadcrumbs.map((b, i) => (
              <span key={b.label}>
                {i > 0 && <span className="mx-1.5">/</span>}
                {b.to ? <Link to={b.to} className="text-ksu-blue hover:underline">{b.label}</Link> : b.label}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <div className="text-[13px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.2px] text-ksu-blue sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  )
}
