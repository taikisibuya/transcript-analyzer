# KSU Transcript AI — ระบบสกัดและแปลงใบทรานสคริปต์ดิจิทัลแบบ AI-Ready

โครงงานวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยกาฬสินธุ์

ระบบรับใบทรานสคริปต์ทั้ง **PDF, JPG และ PNG** แล้วทำงานตามลำดับนี้:
1. ปรับปรุงภาพด้วย **OpenCV**
2. สกัดข้อมูลนักศึกษาและตารางรายวิชาด้วย **Vision-LLM (Gemini)** พร้อม**ค่าความมั่นใจรายฟิลด์**
3. ตรวจความถูกต้องทางคณิตศาสตร์ (หน่วยกิตและ GPA)
4. ให้คนตรวจทานแบบ **Side-by-Side (Human-in-the-Loop)**
5. จัดเก็บเป็นข้อมูล **AI-Ready** ใน PostgreSQL ที่รวม JSONB, ตารางเชิงสัมพันธ์ และเวกเตอร์ (pgvector) ไว้ในที่เดียว ค้นหาทักษะเชิงความหมายได้ และส่งออกเป็น JSON, CSV หรือ Parquet

## ภาพรวมระบบ

```mermaid
flowchart LR
    subgraph M1["Module 1 · Ingestion & Pre-processing"]
        UP["อัปโหลด<br/>PDF / JPG / PNG"] --> HASH["SHA-256<br/>ตรวจไฟล์ซ้ำ"]
        HASH --> PRE["OpenCV<br/>300 DPI · Deskew<br/>CLAHE · Auto-crop"]
    end

    subgraph M2["Module 2 · Extraction & Validation"]
        EXT["Gemini Vision<br/>JSON + confidence"] --> VAL["Validator<br/>หน่วยกิต · GPA · เกรด"]
    end

    subgraph M3["Module 3 · Human-in-the-Loop"]
        REV["หน้าตรวจทาน<br/>Side-by-Side<br/>เตือนเมื่อ &lt; 0.85"]
    end

    subgraph M4["Module 4 · AI-Ready Data Layer"]
        DB[("PostgreSQL 16<br/>JSONB + Relational<br/>+ pgvector HNSW")]
        EMB["gemini-embedding-001<br/>768 มิติ"]
    end

    subgraph M5["Module 5 · Web & API"]
        API["FastAPI"]
        WEB["React + Vite<br/>Dashboard · Search · Export"]
    end

    PRE --> EXT
    VAL --> REV
    REV -- อนุมัติ --> DB
    DB --> EMB --> DB
    DB <--> API <--> WEB
```

| Module | หน้าที่ | ไฟล์หลัก |
|---|---|---|
| 1 | รับไฟล์ ตรวจไฟล์ซ้ำด้วย SHA-256 แปลง PDF เป็นภาพ 300 DPI แก้ภาพเอียง ปรับความเปรียบต่าง (CLAHE) และตัดขอบ | `backend/hasher.py`, `backend/preprocessor.py` |
| 2 | สกัดส่วนหัวและตารางรายวิชาด้วย Gemini Vision เป็น JSON พร้อมค่าความมั่นใจ แล้วตรวจผลรวมหน่วยกิต, GPA รายภาค และรูปแบบเกรด | `backend/extractor.py`, `backend/validator.py` |
| 3 | หน้าตรวจทาน เอกสารต้นฉบับอยู่ซ้าย ฟอร์มอยู่ขวา เน้นช่องที่ต้องตรวจ และต้องยืนยันครบก่อนอนุมัติ | `frontend/src/features/reviewer/` |
| 4 | นำเข้าตารางเชิงสัมพันธ์ (students, academic_semesters, courses) และสร้างเวกเตอร์รายวิชาสำหรับค้นหาเชิงความหมาย | `backend/loader.py`, `backend/embedder.py`, `init.sql` |
| 5 | REST API และเว็บ: ภาพรวม, อัปโหลด, ตรวจทาน, ค้นหาทักษะ, โปรไฟล์นักศึกษา, ส่งออก และผลการทดสอบ | `backend/main.py`, `backend/export_utils.py`, `frontend/` |

## โครงสร้าง repo

