/** เส้นทางทั้งหมดของแอป — ใช้ฟังก์ชันเหล่านี้แทนการพิมพ์ URL เองในแต่ละ component */
export const paths = {
  dashboard: () => '/',
  upload: () => '/upload',
  reviewQueue: () => '/review',
  review: (docId) => `/review/${docId}`,
  search: () => '/search',
  students: () => '/students',
  student: (docId) => `/students/${docId}`,
  export: () => '/export',
  evaluation: () => '/evaluation',
}
