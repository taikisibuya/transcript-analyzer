"""
สร้างร่างชุดเฉลย (ground truth) จากเอกสารที่ "อนุมัติแล้ว" ในฐานข้อมูล

ข้อมูลที่ผ่านการตรวจทาน (HITL) แล้วถือเป็นค่าที่ถูกต้อง จึงใช้เป็นเฉลยได้
แต่ต้องเปิดเทียบกับเอกสารจริงอีกรอบก่อนใช้ เพราะผู้ตรวจอาจพลาดได้

รันจากโฟลเดอร์ backend:
    python evaluation/export_ground_truth.py            # ทุกเอกสารที่อนุมัติแล้ว
    python evaluation/export_ground_truth.py --limit 30
ผลลัพธ์:
    evaluation/dataset/<ชื่อไฟล์>          สำเนาไฟล์ต้นฉบับ
    evaluation/ground_truth/<ชื่อไฟล์>.json  เฉลย (แก้ "_meta" ให้ถูกต้องด้วย)
"""
import argparse
import json
import os
import shutil
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
load_dotenv(os.path.join(BACKEND, ".env"))


def guess_language(raw):
    courses = [c for s in raw.get("semesters") or [] for c in s.get("courses") or []]
    th = sum(1 for c in courses if c.get("course_name_th"))
    return "th" if th >= len(courses) / 2 else "en"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    engine = create_engine(os.getenv("DATABASE_URL"))
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT file_name, file_path, mime_type, raw_json
            FROM documents WHERE review_status = 'APPROVED'
            ORDER BY created_at
        """)).mappings().fetchall()
    if args.limit:
        rows = rows[: args.limit]
    if not rows:
        sys.exit("ไม่พบเอกสารที่อนุมัติแล้ว")

    os.makedirs(os.path.join(HERE, "dataset"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "ground_truth"), exist_ok=True)
    for r in rows:
        raw = r["raw_json"] if isinstance(r["raw_json"], dict) else json.loads(r["raw_json"])
        raw.pop("_review", None)
        src = r["file_path"] if os.path.isabs(r["file_path"]) else os.path.join(BACKEND, r["file_path"])
        if not os.path.exists(src):
            print(f"[SKIP] ไม่พบไฟล์ {src}")
            continue
        shutil.copy2(src, os.path.join(HERE, "dataset", r["file_name"]))
        raw["_meta"] = {
            "language": guess_language(raw),          # th หรือ en
            "source": "native_pdf" if r["mime_type"] == "application/pdf" else "photo",  # native_pdf / scan / photo
            "verified_by_human": False,               # เปลี่ยนเป็น true เมื่อเทียบกับเอกสารจริงแล้ว
        }
        out = os.path.join(HERE, "ground_truth", os.path.splitext(r["file_name"])[0] + ".json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(raw, f, ensure_ascii=False, indent=2)
        print(f"[OK] {r['file_name']}")
    print(f"\nสร้างเฉลย {len(rows)} ฉบับ — ตรวจทานไฟล์ใน evaluation/ground_truth ก่อนใช้งาน")


if __name__ == "__main__":
    main()
