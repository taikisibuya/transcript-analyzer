import os
import re
import uuid
import json
from typing import List, Optional, Dict, Any, Literal

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, Body, BackgroundTasks, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import create_engine, text

from pipeline import run_pipeline
from validator import validate_transcript_data
from loader import load_transcript_to_relational
from embedder import embed_all_courses
from search_skills import get_query_embedding
from export_utils import to_data_contract, to_flat_rows, build_export, build_preview

app = FastAPI(
    title="Transcript Analyzer API",
    description="ระบบวิเคราะห์และสืบค้นทักษะจากใบทรานสคริปต์ด้วย AI, pgvector และ Human-in-the-Loop Platform",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("กรุณากำหนดค่า DATABASE_URL ในไฟล์ .env")

engine = create_engine(DATABASE_URL)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
CONFIDENCE_THRESHOLD = 0.85

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
ASSETS_DIR = os.path.join(FRONTEND_DIST, "assets")
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


# ----------------------------------------------------
# หมวดทักษะหลัก (ใช้ทั้งปุ่มค้นหาด่วน และโปรไฟล์ทักษะของนักศึกษา)
# ----------------------------------------------------
SKILL_CATEGORIES = [
    {"id": "web_software", "label": "Web & Software Development",
     "query": "พัฒนาเว็บ ฟรอนต์เอนด์ แบ็กเอนด์ การเขียนโปรแกรมคอมพิวเตอร์ ฐานข้อมูล วิศวกรรมซอฟต์แวร์"},
    {"id": "ai_data", "label": "AI & Data Analytics",
     "query": "ปัญญาประดิษฐ์ การเรียนรู้ของเครื่อง Machine Learning วิทยาการข้อมูล ขุดค้นข้อมูล"},
    {"id": "network_cloud", "label": "Network & Cloud Security",
     "query": "เครือข่ายคอมพิวเตอร์ ระบบปฏิบัติการ ความปลอดภัยไซเบอร์ คลาวด์"},
    {"id": "hardware_iot", "label": "Hardware & Embedded IoT",
     "query": "ไมโครคอนโทรลเลอร์ สถาปัตยกรรมคอมพิวเตอร์ อินเทอร์เน็ตของสรรพสิ่ง อิเล็กทรอนิกส์ วงจรดิจิทัล"},
]
_CATEGORY_VECTORS: Dict[str, str] = {}


def _category_vector(cat_id: str) -> str:
    """แคชเวกเตอร์ของหมวดทักษะไว้ในหน่วยความจำ เพื่อไม่ต้องเรียก Embedding API ซ้ำ"""
    if cat_id not in _CATEGORY_VECTORS:
        cat = next(c for c in SKILL_CATEGORIES if c["id"] == cat_id)
        _CATEGORY_VECTORS[cat_id] = json.dumps(get_query_embedding(cat["query"]))
    return _CATEGORY_VECTORS[cat_id]


# ----------------------------------------------------
# Global Task Progress Storage (สำหรับติดตามสถานะ Pipeline แบบ Live)
# ----------------------------------------------------
PIPELINE_TASKS: Dict[str, Dict[str, Any]] = {}


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def _as_dict(value) -> Dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value


def _content_disposition(file_name: str) -> str:
    """รองรับชื่อไฟล์ภาษาไทยใน header (RFC 5987)"""
    from urllib.parse import quote
    ascii_name = file_name.encode("ascii", "ignore").decode() or "export"
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(file_name)}'


def _safe_filename(original: str) -> str:
    """ทำความสะอาดชื่อไฟล์ (กัน path traversal) และเติมรหัสสั้นนำหน้าเพื่อไม่ให้ไฟล์ชื่อซ้ำทับกัน"""
    base = os.path.basename(original or "upload")
    stem, ext = os.path.splitext(base)
    stem = re.sub(r"[^\w\-฀-๿]+", "_", stem).strip("_")[:80] or "document"
    return f"{uuid.uuid4().hex[:8]}_{stem}{ext.lower()}"


