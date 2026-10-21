/** เกณฑ์ค่าความมั่นใจ — ต่ำกว่านี้ถือว่าต้องให้คนตรวจทาน (ตามสเปค Confidence < 0.85) */
export const CONFIDENCE_THRESHOLD = 0.85

/** ช่วงเวลา polling (มิลลิวินาที) */
export const POLL_PROCESSING_MS = 2500
export const POLL_TASK_MS = 1000

export const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png'
export const MAX_FILE_MB = 20

/** ตารางเทียบเกรด — ต้องตรงกับ backend/validator.py */
export const GRADE_POINTS = { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0 }
export const NON_CALCULATED_GRADES = new Set([
  'ผ', 'มผ', 'ขร', 'ขส', 'ขป', 'มม', 'มล', 'W', 'I', 'S', 'U', 'AUD', 'P', 'NP', 'PASS',
])

/** ฟิลด์ข้อมูลนักศึกษาในหน้าตรวจทาน (key ตรงกับ raw_json.student) */
export const STUDENT_FIELDS = [
  { key: 'student_id', label: 'รหัสนักศึกษา', mono: true, required: true },
  { key: 'name_th', label: 'ชื่อ-นามสกุล (ไทย)', required: true },
  { key: 'name_en', label: 'ชื่อ-นามสกุล (อังกฤษ)' },
  { key: 'citizen_id', label: 'เลขประจำตัวประชาชน', mono: true },
  { key: 'institution', label: 'สถาบัน' },
  { key: 'institution_code', label: 'รหัสสถานศึกษา', mono: true },
  { key: 'faculty', label: 'คณะ / ประเภทวิชา', placeholder: 'เช่น วิศวกรรมศาสตร์' },
  { key: 'major', label: 'สาขาวิชา' },
  { key: 'degree_name_th', label: 'วุฒิการศึกษา', wide: true },
  { key: 'admission_date', label: 'วันที่เข้าศึกษา' },
  { key: 'graduation_date', label: 'วันที่สำเร็จการศึกษา' },
  { key: 'total_credits_earned', label: 'หน่วยกิตสะสม', type: 'number', step: '0.5' },
  { key: 'gpa_cumulative', label: 'GPAX สะสม', type: 'number', step: '0.01' },
]

/** ชื่อประเภทปัญหาจาก validator เป็นภาษาคน */
export const ISSUE_TYPE_LABELS = {
  LOW_CONFIDENCE: 'ความมั่นใจต่ำ (รายวิชา)',
  LOW_CONFIDENCE_FIELD: 'ความมั่นใจต่ำ (ข้อมูลนักศึกษา)',
  GPA_MISMATCH: 'GPA ภาคไม่ตรงกับที่คำนวณ',
  CREDIT_MISMATCH: 'หน่วยกิตภาคไม่ตรง',
  TOTAL_CREDITS_MISMATCH: 'หน่วยกิตสะสมไม่ตรง',
  INVALID_GRADE: 'รูปแบบเกรดไม่ถูกต้อง',
  MISSING_FACULTY: 'ไม่พบคณะ / ประเภทวิชา',
  MISSING_MAJOR: 'ไม่พบสาขาวิชา',
  MISSING_FIELD: 'ข้อมูลสำคัญหายไป',
  MISSING_SEMESTERS: 'ไม่พบตารางผลการเรียน',
  INCOMPLETE_TRANSCRIPT: 'เอกสารไม่ครบหน้า',
  OTHER: 'อื่น ๆ',
}

/** ตัวกรองเกรดขั้นต่ำในหน้าค้นหา */
export const GRADE_FILTERS = [
  { value: 4, label: 'A' },
  { value: 3.5, label: '≥ B+' },
  { value: 3, label: '≥ B' },
  { value: null, label: 'ทั้งหมด' },
]

export const EXPORT_FORMATS = [
  { id: 'json', name: 'JSON', desc: 'AI-Ready Data Contract โครงสร้างซ้อน เหมาะกับ LLM / API' },
  { id: 'csv', name: 'CSV', desc: 'ตารางแบน 1 แถว = 1 รายวิชา เปิดใน Excel ได้' },
  { id: 'parquet', name: 'Parquet', desc: 'คอลัมน์นาร์ บีบอัด เหมาะกับ Data Pipeline' },
]
