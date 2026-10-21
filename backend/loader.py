import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

GRADE_MAP = {
    "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0,
    "D+": 1.5, "D": 1.0, "F": 0.0
}

def sanitize_grade_point(raw_gp, credits_val, grade_str):
    """
    ปรับแต่งแต้มระดับคะแนน (grade_point) ให้อยู่ในช่วง 0.00 - 4.00
    โดยยึดเกรดจริงบนกระดาษ (grade_str) เป็นหลักอันดับ 1
    """
    grade_clean = str(grade_str or "").strip().upper()

    # 1. แปลงเกรดตัวเลขโดยตรง (เช่น "4.0", "3.0", "1.0")
    try:
        val = float(grade_clean)
        if 0.0 <= val <= 4.0:
            return val
    except (ValueError, TypeError):
        pass

    # 2. แปลงจากเกรดตัวอักษร
    if grade_clean in GRADE_MAP:
        return GRADE_MAP[grade_clean]

    # 3. Fallback กรณีไม่มีเกรดตัวอักษร ค่อยดู raw_gp ที่ AI ดึงมา
    if raw_gp is not None:
        try:
            gp = float(raw_gp)
            if gp > 4.0 and credits_val > 0:
                gp = round(gp / credits_val, 2)
            if 0.0 <= gp <= 4.0:
                return gp
        except (ValueError, TypeError):
            pass

    return None


def load_transcript_to_relational(document_id: str):
    """
    อ่านข้อมูล Structured JSON จากตาราง documents
    แล้วกระจายลงตาราง students, academic_semesters และ courses
    """
    with engine.connect() as conn:
        query = text("SELECT raw_json, file_name FROM documents WHERE id = :doc_id")
        row = conn.execute(query, {"doc_id": document_id}).fetchone()

        if not row or not row[0]:
            print(f"[ERROR] ไม่พบข้อมูล raw_json สำหรับ Doc ID: {document_id}")
            return False

        data = row[0]
        file_name = row[1]
        student_data = data.get("student", {})
        semesters_data = data.get("semesters", [])

    with engine.begin() as tx:
        # ลบข้อมูลเก่าของเอกสารนี้ออกก่อน ป้องกันข้อมูลซ้ำ
        tx.execute(
            text("DELETE FROM students WHERE document_id = :doc_id"),
            {"doc_id": document_id}
        )

        student_insert = text("""
            INSERT INTO students (
                document_id, student_id, citizen_id, title_th, title_en,
                name_th, name_en, institution, institution_code, faculty, 
                department, major, degree_name_th, degree_name_en, 
                admission_date, graduation_date, admission_year, graduation_year,
                education_status, total_credits_attempted, total_credits_earned,
                gpa_cumulative
            ) VALUES (
                :document_id, :student_id, :citizen_id, :title_th, :title_en,
                :name_th, :name_en, :institution, :institution_code, :faculty, 
                :department, :major, :degree_name_th, :degree_name_en, 
                :admission_date, :graduation_date, :admission_year, :graduation_year,
                :education_status, :total_credits_attempted, :total_credits_earned,
                :gpa_cumulative
            ) RETURNING id;
        """)

        admission_year = student_data.get("admission_year")
        if not admission_year:
            s_id = str(student_data.get("student_id", ""))
            admission_year = int("25" + s_id[:2]) if len(s_id) >= 2 and s_id[:2].isdigit() else 2564

        student_uuid = tx.execute(student_insert, {
            "document_id": document_id,
            "student_id": student_data.get("student_id") or "ไม่ระบุรหัส",
            "citizen_id": student_data.get("citizen_id"),
            "title_th": student_data.get("title_th"),
            "title_en": student_data.get("title_en"),
            "name_th": student_data.get("name_th") or student_data.get("name_en") or "ไม่ระบุชื่อ",
            "name_en": student_data.get("name_en"),
            "institution": student_data.get("institution") or "ไม่ระบุสถาบัน",
            "institution_code": student_data.get("institution_code"),
            "faculty": student_data.get("faculty"),
            "department": student_data.get("department"),
            "major": student_data.get("major"),
            "degree_name_th": student_data.get("degree_name_th"),
            "degree_name_en": student_data.get("degree_name_en"),
            "admission_date": student_data.get("admission_date"),
            "graduation_date": student_data.get("graduation_date"),
            "admission_year": admission_year,
            "graduation_year": student_data.get("graduation_year"),
            "education_status": student_data.get("education_status") or "กำลังศึกษา",
            "total_credits_attempted": student_data.get("total_credits_attempted") or 0.0,
            "total_credits_earned": student_data.get("total_credits_earned") or 0.0,
            "gpa_cumulative": student_data.get("gpa_cumulative") or 0.00
        }).scalar()

        total_courses_count = 0

        for sem in semesters_data:
            semester_insert = text("""
                INSERT INTO academic_semesters (
                    student_profile_id, academic_year, semester,
                    credits_attempted, credits_earned, gpa_semester, gpa_cumulative
                ) VALUES (
                    :student_profile_id, :academic_year, :semester,
                    :credits_attempted, :credits_earned, :gpa_semester, :gpa_cumulative
                ) RETURNING id;
            """)

            sem_year = sem.get("academic_year") or admission_year
            sem_term = str(sem.get("semester") or "1")

            semester_uuid = tx.execute(semester_insert, {
                "student_profile_id": student_uuid,
                "academic_year": sem_year,
                "semester": sem_term,
                "credits_attempted": sem.get("semester_credits_earned") or 0.0,
                "credits_earned": sem.get("semester_credits_earned") or 0.0,
                "gpa_semester": sem.get("semester_gpa") or 0.00,
                "gpa_cumulative": sem.get("cumulative_gpa") or 0.00
            }).scalar()

            for course in sem.get("courses", []):
                course_insert = text("""
                    INSERT INTO courses (
                        semester_id, student_profile_id, course_code,
                        course_name_th, course_name_en, credits, grade,
                        grade_point, confidence
                    ) VALUES (
                        :semester_id, :student_profile_id, :course_code,
                        :course_name_th, :course_name_en, :credits, :grade,
                        :grade_point, :confidence
                    );
                """)

                c_name_th = course.get("course_name_th") or course.get("course_name_en") or "ไม่ระบุชื่อวิชา"
                credits_val = float(course.get("credits") or 0.0)
                grade_str = str(course.get("grade") or "-")
                
                sanitized_gp = sanitize_grade_point(course.get("grade_point"), credits_val, grade_str)
                conf_val = float(course.get("confidence") or 0.95)

                tx.execute(course_insert, {
                    "semester_id": semester_uuid,
                    "student_profile_id": student_uuid,
                    "course_code": str(course.get("course_code") or "N/A"),
                    "course_name_th": c_name_th,
                    "course_name_en": course.get("course_name_en"),
                    "credits": credits_val,
                    "grade": grade_str,
                    "grade_point": sanitized_gp,
                    "confidence": conf_val
                })
                total_courses_count += 1

    print("\n[SUCCESS] นำเข้าข้อมูลสู่ฐานข้อมูลสำเร็จ:")
    print(f"- เอกสาร: {file_name} (Doc ID: {document_id})")
    print(f"- ข้อมูลนักศึกษา (Student ID UUID): {student_uuid}")
    print(f"- จำนวนภาคเรียน: {len(semesters_data)} เทอม")
    print(f"- จำนวนรายวิชาทั้งหมด: {total_courses_count} วิชา")
    return True