def process_transcript_task(file_path: str, task_id: str):
    """รัน Pipeline พร้อมอัปเดตสถานะขั้นตอนย่อยให้ Frontend Polling"""
    def on_progress(step: int, step_name: str, message: str, is_duplicate: bool = False,
                    status: str = "PROCESSING", doc_id: str = None, issues: list = None):
        task = PIPELINE_TASKS.get(task_id)
        if not task:
            return
        task["step"] = step
        task["step_name"] = step_name
        task["message"] = message
        if is_duplicate:
            task["is_duplicate"] = True
        if doc_id:
            task["doc_id"] = str(doc_id)
        if status != "PROCESSING":
            task["status"] = status
        if issues:
            task["issues"] = issues

    try:
        print(f"\n[BACKGROUND] เริ่มประมวลผลไฟล์: {file_path} (Task: {task_id})")
        run_pipeline(file_path, progress_callback=on_progress)
        print(f"[BACKGROUND] ประมวลผลเสร็จสิ้น: {file_path}\n")
    except Exception as e:
        print(f"[BACKGROUND ERROR] {str(e)}\n")
        if task_id in PIPELINE_TASKS:
            PIPELINE_TASKS[task_id]["status"] = "FAILED"
            PIPELINE_TASKS[task_id]["message"] = str(e)
            PIPELINE_TASKS[task_id]["step"] = 3


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Transcript Analyzer API is running smoothly."}


@app.get("/api/pipeline/status/{task_id}")
def get_pipeline_status(task_id: str):
    task = PIPELINE_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสงานประมวลผลนี้")
    return task


# ----------------------------------------------------
# Documents
# ----------------------------------------------------
@app.get("/api/documents")
def list_documents(status: Optional[str] = Query(None)):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, file_name, validation_status, review_status, validation_report, created_at,
                   raw_json->'student'->>'student_id'     AS student_id,
                   COALESCE(raw_json->'student'->>'name_th', raw_json->'student'->>'name_en') AS student_name,
                   raw_json->'student'->>'major'          AS major,
                   raw_json->'student'->>'gpa_cumulative' AS gpa_cumulative,
                   page_count, processing_ms, overall_confidence, reviewed_at
            FROM documents
            WHERE (:status IS NULL OR review_status = :status)
            ORDER BY created_at DESC;
        """), {"status": status}).mappings().fetchall()

    documents = []
    for r in rows:
        report = _as_dict(r["validation_report"])
        summary = report.get("summary") or {}
        try:
            gpa = float(r["gpa_cumulative"]) if r["gpa_cumulative"] else None
        except ValueError:
            gpa = None
        documents.append({
            "document_id": str(r["id"]),
            "file_name": r["file_name"],
            "file_url": f"/uploads/{r['file_name']}",
            "validation_status": r["validation_status"],
            "review_status": r["review_status"],
            "validation_report": report or None,
            "issues_count": summary.get("issues_count", len(report.get("issues") or [])),
            "critical_count": summary.get("critical_count", 0),
            "student_id": r["student_id"],
            "student_name": r["student_name"],
            "major": r["major"],
            "gpa_cumulative": gpa,
            "page_count": r["page_count"],
            "processing_ms": r["processing_ms"],
            "overall_confidence": float(r["overall_confidence"]) if r["overall_confidence"] is not None else None,
            "reviewed_at": _iso(r["reviewed_at"]),
            "created_at": _iso(r["created_at"]),
        })

    return {"total": len(documents), "documents": documents}


@app.get("/api/documents/{doc_id}")
def get_document_details(doc_id: str):
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT id, file_name, file_path, mime_type, file_hash_sha256, validation_status, review_status,
                   validation_report, raw_json, page_count, processing_ms, overall_confidence,
                   reviewed_at, created_at
            FROM documents
            WHERE id = :id;
        """), {"id": doc_id}).mappings().fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารที่ระบุ")

    return {
        "document_id": str(row["id"]),
        "file_name": row["file_name"],
        "file_url": f"/uploads/{row['file_name']}",
        "file_path": row["file_path"],
        "mime_type": row["mime_type"],
        "file_hash": row["file_hash_sha256"],
        "validation_status": row["validation_status"],
        "review_status": row["review_status"],
        "validation_report": _as_dict(row["validation_report"]) or None,
        "raw_json": _as_dict(row["raw_json"]),
        "page_count": row["page_count"],
        "processing_ms": row["processing_ms"],
        "overall_confidence": float(row["overall_confidence"]) if row["overall_confidence"] is not None else None,
        "reviewed_at": _iso(row["reviewed_at"]),
        "created_at": _iso(row["created_at"]),
    }


