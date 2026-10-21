import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

def load_transcript_to_relational(document_id: str):
    """
    อ่านข้อมูล Structured JSON จากตาราง documents
    แล้วกระจายลงตาราง students, academic_semesters และ courses
    โดยใช้ Database Transaction (หากเกิดข้อผิดพลาดจะ Rollback อัตโนมัติ)
    """
    with engine.connect() as conn:
        # 1. ดึง raw_json จากตาราง documents
        query = text("SELECT raw_json, file_name FROM documents WHERE id = :doc_id")
        row = conn.execute(query, {"doc_id": document_id}).fetchone()

        if not row or not row[0]:
            print(f"[ERROR] ไม่พบข้อมูล raw_json สำหรับ Doc ID: {document_id}")
            return False

        data = row[0]
        file_name = row[1]
        student_data = data.get("student", {})
        semesters_data = data.get("semesters", [])

    # 2. เริ่ม Transaction บันทึกข้อมูลลงตารางสัมพันธ์
    with engine.begin() as tx:
        # ป้องกันข้อมูลซ้ำ: ลบข้อมูลเดิมของเอกสารนี้ออกก่อน (Cascade จะลบเทอมและวิชาให้อัตโนมัติ)
        tx.execute(
            text("DELETE FROM students WHERE document_id = :doc_id"),
            {"doc_id": document_id}
        )

        # ----------------------------------------------------
        # บันทึกข้อมูลตาราง students (เพิ่ม 3 ฟิลด์ใหม่)
        # ----------------------------------------------------
        student_insert = text("""
            INSERT INTO students (
                document_id, student_id, citizen_id, title_th, title_en,
                name_th, name_en, institution, institution_code,
                faculty, department, major, degree_name_th, degree_name_en,
                admission_date, graduation_date, admission_year, graduation_year,
                education_status, total_credits_attempted, total_credits_earned,
                gpa_cumulative
            ) VALUES (
                :document_id, :student_id, :citizen_id, :title_th, :title_en,
                :name_th, :name_en, :institution, :institution_code,
                :faculty, :department, :major, :degree_name_th, :degree_name_en,
                :admission_date, :graduation_date, :admission_year, :graduation_year,
                :education_status, :total_credits_attempted, :total_credits_earned,
                :gpa_cumulative
            ) RETURNING id;
        """)

        # Fallback ป้องกันค่า NULL ในคอลัมน์ปี
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

        # ----------------------------------------------------
        # บันทึกข้อมูลตาราง academic_semesters และ courses
        # ----------------------------------------------------
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

            # บันทึกแต่ละวิชาในเทอมนั้นๆ
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

                tx.execute(course_insert, {
                    "semester_id": semester_uuid,
                    "student_profile_id": student_uuid,
                    "course_code": str(course.get("course_code") or "N/A"),
                    "course_name_th": c_name_th,
                    "course_name_en": course.get("course_name_en"),
                    "credits": course.get("credits") or 0.0,
                    "grade": str(course.get("grade") or "-"),
                    "grade_point": course.get("grade_point"),
                    "confidence": 0.950
                })
                total_courses_count += 1

    print("\n[SUCCESS] นำเข้าข้อมูลสู่ฐานข้อมูลสมบูรณ์:")
    print(f"- เอกสาร: {file_name} (Doc ID: {document_id})")
    print(f"- ข้อมูลนักศึกษา (Student ID UUID): {student_uuid}")
    print(f"- จำนวนภาคเรียนที่บันทึก: {len(semesters_data)} เทอม")
    print(f"- จำนวนรายวิชาทั้งหมดที่บันทึก: {total_courses_count} วิชา")
    return True

if __name__ == "__main__":
    with engine.connect() as conn:
        latest_doc = conn.execute(text("""
            SELECT id, file_name 
            FROM documents 
            WHERE raw_json IS NOT NULL AND raw_json != '{}'::jsonb
            ORDER BY created_at DESC 
            LIMIT 1;
        """)).fetchone()

    if latest_doc:
        doc_id = latest_doc[0]
        print(f"พบเอกสารล่าสุด: {latest_doc[1]} (ID: {doc_id}) กำลังนำเข้าข้อมูล...")
        load_transcript_to_relational(doc_id)
    else:
        print("ไม่พบเอกสารที่มี raw_json ในระบบ กรุณารัน extractor.py ก่อน")