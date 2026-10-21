"""
สคริปต์ประเมินผลระบบ (Accuracy & Latency) สำหรับรายงานบทที่ 4

รันจากโฟลเดอร์ backend:
    python evaluation/evaluate.py skew      # ทดสอบการแก้ภาพเอียง (ไม่ใช้ API)
    python evaluation/evaluate.py extract   # สกัดข้อมูลชุดทดสอบด้วย Gemini + จับเวลา (ใช้ API)
    python evaluation/evaluate.py score     # เทียบผลกับชุดเฉลย แล้วเขียน evaluation.json
    python evaluation/evaluate.py all       # ทำทั้งสามขั้นตอนต่อกัน

โครงสร้างโฟลเดอร์:
    evaluation/dataset/        ไฟล์ทดสอบ (.pdf .jpg .jpeg .png)
    evaluation/ground_truth/   เฉลย 1 ไฟล์ต่อ 1 เอกสาร ชื่อเดียวกับไฟล์ทดสอบ นามสกุล .json
    evaluation/predictions/    ผลสกัดจาก AI (สร้างอัตโนมัติ)
    evaluation/results/        ผลลัพธ์ทั้งหมด (สร้างอัตโนมัติ)
"""
import argparse
import csv
import difflib
import json
import os
import re
import statistics
import sys
import time
import unicodedata
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

DATASET_DIR = os.path.join(HERE, "dataset")
GT_DIR = os.path.join(HERE, "ground_truth")
PRED_DIR = os.path.join(HERE, "predictions")
RESULT_DIR = os.path.join(HERE, "results")
WORK_DIR = os.path.join(HERE, "work")
FRONTEND_EVAL = os.path.join(BACKEND, "..", "frontend", "public", "evaluation.json")

ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
CONFIDENCE_THRESHOLD = 0.85
SKEW_ANGLES = [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10]

# ฟิลด์ส่วนหัวที่ประเมิน (ตรงกับ field_confidence ใน prompt)
HEADER_FIELDS = [
    "student_id", "name_th", "name_en", "institution", "faculty", "major",
    "degree_name_th", "gpa_cumulative", "total_credits_earned",
]
NUMERIC_HEADER = {"gpa_cumulative": 0.005, "total_credits_earned": 0.05}
COURSE_FIELDS = ["course_code", "course_name_th", "course_name_en", "credits", "grade"]


# ------------------------------------------------------------------
# ตัวช่วยทั่วไป
# ------------------------------------------------------------------
def list_dataset():
    if not os.path.isdir(DATASET_DIR):
        sys.exit(f"[ERROR] ไม่พบโฟลเดอร์ {DATASET_DIR}")
    files = sorted(f for f in os.listdir(DATASET_DIR) if os.path.splitext(f)[1].lower() in ALLOWED_EXT)
    if not files:
        sys.exit("[ERROR] ไม่พบไฟล์ทดสอบใน evaluation/dataset")
    return files


def stem(file_name):
    return os.path.splitext(file_name)[0]


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def norm_text(value):
    """ปรับข้อความให้อยู่รูปแบบเดียวกันก่อนเทียบ (ตัดช่องว่าง/อักขระล่องหน, ไม่สนตัวพิมพ์เล็กใหญ่)"""
    if value is None:
        return ""
    s = unicodedata.normalize("NFC", str(value))
    s = s.replace("​", "").replace(" ", " ")
    s = re.sub(r"\s+", " ", s).strip().casefold()
    return s


def norm_code(value):
    return re.sub(r"[\s\-–._]", "", norm_text(value))


def norm_grade(value):
    s = norm_text(value).upper().replace(" ", "")
    try:
        return f"{float(s):.1f}"
    except ValueError:
        return s.replace(".", "") if s not in {"", "-"} else ""


def to_float(value):
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def same_number(a, b, tol):
    fa, fb = to_float(a), to_float(b)
    if fa is None and fb is None:
        return True
    if fa is None or fb is None:
        return False
    return abs(fa - fb) <= tol