@app.post("/api/upload")
async def upload_transcript(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    ext = os.path.splitext((file.filename or "").lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์เอกสารประเภท PDF, JPG และ PNG เท่านั้น")

    stored_name = _safe_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            buffer.write(chunk)

    task_id = str(uuid.uuid4())
    PIPELINE_TASKS[task_id] = {
        "task_id": task_id,
        "file_name": file.filename,
        "stored_name": stored_name,
        "step": 1,
        "step_name": "STARTING",
        "message": "กำลังเตรียมเอกสารเข้าสู่ Pipeline...",
        "is_duplicate": False,
        "status": "PROCESSING",
        "doc_id": None,
        "issues": []
    }
    background_tasks.add_task(process_transcript_task, file_path, task_id)

    return {
        "message": "อัปโหลดไฟล์สำเร็จ ระบบกำลังประมวลผลเอกสารในเบื้องหลัง",
        "task_id": task_id,
        "file_name": file.filename,
        "file_url": f"/uploads/{stored_name}",
        "status": "PROCESSING"
    }


@app.put("/api/documents/{doc_id}/json")
def update_document_json(doc_id: str, payload: Dict[str, Any] = Body(...)):
    val_report = validate_transcript_data(payload, confidence_threshold=CONFIDENCE_THRESHOLD)
    val_status = val_report.get("status", "FAILED")

    with engine.begin() as conn:
        result = conn.execute(text("""
            UPDATE documents
            SET raw_json = :raw_json,
                validation_status = :val_status,
                validation_report = :val_report
            WHERE id = :doc_id;
        """), {
            "doc_id": doc_id,
            "raw_json": json.dumps(payload, ensure_ascii=False),
            "val_status": val_status,
            "val_report": json.dumps(val_report, ensure_ascii=False)
        })
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="ไม่พบเอกสารที่ระบุ")

    return {
        "message": "บันทึกการแก้ไขข้อมูลสำเร็จ",
        "validation_status": val_status,
        "validation_report": val_report
    }


@app.post("/api/documents/{doc_id}/approve")
def approve_document(doc_id: str):
    with engine.connect() as conn:
        row = conn.execute(text("SELECT raw_json FROM documents WHERE id = :id"), {"id": doc_id}).fetchone()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="ไม่พบข้อมูล JSON ของเอกสารนี้")

    try:
        if not load_transcript_to_relational(doc_id):
            raise HTTPException(status_code=500, detail="ไม่สามารถนำเข้าข้อมูลสู่ตาราง Relational ได้")

        embed_all_courses()

        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE documents
                SET review_status = 'APPROVED', reviewed_at = now()
                WHERE id = :doc_id;
            """), {"doc_id": doc_id})

        return {
            "message": "อนุมัติและนำเข้าข้อมูลสู่ฐานข้อมูลพร้อมสร้าง Vector สำเร็จแล้ว",
            "document_id": doc_id,
            "review_status": "APPROVED"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการอนุมัติข้อมูล: {str(e)}")


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    """ลบเอกสารออกจากทั้ง DB และไฟล์จริง (students / semesters / courses ถูกลบตามด้วย ON DELETE CASCADE)"""
    with engine.begin() as conn:
        row = conn.execute(text("DELETE FROM documents WHERE id = :id RETURNING file_name"), {"id": doc_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารที่ระบุ")

    file_path = os.path.join(UPLOAD_DIR, os.path.basename(row[0] or ""))
    if row[0] and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except OSError as e:
            print(f"[WARNING] ลบไฟล์เอกสารจริงไม่สำเร็จ: {e}")

    return {"message": "ลบเอกสารออกจากระบบสำเร็จ", "document_id": doc_id}


# ----------------------------------------------------
# Dashboard statistics
# ----------------------------------------------------
@app.get("/api/stats")
def get_stats():
    with engine.connect() as conn:
        counts = conn.execute(text("""
            SELECT
                COUNT(*)                                                         AS total,
                COUNT(*) FILTER (WHERE review_status = 'APPROVED')               AS approved,
                COUNT(*) FILTER (WHERE review_status = 'PENDING' AND validation_status IS NOT NULL) AS needs_review,
                COUNT(*) FILTER (WHERE review_status = 'PENDING' AND validation_status IS NULL)     AS processing,
                COUNT(*) FILTER (WHERE review_status = 'PENDING' AND validation_status = 'FAILED')  AS failed,
                COUNT(*) FILTER (WHERE review_status = 'PENDING' AND validation_status = 'WARNING') AS warning,
                COUNT(*) FILTER (WHERE review_status = 'PENDING' AND validation_status = 'PASSED')  AS passed,
                COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')   AS last_7_days,
                AVG(overall_confidence)                                          AS avg_confidence,
                AVG(processing_ms::float / NULLIF(page_count, 0)) FILTER (WHERE processing_ms IS NOT NULL) AS avg_ms_per_page
            FROM documents;
        """)).mappings().fetchone()

        reports = conn.execute(text("""
            SELECT validation_report FROM documents
            WHERE review_status = 'PENDING' AND validation_report IS NOT NULL;
        """)).fetchall()

        latency = conn.execute(text("""
            SELECT id, file_name, processing_ms, page_count, overall_confidence, created_at
            FROM documents
            WHERE processing_ms IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 30;
        """)).mappings().fetchall()

        indexed_courses = conn.execute(text("SELECT COUNT(*) FROM courses WHERE embedding IS NOT NULL")).scalar()

    issue_types: Dict[str, int] = {}
    pending_issues = 0
    for (rep,) in reports:
        for issue in _as_dict(rep).get("issues") or []:
            key = issue.get("type") or "OTHER"
            issue_types[key] = issue_types.get(key, 0) + 1
            pending_issues += 1

    return {
        "total": counts["total"],
        "approved": counts["approved"],
        "needs_review": counts["needs_review"],
        "processing": counts["processing"],
        "by_validation": {"FAILED": counts["failed"], "WARNING": counts["warning"], "PASSED": counts["passed"]},
        "last_7_days": counts["last_7_days"],
        "avg_confidence": round(float(counts["avg_confidence"]), 3) if counts["avg_confidence"] is not None else None,
        "avg_ms_per_page": round(float(counts["avg_ms_per_page"])) if counts["avg_ms_per_page"] is not None else None,
        "pending_issues": pending_issues,
        "issue_types": dict(sorted(issue_types.items(), key=lambda kv: -kv[1])),
        "indexed_courses": indexed_courses,
        "latency": [{
            "document_id": str(r["id"]),
            "file_name": r["file_name"],
            "processing_ms": r["processing_ms"],
            "page_count": r["page_count"] or 1,
            "ms_per_page": round(r["processing_ms"] / (r["page_count"] or 1)),
            "overall_confidence": float(r["overall_confidence"]) if r["overall_confidence"] is not None else None,
            "created_at": _iso(r["created_at"]),
        } for r in latency],
    }


# ----------------------------------------------------
# Semantic skill search (จัดอันดับเป็นรายนักศึกษา)
# ----------------------------------------------------
class MatchedCourse(BaseModel):
    course_code: str
    course_name_th: Optional[str] = None
    course_name_en: Optional[str] = None
    credits: float
    grade: str
    similarity: float


class StudentMatch(BaseModel):
    document_id: str
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    faculty: Optional[str] = None
    major: Optional[str] = None
    gpa_cumulative: Optional[float] = None
    score: float
    match_count: int
    courses: List[MatchedCourse]


class SearchResponse(BaseModel):
    query: str
    total_found: int
    results: List[StudentMatch]


@app.get("/api/skills/categories")
def list_skill_categories():
    return {"categories": SKILL_CATEGORIES}


@app.get("/api/skills/facets")
def search_facets():
    """รายชื่อสาขาวิชาของนักศึกษาที่อนุมัติแล้ว สำหรับตัวกรองในหน้าค้นหา"""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT s.major, COUNT(*) AS n
            FROM students s JOIN documents d ON s.document_id = d.id
            WHERE d.review_status = 'APPROVED' AND s.major IS NOT NULL
            GROUP BY s.major ORDER BY n DESC;
        """)).fetchall()
    return {"majors": [{"name": r[0], "count": r[1]} for r in rows]}


