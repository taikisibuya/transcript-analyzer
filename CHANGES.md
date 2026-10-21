# UI Redesign (KSU Theme) — สรุปการเปลี่ยนแปลง

## วิธีนำไปใช้

1. คัดลอกไฟล์ทั้งหมดในโฟลเดอร์นี้ทับโปรเจคเดิม (ไฟล์ `.env`, `venv/`, `node_modules/`, `uploads/` ของคุณยังใช้ต่อได้)
2. อัปเดตฐานข้อมูลที่มีอยู่ (รันซ้ำได้อย่างปลอดภัย):
   ```bash
   docker exec -i transcript-db psql -U postgres -d transcript_db < migrations/001_ui_redesign.sql
   ```
   ถ้าสร้างฐานข้อมูลใหม่ด้วย `docker compose up` ไม่ต้องรัน เพราะ `init.sql` แก้ให้แล้ว
3. Backend: `pip install -r backend/requirements.txt` แล้ว `uvicorn main:app --reload` (ในโฟลเดอร์ backend)
4. Frontend: `cd frontend && npm install && npm run dev` (เปิด http://localhost:5173)
   — production: `npm run build` แล้ว FastAPI จะเสิร์ฟ `frontend/dist` ให้เอง

> ไม่มี dependency ใหม่ฝั่ง frontend — ระบบเปลี่ยนหน้าใช้ router ขนาดเล็กที่เขียนเองใน `src/router/`

## โครงสร้าง Frontend

```
src/
├── api/            เรียก API ทั้งหมด (documents, stats, skills, exporter)
├── components/
│   ├── layout/     AppLayout, Sidebar
│   └── ui/         Button, Badge, ConfidenceChip, Card, Modal, Tabs, EmptyState, ...
├── config/         constants.js — เกณฑ์ 0.85, ตารางเกรด, ฟิลด์นักศึกษา, ชื่อประเภทปัญหา
├── context/        DocumentsProvider, UploadProvider, FeedbackProvider (+ hooks)
├── features/
│   ├── dashboard/  ภาพรวม + คิวเอกสาร
│   ├── upload/     อัปโหลด + ติดตาม pipeline
│   ├── reviewer/   ตรวจทาน Side-by-Side (HITL)
│   ├── search/     ค้นหาทักษะเชิงความหมาย
│   ├── students/   รายชื่อ + โปรไฟล์นักศึกษา
│   ├── export/     ศูนย์ส่งออก JSON / CSV / Parquet
│   └── evaluation/ ผลการทดสอบ (Accuracy & Latency)
├── hooks/          useDeleteDocument
├── router/         Router.jsx, hooks.js, paths.js
└── utils/          grades (คำนวณ GPA), issues, documentStatus, format, ...
```

## Backend ที่แก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `main.py` | แก้ค้นหาทักษะให้ JOIN ผ่าน `students` (เดิม JOIN `c.document_id` ที่ไม่มีอยู่จริง จึงไม่ได้ชื่อนักศึกษา), รวมผลเป็นรายคน + ตัวกรอง GPAX/สาขา/เกรดขั้นต่ำ, เพิ่ม `/api/stats`, `/api/skills/categories`, `/api/skills/facets`, `/api/students/{id}/skills`, `POST /api/export` (หลายคน + preview), ตั้งชื่อไฟล์อัปโหลดไม่ให้ทับกัน, รองรับชื่อไฟล์ภาษาไทยตอนดาวน์โหลด, แก้การลบเอกสาร |
| `export_utils.py` (ใหม่) | แปลงข้อมูลเป็น AI-Ready Data Contract ตามสเปคข้อ 3 และตารางแบนสำหรับ CSV/Parquet |
| `pipeline.py` | บันทึกเวลาประมวลผล, จำนวนหน้า, ค่าความมั่นใจรวม, mime type ตามชนิดไฟล์จริง |
| `extractor.py` | prompt ขอ `field_confidence` รายฟิลด์ของข้อมูลนักศึกษา |
| `validator.py` | เตือนฟิลด์นักศึกษาที่ความมั่นใจ < 0.85 และระบุตำแหน่ง (`sem_index`, `course_index`, `field`) ให้หน้าตรวจทานชี้ไปยังช่องที่ถูกต้อง — ตรรกะคำนวณ GPA เดิมไม่เปลี่ยน |
| `requirements.txt` | เพิ่มแพ็กเกจที่ขาด (`python-multipart`, `opencv-python`, `pymupdf`, `google-genai`, `pandas`, `pyarrow`, `numpy`) |
| `init.sql` + `migrations/001_ui_redesign.sql` | เพิ่มคอลัมน์ `validation_status`, `validation_report`, `processing_ms` และให้ `review_status` รับค่า `APPROVED` |

## หมายเหตุ

- จุดที่ผู้ตรวจกด "ยืนยัน" ถูกเก็บใน `raw_json._review.verified` จึงไม่ต้องยืนยันซ้ำหลังบันทึก (loader/export ไม่อ่านฟิลด์นี้)
- หน้า "ผลการทดสอบ": เวลาต่อหน้าคำนวณจากข้อมูลจริง ส่วนความแม่นยำต้องเทียบกับชุดเฉลย — วางผลเป็น `frontend/public/evaluation.json` (หน้าเว็บแสดงตัวอย่างรูปแบบไฟล์ไว้)
