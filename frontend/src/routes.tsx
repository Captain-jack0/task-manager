import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LandingPage } from '@/features/landing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { ReviewPage } from '@/features/review/ReviewPage';

export const router = createBrowserRouter([
  // Public marketing page — visitors land here, not on the login form.
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    // Pathless layout: the authenticated app keeps its existing URLs
    // (/tasks, /review, …) so calendar-feed and GitHub links stay valid.
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/tasks', element: <TasksPage /> },
      { path: '/tasks/:id', element: <TaskDetailPage /> },
      { path: '/review', element: <ReviewPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
