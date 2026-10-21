# ใช้ Python 3.11 Slim เป็น Base Image
FROM python:3.11-slim

# ตั้งค่า Environment Variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# ติดตั้ง System Dependencies ที่จำเป็นสำหรับ OpenCV และ PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# คัดลอกและติดตั้ง Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอกโค้ด Backend ทั้งหมด
COPY . .

# สร้างโฟลเดอร์รองรับการอัปโหลดไฟล์
RUN mkdir -p uploads

EXPOSE 8000

# รัน FastAPI ด้วย Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]