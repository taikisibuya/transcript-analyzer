import { LoaderCircle } from 'lucide-react'
import { Link } from '../../router/Router'
import { cn } from '../../utils/cn'

const VARIANTS = {
  primary: 'border-transparent bg-ksu-blue text-white hover:bg-ksu-deep disabled:bg-[#E6EBF3] disabled:text-muted',
  secondary: 'bg-white text-body border-[#D5DDEA] hover:bg-ksu-mist hover:border-ksu-line disabled:text-subtle',
  tonal: 'border-transparent bg-ksu-tint text-ksu-blue hover:bg-[#DCE7F7]',
  success: 'border-transparent bg-success text-white hover:bg-[#186540] disabled:bg-[#E6EBF3] disabled:text-muted',
  danger: 'border-transparent bg-danger text-white hover:bg-[#A8321F]',
  'danger-ghost': 'border-transparent bg-transparent text-danger-text hover:bg-danger-soft',
  ghost: 'border-transparent bg-transparent text-body hover:bg-ksu-tint hover:text-ksu-blue',
  inverse: 'border-transparent bg-white text-ksu-blue hover:bg-ksu-mist shadow-[0_4px_12px_rgba(10,40,90,.2)]',
}
const SIZES = {
  sm: 'min-h-[36px] px-3 text-[13px]',
  md: 'min-h-[40px] px-4 text-sm',
  lg: 'min-h-[48px] px-[22px] text-[15px]',
}

/** ปุ่มมาตรฐานของระบบ — ส่ง `to` เพื่อให้เป็นลิงก์ภายในแอป หรือ `href` สำหรับลิงก์ภายนอก */
export default function Button({
  variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading = false,
  to, href, className, children, disabled, type = 'button', ...rest
}) {
  const cls = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border font-semibold transition-colors',
    'disabled:cursor-not-allowed', VARIANTS[variant], SIZES[size], className,
  )
  const content = (
    <>
      {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : Icon && <Icon size={16} aria-hidden />}
      {children}
      {IconRight && <IconRight size={16} aria-hidden />}
    </>
  )
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>
  return <button type={type} className={cls} disabled={disabled || loading} {...rest}>{content}</button>
}

export function IconButton({ icon: Icon, label, className, size = 40, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px] border border-[#D5DDEA] bg-white text-body transition-colors hover:bg-ksu-tint hover:text-ksu-blue disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon size={16} aria-hidden />
    </button>
  )
}
