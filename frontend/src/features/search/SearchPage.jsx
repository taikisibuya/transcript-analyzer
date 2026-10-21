import { useEffect, useState } from 'react'
import { BrainCircuit, Download, SearchX } from 'lucide-react'
import { skillsApi } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Spinner from '../../components/ui/Spinner'
import { useDocuments } from '../../context/documents'
import { paths } from '../../router/paths'
import ResultCard from './ResultCard'
import SearchBox from './SearchBox'
import SearchFilters from './SearchFilters'
import { useSkillSearch } from './useSkillSearch'

export default function SearchPage() {
  const s = useSkillSearch()
  const { stats } = useDocuments()
  const [categories, setCategories] = useState([])
  const [facets, setFacets] = useState({ majors: [] })

  useEffect(() => {
    skillsApi.categories().then(setCategories).catch(() => {})
    skillsApi.facets().then(setFacets).catch(() => {})
  }, [])

  const results = s.results ?? []

  return (
    <>
      <PageHeader
        title="ค้นหานักศึกษาตามทักษะ"
        description={`พิมพ์เป็นประโยคธรรมดาได้เลย ระบบค้นจากความหมายของรายวิชา (Semantic Search) ในทรานสคริปต์ที่อนุมัติแล้ว ${stats?.approved ?? 0} ฉบับ`}
      />

      <SearchBox search={s} categories={categories} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <SearchFilters filters={s.filters} onChange={s.updateFilter} onReset={s.resetFilters} majors={facets.majors ?? []} />

        <section className="flex min-w-0 flex-1 flex-col gap-3.5" aria-live="polite">
          {!s.submitted ? (
            <Card>
              <EmptyState
                icon={BrainCircuit}
                title="เริ่มค้นหาบุคลากรตามทักษะ"
                description="เลือกหมวดทักษะด่วนด้านบน หรือพิมพ์ความสามารถที่ต้องการ เช่น “มีทักษะด้าน Machine Learning และเกรด A”"
              />
            </Card>
          ) : s.loading ? (
            <Card><Spinner label="กำลังวิเคราะห์ความหมายและค้นหา…" /></Card>
          ) : s.error ? (
            <Card><EmptyState icon={SearchX} tone="danger" title="ค้นหาไม่สำเร็จ" description={s.error} action={<Button variant="secondary" onClick={() => s.submit(s.submitted)}>ลองอีกครั้ง</Button>} /></Card>
          ) : results.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="ไม่พบนักศึกษาที่ตรงเงื่อนไข"
                description="ลองลดเกรดขั้นต่ำ ล้างตัวกรองสาขา หรือใช้คำค้นที่กว้างขึ้น"
                action={<Button variant="secondary" onClick={s.resetFilters}>ล้างตัวกรอง</Button>}
              />
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <p className="text-[15px]">
                  <b>{results.length} คน</b> <span className="text-muted">ตรงเงื่อนไข · {s.filters.sort === 'gpa' ? 'เรียงตาม GPAX' : 'จัดอันดับตามความสอดคล้องของทักษะ'}</span>
                </p>
                <div className="flex gap-2">
                  <select aria-label="เรียงตาม" value={s.filters.sort} onChange={(e) => s.updateFilter('sort', e.target.value)} className="input w-auto">
                    <option value="relevance">เรียงตาม: ตรงทักษะมากที่สุด</option>
                    <option value="gpa">เรียงตาม: GPAX สูงสุด</option>
                  </select>
                  <Button
                    variant="secondary"
                    icon={Download}
                    to={paths.export()}
                    state={{ documentIds: results.map((r) => r.document_id), label: `ผลค้นหา “${s.submitted}”`, count: results.length }}
                  >
                    ส่งออกผลลัพธ์
                  </Button>
                </div>
              </div>
              {results.map((r, i) => <ResultCard key={r.document_id} result={r} rank={i + 1} />)}
            </>
          )}
        </section>
      </div>
    </>
  )
}