@app.get("/api/skills/search", response_model=SearchResponse)
def search_skills(
    query: str = Query(..., min_length=1),
    grade: Optional[str] = Query(None, description="กรองเกรดแบบตรงตัว เช่น A"),
    min_grade_point: Optional[float] = Query(None, ge=0, le=4, description="แต้มเกรดขั้นต่ำของรายวิชาที่ตรง"),
    min_gpa: Optional[float] = Query(None, ge=0, le=4, description="GPAX ขั้นต่ำของนักศึกษา"),
    majors: Optional[List[str]] = Query(None),
    min_similarity: float = Query(0.0, ge=0, le=100, description="ความคล้ายขั้นต่ำ (%)"),
    sort: Literal["relevance", "gpa"] = Query("relevance"),
    top_k: int = Query(12, ge=1, le=50),
):
    """ค้นหาทักษะทางความหมาย แล้วรวมผลรายวิชาเป็นรายนักศึกษา (Talent Intelligence Query)"""
    try:
        vector_str = json.dumps(get_query_embedding(query))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"สร้างเวกเตอร์คำค้นหาไม่สำเร็จ: {e}")

    where = ["c.embedding IS NOT NULL", "d.review_status = 'APPROVED'"]
    params: Dict[str, Any] = {"q_vec": vector_str, "pool": min(top_k * 10, 500)}
    if grade:
        where.append("UPPER(c.grade) = UPPER(:grade)")
        params["grade"] = grade
    if min_grade_point is not None:
        where.append("c.grade_point >= :min_gp")
        params["min_gp"] = min_grade_point
    if min_gpa is not None:
        where.append("s.gpa_cumulative >= :min_gpa")
        params["min_gpa"] = min_gpa
    if majors:
        where.append("s.major = ANY(:majors)")
        params["majors"] = list(majors)

    sql = text(f"""
        SELECT c.course_code, c.course_name_th, c.course_name_en, c.credits, c.grade,
               (1 - (c.embedding <=> (:q_vec)::vector)) AS similarity,
               s.student_id, s.name_th, s.faculty, s.major, s.gpa_cumulative, d.id::text AS document_id
        FROM courses c
        JOIN students s ON c.student_profile_id = s.id
        JOIN documents d ON s.document_id = d.id
        WHERE {' AND '.join(where)}
        ORDER BY c.embedding <=> (:q_vec)::vector ASC
        LIMIT :pool;
    """)

    try:
        with engine.connect() as conn:
            rows = conn.execute(sql, params).mappings().fetchall()
    except Exception as e:
        print(f"[SEARCH ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

    grouped: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        sim = round(float(r["similarity"] or 0) * 100, 1)
        if sim < min_similarity:
            continue
        doc_id = r["document_id"]
        entry = grouped.setdefault(doc_id, {
            "document_id": doc_id,
            "student_id": r["student_id"],
            "student_name": r["name_th"],
            "faculty": r["faculty"],
            "major": r["major"],
            "gpa_cumulative": float(r["gpa_cumulative"]) if r["gpa_cumulative"] is not None else None,
            "score": sim,
            "courses": [],
        })
        entry["courses"].append({
            "course_code": r["course_code"] or "-",
            "course_name_th": r["course_name_th"],
            "course_name_en": r["course_name_en"],
            "credits": float(r["credits"] or 0),
            "grade": r["grade"] or "-",
            "similarity": sim,
        })

    results = []
    for entry in grouped.values():
        entry["match_count"] = len(entry["courses"])
        entry["courses"] = entry["courses"][:3]
        results.append(entry)

    if sort == "gpa":
        results.sort(key=lambda e: (e["gpa_cumulative"] or 0, e["score"]), reverse=True)
    else:
        results.sort(key=lambda e: (e["score"], e["match_count"]), reverse=True)

    return {"query": query, "total_found": len(results), "results": results[:top_k]}


@app.get("/api/students/{doc_id}/skills")
def student_skill_profile(doc_id: str):
    """โปรไฟล์ทักษะ 4 หมวด: ความคล้ายสูงสุดระหว่างหมวดทักษะกับรายวิชาที่ได้เกรด B ขึ้นไป"""
    with engine.connect() as conn:
        has_courses = conn.execute(text("""
            SELECT COUNT(*) FROM courses c JOIN students s ON c.student_profile_id = s.id
            WHERE s.document_id = :doc AND c.embedding IS NOT NULL;
        """), {"doc": doc_id}).scalar()
        if not has_courses:
            return {"document_id": doc_id, "indexed": False, "skills": []}

        skills = []
        for cat in SKILL_CATEGORIES:
            try:
                vec = _category_vector(cat["id"])
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"สร้างเวกเตอร์หมวดทักษะไม่สำเร็จ: {e}")
            rows = conn.execute(text("""
                SELECT c.course_code, c.course_name_th, c.grade,
                       (1 - (c.embedding <=> (:vec)::vector)) AS similarity
                FROM courses c JOIN students s ON c.student_profile_id = s.id
                WHERE s.document_id = :doc AND c.embedding IS NOT NULL
                  AND (c.grade_point IS NULL OR c.grade_point >= 3.0)
                ORDER BY c.embedding <=> (:vec)::vector ASC
                LIMIT 3;
            """), {"vec": vec, "doc": doc_id}).mappings().fetchall()
            skills.append({
                "id": cat["id"],
                "label": cat["label"],
                "score": round(float(rows[0]["similarity"]) * 100, 1) if rows else 0.0,
                "courses": [{"course_code": r["course_code"], "course_name_th": r["course_name_th"],
                             "grade": r["grade"]} for r in rows],
            })

    skills.sort(key=lambda s: -s["score"])
    return {"document_id": doc_id, "indexed": True, "skills": skills}


