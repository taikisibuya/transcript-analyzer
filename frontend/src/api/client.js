import axios from 'axios'

/** axios instance กลาง — dev ใช้ proxy ของ Vite (/api → :8000), production เสิร์ฟจาก FastAPI โดเมนเดียวกัน */
export const http = axios.create({ baseURL: '/api', timeout: 120000 })

/** แปลง error จาก axios เป็นข้อความภาษาไทยที่อ่านเข้าใจ */
export function getErrorMessage(err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') {
  if (err?.response?.data?.detail) {
    const d = err.response.data.detail
    return typeof d === 'string' ? d : JSON.stringify(d)
  }
  if (err?.code === 'ERR_NETWORK') return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่'
  if (err?.code === 'ECONNABORTED') return 'เซิร์ฟเวอร์ตอบกลับช้าเกินไป กรุณาลองใหม่'
  return err?.message || fallback
}
