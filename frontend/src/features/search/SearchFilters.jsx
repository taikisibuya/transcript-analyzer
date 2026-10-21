import Card from '../../components/ui/Card'
import { Segmented } from '../../components/ui/Tabs'
import { GRADE_FILTERS } from '../../config/constants'

export default function SearchFilters({ filters, onChange, onReset, majors }) {
  const toggleMajor = (name) =>
    onChange('majors', filters.majors.includes(name) ? filters.majors.filter((m) => m !== name) : [...filters.majors, name])

  return (
    <Card as="aside" aria-label="ตัวกรอง" className="flex flex-col gap-5 p-[18px] lg:w-[260px] lg:shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">ตัวกรอง</h2>
        <button type="button" onClick={onReset} className="min-h-[32px] text-[13px] font-semibold text-ksu-blue hover:underline">ล้างทั้งหมด</button>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-semibold">เกรดของรายวิชาที่ตรง</div>
        <Segmented options={GRADE_FILTERS} value={filters.minGradePoint} onChange={(v) => onChange('minGradePoint', v)} label="เกรดขั้นต่ำ" />
      </div>

      <div>
        <label htmlFor="min-gpa" className="mb-2 flex justify-between text-[13px] font-semibold">
          <span>GPAX ขั้นต่ำ</span>
          <span className="font-mono text-ksu-blue">{filters.minGpa > 0 ? filters.minGpa.toFixed(2) : 'ไม่กำหนด'}</span>
        </label>
        <input id="min-gpa" type="range" min="0" max="4" step="0.25" value={filters.minGpa} onChange={(e) => onChange('minGpa', Number(e.target.value))} className="w-full" />
        <div className="flex justify-between text-xs text-muted"><span>0.00</span><span>4.00</span></div>
      </div>

      {majors.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold">สาขาวิชา</legend>
          {majors.map((m) => (
            <label key={m.name} className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={filters.majors.includes(m.name)} onChange={() => toggleMajor(m.name)} className="h-[18px] w-[18px]" />
              <span className="flex-1">{m.name}</span>
              <span className="text-xs text-muted">{m.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div>
        <label htmlFor="min-sim" className="mb-2 block text-[13px] font-semibold">ความคล้ายขั้นต่ำ</label>
        <select id="min-sim" value={filters.minSimilarity} onChange={(e) => onChange('minSimilarity', Number(e.target.value))} className="input">
          <option value={0}>ทุกระดับ</option>
          <option value={60}>60% ขึ้นไป</option>
          <option value={70}>70% ขึ้นไป</option>
          <option value={80}>80% ขึ้นไป</option>
        </select>
      </div>
    </Card>
  )
}