# ----------------------------------------------------
# Export (AI-Ready JSON / CSV / Parquet)
# ----------------------------------------------------
def _load_documents_for_export(doc_ids: Optional[List[str]]):
    with engine.connect() as conn:
        if doc_ids:
            rows = conn.execute(text("""
                SELECT id, file_name, file_hash_sha256, raw_json, review_status, reviewed_at,
                       overall_confidence, created_at
                FROM documents WHERE id::text = ANY(:ids) ORDER BY created_at DESC;
            """), {"ids": doc_ids}).mappings().fetchall()
        else:
            rows = conn.execute(text("""
                SELECT id, file_name, file_hash_sha256, raw_json, review_status, reviewed_at,
                       overall_confidence, created_at
                FROM documents WHERE review_status = 'APPROVED' ORDER BY created_at DESC;
            """)).mappings().fetchall()
    return [r for r in rows if _as_dict(r["raw_json"]).get("student")]


def _make_export(rows, fmt: str, include_confidence: bool, mask_citizen: bool):
    contracts, flat = [], []
    for r in rows:
        raw = _as_dict(r["raw_json"])
        meta = {
            "document_id": str(r["id"]), "file_name": r["file_name"], "file_hash": r["file_hash_sha256"],
            "created_at": _iso(r["created_at"]), "review_status": r["review_status"],
            "reviewed_at": _iso(r["reviewed_at"]), "overall_confidence": r["overall_confidence"],
        }
        contracts.append(to_data_contract(raw, meta, include_confidence, mask_citizen))
        flat.extend(to_flat_rows(raw, include_confidence))
    content, media_type, ext = build_export(contracts, flat, fmt)
    return content, media_type, ext, flat


