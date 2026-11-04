import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { StoreProvider } from './lib/store'
import { AddInfo } from './pages/AddInfo'
import { CommandCenter } from './pages/CommandCenter'
import { DepartmentHub, DepartmentsIndex } from './pages/Departments'
import { NotFound } from './pages/NotFound'
import { EquipmentDetail, GlossaryDetail, GlossaryIndex, SystemDetail, SystemsIndex } from './pages/Reference'
import { Review } from './pages/Review'
import { SearchPage } from './pages/Search'
import { WorkflowsIndex } from './pages/Workflows'
import './styles/app.css'

// The flowchart engine is the heaviest part of the app — load it on demand.
const WorkflowExplorer = lazy(() => import('./explorer/Explorer').then((m) => ({ default: m.WorkflowExplorer })))

const Explorer = () => (
  <Suspense
    fallback={
      <div className="loading" aria-busy="true">
        <div className="loading__ridge" />
        <p>Opening workflow…</p>
      </div>
    }
  >
    <WorkflowExplorer />
  </Suspense>
)

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorBoundary.RouteError />,
    children: [
      { path: '/', element: <CommandCenter /> },
      { path: '/departments', element: <DepartmentsIndex /> },
      { path: '/departments/:id', element: <DepartmentHub /> },
      { path: '/workflows', element: <WorkflowsIndex /> },
      { path: '/workflows/:id', element: <Explorer /> },
      { path: '/systems', element: <SystemsIndex /> },
      { path: '/systems/:id', element: <SystemDetail /> },
      { path: '/equipment', element: <SystemsIndex /> },
      { path: '/equipment/:id', element: <EquipmentDetail /> },
      { path: '/glossary', element: <GlossaryIndex /> },
      { path: '/glossary/:id', element: <GlossaryDetail /> },
      { path: '/review', element: <Review /> },
      { path: '/review/notes', element: <Review /> },
      { path: '/review/sources', element: <Review /> },
      { path: '/add', element: <AddInfo /> },
      { path: '/add/:kind', element: <AddInfo /> },
      { path: '/search', element: <SearchPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <RouterProvider router={router} />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)
