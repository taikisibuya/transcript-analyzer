import os
import sys
import json
from typing import Dict, Any, List
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

# รายการเกรดที่ไม่นำมาคิด GPA (รองรับทั้งแบบมีจุดและไม่มีจุด)
NON_CALCULATED_GRADES = {
    "ผ", "ผ.", "มผ", "ม.ผ.", "ขร", "ข.ร.", "ขส", "ข.ส.", "ขป", "ข.ป.",
    "มม", "ม.ม.", "มล", "ม.ล.", "W", "I", "S", "U", "AUD", "P", "NP", "PASS"
}

# ตารางเทียบเกรดตัวอักษรเป็นแต้มคะแนน
GRADE_MAP = {
    "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0,
    "D+": 1.5, "D": 1.0, "F": 0.0
}


def parse_numeric(val: Any, default: float = 0.0) -> float:
    """แปลงค่าตัวเลขทศนิยมอย่างปลอดภัย"""
    if val is None:
        return default
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return default


def validate_transcript_data(raw_json: Dict[str, Any], confidence_threshold: float = 0.85) -> Dict[str, Any]:
    issues: List[Dict[str, Any]] = []
    
    student = raw_json.get("student", {})
    semesters = raw_json.get("semesters", [])

    # 1. ตรวจสอบข้อมูลประวัตินักศึกษาเบื้องต้น
    if not student.get("student_id"):
        issues.append({
            "level": "CRITICAL",
            "type": "MISSING_FIELD",
            "term": "ข้อมูลส่วนตัว",
            "field": "student.student_id",
            "message": "ไม่พบรหัสนักศึกษาในเอกสาร"
        })

    if not student.get("name_th") and not student.get("name_en"):
        issues.append({
            "level": "CRITICAL",
            "type": "MISSING_FIELD",
            "term": "ข้อมูลส่วนตัว",
            "field": "student.name_th",
            "message": "ไม่พบชื่อ-นามสกุลนักศึกษา"
        })

    # ตรวจสอบ คณะ / ประเภทวิชา
    if not student.get("faculty") and not student.get("department"):
        issues.append({
            "level": "WARNING",
            "type": "MISSING_FACULTY",
            "term": "ข้อมูลส่วนตัว",
            "field": "student.faculty",
            "message": "ไม่พบข้อมูล คณะ / ประเภทวิชา (AI อาจอ่านหลุดเนื่องจากความคมชัดของภาพ) กรุณาระบุเพิ่มเติม"
        })

    # ตรวจสอบ สาขาวิชา
    if not student.get("major"):
        issues.append({
            "level": "WARNING",
            "type": "MISSING_MAJOR",
            "term": "ข้อมูลส่วนตัว",
            "field": "student.major",
            "message": "ไม่พบข้อมูล สาขาวิชา / แขนงวิชา กรุณาตรวจสอบเอกสาร"
        })

    # ตรวจสอบค่าความมั่นใจรายฟิลด์ของข้อมูลนักศึกษา (field_confidence จาก Vision-LLM)
    field_conf = student.get("field_confidence") or {}
    if isinstance(field_conf, dict):
        for f_key, f_conf in field_conf.items():
            conf_val = parse_numeric(f_conf, default=1.0)
            if conf_val < confidence_threshold and student.get(f_key) not in (None, ""):
                issues.append({
                    "level": "WARNING",
                    "type": "LOW_CONFIDENCE_FIELD",
                    "term": "ข้อมูลส่วนตัว",
                    "field": f"student.{f_key}",
                    "confidence": round(conf_val, 3),
                    "message": f"AI มั่นใจเพียง {round(conf_val * 100, 1)}% โปรดยืนยันค่าในช่องนี้"
                })

    if not semesters:
        issues.append({
            "level": "CRITICAL",
            "type": "MISSING_SEMESTERS",
            "field": "semesters",
            "message": "ไม่พบข้อมูลภาคการศึกษาหรือตารางผลการเรียน"
        })
        return {
            "is_valid": False,
            "status": "FAILED",
            "summary": {
                "total_semesters": 0,
                "total_courses": 0,
                "calculated_total_credits": 0.0,
                "calculated_graded_credits": 0.0,
                "issues_count": len(issues),
                "warning_count": 0,
                "critical_count": len(issues)
            },
            "issues": issues
        }

    total_courses_count = 0
    calculated_total_credits = 0.0
    calculated_graded_credits = 0.0
    calculated_total_points = 0.0

    # 2. ตรวจสอบระดับภาคการศึกษาและรายวิชา
    for s_idx, sem in enumerate(semesters):
        term_label = f"ภาคเรียน {sem.get('semester')}/{sem.get('academic_year')}"
        courses = sem.get("courses", [])
        total_courses_count += len(courses)

        sem_stated_credits = parse_numeric(sem.get("semester_credits_earned"))
        sem_stated_gpa = sem.get("semester_gpa")

        sem_calculated_credits = 0.0
        sem_gpa_credits = 0.0
        sem_total_points = 0.0

        for c_idx, c in enumerate(courses, start=1):
            c_code = str(c.get("course_code") or f"แถวที่ {c_idx}")
            c_name = c.get("course_name_th") or c.get("course_name_en") or "ไม่ระบุชื่อวิชา"
            c_credits = parse_numeric(c.get("credits"))
            c_grade = str(c.get("grade") or "").strip()
            c_conf = parse_numeric(c.get("confidence"), default=1.0)
            c_gp = c.get("grade_point")

            sem_calculated_credits += c_credits

            # ก. ตรวจสอบความมั่นใจของ AI (Confidence Check)
            if c_conf < confidence_threshold:
                issues.append({
                    "level": "WARNING",
                    "type": "LOW_CONFIDENCE",
                    "term": term_label,
                    "sem_index": s_idx,
                    "course_index": c_idx - 1,
                    "course_code": c_code,
                    "course_name": c_name,
                    "confidence": round(c_conf, 3),
                    "message": f"AI มั่นใจเพียง {round(c_conf * 100, 1)}% แนะนำให้ตรวจสอบตัวสะกด/เกรด"
                })

            # ข. ตรวจสอบแต้มเกรดเพื่อคำนวณ GPA
            clean_grade = c_grade.replace(".", "").strip().upper()
            is_non_calculated = (c_grade in NON_CALCULATED_GRADES) or (clean_grade in NON_CALCULATED_GRADES)

            if not is_non_calculated and c_grade != "":
                numeric_gp = None

                # แปลงตัวเลขจาก c_grade โดยตรง
                try:
                    val = float(c_grade)
                    if 0.0 <= val <= 4.0:
                        numeric_gp = val
                except ValueError:
                    pass

                # เทียบตัวอักษรมาตรฐาน
                if numeric_gp is None and c_grade.upper() in GRADE_MAP:
                    numeric_gp = GRADE_MAP[c_grade.upper()]

                # Fallback สุดท้ายถ้าไม่มีเกรดระบุ ค่อยใช้ c_gp
                if numeric_gp is None and c_gp is not None:
                    parsed_gp = parse_numeric(c_gp)
                    if parsed_gp > 4.0 and c_credits > 0:
                        parsed_gp = round(parsed_gp / c_credits, 2)
                    if 0.0 <= parsed_gp <= 4.0:
                        numeric_gp = parsed_gp

                if numeric_gp is not None:
                    sem_gpa_credits += c_credits
                    sem_total_points += (c_credits * numeric_gp)
                else:
                    issues.append({
                        "level": "WARNING",
                        "type": "INVALID_GRADE",
                        "term": term_label,
                        "sem_index": s_idx,
                        "course_index": c_idx - 1,
                        "course_code": c_code,
                        "message": f"พบรูปแบบเกรดที่อาจไม่ถูกต้อง: '{c_grade}'"
                    })

        # ค. ตรวจสอบผลรวมหน่วยกิตประจำภาค
        if sem_stated_credits > 0:
            is_match_total = abs(sem_calculated_credits - sem_stated_credits) <= 0.02
            is_match_graded = abs(sem_gpa_credits - sem_stated_credits) <= 0.02

            if not (is_match_total or is_match_graded):
                issues.append({
                    "level": "WARNING",
                    "type": "CREDIT_MISMATCH",
                    "term": term_label,
                    "sem_index": s_idx,
                    "message": (
                        f"ผลรวมหน่วยกิตรายวิชา (รวมทุกวิชา={sem_calculated_credits:.2f}, เฉพาะคิดเกรด={sem_gpa_credits:.2f}) "
                        f"ไม่ตรงกับหน่วยกิตที่เอกสารระบุ ({sem_stated_credits:.2f})"
                    )
                })

        # ง. ทวนสอบ GPA ประจำภาค
        if sem_stated_gpa is not None and sem_gpa_credits > 0:
            stated_gpa = parse_numeric(sem_stated_gpa)
            raw_gpa = sem_total_points / sem_gpa_credits
            calculated_gpa = round(raw_gpa, 2)
            truncated_gpa = int(raw_gpa * 100) / 100.0

            diff_round = abs(calculated_gpa - stated_gpa)
            diff_trunc = abs(truncated_gpa - stated_gpa)

            if diff_round > 0.02 and diff_trunc > 0.02:
                issues.append({
                    "level": "WARNING",
                    "type": "GPA_MISMATCH",
                    "term": term_label,
                    "sem_index": s_idx,
                    "calculated_gpa": calculated_gpa,
                    "stated_gpa": stated_gpa,
                    "message": (
                        f"GPA ที่คำนวณได้ ({calculated_gpa:.2f}) "
                        f"ไม่ตรงกับที่ระบุในเอกสาร ({stated_gpa:.2f})"
                    )
                })

        calculated_total_credits += sem_calculated_credits
        calculated_graded_credits += sem_gpa_credits
        calculated_total_points += sem_total_points

    # 3. ตรวจสอบภาพรวมทั้งหลักสูตร (Transcript Completeness Check)
    stated_total = parse_numeric(student.get("total_credits_earned") or student.get("total_credits_attempted"))
    if stated_total > 0:
        diff_tot = abs(calculated_total_credits - stated_total)
        diff_grd = abs(calculated_graded_credits - stated_total)
        min_diff = min(diff_tot, diff_grd)

        # หากหน่วยกิตต่างกันเกิน 6.0 แสดงว่าขาดหายไปทั้งภาคเรียน หรือเป็นเพียงใบแจ้งเกรดชั่วคราว
        if min_diff > 6.0:
            issues.append({
                "level": "CRITICAL",
                "type": "INCOMPLETE_TRANSCRIPT",
                "term": "ความสมบูรณ์ของเอกสาร",
                "message": (
                    f"เอกสารไม่สมบูรณ์หรือเป็นเพียงใบแจ้งเกรดรายภาค: พบหน่วยกิตในเอกสารเพียง {calculated_total_credits:.2f} หน่วยกิต "
                    f"จากยอดสะสมทั้งหมด {stated_total:.2f} หน่วยกิต (กรุณาแนบใบทรานสคริปต์ฉบับเต็มทุกหน้า)"
                )
            })
        elif min_diff > 0.5:
            issues.append({
                "level": "WARNING",
                "type": "TOTAL_CREDITS_MISMATCH",
                "term": "ภาพรวมหลักสูตร",
                "message": (
                    f"หน่วยกิตสะสมรวมจากทุกวิชา (รวม={calculated_total_credits:.2f}, คิดเกรด={calculated_graded_credits:.2f}) "
                    f"ไม่ตรงกับยอดรวมในประวัตินักศึกษา ({stated_total:.2f})"
                )
            })

    has_critical = any(i["level"] == "CRITICAL" for i in issues)
    has_warning = any(i["level"] == "WARNING" for i in issues)

    status = "FAILED" if has_critical else ("WARNING" if has_warning else "PASSED")

    return {
        "is_valid": not has_critical,
        "status": status,
        "summary": {
            "total_semesters": len(semesters),
            "total_courses": total_courses_count,
            "calculated_total_credits": calculated_total_credits,
            "calculated_graded_credits": calculated_graded_credits,
            "issues_count": len(issues),
            "warning_count": sum(1 for i in issues if i["level"] == "WARNING"),
            "critical_count": sum(1 for i in issues if i["level"] == "CRITICAL")
        },
        "issues": issues
    }


