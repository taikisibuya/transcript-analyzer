-- ============================================================
-- Migration 001: ปรับตาราง documents ให้ตรงกับโค้ด backend และหน้าจอใหม่
-- ใช้กับฐานข้อมูลที่สร้างไว้แล้ว (รันซ้ำได้อย่างปลอดภัย)
--   docker exec -i transcript-db psql -U postgres -d transcript_db < migrations/001_ui_redesign.sql
-- ============================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS validation_report JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_ms INT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS overall_confidence NUMERIC(4, 3);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS page_count INT DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- review_status: โค้ดใช้ 'APPROVED' แต่ schema เดิมอนุญาตเฉพาะ 'VERIFIED'
UPDATE documents SET review_status = 'APPROVED' WHERE review_status = 'VERIFIED';
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'documents'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%review_status%'
  LOOP
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE documents ADD CONSTRAINT documents_review_status_check
  CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_documents_review_status ON documents(review_status);