```
backend/
  main.py             FastAPI — API ทั้งหมด + Pipeline เบื้องหลัง
  pipeline.py         รัน Pipeline ครบวงจรจากบรรทัดคำสั่ง
  preprocessor.py     OpenCV: 300 DPI, deskew, CLAHE, auto-crop
  extractor.py        Gemini Vision → JSON + confidence (retry อัตโนมัติ)
  validator.py        กฎตรวจหน่วยกิต / GPA / เกรด → PASSED · WARNING · FAILED
  loader.py           JSONB → ตารางเชิงสัมพันธ์
  embedder.py         สร้างเวกเตอร์รายวิชา (768 มิติ)
  export_utils.py     AI-Ready Data Contract → JSON / CSV / Parquet
  evaluation/         สคริปต์วัดความแม่นยำ เวลา และการแก้ภาพเอียง
  Dockerfile
frontend/             React 19 + Vite + Tailwind (เสิร์ฟด้วย Nginx ใน Docker)
migrations/           ปรับโครงสร้างฐานข้อมูลเดิมโดยไม่ลบข้อมูล
init.sql              สร้างตาราง ดัชนี และ pgvector อัตโนมัติ
docker-compose.yml    db + backend + frontend (+ ngrok ไม่บังคับ)
```

## ติดตั้งแบบเร็ว: Docker

