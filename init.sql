-- 1. เปิดใช้งาน Extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ตาราง documents (จัดการไฟล์และบันทึกประวัติ Ingestion)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_hash_sha256 CHAR(64) UNIQUE NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    page_count INT DEFAULT 1,
    overall_confidence NUMERIC(4, 3),
    processing_ms INT,                         -- [NEW] เวลาประมวลผล pipeline ทั้งเอกสาร (มิลลิวินาที)
    validation_status VARCHAR(20) CHECK (validation_status IN ('PASSED', 'WARNING', 'FAILED')),
    validation_report JSONB,
    review_status VARCHAR(20) DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_at TIMESTAMPTZ,
    raw_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ตาราง students (ประวัติผู้เรียนและโครงสร้างหลักสูตร - ปรับปรุงใหม่)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    citizen_id VARCHAR(20),
    title_th VARCHAR(50),
    title_en VARCHAR(50),
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    institution VARCHAR(255) NOT NULL,
    institution_code VARCHAR(50),              -- [NEW] เพิ่มรหัสสถานศึกษา
    faculty VARCHAR(255),
    department VARCHAR(255),
    major VARCHAR(255),
    sub_major VARCHAR(255),
    study_plan VARCHAR(255),
    degree_name_th VARCHAR(255),
    degree_name_en VARCHAR(255),
    admission_date VARCHAR(100),              -- [NEW] เพิ่มวันที่เข้าศึกษาแบบเต็ม
    graduation_date VARCHAR(100),             -- [NEW] เพิ่มวันที่สำเร็จการศึกษาแบบเต็ม
    admission_year INT,                       -- ปรับเป็น Nullable เพื่อรองรับ admission_date
    graduation_year INT,
    education_status VARCHAR(50) DEFAULT 'GRADUATED',
    honors VARCHAR(100),
    total_credits_attempted NUMERIC(5, 1),
    total_credits_earned NUMERIC(5, 1),
    gpa_cumulative NUMERIC(3, 2) NOT NULL,
    additional_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ตาราง academic_semesters (สถิติผลการเรียนรายภาคการศึกษา)
CREATE TABLE academic_semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_profile_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year INT NOT NULL,
    semester VARCHAR(20) NOT NULL,
    credits_attempted NUMERIC(4, 1),
    credits_earned NUMERIC(4, 1),
    gpa_semester NUMERIC(3, 2),
    gpa_cumulative NUMERIC(3, 2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ตาราง courses (รายละเอียดวิชาและพิกัดเวกเตอร์สืบค้นทักษะ)
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id UUID NOT NULL REFERENCES academic_semesters(id) ON DELETE CASCADE,
    student_profile_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_code VARCHAR(50) NOT NULL,
    course_name_th VARCHAR(255) NOT NULL,
    course_name_en VARCHAR(255),
    credits NUMERIC(3, 1) CHECK (credits >= 0),
    grade VARCHAR(10) NOT NULL,
    grade_point NUMERIC(3, 2),
    confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    skill_keywords TEXT,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ดัชนีเพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX idx_documents_review_status ON documents(review_status);
CREATE INDEX idx_students_document_id ON students(document_id);
CREATE INDEX idx_semesters_student_profile_id ON academic_semesters(student_profile_id);
CREATE INDEX idx_courses_semester_id ON courses(semester_id);
CREATE INDEX idx_courses_student_profile_id ON courses(student_profile_id);

-- ดัชนี HNSW สำหรับ Semantic Vector Search (Cosine Distance)
CREATE INDEX courses_embedding_hnsw_idx 
ON courses USING hnsw (embedding vector_cosine_ops);