def field_equal(field, gt, pred):
    if field in NUMERIC_HEADER:
        return same_number(gt, pred, NUMERIC_HEADER[field])
    if field == "credits":
        return same_number(gt, pred, 0.05)
    if field == "grade":
        return norm_grade(gt) == norm_grade(pred)
    if field == "course_code":
        return norm_code(gt) == norm_code(pred)
    return norm_text(gt) == norm_text(pred)


def is_empty(value):
    return value is None or norm_text(value) == ""


def pct(n, d):
    return round(n / d, 4) if d else None


def percentile(values, p):
    if not values:
        return None
    v = sorted(values)
    k = (len(v) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def describe(values):
    if not values:
        return None
    return {
        "n": len(values),
        "mean": round(statistics.mean(values), 1),
        "median": round(statistics.median(values), 1),
        "p95": round(percentile(values, 95), 1),
        "min": round(min(values), 1),
        "max": round(max(values), 1),
    }


# ------------------------------------------------------------------
# 1) ทดสอบการแก้ภาพเอียง (Deskew) — ไม่ต้องใช้ API
# ------------------------------------------------------------------
def load_pages(path):
    from preprocessor import pdf_to_images, read_image_safe
    if path.lower().endswith(".pdf"):
        return pdf_to_images(path, dpi=300)
    img = read_image_safe(path)
    return [img] if img is not None else []


def run_skew(args):
    import cv2
    from preprocessor import deskew, resize_guardrail

    def rotate(img, angle):
        h, w = img.shape[:2]
        m = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        return cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))

    rows = []
    for name in list_dataset():
        pages = load_pages(os.path.join(DATASET_DIR, name))[: args.max_pages]
        for p_idx, page in enumerate(pages, start=1):
            base = resize_guardrail(page)
            # เติมขอบขาวก่อนหมุน เพื่อไม่ให้มุมเอกสารหลุดกรอบภาพ
            base = cv2.copyMakeBorder(base, 300, 300, 300, 300, cv2.BORDER_CONSTANT, value=(255, 255, 255))
            for angle in SKEW_ANGLES:
                t0 = time.perf_counter()
                fixed, estimated = deskew(rotate(base, angle))
                ms = (time.perf_counter() - t0) * 1000
                _, residual = deskew(fixed)
                rows.append({
                    "file": name, "page": p_idx, "applied_deg": angle,
                    "estimated_deg": round(float(estimated), 2),
                    "residual_deg": round(abs(float(residual)), 2),
                    "deskew_ms": round(ms, 1),
                })
        print(f"[SKEW] {name}: {len(pages)} หน้า")

    os.makedirs(RESULT_DIR, exist_ok=True)
    out_csv = os.path.join(RESULT_DIR, "skew_results.csv")
    with open(out_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    summary = {"by_angle": [], "pages": len({(r["file"], r["page"]) for r in rows})}
    for angle in SKEW_ANGLES:
        sel = [r for r in rows if r["applied_deg"] == angle]
        res = [r["residual_deg"] for r in sel]
        summary["by_angle"].append({
            "applied_deg": angle,
            "mean_residual_deg": round(statistics.mean(res), 2),
            "max_residual_deg": round(max(res), 2),
            "success_rate": pct(sum(1 for x in res if x <= 0.5), len(res)),
        })
    all_res = [r["residual_deg"] for r in rows]
    summary["overall_success_rate"] = pct(sum(1 for x in all_res if x <= 0.5), len(all_res))
    summary["mean_residual_deg"] = round(statistics.mean(all_res), 2)
    summary["deskew_ms"] = describe([r["deskew_ms"] for r in rows])
    save_json(os.path.join(RESULT_DIR, "skew_summary.json"), summary)

    print("\nมุมที่หมุน | คลาดเคลื่อนเฉลี่ย | สูงสุด | สำเร็จ (≤0.5°)")
    for s in summary["by_angle"]:
        print(f"{s['applied_deg']:>+8} | {s['mean_residual_deg']:>14} | {s['max_residual_deg']:>6} | {s['success_rate']:.0%}")
    print(f"\nสำเร็จรวม {summary['overall_success_rate']:.0%} — บันทึกที่ {out_csv}")
    return summary


# ------------------------------------------------------------------
# 2) สกัดข้อมูลชุดทดสอบ + จับเวลาแต่ละขั้น (ใช้ Gemini API)
# ------------------------------------------------------------------
def normalize_prediction(pred):
    """Gemini บางครั้งตอบเป็น list ที่มี object เดียว — ดึง object ที่มีข้อมูลนักศึกษาออกมา"""
    if isinstance(pred, list):
        dicts = [x for x in pred if isinstance(x, dict)]
        with_data = [x for x in dicts if "student" in x or "semesters" in x]
        pred = (with_data or dicts or [None])[0]
    if not isinstance(pred, dict):
        raise ValueError(f"รูปแบบผลลัพธ์จาก AI ไม่ถูกต้อง: {type(pred).__name__}")
    return pred


def run_extract(args):
    from preprocessor import preprocess_transcript_pipeline
    from extractor import extract_transcript_with_vision
    from validator import validate_transcript_data

    timings_path = os.path.join(RESULT_DIR, "timings.json")
    timings = load_json(timings_path) if os.path.exists(timings_path) else {}
    files = list_dataset()
    failed = []

    for i, name in enumerate(files, start=1):
        pred_path = os.path.join(PRED_DIR, stem(name) + ".json")
        if os.path.exists(pred_path) and not args.force:
            print(f"[{i}/{len(files)}] ข้าม {name} (มีผลสกัดแล้ว ใช้ --force เพื่อสกัดใหม่)")
            continue

        src = os.path.join(DATASET_DIR, name)
        print(f"[{i}/{len(files)}] {name}")
        t0 = time.perf_counter()
        target, pages = src, 1
        try:
            # แยกโฟลเดอร์ผลลัพธ์ต่อไฟล์ ไม่ให้ภาพของแต่ละเอกสารเขียนทับกัน
            out = preprocess_transcript_pipeline(src, output_dir=os.path.join(WORK_DIR, stem(name)))
            if out:
                target, pages = out, len(out)
        except Exception as e:  # noqa: BLE001
            print(f"   [WARNING] preprocess ล้มเหลว ใช้ไฟล์ต้นฉบับแทน: {e}")
        t1 = time.perf_counter()

        try:
            pred = normalize_prediction(extract_transcript_with_vision(target))
            t2 = time.perf_counter()
            report = validate_transcript_data(pred, confidence_threshold=CONFIDENCE_THRESHOLD)
            t3 = time.perf_counter()
        except Exception as e:  # noqa: BLE001
            print(f"   [ERROR] สกัดข้อมูลไม่สำเร็จ: {e}")
            print("   -> ข้ามไฟล์นี้ไปก่อน รันคำสั่ง extract ซ้ำภายหลังเพื่อทำไฟล์ที่ค้าง")
            timings[name] = {"error": str(e)[:300]}
            save_json(timings_path, timings)
            failed.append(name)
            if args.sleep and i < len(files):
                time.sleep(args.sleep)
            continue

        save_json(pred_path, pred)
        timings[name] = {
            "pages": pages,
            "preprocess_ms": round((t1 - t0) * 1000, 1),
            "extract_ms": round((t2 - t1) * 1000, 1),
            "validate_ms": round((t3 - t2) * 1000, 1),
            "total_ms": round((t3 - t0) * 1000, 1),
            "validation_status": report.get("status"),
            "issues": len(report.get("issues", [])),
        }
        save_json(timings_path, timings)
        print(f"   {pages} หน้า · {timings[name]['total_ms'] / 1000:.1f} วินาที · {report.get('status')}")
        if args.sleep and i < len(files):
            time.sleep(args.sleep)

    done = sum(1 for f in files if os.path.exists(os.path.join(PRED_DIR, stem(f) + ".json")))
    print(f"\nสกัดสำเร็จ {done}/{len(files)} ไฟล์")
    if failed:
        print("ไฟล์ที่ยังไม่สำเร็จ (รัน extract ซ้ำได้ ระบบจะทำเฉพาะไฟล์เหล่านี้):")
        for f in failed:
            print("  -", f)


# ------------------------------------------------------------------
# 3) เทียบผลกับเฉลย
# ------------------------------------------------------------------
def semester_key(sem):
    return (str(sem.get("academic_year") or "").strip(), str(sem.get("semester") or "").strip())


def course_label(c):
    return f"{norm_code(c.get('course_code'))} {norm_text(c.get('course_name_th') or c.get('course_name_en'))}"


def match_courses(gt_courses, pred_courses, threshold=0.6):
    """จับคู่รายวิชาเฉลยกับผลสกัดแบบ greedy ตามความคล้ายของรหัส+ชื่อวิชา"""
    pairs = []
    for gi, g in enumerate(gt_courses):
        for pi, p in enumerate(pred_courses):
            if norm_code(g.get("course_code")) and norm_code(g.get("course_code")) == norm_code(p.get("course_code")):
                score = 1.0 + difflib.SequenceMatcher(None, course_label(g), course_label(p)).ratio()
            else:
                score = difflib.SequenceMatcher(None, course_label(g), course_label(p)).ratio()
            if score >= threshold:
                pairs.append((score, gi, pi))
    pairs.sort(reverse=True)
    used_g, used_p, matched = set(), set(), []
    for _, gi, pi in pairs:
        if gi in used_g or pi in used_p:
            continue
        used_g.add(gi)
        used_p.add(pi)
        matched.append((gi, pi))
    return matched


def flatten(data):
    """คืน dict: semester_key -> {sem, courses}"""
    out = {}
    for sem in (data or {}).get("semesters") or []:
        key = semester_key(sem)
        if key in out:  # ภาคซ้ำ (เช่น เอกสารแยกหน้า) รวมรายวิชา
            out[key]["courses"].extend(sem.get("courses") or [])
        else:
            out[key] = {"sem": sem, "courses": list(sem.get("courses") or [])}
    return out


def score_document(gt, pred):
    res = {"header": {}, "cells": {f: [0, 0] for f in COURSE_FIELDS},
           "rows": {"tp": 0, "fp": 0, "fn": 0}, "sem_gpa": [0, 0],
           "conf_rows": []}

    g_st, p_st = gt.get("student") or {}, pred.get("student") or {}
    for f in HEADER_FIELDS:
        if is_empty(g_st.get(f)):
            continue  # เฉลยไม่มีค่านี้ ไม่นำมาคิด
        res["header"][f] = field_equal(f, g_st.get(f), p_st.get(f))

    g_sems, p_sems = flatten(gt), flatten(pred)
    for key, g in g_sems.items():
        p = p_sems.get(key)
        if p is None:
            res["rows"]["fn"] += len(g["courses"])
            continue
        if not is_empty(g["sem"].get("semester_gpa")):
            res["sem_gpa"][1] += 1
            res["sem_gpa"][0] += same_number(g["sem"].get("semester_gpa"), p["sem"].get("semester_gpa"), 0.005)

        pairs = match_courses(g["courses"], p["courses"])
        res["rows"]["tp"] += len(pairs)
        res["rows"]["fn"] += len(g["courses"]) - len(pairs)
        res["rows"]["fp"] += len(p["courses"]) - len(pairs)
        for gi, pi in pairs:
            gc, pc = g["courses"][gi], p["courses"][pi]
            row_ok = True
            for f in COURSE_FIELDS:
                if is_empty(gc.get(f)):
                    continue
                ok = field_equal(f, gc.get(f), pc.get(f))
                res["cells"][f][1] += 1
                res["cells"][f][0] += ok
                row_ok = row_ok and ok
            conf = to_float(pc.get("confidence"))
            res["conf_rows"].append({"confidence": conf, "correct": row_ok})
    for key, p in p_sems.items():
        if key not in g_sems:
            res["rows"]["fp"] += len(p["courses"])
    return res


def run_score(args):
    files = list_dataset()
    timings_path = os.path.join(RESULT_DIR, "timings.json")
    timings = load_json(timings_path) if os.path.exists(timings_path) else {}

    header_tot = {f: [0, 0] for f in HEADER_FIELDS}
    cell_tot = {f: [0, 0] for f in COURSE_FIELDS}
    rows_tot = {"tp": 0, "fp": 0, "fn": 0}
    sem_gpa = [0, 0]
    conf_rows = []
    lang_tot = {}
    detail = []

    for name in files:
        gt_path = os.path.join(GT_DIR, stem(name) + ".json")
        pred_path = os.path.join(PRED_DIR, stem(name) + ".json")
        if not os.path.exists(gt_path):
            print(f"[SKIP] {name}: ไม่มีไฟล์เฉลย")
            continue
        if not os.path.exists(pred_path):
            print(f"[SKIP] {name}: ยังไม่มีผลสกัด (รัน extract ก่อน)")
            continue
        gt, pred = load_json(gt_path), load_json(pred_path)
        r = score_document(gt, pred)

        correct = sum(r["header"].values()) + sum(v[0] for v in r["cells"].values())
        total = len(r["header"]) + sum(v[1] for v in r["cells"].values())
        lang = (gt.get("_meta") or {}).get("language", "th")
        lang_tot.setdefault(lang, [0, 0])
        lang_tot[lang][0] += correct
        lang_tot[lang][1] += total

        for f, ok in r["header"].items():
            header_tot[f][0] += ok
            header_tot[f][1] += 1
        for f, (c, t) in r["cells"].items():
            cell_tot[f][0] += c
            cell_tot[f][1] += t
        for k in rows_tot:
            rows_tot[k] += r["rows"][k]
        sem_gpa[0] += r["sem_gpa"][0]
        sem_gpa[1] += r["sem_gpa"][1]
        conf_rows.extend(r["conf_rows"])

        t = timings.get(name, {})
        meta = gt.get("_meta") or {}
        detail.append({
            "file": name, "language": lang, "source": meta.get("source", ""),
            "pages": t.get("pages"), "total_ms": t.get("total_ms"),
            "ms_per_page": round(t["total_ms"] / t["pages"], 1) if t.get("total_ms") and t.get("pages") else None,
            "header_acc": pct(sum(r["header"].values()), len(r["header"])),
            "course_tp": r["rows"]["tp"], "course_fp": r["rows"]["fp"], "course_fn": r["rows"]["fn"],
            "cell_acc": pct(sum(v[0] for v in r["cells"].values()), sum(v[1] for v in r["cells"].values())),
            "overall_acc": pct(correct, total),
            "validation_status": t.get("validation_status"),
        })

    if not detail:
        sys.exit("[ERROR] ไม่มีเอกสารที่มีทั้งเฉลยและผลสกัด")

    tp, fp, fn = rows_tot["tp"], rows_tot["fp"], rows_tot["fn"]
    precision, recall = pct(tp, tp + fp), pct(tp, tp + fn)
    f1 = round(2 * precision * recall / (precision + recall), 4) if precision and recall else None

    all_correct = sum(v[0] for v in header_tot.values()) + sum(v[0] for v in cell_tot.values())
    all_total = sum(v[1] for v in header_tot.values()) + sum(v[1] for v in cell_tot.values())

    # วิเคราะห์ค่าความมั่นใจ: ระบบเตือน (< 0.85) จับแถวที่ผิดได้กี่แถว
    with_conf = [c for c in conf_rows if c["confidence"] is not None]
    wrong = [c for c in with_conf if not c["correct"]]
    flagged = [c for c in with_conf if c["confidence"] < CONFIDENCE_THRESHOLD]
    confidence = {
        "threshold": CONFIDENCE_THRESHOLD,
        "rows": len(with_conf),
        "wrong_rows": len(wrong),
        "flagged_rows": len(flagged),
        "wrong_rows_flagged": pct(sum(1 for c in wrong if c["confidence"] < CONFIDENCE_THRESHOLD), len(wrong)),
        "flagged_rows_wrong": pct(sum(1 for c in flagged if not c["correct"]), len(flagged)),
        "mean_conf_correct": round(statistics.mean([c["confidence"] for c in with_conf if c["correct"]]), 3) if len(wrong) < len(with_conf) else None,
        "mean_conf_wrong": round(statistics.mean([c["confidence"] for c in wrong]), 3) if wrong else None,
    }

    ok_t = [t for t in timings.values() if t.get("total_ms") and t.get("pages")]
    latency = {
        "documents": len(ok_t),
        "pages": sum(t["pages"] for t in ok_t),
        "ms_per_page": describe([t["total_ms"] / t["pages"] for t in ok_t]),
        "ms_per_document": describe([t["total_ms"] for t in ok_t]),
        "stage_mean_ms": {
            s: round(statistics.mean([t[s] for t in ok_t]), 1) for s in ("preprocess_ms", "extract_ms", "validate_ms")
        } if ok_t else None,
    }

    skew_path = os.path.join(RESULT_DIR, "skew_summary.json")
    fields = [{"field": f, "accuracy": pct(*header_tot[f]), "n": header_tot[f][1]} for f in HEADER_FIELDS if header_tot[f][1]]
    fields += [{"field": f, "accuracy": pct(*cell_tot[f]), "n": cell_tot[f][1]} for f in COURSE_FIELDS if cell_tot[f][1]]
    if sem_gpa[1]:
        fields.append({"field": "semester_gpa", "accuracy": pct(*sem_gpa), "n": sem_gpa[1]})

    result = {
        "dataset": args.name or f"ชุดทดสอบทรานสคริปต์ {len(detail)} ฉบับ",
        "samples": len(detail),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "overall_accuracy": pct(all_correct, all_total),
        "by_language": {k: pct(*v) for k, v in sorted(lang_tot.items())},
        "fields": fields,
        "course_rows": {"precision": precision, "recall": recall, "f1": f1, "tp": tp, "fp": fp, "fn": fn},
        "confidence": confidence,
        "latency": latency,
        "deskew": load_json(skew_path) if os.path.exists(skew_path) else None,
    }

    save_json(os.path.join(RESULT_DIR, "evaluation.json"), result)
    with open(os.path.join(RESULT_DIR, "per_document.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(detail[0].keys()))
        w.writeheader()
        w.writerows(detail)
    if not args.no_frontend:
        save_json(os.path.abspath(FRONTEND_EVAL), result)

    print(f"\nเอกสาร {len(detail)} ฉบับ · ความแม่นยำรวม {result['overall_accuracy']:.1%}")
    print(f"แถวรายวิชา: Precision {precision:.1%} · Recall {recall:.1%} · F1 {f1:.1%}" if f1 else "แถวรายวิชา: -")
    for fl in fields:
        print(f"  {fl['field']:<22} {fl['accuracy']:.1%}  (n={fl['n']})")
    if latency["ms_per_page"]:
        print(f"เวลาต่อหน้า: เฉลี่ย {latency['ms_per_page']['mean'] / 1000:.1f} วินาที · p95 {latency['ms_per_page']['p95'] / 1000:.1f} วินาที")
    print(f"\nบันทึกผลที่ {RESULT_DIR} และ frontend/public/evaluation.json")
    return result


def main():
    ap = argparse.ArgumentParser(description="ประเมินความแม่นยำและเวลาประมวลผลของระบบสกัดทรานสคริปต์")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("skew", help="ทดสอบการแก้ภาพเอียง")
    s.add_argument("--max-pages", type=int, default=2)
    e = sub.add_parser("extract", help="สกัดข้อมูลชุดทดสอบด้วย Gemini")
    e.add_argument("--force", action="store_true", help="สกัดใหม่แม้มีผลอยู่แล้ว")
    e.add_argument("--sleep", type=float, default=5.0, help="พักระหว่างไฟล์ (วินาที) กัน rate limit")
    c = sub.add_parser("score", help="เทียบผลกับเฉลย")
    c.add_argument("--name", help="ชื่อชุดข้อมูลที่แสดงในรายงาน")
    c.add_argument("--no-frontend", action="store_true", help="ไม่ต้องคัดลอกผลไปหน้าเว็บ")
    a = sub.add_parser("all", help="skew + extract + score")
    a.add_argument("--max-pages", type=int, default=2)
    a.add_argument("--force", action="store_true")
    a.add_argument("--sleep", type=float, default=5.0)
    a.add_argument("--name")
    a.add_argument("--no-frontend", action="store_true")
    args = ap.parse_args()

    os.chdir(BACKEND)
    if args.cmd in ("skew", "all"):
        run_skew(args)
    if args.cmd in ("extract", "all"):
        run_extract(args)
    if args.cmd in ("score", "all"):
        run_score(args)


if __name__ == "__main__":
    main()
