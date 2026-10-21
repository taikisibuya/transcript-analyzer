import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from google import genai
from google.genai import types

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("ไม่พบค่า DATABASE_URL ในไฟล์ .env")

engine = create_engine(DATABASE_URL)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("ไม่พบค่า GEMINI_API_KEY ในไฟล์ .env")

client = genai.Client(api_key=api_key)

# ใช้ชื่อโมเดลที่มีในระบบของคุณ
EMBEDDING_MODEL = "models/gemini-embedding-001"

def generate_embedding(text_content: str) -> list[float]:
    """สร้าง Vector 768 มิติจากข้อความโดยใช้ gemini-embedding-001"""
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text_content,
        config=types.EmbedContentConfig(
            output_dimensionality=768  # ล็อกมิติให้ตรงกับ Schema vector(768) ของ Postgres
        )
    )
    if hasattr(response, 'embedding') and response.embedding:
        return response.embedding.values
    return response.embeddings[0].values

def embed_all_courses():
    """ดึงรายวิชาที่ยังไม่มี Vector มาสร้างและบันทึกลงฐานข้อมูล"""
    with engine.connect() as conn:
        # ดึงเฉพาะวิชาที่คอลัมน์ embedding ยังเป็น NULL
        query = text("""
            SELECT id, course_code, course_name_th, course_name_en 
            FROM courses 
            WHERE embedding IS NULL
            ORDER BY course_code;
        """)
        rows = conn.execute(query).fetchall()

        if not rows:
            print("[INFO] ทุกรายวิชาในฐานข้อมูลมี Vector Embedding ครบถ้วนแล้ว ไม่ต้องประมวลผลเพิ่ม")
            return

        total_courses = len(rows)
        print(f"[START] พบรายวิชาที่ต้องสร้าง Embedding ทั้งหมด: {total_courses} วิชา\n")

        success_count = 0

        for idx, row in enumerate(rows, start=1):
            course_id = row[0]
            code = row[1] or ""
            name_th = row[2] or ""
            name_en = row[3] or ""

            # รวมรหัสและชื่อวิชาทั้งไทย-อังกฤษ เพื่อให้ Semantic คลุมทั้ง 2 ภาษา
            content_to_embed = f"{code} {name_th} {name_en}".strip()

            try:
                vector_values = generate_embedding(content_to_embed)

                # แปลงเป็น JSON format สำหรับ Cast เข้า pgvector
                vector_str = json.dumps(vector_values)

                # อัปเดตพิกัดเวกเตอร์ลงตาราง courses
                update_query = text("""
                    UPDATE courses
                    SET embedding = (:vec)::vector
                    WHERE id = :cid;
                """)
                conn.execute(update_query, {
                    "vec": vector_str,
                    "cid": course_id
                })
                conn.commit()

                success_count += 1
                print(f"[{idx}/{total_courses}] สำเร็จ: {code} - {name_th}")

            except Exception as e:
                print(f"[{idx}/{total_courses}] ล้มเหลว: {code} ({str(e)})")

        print(f"\n[COMPLETED] อัปเดต Vector Embedding สำเร็จทั้งหมด {success_count}/{total_courses} วิชา")

if __name__ == "__main__":
    embed_all_courses()