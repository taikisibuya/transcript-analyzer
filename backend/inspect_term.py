import os
import sys
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))
NON_CALC = {"ผ.", "ม.ผ.", "ข.ร.", "ข.ส.", "ข.ป.", "W", "I", "S", "U", "AUD"}


def get_available_documents():
    with engine.connect() as conn:
        query = text("""
            SELECT id, file_name, created_at 
            FROM documents 
            WHERE raw_json IS NOT NULL AND raw_json != '{}'::jsonb
            ORDER BY created_at DESC;
        """)
        return conn.execute(query).fetchall()


def select_document(doc_query=None):
    docs = get_available_documents()
    if not docs:
        print("[ERROR] ไม่พบเอกสารที่มี raw_json ในฐานข้อมูล")
        return None

    if doc_query:
        matches = [d for d in docs if doc_query.lower() in d[1].lower() or doc_query == str(d[0])]
        if matches:
            return matches[0]

    print("\n📂 รายการเอกสารทั้งหมดในฐานข้อมูล:")
    for idx, d in enumerate(docs, start=1):
        print(f"  [{idx}] {d[1]} (สร้างเมื่อ: {d[2].strftime('%Y-%m-%d %H:%M')})")

    while True:
        try:
            choice = input(f"\nเลือกเอกสาร [1-{len(docs)}] (กด Enter เพื่อเลือกเอกสารล่าสุด [1]): ").strip()
            if not choice:
                return docs[0]
            choice_idx = int(choice) - 1
            if 0 <= choice_idx < len(docs):
                return docs[choice_idx]
            print(f"กรุณากรอกตัวเลขระหว่าง 1 ถึง {len(docs)}")
        except ValueError:
            print("กรุณากรอกตัวเลขที่ถูกต้อง")


def inspect_semester(doc_record, target_sem=None, target_year=None):
    doc_id, file_name = doc_record[0], doc_record[1]

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT raw_json FROM documents WHERE id = :doc_id"),
            {"doc_id": doc_id}
        ).fetchone()

    raw_json_data = row[0]
    if isinstance(raw_json_data, str):
        raw_json_data = json.loads(raw_json_data)

    semesters = raw_json_data.get("semesters", [])
    if not semesters:
        print(f"[!] เอกสาร {file_name} ไม่มีข้อมูลภาคการศึกษา")
        return

    print(f"\n{'='*95}")
    print(f"📂 เอกสาร: {file_name} (ID: {doc_id})")
    print(f"📊 ภาพรวมภาคเรียนทั้งหมดในเอกสารนี้:")
    for sem in semesters:
        s_no = sem.get("semester")
        y_no = sem.get("academic_year")
        courses = sem.get("courses", [])
        sum_total = sum(float(c.get("credits") or 0.0) for c in courses)
        sum_graded = sum(float(c.get("credits") or 0.0) for c in courses if str(c.get("grade") or "").strip() not in NON_CALC)
        stated_c = float(sem.get("semester_credits_earned") or 0.0)
        
        is_ok = abs(sum_total - stated_c) <= 0.02 or abs(sum_graded - stated_c) <= 0.02
        status_icon = "✅" if is_ok else "⚠️"
        print(f"   {status_icon} ภาคเรียน {s_no}/{y_no} -> {len(courses)} วิชา | รวมทั้งหมด: {sum_total:.2f} | คิดเกรด: {sum_graded:.2f} | เอกสารระบุ: {stated_c:.2f}")
    print(f"{'='*95}")

    if not target_sem or not target_year:
        term_input = input("\nพิมพ์ 'ภาค/ปี' ที่ต้องการดู (เช่น 1/2565) หรือกด Enter เพื่อดูเทอมแรก: ").strip()
        if "/" in term_input:
            target_sem, target_year = term_input.split("/")
        else:
            target_sem = semesters[0].get("semester")
            target_year = semesters[0].get("academic_year")

    found = False
    for sem in semesters:
        sem_no = str(sem.get("semester") or "").strip()
        year = str(sem.get("academic_year") or "").strip()

        if sem_no == str(target_sem).strip() and year == str(target_year).strip():
            found = True
            courses = sem.get("courses", [])
            stated_credits = sem.get("semester_credits_earned")

            print(f"\n🎯 รายละเอียดวิชาประจำภาคเรียน {sem_no}/{year}:")
            print(f"{'ลำดับ':^5} | {'รหัสวิชา':^12} | {'ชื่อวิชา':<38} | {'หน่วยกิต':^8} | {'เกรด':^6} | {'ความมั่นใจ':^12}")
            print("-" * 95)

            sum_total = 0.0
            sum_graded = 0.0
            for idx, c in enumerate(courses, start=1):
                code = str(c.get("course_code") or "-")
                name = str(c.get("course_name_th") or c.get("course_name_en") or "-")
                credits = float(c.get("credits") or 0.0)
                grade = str(c.get("grade") or "-").strip()
                conf = float(c.get("confidence") or 1.0)
                
                sum_total += credits
                if grade not in NON_CALC:
                    sum_graded += credits

                display_name = (name[:35] + "..") if len(name) > 37 else name
                print(f"{idx:^5} | {code:^12} | {display_name:<38} | {credits:^8.2f} | {grade:^6} | {conf * 100:>10.1f}%")

            print("-" * 95)
            print(f"📊 ผลรวมหน่วยกิตทุกวิชา (Total)       : {sum_total:.2f} หน่วยกิต")
            print(f"🎯 ผลรวมเฉพาะวิชาคิดเกรด (Graded)     : {sum_graded:.2f} หน่วยกิต")
            print(f"📑 หน่วยกิตที่ระบุในเอกสาร (Stated)     : {float(stated_credits or 0):.2f} หน่วยกิต")
            
            if abs(sum_graded - float(stated_credits or 0)) <= 0.02:
                print("✅ หน่วยกิตตรงกันพอดี (ตรงตามเกณฑ์หน่วยกิตคิดเกรดของอาชีวะ)")
            elif abs(sum_total - float(stated_credits or 0)) <= 0.02:
                print("✅ หน่วยกิตตรงกันพอดี (ตรงตามเกณฑ์หน่วยกิตรวมทั้งหมด)")
            else:
                print("⚠️  มีส่วนต่างที่ไม่ตรงกับเอกสาร แนะนำให้ตรวจดูตารางด้านบน")
            break

    if not found:
        print(f"[!] ไม่พบข้อมูลภาคเรียน {target_sem}/{target_year}")


if __name__ == "__main__":
    doc_arg = sys.argv[1] if len(sys.argv) > 1 else None
    sem_arg = sys.argv[2] if len(sys.argv) > 2 else None
    year_arg = sys.argv[3] if len(sys.argv) > 3 else None

    chosen_doc = select_document(doc_arg)
    if chosen_doc:
        inspect_semester(chosen_doc, sem_arg, year_arg)