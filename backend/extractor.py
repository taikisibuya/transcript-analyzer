import os
import json
import time
from typing import Union, List
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from google import genai
from google.genai import types

# นำเข้าฟังก์ชันจาก hasher.py
from hasher import register_document, calculate_sha256

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("ไม่พบค่า GEMINI_API_KEY ในไฟล์ .env")

client = genai.Client(api_key=api_key)

PROMPT_EXTRACT_TRANSCRIPT = """
คุณคือระบบ AI ผู้เชี่ยวชาญด้านการสกัดข้อมูลใบทรานสคริปต์ทางการศึกษา (Academic Transcript Extraction)
หน้าที่ของคุณคืออ่านเอกสารใบทรานสคริปต์นี้อย่างละเอียด (แม้ว่าจะเป็นภาพถ่ายหรือภาพสแกนหลายหน้า) และสกัดข้อมูลทั้งหมดออกมาเป็นโครงสร้าง JSON ตาม Schema ด้านล่างนี้เท่านั้น:

ข้อกำหนดสำคัญในการสกัดข้อมูล:
1. สกัดตัวสะกดภาษาไทยและภาษาอังกฤษให้ถูกต้องตรงตามเอกสารจริง
2. วันที่เข้าศึกษาและวันที่สำเร็จการศึกษา ให้สกัดข้อความระบุวันที่แบบเต็มตามที่ปรากฏบนเอกสาร เช่น "16 พฤษภาคม 2565" หรือ "16 พ.ค. 2565" (หากเอกสารระบุเฉพาะปี ให้ใส่เป็นข้อความปี เช่น "พ.ศ. 2565")
3. สกัดรหัสสถานศึกษา (ถ้ามีระบุบนเอกสาร เช่น "1346016101")
4. กฎการสกัดสังกัดและสาขาวิชา (สำคัญมาก):
   - "faculty": สำหรับระดับมหาวิทยาลัยให้ดึงคำว่า "คณะ" แต่หากเป็นเอกสารระดับอาชีวศึกษา (ปวช./ปวส./วิทยาลัยเทคนิค/วิทยาลัยอาชีวศึกษา) ที่ไม่มีคำว่าคณะ ให้ดึงข้อความจากหัวข้อ "ประเภทวิชา" มาใส่แทนทันที (เช่น "อุตสาหกรรม", "บริหารธุรกิจ", "พาณิชยกรรม", "ศิลปกรรม") ห้ามใส่เป็น null หากเอกสารมีคำว่า "ประเภทวิชา" ระบุอยู่
   - "major": ให้ดึงข้อมูล "สาขาวิชา" หรือ "สาขางาน" (เช่น "เทคโนโลยีคอมพิวเตอร์")
   - "degree_name_th": ให้ดึงระดับวุฒิการศึกษา เช่น "ประกาศนียบัตรวิชาชีพชั้นสูง", "ประกาศนียบัตรวิชาชีพ", "วิศวกรรมศาสตรบัณฑิต"
5. รายวิชาทุกวิชา (courses) ต้องระบุ รหัสวิชา, ชื่อวิชา, จำนวนหน่วยกิต, และเกรดที่ได้รับ ให้ครบถ้วน
6. ประเมินค่าความเชื่อมั่น (confidence) ของแต่ละรายวิชาเป็นทศนิยมระหว่าง 0.00 ถึง 1.00 (เช่น 0.98 หรือ 0.80) ตามความคมชัดและการจัดวางของตัวอักษร
7. หากช่องใดไม่มีข้อมูลปรากฏในเอกสารจริงๆ จึงค่อยใส่ค่า null
8. ประเมินค่าความเชื่อมั่นรายฟิลด์ของข้อมูลนักศึกษาใน "field_confidence" (0.00-1.00) สำหรับ student_id, name_th, name_en, institution, faculty, major, degree_name_th, gpa_cumulative, total_credits_earned โดยให้ค่าต่ำเมื่อตัวอักษรเบลอ ถูกบัง หรือไม่แน่ใจ

โครงสร้าง JSON ที่ต้องการ:
{
  "student": {
    "student_id": "รหัสนิสิต/นักศึกษา (string)",
    "citizen_id": "เลขบัตรประชาชน (ถ้ามี)",
    "title_th": "คำนำหน้าชื่อไทย เช่น นาย หรือ นางสาว",
    "title_en": "คำนำหน้าชื่ออังกฤษ",
    "name_th": "ชื่อ-นามสกุลภาษาไทย",
    "name_en": "ชื่อ-นามสกุลภาษาอังกฤษ",
    "institution": "ชื่อสถาบันการศึกษา/มหาวิทยาลัย/วิทยาลัย",
    "institution_code": "รหัสสถานศึกษา เช่น 1346016101 (ถ้ามี)",
    "faculty": "คณะ หรือ ประเภทวิชา (กรณีอาชีวะ เช่น อุตสาหกรรม)",
    "department": "ภาควิชา (ถ้ามี)",
    "major": "สาขาวิชา หรือ สาขางาน",
    "degree_name_th": "ชื่อระดับการศึกษา/วุฒิที่ได้รับ เช่น ประกาศนียบัตรวิชาชีพชั้นสูง",
    "degree_name_en": "ชื่อปริญญา (อังกฤษ)",
    "admission_date": "วันที่เข้าศึกษาแบบเต็ม เช่น 13 พฤษภาคม 2562 (ถ้ามี)",
    "graduation_date": "วันที่สำเร็จการศึกษาแบบเต็ม เช่น 31 มีนาคม 2564 (ถ้ามี)",
    "admission_year": 2562,
    "graduation_year": 2564,
    "education_status": "สถานภาพ เช่น สำเร็จการศึกษา",
    "total_credits_attempted": 0.0,
    "total_credits_earned": 0.0,
    "gpa_cumulative": 0.00,
    "field_confidence": {
      "student_id": 0.99, "name_th": 0.97, "name_en": 0.95, "institution": 0.99,
      "faculty": 0.90, "major": 0.93, "degree_name_th": 0.94,
      "gpa_cumulative": 0.98, "total_credits_earned": 0.96
    }
  },
  "semesters": [
    {
      "academic_year": 2562,
      "semester": 1,
      "semester_gpa": 0.00,
      "semester_credits_earned": 0.0,
      "cumulative_gpa": 0.00,
      "cumulative_credits_earned": 0.0,
      "courses": [
        {
          "course_code": "รหัสวิชา เช่น 3000-1101",
          "course_name_th": "ชื่อวิชาภาษาไทย (ถ้ามี)",
          "course_name_en": "ชื่อวิชาภาษาอังกฤษ",
          "credits": 3.0,
          "grade": "3.0",
          "grade_point": 3.0,
          "confidence": 0.98
        }
      ]
    }
  ]
}
"""

