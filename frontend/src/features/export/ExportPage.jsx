import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, Download } from 'lucide-react'
import { exportApi, getErrorMessage } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import Spinner from '../../components/ui/Spinner'
import { EXPORT_FORMATS } from '../../config/constants'
import { useDocuments } from '../../context/documents'
import { useFeedback } from '../../context/feedback'
import { useLocation } from '../../router/hooks'
import { cn } from '../../utils/cn'
import { downloadBlob } from '../../utils/download'
import { formatBytes } from '../../utils/format'

function StepTitle({ n, children }) {
  return (
    <h2 className="mb-3.5 flex items-center gap-2.5 text-base font-bold">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ksu-sky text-xs font-bold text-white">{n}</span>
      {children}
    </h2>
  )
}

export default function ExportPage() {
  const { state } = useLocation()
  const { approved } = useDocuments()
  const { toast } = useFeedback()

  // ขอบเขตข้อมูล: จากหน้าค้นหา/โปรไฟล์ (ส่งผ่าน router state) หรือทั้งหมดที่อนุมัติแล้ว
  const scopes = useMemo(() => {
    const list = []
    if (state?.documentIds?.length) list.push({ id: 'selection', title: state.label ?? 'รายการที่เลือก', desc: `${state.documentIds.length} คน`, ids: state.documentIds })
    list.push({ id: 'all', title: 'ทั้งหมดที่อนุมัติแล้ว', desc: `${approved.length} คน`, ids: null })
    return list
  }, [state, approved.length])

  const [scopeId, setScopeId] = useState(scopes[0].id)
  const [format, setFormat] = useState('json')
  const [includeConfidence, setIncludeConfidence] = useState(true)
  const [maskCitizen, setMaskCitizen] = useState(true)
  const [previewResult, setPreviewResult] = useState({ key: null, data: null, error: null })
  const [downloading, setDownloading] = useState(false)

  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]
  const body = useMemo(
    () => ({
      document_ids: scope.ids,
      format,
      include_confidence: includeConfidence,
      mask_citizen_id: maskCitizen,
      file_label: scope.id === 'all' ? 'ksu_all_approved' : 'ksu_selection',
    }),
    [scope, format, includeConfidence, maskCitizen],
  )

  // ตัวอย่างไฟล์: ขอใหม่ทุกครั้งที่ตัวเลือกเปลี่ยน (หน่วงเล็กน้อยกันการยิงถี่)
  const bodyKey = JSON.stringify(body)
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      exportApi.preview(body).then(
        (data) => alive && setPreviewResult({ key: bodyKey, data, error: null }),
        (err) => alive && setPreviewResult({ key: bodyKey, data: null, error: getErrorMessage(err) }),
      )
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [body, bodyKey])
  const preview = { ...previewResult, loading: previewResult.key !== bodyKey }

  const download = async () => {
    setDownloading(true)
    try {
      const { blob, fileName } = await exportApi.download(body)
      downloadBlob(blob, fileName)
      toast.success(`ดาวน์โหลด ${fileName} แล้ว`)
    } catch (err) {
      toast.error(`ส่งออกไม่สำเร็จ: ${getErrorMessage(err)}`)
    } finally {
      setDownloading(false)
    }
  }

  const fmt = EXPORT_FORMATS.find((f) => f.id === format)

  return (
    <>
      <PageHeader title="ส่งออกข้อมูล AI-Ready" description="เลือกข้อมูลและรูปแบบไฟล์ แล้วดูตัวอย่างก่อนดาวน์โหลด — ส่งออกได้เฉพาะเอกสารที่อนุมัติแล้ว (หรือที่เลือกมา)" />

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-col gap-[18px] xl:w-[440px] xl:shrink-0">
          <Card className="p-5">
            <StepTitle n={1}>ข้อมูลที่จะส่งออก</StepTitle>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="ขอบเขตข้อมูล">
              {scopes.map((s) => (
                <label key={s.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5', s.id === scope.id ? 'border-ksu-blue bg-ksu-mist' : 'border-[#D5DDEA] hover:bg-ksu-mist')}>
                  <input type="radio" name="scope" checked={s.id === scope.id} onChange={() => setScopeId(s.id)} className="mt-0.5 h-[18px] w-[18px]" />
                  <span><b className="text-sm">{s.title}</b><span className="block text-[13px] text-muted">{s.desc}</span></span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <StepTitle n={2}>รูปแบบไฟล์</StepTitle>
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="รูปแบบไฟล์">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={format === f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn('flex min-h-[56px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-left', format === f.id ? 'border-2 border-ksu-blue bg-ksu-mist' : 'border border-[#D5DDEA] bg-white hover:bg-ksu-mist')}
                >
                  <span className="w-[72px] shrink-0 font-mono text-[15px] font-bold">{f.name}</span>
                  <span className="text-xs leading-snug text-muted">{f.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-2 p-5">
            <StepTitle n={3}>ตัวเลือก</StepTitle>
            <label className="flex min-h-[36px] cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={includeConfidence} onChange={(e) => setIncludeConfidence(e.target.checked)} className="h-[18px] w-[18px]" />แนบค่าความมั่นใจ (confidence) รายฟิลด์</label>
            <label className="flex min-h-[36px] cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={maskCitizen} onChange={(e) => setMaskCitizen(e.target.checked)} className="h-[18px] w-[18px]" />ปกปิดเลขประจำตัวประชาชน (แสดงเฉพาะ 4 หลักท้าย)</label>
          </Card>
        </div>

        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-ksu-sky px-[18px] py-3.5 text-white">
            <div>
              <div className="text-[15px] font-bold">ตัวอย่างไฟล์</div>
              <div className="font-mono text-xs text-[#DCE8F8]">{preview.data?.file_name ?? '—'}</div>
            </div>
            {format === 'json' && <span className="inline-flex items-center gap-1.5 text-xs font-semibold"><CircleCheck size={14} aria-hidden />ตรงตาม AI-Ready Data Contract</span>}
          </div>
          {preview.loading && !preview.data ? (
            <Spinner label="กำลังสร้างตัวอย่าง…" className="min-h-[380px]" />
          ) : preview.error ? (
            <p role="alert" className="m-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-text">{preview.error}</p>
          ) : (
            <pre className={cn('min-h-[380px] flex-1 overflow-auto whitespace-pre bg-ksu-mist p-[18px] font-mono text-[13px] leading-relaxed text-body transition-opacity', preview.loading && 'opacity-50')}>{preview.data?.preview}</pre>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EBF3] px-[18px] py-3.5">
            <span className="text-[13px] text-muted">
              {preview.data ? `${preview.data.students} นักศึกษา · ${preview.data.rows} รายวิชา · ${formatBytes(preview.data.size_bytes)}` : '—'}
            </span>
            <Button size="lg" icon={Download} loading={downloading} disabled={!preview.data || !!preview.error} onClick={download}>
              ดาวน์โหลด {fmt.name}
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
