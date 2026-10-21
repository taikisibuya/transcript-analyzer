import os
import sys
import json
import time
import mimetypes
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

from preprocessor import preprocess_transcript_pipeline
from hasher import register_document
from extractor import (
    check_document_status,
    extract_transcript_with_vision,
    update_document_raw_json,
)
from validator import validate_transcript_data

try:
    from loader import load_transcript_to_relational
except ImportError:
    load_transcript_to_relational = None

try:
    from embedder import embed_all_courses
except ImportError:
    embed_all_courses = None


def save_validation_results(doc_id: str, val_report: dict, review_status: str):
    """บันทึกผลการตรวจสอบจาก Validator ลงในตาราง documents"""
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE documents 
            SET validation_status = :val_status,
                validation_report = :val_report,
                review_status = :rev_status
            WHERE id = :doc_id;
        """), {
            "doc_id": doc_id,
            "val_status": val_report.get("status", "FAILED"),
            "val_report": json.dumps(val_report, ensure_ascii=False),
            "rev_status": review_status
        })


def compute_overall_confidence(data: dict):
    """ค่าความมั่นใจรวมของเอกสาร = ค่าเฉลี่ยของความมั่นใจรายวิชาและรายฟิลด์ข้อมูลนักศึกษา"""
    values = []
    student = (data or {}).get("student") or {}
    for v in (student.get("field_confidence") or {}).values():
        try:
            values.append(float(v))
        except (TypeError, ValueError):
            pass
    for sem in (data or {}).get("semesters") or []:
        for c in sem.get("courses") or []:
            try:
                values.append(float(c.get("confidence")))
            except (TypeError, ValueError):
                pass
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def save_processing_metrics(doc_id: str, processing_ms: int, page_count: int, overall_confidence):
    """บันทึกเวลาประมวลผล จำนวนหน้า และค่าความมั่นใจรวม (ใช้ใน Dashboard / Evaluation)"""
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE documents
            SET processing_ms = :ms, page_count = :pages, overall_confidence = :conf
            WHERE id = :doc_id;
        """), {"doc_id": doc_id, "ms": processing_ms, "pages": page_count, "conf": overall_confidence})