class ExportRequest(BaseModel):
    document_ids: Optional[List[str]] = None   # None = ทุกเอกสารที่อนุมัติแล้ว
    format: Literal["json", "csv", "parquet"] = "json"
    include_confidence: bool = True
    mask_citizen_id: bool = True
    file_label: Optional[str] = None
    preview: bool = False


@app.post("/api/export")
def export_batch(req: ExportRequest):
    rows = _load_documents_for_export(req.document_ids)
    if not rows:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลที่ส่งออกได้")

    content, media_type, ext, flat = _make_export(rows, req.format, req.include_confidence, req.mask_citizen_id)
    label = re.sub(r"[^\w\-]+", "_", req.file_label or ("ksu_all_approved" if not req.document_ids else "ksu_export"))
    file_name = f"{label}.{ext}"

    if req.preview:
        return {
            "file_name": file_name,
            "format": req.format,
            "students": len(rows),
            "rows": len(flat),
            "size_bytes": len(content),
            "preview": build_preview(content, req.format, flat),
        }

    return Response(content=content, media_type=media_type,
                    headers={"Content-Disposition": _content_disposition(file_name)})


@app.get("/api/documents/{doc_id}/export")
def export_document_data(
    doc_id: str,
    format: Literal["json", "csv", "parquet"] = Query("json"),
    include_confidence: bool = Query(True),
    mask_citizen_id: bool = Query(True),
):
    rows = _load_documents_for_export([doc_id])
    if not rows:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารหรือข้อมูล JSON")

    content, media_type, ext, _ = _make_export(rows, format, include_confidence, mask_citizen_id)
    base_name = os.path.splitext(rows[0]["file_name"])[0]
    suffix = {"json": "ai_ready", "csv": "tabular", "parquet": "dataset"}[format]
    return Response(content=content, media_type=media_type,
                    headers={"Content-Disposition": _content_disposition(f"{base_name}_{suffix}.{ext}")})


# ----------------------------------------------------
# Serve built React app (SPA fallback)
# ----------------------------------------------------
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    if full_path.startswith("api") or full_path.startswith("uploads"):
        raise HTTPException(status_code=404, detail="Not Found")

    target_file = os.path.realpath(os.path.join(FRONTEND_DIST, full_path))
    if full_path and target_file.startswith(FRONTEND_DIST) and os.path.isfile(target_file):
        return FileResponse(target_file)

    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)

    return {"message": "Frontend build not found. Please run 'npm run build' inside frontend folder."}