def get_documents_from_db(engine):
    with engine.connect() as conn:
        return conn.execute(text("""
            SELECT id, file_name, raw_json, created_at 
            FROM documents 
            WHERE raw_json IS NOT NULL AND raw_json != '{}'::jsonb
            ORDER BY created_at DESC;
        """)).fetchall()


def print_validation_report(file_name: str, doc_id: str, report: dict):
    status_icons = {"PASSED": "✅", "WARNING": "⚠️", "FAILED": "❌"}
    icon = status_icons.get(report['status'], "")

    print(f"\nกำลังตรวจสอบเอกสาร: {file_name} (ID: {doc_id}) ...")
    print("=" * 65)
    print(f"ผลการตรวจสอบ (Validation Status): {icon} {report['status']}")
    print(f"- จำนวนภาคเรียนที่พบ       : {report['summary']['total_semesters']} เทอม")
    print(f"- จำนวนรายวิชาทั้งหมด       : {report['summary']['total_courses']} วิชา")
    print(f"- หน่วยกิตรวมทุกวิชา         : {report['summary']['calculated_total_credits']:.2f} หน่วยกิต")
    print(f"- หน่วยกิตเฉพาะวิชาคิดเกรด   : {report['summary']['calculated_graded_credits']:.2f} หน่วยกิต")
    print(f"- รายการข้อสังเกต/เตือน     : {report['summary']['issues_count']} รายการ")
    print("=" * 65)

    if report["issues"]:
        print("รายการข้อผิดพลาด / ข้อสังเกตที่พบ:")
        for idx, issue in enumerate(report["issues"], start=1):
            lvl = issue["level"]
            term = f"[{issue.get('term')}] " if issue.get("term") else ""
            msg = issue["message"]
            print(f"  {idx}. [{lvl}] {term}{msg}")
    else:
        print("✅ ข้อมูลสมบูรณ์ 100% ไม่พบข้อผิดพลาดหรือความผิดปกติทางคณิตศาสตร์")


