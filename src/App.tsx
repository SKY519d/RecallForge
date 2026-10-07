import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AccountGate } from './components/auth/AccountGate';
import { AppLayout } from './components/layout/AppLayout';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const QuestionsPage = lazy(() => import('./pages/QuestionsPage').then((module) => ({ default: module.QuestionsPage })));
const AddQuestionPage = lazy(() => import('./pages/AddQuestionPage').then((module) => ({ default: module.AddQuestionPage })));
const QuestionDetailPage = lazy(() => import('./pages/QuestionDetailPage').then((module) => ({ default: module.QuestionDetailPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((module) => ({ default: module.ReviewPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const PlannerPage = lazy(() => import('./pages/PlannerPage').then((module) => ({ default: module.PlannerPage })));

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AccountGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Suspense fallback={<PageLoading />}><DashboardPage /></Suspense>} />
            <Route path="questions" element={<Suspense fallback={<PageLoading />}><QuestionsPage /></Suspense>} />
            <Route path="questions/:id" element={<Suspense fallback={<PageLoading />}><QuestionDetailPage /></Suspense>} />
            <Route path="add" element={<Suspense fallback={<PageLoading />}><AddQuestionPage /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<PageLoading />}><AnalyticsPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoading />}><SettingsPage /></Suspense>} />
            <Route path="planner" element={<Suspense fallback={<PageLoading />}><PlannerPage /></Suspense>} />
            <Route path="review" element={<Suspense fallback={<PageLoading />}><ReviewPage /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AccountGate>
    </BrowserRouter>
  );
}

function PageLoading() {
  return <div className="page-loading" role="status">Opening your workspace…</div>;
}
