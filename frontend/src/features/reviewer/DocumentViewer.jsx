import { useState } from 'react'
import { ExternalLink, FileX, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { isImageFile } from '../../utils/documentStatus'

/** แสดงเอกสารต้นฉบับ: PDF ใช้ตัวอ่านของเบราว์เซอร์, รูปภาพมีปุ่มซูม/หมุน */
export default function DocumentViewer({ doc }) {
  const isImage = isImageFile(doc.file_name)
  const [zoom, setZoom] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [broken, setBroken] = useState(false)

  return (
    <section aria-label="เอกสารต้นฉบับ" className="flex min-h-[60vh] flex-1 flex-col bg-[#E4EBF5] lg:min-h-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D5DDEA] bg-[#EEF2F7] px-4 py-2.5">
        <span className="mr-auto text-[13px] font-semibold text-body">เอกสารต้นฉบับ{doc.page_count > 1 ? ` · ${doc.page_count} หน้า` : ''}</span>
        {isImage && (
          <>
            <IconButton icon={ZoomOut} label="ซูมออก" size={36} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} />
            <span className="min-w-[48px] text-center font-mono text-[13px]">{Math.round(zoom * 100)}%</span>
            <IconButton icon={ZoomIn} label="ซูมเข้า" size={36} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} />
            <IconButton icon={RotateCw} label="หมุนภาพ 90 องศา" size={36} onClick={() => setRotate((r) => (r + 90) % 360)} />
          </>
        )}
        <a href={doc.file_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#D5DDEA] bg-white px-3 text-[13px] font-semibold text-body hover:bg-ksu-tint hover:text-ksu-blue">
          <ExternalLink size={14} aria-hidden />เปิดแท็บใหม่
        </a>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-auto p-3 sm:p-5">
        {broken ? (
          <EmptyState icon={FileX} tone="danger" title="เปิดไฟล์ต้นฉบับไม่ได้" description="ไฟล์อาจถูกลบหรือย้ายออกจากโฟลเดอร์ uploads ของเซิร์ฟเวอร์" />
        ) : isImage ? (
          <div className="flex min-h-full items-start justify-center">
            <img
              src={doc.file_url}
              alt={`ภาพเอกสาร ${doc.file_name}`}
              onError={() => setBroken(true)}
              className="max-w-full origin-top bg-white shadow-[0_8px_28px_rgba(14,39,71,.18)] transition-transform"
              style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
            />
          </div>
        ) : (
          <iframe src={`${doc.file_url}#view=FitH`} title={`เอกสาร ${doc.file_name}`} className="min-h-[70vh] w-full flex-1 rounded-lg border-0 bg-white shadow-[0_8px_28px_rgba(14,39,71,.18)] lg:min-h-0" />
        )}
      </div>
    </section>
  )
}