def run_batch_validation(docs):
    print(f"\n🚀 กำลังตรวจสอบเอกสารทั้งหมด {len(docs)} ฉบับในฐานข้อมูล ...\n")
    print(f"{'ลำดับ':^5} | {'ชื่อเอกสาร':<32} | {'สถานะ':^10} | {'วิชา':^6} | {'ข้อผิดพลาด/เตือน':^15}")
    print("-" * 75)

    passed_cnt, warn_cnt, fail_cnt = 0, 0, 0

    for idx, d in enumerate(docs, start=1):
        _, file_name, raw_data, _ = d
        if isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        
        rep = validate_transcript_data(raw_data)
        st = rep["status"]
        if st == "PASSED": passed_cnt += 1
        elif st == "WARNING": warn_cnt += 1
        else: fail_cnt += 1

        disp_name = (file_name[:29] + "..") if len(file_name) > 31 else file_name
        print(f"{idx:^5} | {disp_name:<32} | {st:^10} | {rep['summary']['total_courses']:^6} | {rep['summary']['issues_count']:^15}")

    print("-" * 75)
    print(f"📊 สรุปภาพรวม: ✅ PASSED: {passed_cnt} | ⚠️ WARNING: {warn_cnt} | ❌ FAILED: {fail_cnt}\n")


