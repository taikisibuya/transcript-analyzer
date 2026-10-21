import hashlib
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def calculate_sha256(file_path: str) -> str:
    """คำนวณค่า SHA-256 ของไฟล์เพื่อใช้เป็น Fingerprint ประจำเอกสาร"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def register_document(file_path: str, mime_type: str = "application/pdf"):
    """บันทึกข้อมูลเอกสารลงตาราง documents พร้อมระบบ Deduplication"""
    if not os.path.exists(file_path):
        print(f"Error: ไม่พบไฟล์ที่ตำแหน่ง {file_path}")
        return None

    file_name = os.path.basename(file_path)
    file_hash = calculate_sha256(file_path)
    print(f"File: {file_name}")
    print(f"SHA-256: {file_hash}")

    with engine.connect() as conn:
        # ตรวจสอบว่าเคยมี Hash นี้ในระบบแล้วหรือไม่
        check_query = text("SELECT id, file_name FROM documents WHERE file_hash_sha256 = :hash")
        existing_doc = conn.execute(check_query, {"hash": file_hash}).fetchone()

        if existing_doc:
            print(f"[DUPLICATE] ตรวจพบไฟล์ซ้ำในระบบ (Doc ID: {existing_doc[0]})")
            return existing_doc[0]

        # บันทึกข้อมูลเอกสารใหม่
        insert_query = text("""
            INSERT INTO documents (
                file_name, file_path, file_hash_sha256, mime_type, raw_json
            ) VALUES (
                :file_name, :file_path, :file_hash, :mime_type, '{}'::jsonb
            ) RETURNING id;
        """)
        result = conn.execute(insert_query, {
            "file_name": file_name,
            "file_path": file_path,
            "file_hash": file_hash,
            "mime_type": mime_type
        })
        conn.commit()
        new_id = result.scalar()
        print(f"[SUCCESS] บันทึกเอกสารใหม่เรียบร้อย (Doc ID: {new_id})")
        return new_id

if __name__ == "__main__":
    # จำลองไฟล์ทดสอบ
    dummy_path = "sample_transcript.txt"
    with open(dummy_path, "w", encoding="utf-8") as f:
        f.write("Test Transcript File Content")

    # ทดสอบบันทึกครั้งที่ 1 (ต้องผ่าน [SUCCESS])
    doc_id = register_document(dummy_path, "text/plain")

    # ทดสอบบันทึกซ้ำครั้งที่ 2 (ต้องแจ้งเตือน [DUPLICATE])
    register_document(dummy_path, "text/plain")

    # ลบไฟล์จำลองหลังทดสอบเสร็จ
    if os.path.exists(dummy_path):
        os.remove(dummy_path)