"""
แปลงข้อมูล raw_json ของเอกสารให้อยู่ในรูปแบบ AI-Ready Data Contract (ตามสเปคข้อ 3)
และสร้างตารางแบบแบน (1 แถว = 1 รายวิชา) สำหรับ CSV / Parquet
"""
import io
import json
from typing import Any, Dict, List, Optional

import pandas as pd

STUDENT_INFO_FIELDS = [
    "student_id", "citizen_id", "title_th", "title_en", "name_th", "name_en",
    "institution", "institution_code", "faculty", "department", "major",
    "degree_name_th", "degree_name_en", "admission_date", "graduation_date",
    "education_status", "total_credits_earned", "gpa_cumulative",
]


def _to_float(val: Any) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def mask_citizen_id(value: Optional[str]) -> Optional[str]:
    """ปกปิดเลขประจำตัวประชาชน เหลือเฉพาะ 4 หลักท้าย"""
    if not value:
        return value
    digits = str(value)
    return "*" * max(len(digits) - 4, 0) + digits[-4:]


def to_data_contract(raw: Dict[str, Any], meta: Dict[str, Any],
                     include_confidence: bool = True, mask_citizen: bool = True) -> Dict[str, Any]:
    student = (raw or {}).get("student") or {}
    student_info = {k: student.get(k) for k in STUDENT_INFO_FIELDS}
    student_info["gpa_cumulative"] = _to_float(student_info.get("gpa_cumulative"))
    student_info["total_credits_earned"] = _to_float(student_info.get("total_credits_earned"))
    if mask_citizen:
        student_info["citizen_id"] = mask_citizen_id(student_info.get("citizen_id"))
    if include_confidence and student.get("field_confidence"):
        student_info["field_confidence"] = student.get("field_confidence")

    records = []
    for sem in (raw or {}).get("semesters") or []:
        courses = []
        for c in sem.get("courses") or []:
            course = {
                "course_code": c.get("course_code"),
                "course_name_th": c.get("course_name_th"),
                "course_name_en": c.get("course_name_en"),
                "credits": _to_float(c.get("credits")),
                "grade": c.get("grade"),
            }
            if include_confidence:
                course["confidence"] = _to_float(c.get("confidence"))
            courses.append(course)
        records.append({
            "academic_year": sem.get("academic_year"),
            "semester": str(sem.get("semester")) if sem.get("semester") is not None else None,
            "semester_gpa": _to_float(sem.get("semester_gpa")),
            "semester_credits_earned": _to_float(sem.get("semester_credits_earned")),
            "cumulative_gpa": _to_float(sem.get("cumulative_gpa")),
            "courses": courses,
        })

    metadata = {
        "document_id": meta.get("document_id"),
        "source_file": meta.get("file_name"),
        "file_hash_sha256": meta.get("file_hash"),
        "processed_at": meta.get("created_at"),
        "review_status": meta.get("review_status"),
        "reviewed_at": meta.get("reviewed_at"),
    }
    if include_confidence:
        metadata["confidence_score"] = _to_float(meta.get("overall_confidence"))

    return {"student_info": student_info, "academic_records": records, "metadata": metadata}


def to_flat_rows(raw: Dict[str, Any], include_confidence: bool = True) -> List[Dict[str, Any]]:
    student = (raw or {}).get("student") or {}
    rows = []
    for sem in (raw or {}).get("semesters") or []:
        for c in sem.get("courses") or []:
            row = {
                "student_id": student.get("student_id"),
                "name_th": student.get("name_th"),
                "name_en": student.get("name_en"),
                "institution": student.get("institution"),
                "faculty": student.get("faculty"),
                "major": student.get("major"),
                "gpa_cumulative": _to_float(student.get("gpa_cumulative")),
                "academic_year": sem.get("academic_year"),
                "semester": str(sem.get("semester")) if sem.get("semester") is not None else None,
                "semester_gpa": _to_float(sem.get("semester_gpa")),
                "course_code": c.get("course_code"),
                "course_name_th": c.get("course_name_th"),
                "course_name_en": c.get("course_name_en"),
                "credits": _to_float(c.get("credits")),
                "grade": c.get("grade"),
            }
            if include_confidence:
                row["confidence"] = _to_float(c.get("confidence"))
            rows.append(row)
    return rows


def build_export(contracts: List[Dict[str, Any]], flat_rows: List[Dict[str, Any]], fmt: str):
    """คืนค่า (bytes, media_type, file_extension)"""
    if fmt == "json":
        payload = contracts[0] if len(contracts) == 1 else contracts
        return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"), "application/json", "json"

    df = pd.DataFrame(flat_rows)
    if fmt == "csv":
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        return buf.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "csv"

    buf = io.BytesIO()
    df.to_parquet(buf, index=False, engine="pyarrow")
    return buf.getvalue(), "application/octet-stream", "parquet"


def build_preview(content: bytes, fmt: str, flat_rows: List[Dict[str, Any]], max_chars: int = 2400) -> str:
    if fmt == "parquet":
        import pyarrow as pa
        schema = pa.Table.from_pandas(pd.DataFrame(flat_rows), preserve_index=False).schema
        lines = [f"{f.name:<18} {f.type}" for f in schema]
        return "schema (pyarrow)\n" + "\n".join(lines) + f"\n\nrows: {len(flat_rows)}   compression: snappy"
    text = content.decode("utf-8-sig")
    return text if len(text) <= max_chars else text[:max_chars] + "\n…"
