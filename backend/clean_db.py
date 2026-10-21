import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    # คำสั่ง CASCADE จะช่วยลบข้อมูลในตารางลูกที่เชื่อม Foreign Key ไว้ด้วยอัตโนมัติ
    conn.execute(text("TRUNCATE TABLE documents CASCADE;"))
    conn.commit()
    print("ล้างข้อมูลในตาราง documents เรียบร้อยแล้ว")