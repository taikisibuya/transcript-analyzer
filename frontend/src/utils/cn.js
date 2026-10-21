/** รวม className แบบมีเงื่อนไข: cn('a', cond && 'b') */
export const cn = (...classes) => classes.filter(Boolean).join(' ')