def run_pipeline(input_file_path: str, force_reprocess: bool = False, force_load: bool = False, progress_callback=None):
    """
    กระบวนการ Pipeline ครบวงจร 5 ขั้นตอน (Strict Human-in-the-Loop):
    1. Preprocessing (OpenCV)
    2. Vision AI Extraction (Gemini -> raw_json)
    3. Automated Validation (Rule-based Math & Policy Integrity Check)
    4. Relational Database ETL (เมื่อผ่านการอนุมัติ)
    5. Vector Embeddings (เมื่อผ่านการอนุมัติ)
    """
    print("=" * 70)
    print(f"🚀 เริ่มต้น Pipeline สำหรับ: {os.path.basename(input_file_path)}")
    print("=" * 70)

    if not os.path.exists(input_file_path):
        print(f"[ERROR] ไม่พบไฟล์ที่ระบุ: {input_file_path}")
        if progress_callback:
            progress_callback(step=1, step_name="ERROR", message="ไม่พบไฟล์ในระบบ", status="FAILED")
        return None

    doc_id = None
    started_at = time.perf_counter()
    page_count = 1

    try:
        # ----------------------------------------------------
        # [ขั้นตอนที่ 1/5] Preprocessing ปรับปรุงคุณภาพเอกสาร
        # ----------------------------------------------------
        print("\n[ขั้นตอนที่ 1/5] Preprocessing ปรับปรุงคุณภาพเอกสาร...")
        if progress_callback:
            progress_callback(step=1, step_name="PREPROCESSING", message="กำลังปรับปรุงคุณภาพเอกสาร (OpenCV Deskew / 300 DPI)...")

        target_extraction_path = input_file_path
        try:
            processed_output = preprocess_transcript_pipeline(input_file_path)
            if isinstance(processed_output, list) and len(processed_output) > 0:
                if all(os.path.exists(p) for p in processed_output):
                    target_extraction_path = processed_output
                    page_count = len(processed_output)
                    print(f"-> เตรียมภาพความคมชัดสูงสำเร็จ: {len(processed_output)} หน้า")
            elif isinstance(processed_output, str) and os.path.exists(processed_output):
                target_extraction_path = processed_output
                print(f"-> เตรียมภาพความคมชัดสูงสำเร็จ: {target_extraction_path}")
        except Exception as e:
            print(f"-> [WARNING Preprocessing] {e} (ข้ามไปใช้ไฟล์ต้นฉบับแทน)")

        # ----------------------------------------------------
        # [ขั้นตอนที่ 2/5] สกัดข้อมูลด้วย Gemini Vision
        # ----------------------------------------------------
        print("\n[ขั้นตอนที่ 2/5] สกัดข้อมูลด้วย Gemini Vision...")
        doc_id, is_completed, existing_data = check_document_status(input_file_path)
        is_duplicate = is_completed and not force_reprocess

        if is_duplicate:
            print(f"-> [SKIP] พบข้อมูลเดิมในระบบแล้ว (Doc ID: {doc_id}) ข้ามการเรียก Vision AI")
            if progress_callback:
                progress_callback(
                    step=2, 
                    step_name="AI_EXTRACTION", 
                    message="ตรวจพบไฟล์ซ้ำ (SHA-256): ดึงข้อมูลเดิมจากแคช ข้ามการเรียก Vision AI", 
                    is_duplicate=True, 
                    doc_id=doc_id
                )
            structured_data = existing_data
        else:
            if progress_callback:
                progress_callback(
                    step=2, 
                    step_name="AI_EXTRACTION", 
                    message="กำลังสกัดโครงสร้างเอกสารด้วย Vision AI (Gemini)...", 
                    is_duplicate=False, 
                    doc_id=doc_id
                )

            if not doc_id:
                print("-> ลงทะเบียนเอกสารใหม่ลงตาราง documents...")
                mime_type = mimetypes.guess_type(input_file_path)[0] or "application/octet-stream"
                doc_id = register_document(input_file_path, mime_type=mime_type)
            else:
                print(f"-> ประมวลผลซ้ำสำหรับเอกสารเดิม (Doc ID: {doc_id})...")

            structured_data = extract_transcript_with_vision(target_extraction_path)
            update_document_raw_json(doc_id, structured_data)
            print(f"-> สกัดและบันทึก Structured JSON เรียบร้อย (Doc ID: {doc_id})")

        # ----------------------------------------------------
        # [ขั้นตอนที่ 3/5] Validation ตรวจสอบความสมบูรณ์และคณิตศาสตร์
        # ----------------------------------------------------
        print("\n[ขั้นตอนที่ 3/5] Automated Validation & Integrity Check...")
        if progress_callback:
            progress_callback(
                step=3, 
                step_name="VALIDATION", 
                message="กำลังตรวจสอบความถูกต้อง (Automated Math & Integrity Check)...", 
                doc_id=doc_id
            )

        val_report = validate_transcript_data(structured_data)
        val_status = val_report.get("status", "FAILED")

        if not is_duplicate:
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            save_processing_metrics(doc_id, elapsed_ms, page_count, compute_overall_confidence(structured_data))
        
        status_icons = {"PASSED": "✅", "WARNING": "⚠️", "FAILED": "❌"}
        print(f"-> ผลการประเมิน: {status_icons.get(val_status, '')} {val_status}")

        # นโยบาย Strict Human-in-the-Loop
        if not force_load:
            save_validation_results(doc_id, val_report, review_status="PENDING")
            print("\n" + "=" * 70)
            print("⏸️  [STRICT HITL] เอกสารถูกส่งเข้าคิวรอตรวจ (PENDING)")
            print(f"-> ผลประเมินเบื้องต้น: {status_icons.get(val_status, '')} {val_status}")
            print(f"-> Document ID: {doc_id}")
            print("=" * 70)

            if progress_callback:
                progress_callback(
                    step=3,
                    step_name="COMPLETED",
                    message=f"ประเมินผลสำเร็จ ({val_status}) เอกสารพร้อมให้ตรวจทาน",
                    status=val_status,
                    doc_id=doc_id,
                    issues=val_report.get("issues", [])
                )
            return doc_id

        # กรณีมีแฟล็ก --force-load
        save_validation_results(doc_id, val_report, review_status="APPROVED")
        if load_transcript_to_relational:
            load_transcript_to_relational(doc_id)
        if embed_all_courses:
            embed_all_courses()

        return doc_id

    except Exception as e:
        err_msg = str(e)
        print(f"\n❌ [CRITICAL ERROR] Pipeline ล้มเหลว: {err_msg}")
        
        fail_report = {
            "status": "FAILED",
            "is_valid": False,
            "summary": {"total_courses": 0, "calculated_graded_credits": 0.0, "issues_count": 1},
            "issues": [{
                "level": "CRITICAL",
                "term": "ระบบสกัดข้อมูล",
                "message": f"ไม่สามารถสกัดข้อมูลจากเอกสารได้: {err_msg}"
            }]
        }

        if doc_id:
            save_validation_results(doc_id, fail_report, review_status="PENDING")

        if progress_callback:
            progress_callback(
                step=3,
                step_name="FAILED",
                message=f"ระบบสกัดข้อมูลล้มเหลว: {err_msg}",
                status="FAILED",
                doc_id=doc_id,
                issues=fail_report["issues"]
            )

        return doc_id


if __name__ == "__main__":
    target_file = "transcript_sample.pdf"
    run_pipeline(target_file)