import os
import cv2
import fitz  # PyMuPDF
import numpy as np


def read_image_safe(file_path: str) -> np.ndarray:
    """
    อ่านไฟล์รูปภาพอย่างปลอดภัย รองรับชื่อไฟล์และ Path ภาษาไทยบน Windows
    """
    try:
        data = np.fromfile(file_path, dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is not None:
            return img
    except Exception:
        pass
    return cv2.imread(file_path)


def write_image_safe(file_path: str, img: np.ndarray) -> bool:
    """
    บันทึกไฟล์รูปภาพอย่างปลอดภัย รองรับ Path ภาษาไทยบน Windows
    """
    try:
        ext = os.path.splitext(file_path)[1]
        success, encoded = cv2.imencode(ext, img)
        if success:
            encoded.tofile(file_path)
            return True
    except Exception:
        pass
    return cv2.imwrite(file_path, img)


def resize_guardrail(image: np.ndarray, max_dim: int = 3000) -> np.ndarray:
    """
    Guardrail: ปรับลดขนาดภาพถ่ายขนาดใหญ่เกินจำเป็น (เช่น ภาพกล้อง 48MP-108MP)
    ให้อยู่ในเกณฑ์เทียบเท่าความคมชัดมาตรฐาน 300 DPI เพื่อประหยัด RAM และเร่งการทำงานของ OpenCV
    """
    h, w = image.shape[:2]
    largest_dim = max(h, w)

    if largest_dim > max_dim:
        scale = max_dim / largest_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        # cv2.INTER_AREA ให้ผลลัพธ์คมชัดสูงสุดสำหรับการย่อภาพเอกสารที่มีตัวหนังสือ
        return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

    return image


def pdf_to_images(pdf_path: str, dpi: int = 300) -> list[np.ndarray]:
    """
    แปลงเอกสาร PDF แต่ละหน้าเป็นรูปภาพแบบ 300 DPI โดยตรงในหน่วยความจำ
    """
    doc = fitz.open(pdf_path)
    images = []

    # คำนวณอัตราส่วนการขยาย: PDF มาตรฐานอยู่ที่ 72 DPI (300 / 72 ≈ 4.1667)
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)

    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(matrix=matrix)

        # แปลงข้อมูลภาพจาก PyMuPDF ไปเป็น NumPy Array (BGR สำหรับ OpenCV)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        if pix.n == 4:  # กรณีเป็น RGBA
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:  # กรณีเป็น RGB
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        images.append(img)

    doc.close()
    return images


def deskew(image: np.ndarray) -> tuple[np.ndarray, float]:
    """
    ตรวจจับมุมเอียงของตัวอักษรและบรรทัด แล้วหมุนภาพกลับให้ได้ระนาบ 0 องศา
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # กลับสีตัวอักษรเป็นสีขาวบนพื้นหลังดำ เพื่อหาพิกัดข้อความ
    inv_gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(inv_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

    # คำนวณมุมเอียงจากกลุ่มพิกัดข้อความทั้งหมด
    # findNonZero คืนพิกัดแบบ (x, y) ตรงกับที่ minAreaRect ต้องการ
    coords = cv2.findNonZero(thresh)
    if coords is None:
        return image, 0.0

    angle = cv2.minAreaRect(coords)[-1]

    # OpenCV แต่ละรุ่นคืนมุมคนละช่วง ([-90, 0) หรือ [0, 90)) จึงปรับให้อยู่ในช่วง (-45, 45]
    # แล้วหมุนด้วยมุมนั้นโดยตรง ใช้ได้ทั้งภาพที่เอียงตามและทวนเข็มนาฬิกา
    while angle <= -45:
        angle += 90
    while angle > 45:
        angle -= 90

    # หมุนภาพโดยเติมพื้นหลังขอบเป็นสีขาว
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        m,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255),
    )

    return rotated, angle


def normalize_contrast(image: np.ndarray) -> np.ndarray:
    """
    ปรับปรุง Contrast ด้วยวิธี CLAHE (Contrast Limited Adaptive Histogram Equalization)
    ช่วยให้อ่านตัวหนังสือและเส้นตารางได้คมชัดขึ้น แม้ถ่ายในที่แสงน้อย
    """
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_l = clahe.apply(l_channel)

    merged = cv2.merge([enhanced_l, a_channel, b_channel])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def auto_crop(image: np.ndarray, padding: int = 40) -> np.ndarray:
    """
    ตัดเฉพาะขอบกระดาษส่วนเกินออก โดยรักษาทั้งส่วนหัว (Header)
    และตารางรายวิชา (Course Table) ไว้อย่างสมบูรณ์
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # มาร์กพิกเซลที่มีข้อความหรือเส้นตาราง (สีเข้มกว่าพื้นกระดาษขาว)
    thresh = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)[1]

    points = cv2.findNonZero(thresh)
    if points is None:
        return image

    x, y, w, h = cv2.boundingRect(points)
    (img_h, img_w) = image.shape[:2]

    # เพิ่มระยะขอบ (Padding) ป้องกันการตัดชิดตัวหนังสือเกินไป
    x1 = max(0, x - padding)
    y1 = max(0, y - padding)
    x2 = min(img_w, x + w + padding)
    y2 = min(img_h, y + h + padding)

    return image[y1:y2, x1:x2]