ต้องมี **Docker Desktop** (บน Windows ให้เปิด WSL 2) และ **Gemini API Key** จาก [Google AI Studio](https://aistudio.google.com)

```bash
git clone https://github.com/taikisibuya/transcript-analyzer && cd transcript-analyzer
cp .env.example .env          # ใส่ GEMINI_API_KEY (และ NGROK_AUTHTOKEN ถ้าใช้)
docker compose up -d --build  # ครั้งแรกใช้เวลาหลายนาที
docker compose ps             # ทุกบริการต้อง Up และ db ต้อง healthy
```

| บริการ | URL |
|---|---|
| หน้าเว็บ | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| ngrok (ไม่บังคับ) | http://localhost:4040 — ดู URL สาธารณะ |

> ถ้ามีฐานข้อมูลเดิมอยู่แล้ว (volume เดิม) ให้รัน
> `docker exec -i transcript-db psql -U postgres -d transcript_db < migrations/001_ui_redesign.sql`

## ติดตั้งแบบพัฒนา (แก้โค้ดแล้วเห็นผลทันที)

ต้องมี Python 3.11+ และ Node.js 20+

1. **ฐานข้อมูล:** `docker compose up -d db`
2. **Backend:** สร้างไฟล์ `backend/.env` โดยใส่ `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transcript_db` และ `GEMINI_API_KEY=...` แล้วรัน
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
3. **Frontend:** รันคำสั่งต่อไปนี้ แล้วเปิด http://localhost:5173 (Vite ส่งต่อ `/api` ไปพอร์ต 8000 ให้)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ใช้งาน

| หน้า | ทำอะไร |
|---|---|
| ภาพรวม | จำนวนเอกสารตามสถานะ, ค่าความมั่นใจเฉลี่ย, เวลาต่อหน้า, คิวเอกสาร, งานที่ควรทำถัดไป |
| อัปโหลดเอกสาร | ลากวางหลายไฟล์ (ไม่เกิน 20 MB/ไฟล์) แล้วติดตามสถานะทีละขั้น: ปรับภาพ → สกัด → ตรวจสอบ → พร้อมตรวจทาน |
| คิวตรวจทาน | Side-by-Side เทียบต้นฉบับ แก้ค่า ยืนยันทีละจุด แล้วอนุมัติ ปุ่มลัด: `J`/`K` เลื่อน, `Enter` ยืนยัน, `Ctrl+S` บันทึก |
| ค้นหาทักษะ | ค้นหาเชิงความหมาย (ไทย/อังกฤษ) พร้อมตัวกรองเกรดและความคล้ายขั้นต่ำ แสดงรายวิชาที่เป็นหลักฐาน |
| นักศึกษา | โปรไฟล์: GPAX, กราฟ GPA รายภาค, โปรไฟล์ทักษะ, แหล่งที่มา (SHA-256, confidence) |
| ส่งออกข้อมูล | JSON / CSV / Parquet ตาม AI-Ready Data Contract เลือกแนบ confidence และปกปิดเลขบัตรประชาชนได้ |
| ผลการทดสอบ | ความแม่นยำจาก `evaluation.json` และเวลาประมวลผลรายเอกสาร |

**สถานะของเอกสาร:** ผลตรวจอัตโนมัติมี 3 ค่า (`PASSED` / `WARNING` / `FAILED`) ส่วนสถานะการตรวจทานเป็น `PENDING` → `APPROVED` (หรือ `REJECTED`) ข้อมูลจะเข้าตารางเชิงสัมพันธ์และสร้างเวกเตอร์ก็ต่อเมื่อคนอนุมัติแล้วเท่านั้น (Strict HITL)

## ผลการทดสอบ

ทดสอบกับใบทรานสคริปต์ภาษาไทย 9 ฉบับ (17 หน้า) วัดด้วย `backend/evaluation/evaluate.py`

| ตัวชี้วัด | ผล |
|---|---|
| ความแม่นยำรวมทุกฟิลด์ | **97.78%** |
| F1 ของแถวรายวิชา | **99.14%** (TP 344 · FP 3 · FN 3) |
| เกรด / GPA รายภาค / GPAX | 100% |
| ชื่อวิชาภาษาไทย | 93.90% |
| เวลาเฉลี่ยต่อหน้า | 38.1 วินาที (98.5% เป็นเวลารอ Gemini API) |
| แก้ภาพเอียง ±1°–±10° | สำเร็จ 99.4% (169/170 กรณี) คลาดเคลื่อนเฉลี่ย 0.02° |

```bash
cd backend
python evaluation/export_ground_truth.py   # สร้างเฉลยจากเอกสารที่อนุมัติแล้ว
python evaluation/evaluate.py skew         # ทดสอบการแก้ภาพเอียง
python evaluation/evaluate.py extract      # สกัด + จับเวลา (รันซ้ำได้ ข้ามไฟล์ที่ทำแล้ว)
python evaluation/evaluate.py score        # → results/evaluation.json, per_document.csv
```

## ความปลอดภัยและข้อมูลส่วนบุคคล

- ใบทรานสคริปต์เป็นข้อมูลส่วนบุคคล (PDPA) **repo นี้ไม่เก็บเอกสารจริง** โฟลเดอร์ `uploads/`, `preprocessed_output/` และชุดข้อมูลทดสอบถูกระบุใน `.gitignore`
- รหัสลับทั้งหมด (`GEMINI_API_KEY`, `NGROK_AUTHTOKEN`) อยู่ใน `.env` ซึ่งถูกระบุใน `.gitignore` ให้ใช้ `.env.example` เป็นแม่แบบ
- ไฟล์ส่งออกปกปิดเลขประจำตัวประชาชนเหลือ 4 หลักท้ายได้
- ระบบยังไม่มีการยืนยันตัวตนผู้ใช้ ห้ามเปิดผ่าน ngrok ทิ้งไว้ขณะมีข้อมูลจริงในระบบ

## ข้อจำกัด

- ค่าความมั่นใจของโมเดลยังแยกแถวที่ผิดไม่ได้ (แถวที่ผิดเฉลี่ย 0.977 ส่วนแถวที่ถูก 0.979) ระบบจึงพึ่งกฎตรวจทางคณิตศาสตร์และการตรวจทานโดยคน
- ชุดทดสอบยังมีเฉพาะเอกสารภาษาไทยแบบ PDF ยังไม่ได้วัดผลกับเอกสารภาษาอังกฤษและภาพถ่าย
- สถานะงานที่กำลังประมวลผลเก็บในหน่วยความจำ หายเมื่อรีสตาร์ต backend
- Gemini API แบบฟรีมีโควตาต่อวัน เมื่อโควตาหมดจะได้ `429 RESOURCE_EXHAUSTED`

## เทคโนโลยี

FastAPI · SQLAlchemy · PostgreSQL 16 + pgvector · OpenCV · PyMuPDF · Google Gemini (google-genai) · pandas / PyArrow · React 19 · Vite · Tailwind CSS · Docker Compose · Nginx
