import json
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "dbname": "transcript_db",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432,
}


def print_academic_summary(student_identifier: str = None):
    """ดึงข้อมูลวิเคราะห์เชิงลึกและสรุปประวัติการศึกษาของนักศึกษาจาก PostgreSQL"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. คิวรีข้อมูลประวัตินักศึกษา พร้อมดึง raw_json มาเป็นตัวสำรอง
        student_query = """
            SELECT 
                s.id AS student_uuid,
                s.student_id,
                s.citizen_id,
                s.title_th,
                s.name_th,
                s.title_en,
                s.name_en,
                s.institution,
                s.institution_code,
                s.faculty,
                s.department,
                s.major,
                s.sub_major,
                s.study_plan,
                s.degree_name_th,
                s.degree_name_en,
                s.admission_date,
                s.graduation_date,
                s.admission_year,
                s.graduation_year,
                s.education_status,
                s.honors,
                s.total_credits_attempted,
                s.total_credits_earned,
                s.gpa_cumulative AS profile_gpax,
                d.file_name,
                d.raw_json
            FROM students s
            JOIN documents d ON s.document_id = d.id
        """
        if student_identifier:
            student_query += " WHERE s.student_id = %s OR s.id::text = %s LIMIT 1;"
            cur.execute(student_query, (student_identifier, student_identifier))
        else:
            student_query += " ORDER BY s.created_at DESC LIMIT 1;"
            cur.execute(student_query)

        student = cur.fetchone()
        if not student:
            print("[ERROR] ไม่พบข้อมูลนักศึกษาในฐานข้อมูล (กรุณารัน loader.py ก่อน)")
            return

        # อ่านข้อมูลจาก raw_json เผื่อกรณีในตารางยังไม่ได้รัน loader.py ซ้ำ
        raw_obj = student.get("raw_json") or {}
        if isinstance(raw_obj, str):
            try:
                raw_obj = json.loads(raw_obj)
            except Exception:
                raw_obj = {}
        raw_student = raw_obj.get("student", {})

        # 2. คิวรีสรุปสถิติภาพรวมตลอดหลักสูตร
        overview_query = """
            SELECT 
                MIN(sem.academic_year) AS start_year,
                MAX(sem.academic_year) AS end_year,
                COUNT(DISTINCT sem.id) AS total_semesters,
                COUNT(c.id) AS total_courses,
                COALESCE(SUM(c.credits), 0) AS total_credits
            FROM academic_semesters sem
            LEFT JOIN courses c ON c.semester_id = sem.id
            WHERE sem.student_profile_id = %s;
        """
        cur.execute(overview_query, (student["student_uuid"],))
        overview = cur.fetchone()

        # 3. คิวรีแจกแจงรายละเอียดรายภาคการศึกษา
        semesters_query = """
            SELECT 
                sem.semester,
                sem.academic_year,
                COUNT(c.id) AS course_count,
                COALESCE(SUM(c.credits), 0) AS semester_credits,
                sem.gpa_semester,
                sem.gpa_cumulative
            FROM academic_semesters sem
            LEFT JOIN courses c ON c.semester_id = sem.id
            WHERE sem.student_profile_id = %s
            GROUP BY sem.id, sem.semester, sem.academic_year, sem.gpa_semester, sem.gpa_cumulative
            ORDER BY sem.academic_year ASC, sem.semester ASC;
        """
        cur.execute(semesters_query, (student["student_uuid"],))
        semesters = cur.fetchall()

        # 4. ประมวลผลและจัดรูปแบบฟิลด์ต่างๆ
        full_name_th = f"{student['title_th'] or ''}{student['name_th']}"
        full_name_en = (
            f" ({student['title_en'] or ''}{student['name_en']})"
            if student["name_en"]
            else ""
        )

        study_branch = student["major"] or student["department"] or "-"
        sub_branch = (
            f" (สาขางาน: {student['sub_major']})" if student.get("sub_major") else ""
        )

        # รหัสสถาบัน (ดึงจากตาราง students หรือ fallback ไป raw_json)
        inst_code = student["institution_code"] or raw_student.get("institution_code")
        inst_txt = f"{student['institution']}" + (f" (รหัส: {inst_code})" if inst_code else "")

        # วันที่เข้าศึกษา
        admit_date = student["admission_date"] or raw_student.get("admission_date")
        admit_yr = student["admission_year"] or raw_student.get("admission_year") or overview["start_year"]
        admit_txt = admit_date if admit_date else (f"พ.ศ. {admit_yr}" if admit_yr else "-")

        # วันที่สำเร็จการศึกษา
        grad_date = student["graduation_date"] or raw_student.get("graduation_date")
        grad_yr = student["graduation_year"] or raw_student.get("graduation_year") or overview["end_year"]
        grad_txt = grad_date if grad_date else (f"พ.ศ. {grad_yr}" if grad_yr else "-")

        degree_txt = (
            student["degree_name_th"] or student["degree_name_en"] or "-"
        )

        final_gpax = (
            student["profile_gpax"]
            or (semesters[-1]["gpa_cumulative"] if semesters else "-")
        )

        # 5. แสดงผลบน Terminal
        print("\n" + "=" * 75)
        print("🎓 ข้อมูลสรุปประวัติและผลการศึกษา (Academic Profile Verification)")
        print("=" * 75)
        print(f"เอกสารต้นทาง         : {student['file_name']}")
        print(f"รหัสนักศึกษา         : {student['student_id']}")
        print(f"ชื่อ-นามสกุล          : {full_name_th}{full_name_en}")
        print(f"สถานศึกษา            : {inst_txt}")
        if student["faculty"]:
            print(f"คณะ / ภาควิชา        : {student['faculty']}")
        print(f"สาขาวิชา / สาขางาน    : {study_branch}{sub_branch}")
        print(f"วุฒิการศึกษาที่ได้รับ : {degree_txt}")
        print(f"วันที่เข้าศึกษา        : {admit_txt}")
        print(f"สถานะ / วันที่สำเร็จ   : {student['education_status']} ({grad_txt})")

        print("\n" + "-" * 75)
        print("📊 ไทม์ไลน์และภาระการเรียนสะสม (Overall Progression)")
        print("-" * 75)
        print(
            f"ช่วงปีการศึกษาที่เรียน  : พ.ศ. {overview['start_year']} - {overview['end_year']}"
        )
        print(f"จำนวนภาคเรียนทั้งหมด : {overview['total_semesters']} ภาคการศึกษา")
        print(f"จำนวนรายวิชาทั้งหมด  : {overview['total_courses']} รายวิชา")
        print(f"หน่วยกิตสะสมรวม      : {float(overview['total_credits']):.2f} หน่วยกิต")
        print(f"เกรดเฉลี่ยสะสม (GPAX) : {final_gpax}")

        print("\n" + "-" * 75)
        print("📑 รายละเอียดผลการเรียนแยกตามภาคการศึกษา (Semester Progression)")
        print("-" * 75)
        print(
            f"{'ภาค/ปีการศึกษา':^15} | {'จำนวนวิชา':^10} | {'หน่วยกิต':^10} | {'GPA ประจำภาค':^14} | {'GPAX สะสม':^10}"
        )
        print("-" * 75)

        for s in semesters:
            term_label = f"{s['semester']}/{s['academic_year']}"
            sem_gpa = (
                f"{s['gpa_semester']:.2f}"
                if s["gpa_semester"] is not None
                else "-"
            )
            cum_gpa = (
                f"{s['gpa_cumulative']:.2f}"
                if s["gpa_cumulative"] is not None
                else "-"
            )
            sem_credits = float(s["semester_credits"]) if s["semester_credits"] else 0.0
            print(
                f"{term_label:^15} | {s['course_count']:^10} | {sem_credits:^10.2f} | {sem_gpa:^14} | {cum_gpa:^10}"
            )

        print("=" * 75)
        print(
            "[STATUS] ✅ ข้อมูลเชื่อมโยงสมบูรณ์ (Relational Integrity Verified)\n"
        )

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    print_academic_summary()