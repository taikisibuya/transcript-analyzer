import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { ACCEPTED_FILE_TYPES, MAX_FILE_MB } from '../../config/constants'
import { useUploads } from '../../context/uploads'
import { cn } from '../../utils/cn'

export default function Dropzone() {
  const { addFiles, openReviewerOnSingle, setOpenReviewerOnSingle } = useUploads()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="เลือกไฟล์ทรานสคริปต์เพื่ออัปโหลด"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed px-6 py-11 text-center transition-colors',
          dragging ? 'border-ksu-blue bg-ksu-tint' : 'border-ksu-sky bg-ksu-mist hover:bg-ksu-tint/70',
        )}
      >
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-[18px] bg-ksu-sky text-white">
          <Upload size={30} strokeWidth={1.8} aria-hidden />
        </span>
        <span className="text-lg font-bold sm:text-[19px]">
          {dragging ? 'ปล่อยไฟล์ที่นี่' : <>ลากไฟล์มาวางที่นี่ หรือ <span className="text-ksu-blue underline">เลือกไฟล์จากเครื่อง</span></>}
        </span>
        <span className="text-sm text-muted">
          PDF (ไฟล์ดิจิทัลหรือสแกน), JPG, PNG · เลือกหลายไฟล์พร้อมกันได้ · ไม่เกิน {MAX_FILE_MB} MB ต่อไฟล์
        </span>
        <span className="mt-1 flex flex-wrap justify-center gap-2">
          {['ภาษาไทย / อังกฤษ', 'รูปถ่ายจากมือถือ', 'แก้ภาพเอียงอัตโนมัติ', 'ตรวจไฟล์ซ้ำด้วย SHA-256'].map((t) => (
            <span key={t} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-body">{t}</span>
          ))}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3 self-start rounded-xl px-1 py-1 text-sm">
        <input type="checkbox" checked={openReviewerOnSingle} onChange={(e) => setOpenReviewerOnSingle(e.target.checked)} className="h-[18px] w-[18px]" />
        <span>เปิดหน้าตรวจทานทันทีเมื่ออัปโหลดไฟล์เดียวและประมวลผลเสร็จ</span>
      </label>
    </div>
  )
}
