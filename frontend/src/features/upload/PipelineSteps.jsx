import { cn } from '../../utils/cn'

const STEPS = ['ปรับภาพ', 'สกัดข้อมูล', 'ตรวจสอบ', 'พร้อมตรวจทาน']
const STYLE = {
  done: 'bg-success-soft text-success',
  run: 'bg-ksu-tint text-ksu-blue',
  warn: 'bg-warning-soft text-warning-text',
  fail: 'bg-danger-soft text-danger-text',
  todo: 'bg-ground text-subtle',
}
const PREFIX = { done: '✓ ', run: '● ', fail: '✕ ', warn: '! ', todo: '' }

/** สถานะ 4 ขั้นของไฟล์ จาก task ของ backend (step 1-3 + status) */
function stepStates(item) {
  if (item.phase === 'failed') return ['fail', 'todo', 'todo', 'todo']
  if (item.phase !== 'processing' && item.phase !== 'done') return ['todo', 'todo', 'todo', 'todo']
  const t = item.task
  if (!t) return ['run', 'todo', 'todo', 'todo']
  if (t.status === 'FAILED') return t.step >= 3 ? ['done', 'done', 'fail', 'todo'] : ['done', 'fail', 'todo', 'todo']
  if (t.status === 'WARNING') return ['done', 'done', 'warn', 'warn']
  if (t.status === 'PASSED') return ['done', 'done', 'done', 'done']
  return [0, 1, 2, 3].map((i) => (i < t.step - 1 ? 'done' : i === t.step - 1 ? 'run' : 'todo'))
}

export default function PipelineSteps({ item }) {
  const states = stepStates(item)
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="ขั้นตอนการประมวลผล">
      {STEPS.map((label, i) => (
        <li key={label} className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', STYLE[states[i]], states[i] === 'run' && 'animate-pulse')}>
          {PREFIX[states[i]]}{label}
        </li>
      ))}
    </ol>
  )
}
