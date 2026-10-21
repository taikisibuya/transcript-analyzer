import json
import os
import sys
from dotenv import load_dotenv
from google import genai
from google.genai import types
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("ไม่พบค่า DATABASE_URL ในไฟล์ .env")

engine = create_engine(DATABASE_URL)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("ไม่พบค่า GEMINI_API_KEY ในไฟล์ .env")

client = genai.Client(api_key=api_key)

# ใช้โมเดล gemini-embedding-001 ตรงตามที่ทำ Vector ไว้ในฐานข้อมูล
EMBEDDING_MODEL = "models/gemini-embedding-001"


def get_query_embedding(query_text: str) -> list[float]:
    """แปลงคำค้นหาให้เป็นเวกเตอร์ 768 มิติ"""
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query_text,
        config=types.EmbedContentConfig(output_dimensionality=768),
    )
    if hasattr(response, "embedding") and response.embedding:
        return response.embedding.values
    return response.embeddings[0].values


def search_courses_by_skill(query: str, top_k: int = 5):
    """ค้นหารายวิชาที่ตรงกับคำค้นหาโดยใช้ Cosine Distance (<=>) ของ pgvector"""
    print(f"\n🔍 กำลังค้นหาวิชาที่เกี่ยวข้องกับ: '{query}' ...\n")
    query_vector = get_query_embedding(query)
    vector_str = json.dumps(query_vector)

    with engine.connect() as conn:
        # คำนวณ Cosine Similarity: 1 - (embedding <=> query_vector)
        sql = text("""
            SELECT 
                course_code,
                course_name_th,
                course_name_en,
                credits,
                grade,
                (1 - (embedding <=> (:q_vec)::vector)) AS similarity
            FROM courses
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> (:q_vec)::vector ASC
            LIMIT :k;
        """)

        results = conn.execute(
            sql, {"q_vec": vector_str, "k": top_k}
        ).fetchall()

        if not results:
            print("ไม่พบข้อมูลรายวิชาในฐานข้อมูล")
            return

        print(
            f"{'รหัสวิชา':<12} | {'ชื่อวิชา (TH / EN)':<45} | {'หน่วยกิต':<8} | {'เกรด':<6} | {'ความตรงสาย':<10}"
        )
        print("-" * 90)
        for row in results:
            code = row[0] or "-"
            en_part = f" ({row[2]})" if row[2] else ""
            name = f"{row[1] or ''}{en_part}"
            if len(name) > 42:
                name = name[:39] + "..."
            credits = row[3] if row[3] is not None else "-"
            grade = row[4] or "-"
            sim_score = float(row[5]) * 100 if row[5] is not None else 0.0

            print(
                f"{code:<12} | {name:<45} | {str(credits):<8} | {grade:<6} | {sim_score:.2f}%"
            )


if __name__ == "__main__":
    # รับคำค้นหาจากคำสั่งใน Terminal หรือใช้ค่าดีฟอลต์หากไม่ได้ระบุ
    search_query = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "พัฒนาเว็บ frontend backend"
    )
    search_courses_by_skill(search_query, top_k=5)