def check_document_status(file_path: str):
    """ตรวจสอบสถานะเอกสารในฐานข้อมูล คืนค่า: (doc_id, is_completed, existing_json)"""
    file_hash = calculate_sha256(file_path)
    with engine.connect() as conn:
        query = text("""
            SELECT id, raw_json 
            FROM documents 
            WHERE file_hash_sha256 = :hash
        """)
        row = conn.execute(query, {"hash": file_hash}).fetchone()

        if not row:
            return None, False, None

        doc_id, raw_json = row[0], row[1]
        
        if raw_json and isinstance(raw_json, dict) and "student" in raw_json:
            return doc_id, True, raw_json
        
        return doc_id, False, None

def extract_transcript_with_vision(input_target: Union[str, List[str]], max_retries: int = 4, initial_delay: int = 4) -> dict:
    """
    ส่งไฟล์ (PDF หรือ List ของไฟล์รูปภาพที่ผ่านการ Preprocess) ไปให้ Vision AI สกัดข้อมูล
    พร้อมระบบ Auto-Retry รับมือปัญหา 503 (High Demand) และ 429 (Rate Limit)
    """
    file_paths = [input_target] if isinstance(input_target, str) else input_target

    for path in file_paths:
        if not os.path.exists(path):
            raise FileNotFoundError(f"ไม่พบไฟล์: {path}")

    uploaded_files = []

    try:
        for path in file_paths:
            print(f"กำลังอัปโหลดไฟล์ '{os.path.basename(path)}' ไปยัง Vision-LLM...")
            f = client.files.upload(file=path)
            
            while f.state.name == "PROCESSING":
                time.sleep(1)
                f = client.files.get(name=f.name)

            if f.state.name == "FAILED":
                raise RuntimeError(f"การประมวลผลไฟล์ล้มเหลว: {f.error.message}")
            
            uploaded_files.append(f)

        print(f"กำลังสกัดข้อมูลใบทรานสคริปต์ด้วย Vision AI ({len(uploaded_files)} ไฟล์/หน้า)...")

        contents = [*uploaded_files, PROMPT_EXTRACT_TRANSCRIPT]

        current_delay = initial_delay
        for attempt in range(1, max_retries + 1):
            try:
                response = client.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                result_json = json.loads(response.text)
                # บางครั้งแบบจำลองตอบเป็น list ที่มี object เดียว ให้ดึง object ข้อมูลทรานสคริปต์ออกมา
                if isinstance(result_json, list):
                    candidates = [x for x in result_json if isinstance(x, dict)]
                    with_data = [x for x in candidates if "student" in x or "semesters" in x]
                    result_json = (with_data or candidates or [None])[0]
                if not isinstance(result_json, dict):
                    raise ValueError("Vision AI ตอบกลับในรูปแบบที่ไม่ใช่ JSON object")
                return result_json

            except Exception as e:
                err_msg = str(e)
                is_transient_error = any(code in err_msg for code in ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "500", "INTERNAL"])

                if is_transient_error and attempt < max_retries:
                    print(f"[RETRY] เซิร์ฟเวอร์หนาแน่น (503/429) กำลังลองใหม่รอบที่ {attempt}/{max_retries} (รอ {current_delay} วินาที)...")
                    time.sleep(current_delay)
                    current_delay *= 2
                else:
                    raise e

    finally:
        for f in uploaded_files:
            try:
                client.files.delete(name=f.name)
            except Exception:
                pass

