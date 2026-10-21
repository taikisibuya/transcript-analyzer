import { Search, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import { GRADE_FILTERS } from '../../config/constants'
import { cn } from '../../utils/cn'

export default function SearchBox({ search, categories }) {
  const { query, setQuery, submit, submitted, filters, updateFilter, clearQuery } = search
  const grade = GRADE_FILTERS.find((g) => g.value === filters.minGradePoint)

  return (
    <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[18px] shadow-soft">
      <form className="flex flex-wrap gap-2.5" onSubmit={(e) => { e.preventDefault(); submit() }} role="search">
        <label className="flex min-h-[56px] flex-[1_1_380px] items-center gap-3 rounded-[14px] border-2 border-ksu-blue px-4">
          <Search size={22} className="text-ksu-blue" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="เช่น มีทักษะด้าน Machine Learning, พัฒนาเว็บ frontend, ไมโครคอนโทรลเลอร์"
            aria-label="คำค้นหาทักษะ"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none sm:text-[17px]"
          />
        </label>
        <Button type="submit" size="lg" className="min-h-[56px] rounded-[14px] px-7 text-base" disabled={!query.trim()}>ค้นหา</Button>
      </form>

      {submitted && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">เงื่อนไขที่ใช้:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-ksu-tint py-1 pl-3 pr-1 font-semibold text-ksu-blue">
            ทักษะ ≈ “{submitted}”
            <button type="button" onClick={clearQuery} aria-label="ล้างคำค้น" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"><X size={13} /></button>
          </span>
          {grade?.value && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ksu-tint py-1 pl-3 pr-1 font-semibold text-ksu-blue">
              เกรดรายวิชา {grade.label === 'A' ? '= A' : grade.label}
              <button type="button" onClick={() => updateFilter('minGradePoint', null)} aria-label="ล้างเงื่อนไขเกรด" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"><X size={13} /></button>
            </span>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#EEF1F6] pt-3">
          <span className="mr-1 text-[13px] text-muted">หมวดทักษะด่วน</span>
          {categories.map((c) => {
            const active = submitted === c.query
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => submit(c.query)}
                className={cn(
                  'min-h-[38px] rounded-full border px-4 text-[13px] font-semibold transition-colors',
                  active ? 'border-ksu-sky bg-ksu-sky text-white' : 'border-[#D5DDEA] bg-white text-body hover:border-ksu-line hover:bg-ksu-tint',
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