def preprocess_transcript_pipeline(
    input_target: str | list[str], output_dir: str = "preprocessed_output"
) -> list[str]:
    """
    รันกระบวนการ Pre-processing ครบวงจร รองรับทั้งไฟล์ PDF, รูปภาพเดี่ยว และหลายรูปภาพ (หน้า-หลัง):
    Input -> Guardrail Resize (<= 3000px) -> Deskew -> Contrast Normalization -> Auto-crop
    """
    os.makedirs(output_dir, exist_ok=True)
    raw_images = []

    # 1. โหลดข้อมูลภาพตามประเภท Input
    if isinstance(input_target, list):
        # กรณีส่งมาเป็นรายการไฟล์รูปภาพ (เช่น รูปหน้า-หลัง)
        for path in input_target:
            if not os.path.exists(path):
                raise FileNotFoundError(f"ไม่พบไฟล์: {path}")
            img = read_image_safe(path)
            if img is not None:
                raw_images.append(img)
    elif isinstance(input_target, str):
        if not os.path.exists(input_target):
            raise FileNotFoundError(f"ไม่พบไฟล์: {input_target}")

        ext = os.path.splitext(input_target)[1].lower()
        if ext == ".pdf":
            print(f"[PREPROCESS] กำลังแปลงไฟล์ PDF '{input_target}' เป็น 300 DPI...")
            raw_images = pdf_to_images(input_target, dpi=300)
        elif ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
            print(f"[PREPROCESS] ตรวจพบไฟล์รูปภาพ '{input_target}' เข้าสู่กระบวนการปรับปรุงภาพ...")
            img = read_image_safe(input_target)
            if img is not None:
                raw_images.append(img)
        else:
            raise ValueError(f"ไม่รองรับไฟล์นามสกุล: {ext}")
    else:
        raise TypeError("input_target ต้องเป็น str หรือ list[str]")

    if not raw_images:
        raise ValueError("ไม่สามารถอ่านข้อมูลภาพจาก Input ที่ระบุได้")

    output_files = []

    # 2. ปรับปรุงคุณภาพเอกสารทีละหน้า
    for idx, page_img in enumerate(raw_images):
        page_num = idx + 1
        print(f"--- ประมวลผลหน้า {page_num} ---")

        # 2.1 ดักความละเอียดให้อยู่ในเกณฑ์ 300 DPI (ไม่เกิน 3000px)
        guarded_img = resize_guardrail(page_img, max_dim=3000)

        # 2.2 บันทึกภาพต้นฉบับไว้เทียบ Before
        before_path = os.path.join(output_dir, f"page_{page_num}_1_original.png")
        write_image_safe(before_path, guarded_img)

        # 2.3 แก้มุมเอียง (Deskew)
        deskewed_img, angle = deskew(guarded_img)
        print(f"- ตรวจพบมุมเอียง: {angle:.2f} องศา (ปรับระนาบเรียบร้อย)")

        # 2.4 ปรับ Contrast ด้วย CLAHE
        contrast_img = normalize_contrast(deskewed_img)

        # 2.5 ตัดขอบส่วนเกิน (Auto-crop)
        final_img = auto_crop(contrast_img)

        # 2.6 บันทึกภาพผลลัพธ์ After พร้อมส่งต่อให้ Gemini Vision
        after_path = os.path.join(output_dir, f"page_{page_num}_2_processed_final.png")
        write_image_safe(after_path, final_img)
        output_files.append(after_path)
        print(f"[SUCCESS] บันทึกภาพพร้อมใช้งาน: {after_path}")

    return output_files


if __name__ == "__main__":
    sample_pdf = "transcript_sample.pdf"
    if os.path.exists(sample_pdf):
        results = preprocess_transcript_pipeline(sample_pdf)
        print("\n=== กระบวนการ Pre-processing สมบูรณ์ ===")
        print(f"บันทึกไฟล์ภาพพร้อมใช้งานไว้ที่: {results}")
    else:
        print(f"ไม่พบไฟล์ '{sample_pdf}' สำหรับทดสอบ")