if __name__ == "__main__":
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ERROR] กรุณาตั้งค่า DATABASE_URL ในไฟล์ .env")
        sys.exit(1)

    db_engine = create_engine(db_url)
    all_docs = get_documents_from_db(db_engine)

    if not all_docs:
        print("[ERROR] ไม่พบเอกสารที่มี raw_json ในฐานข้อมูล")
        sys.exit(1)

    if len(sys.argv) > 1 and sys.argv[1].lower() in ["--all", "-a", "all"]:
        run_batch_validation(all_docs)
        sys.exit(0)

    target_doc = None
    if len(sys.argv) > 1:
        keyword = sys.argv[1].lower()
        matches = [d for d in all_docs if keyword in d[1].lower() or keyword == str(d[0])]
        if matches:
            target_doc = matches[0]

    if not target_doc:
        print("\n📂 เลือกเอกสารที่ต้องการตรวจสอบ:")
        for idx, d in enumerate(all_docs, start=1):
            print(f"  [{idx}] {d[1]}")
        print(f"  [A] ตรวจสอบเอกสารทั้งหมดพร้อมกัน (Batch Summary)")

        choice = input(f"\nเลือก [1-{len(all_docs)}] หรือ 'A' (กด Enter เพื่อเลือกเอกสารล่าสุด [1]): ").strip()
        if choice.upper() == "A":
            run_batch_validation(all_docs)
            sys.exit(0)
        elif not choice:
            target_doc = all_docs[0]
        else:
            try:
                c_idx = int(choice) - 1
                target_doc = all_docs[c_idx] if 0 <= c_idx < len(all_docs) else all_docs[0]
            except ValueError:
                target_doc = all_docs[0]

    raw_json_data = target_doc[2]
    if isinstance(raw_json_data, str):
        raw_json_data = json.loads(raw_json_data)

    val_report = validate_transcript_data(raw_json_data)
    print_validation_report(target_doc[1], target_doc[0], val_report)