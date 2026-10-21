import { FileQuestion } from 'lucide-react'
import AppLayout from './components/layout/AppLayout'
import Button from './components/ui/Button'
import EmptyState from './components/ui/EmptyState'
import { DocumentsProvider } from './context/DocumentsProvider'
import { FeedbackProvider } from './context/FeedbackProvider'
import { UploadProvider } from './context/UploadProvider'
import DashboardPage from './features/dashboard/DashboardPage'
import EvaluationPage from './features/evaluation/EvaluationPage'
import ExportPage from './features/export/ExportPage'
import ReviewerPage from './features/reviewer/ReviewerPage'
import ReviewQueueRedirect from './features/reviewer/ReviewQueueRedirect'
import SearchPage from './features/search/SearchPage'
import StudentListPage from './features/students/StudentListPage'
import StudentProfilePage from './features/students/StudentProfilePage'
import UploadPage from './features/upload/UploadPage'
import { RouterProvider, Routes } from './router/Router'
import { paths } from './router/paths'

const withLayout = (page) => <AppLayout>{page}</AppLayout>

function NotFound() {
  return withLayout(
    <div className="card">
      <EmptyState icon={FileQuestion} title="ไม่พบหน้าที่ต้องการ" description="ลิงก์อาจไม่ถูกต้องหรือหน้านี้ถูกย้ายแล้ว" action={<Button to={paths.dashboard()}>กลับหน้าภาพรวม</Button>} />
    </div>,
  )
}

const routes = [
  { path: '/', element: withLayout(<DashboardPage />) },
  { path: '/upload', element: withLayout(<UploadPage />) },
  { path: '/review', element: withLayout(<ReviewQueueRedirect />) },
  { path: '/review/:docId', element: <ReviewerPage /> }, // โหมดเต็มจอ ไม่มีแถบเมนู
  { path: '/search', element: withLayout(<SearchPage />) },
  { path: '/students', element: withLayout(<StudentListPage />) },
  { path: '/students/:docId', element: withLayout(<StudentProfilePage />) },
  { path: '/export', element: withLayout(<ExportPage />) },
  { path: '/evaluation', element: withLayout(<EvaluationPage />) },
  { path: '*', element: <NotFound /> },
]

export default function App() {
  return (
    <RouterProvider>
      <FeedbackProvider>
        <DocumentsProvider>
          <UploadProvider>
            <Routes routes={routes} />
          </UploadProvider>
        </DocumentsProvider>
      </FeedbackProvider>
    </RouterProvider>
  )
}