def update_document_raw_json(document_id: str, raw_data: dict):
    """อัปเดตข้อมูลผลลัพธ์ JSON ลงฟิลด์ raw_json ในตาราง documents"""
    with engine.connect() as conn:
        update_query = text("""
            UPDATE documents
            SET raw_json = :raw_json
            WHERE id = :doc_id;
        """)
        conn.execute(update_query, {
            "raw_json": json.dumps(raw_data, ensure_ascii=False),
            "doc_id": document_id
        })
        conn.commit()
        print(f"[UPDATED] บันทึก Structured JSON ลงตาราง documents สำเร็จ (Doc ID: {document_id})")

if __name__ == "__main__":
    pdf_filename = "transcript_sample.pdf"
    FORCE_RE_EXTRACT = True

    if not os.path.exists(pdf_filename):
        print(f"Error: ไม่พบไฟล์ '{pdf_filename}'")
        exit()

    doc_id, is_completed, existing_data = check_document_status(pdf_filename)

    if is_completed and not FORCE_RE_EXTRACT:
        print(f"[SKIP] เอกสารนี้เคยประมวลผลสมบูรณ์แล้ว (Doc ID: {doc_id}) ข้ามการเรียก Vision AI")
        structured_data = existing_data
    else:
        if not doc_id:
            print("[INFO] เอกสารใหม่ กำลังลงทะเบียน...")
            doc_id = register_document(pdf_filename, mime_type="application/pdf")
        else:
            print(f"[RE-EXTRACT] กำลังประมวลผลสกัดข้อมูลใหม่สำหรับเอกสารเดิม (Doc ID: {doc_id})...")

        structured_data = extract_transcript_with_vision(pdf_filename)
        update_document_raw_json(doc_id, structured_data)

    print("\n=== ข้อมูลใบทรานสคริปต์ที่ประมวลผลได้ ===")
    student = structured_data.get("student", {})
    print(f"ชื่อ-สกุล: {student.get('name_th')} ({student.get('name_en')})")
    print(f"รหัสนักศึกษา: {student.get('student_id')}")
    print(f"สถาบัน: {student.get('institution')} (รหัส: {student.get('institution_code')})")
    print(f"คณะ/ประเภทวิชา: {student.get('faculty')}")
    print(f"GPAX สะสม: {student.get('gpa_cumulative')}")
    print(f"จำนวนภาคเรียนที่พบ: {len(structured_data.get('semesters', []))} ภาคเรียน")
    print("=========================================")