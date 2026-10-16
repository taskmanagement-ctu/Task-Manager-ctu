import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import SuperAdminPage from '../pages/SuperAdminPage';
import AdminPage from '../pages/AdminPage';
import StaffPage from '../pages/StaffPage';
import VerifiedUsersPage from '../pages/VerifiedUsersPage';
import UserManagementPage from '../pages/UserManagementPage';

import SuperAdminStaffAssignmentsPage from '../pages/SuperAdminStaffAssignmentsPage';
import SuperAdminDepartmentsPage from '../pages/SuperAdminDepartmentsPage';
import SuperAdminTeamPage from '../pages/SuperAdminTeamPage';
import DeptAdminStaffPage from '../pages/DeptAdminStaffPage';
import TasksPage from '../pages/TasksPage';
import NaacDashboardPage from '../pages/NaacDashboardPage';
import ProfilePage from '../pages/ProfilePage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SettingsProvider } from '../context/SettingsContext';
import ProtectedRoute from '../components/ProtectedRoute';
import SuperAdminLayout from '../components/SuperAdminLayout';
import DeptAdminLayout from '../components/DeptAdminLayout';
import StaffLayout from '../components/StaffLayout';
import SystemSettingsModal from '../components/SystemSettingsModal';

/** Smart dispatcher for generic /tasks links (e.g. from notification emails) */
const TaskRedirectHandler = () => {
  const { isAuthenticated, loading, currentUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-container"><div className="vu-loading">Loading...</div></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const search = location.search || '';
  let targetPath = '/staff/tasks';
  if (currentUser?.role === 'super_admin') {
    targetPath = '/super-admin/tasks';
  } else if (currentUser?.role === 'department_admin') {
    targetPath = '/admin/tasks';
  }

  return <Navigate to={`${targetPath}${search}`} replace />;
};

const AppRouter = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <SystemSettingsModal />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/tasks" element={<TaskRedirectHandler />} />
            <Route path="/tasks/*" element={<TaskRedirectHandler />} />
          
            {/* Super Admin Routes */}
            <Route path="/super-admin" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<SuperAdminPage />} />
              <Route path="users" element={<UserManagementPage />} />
              <Route path="verified-users" element={<VerifiedUsersPage />} />
              <Route path="team" element={<SuperAdminTeamPage />} />
              <Route path="staff-manage" element={<SuperAdminStaffAssignmentsPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="departments" element={<SuperAdminDepartmentsPage />} />
              <Route path="naac" element={<NaacDashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<Navigate to="/super-admin/tasks" replace />} />
              <Route path="alerts" element={<div>Alerts Work In Progress</div>} />
              <Route path="more" element={<div>More Options</div>} />
            </Route>

            {/* Department Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['department_admin']}>
                <DeptAdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminPage />} />
              <Route path="staff" element={<DeptAdminStaffPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="verified-users" element={<VerifiedUsersPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<Navigate to="/admin/tasks" replace />} />
            </Route>

            {/* Aliases for /dept-admin */}
            <Route path="/dept-admin" element={<Navigate to="/admin" replace />} />
            <Route path="/dept-admin/tasks" element={<Navigate to="/admin/tasks" replace />} />
            <Route path="/dept-admin/staff" element={<Navigate to="/admin/staff" replace />} />
            <Route path="/dept-admin/verified-users" element={<Navigate to="/admin/verified-users" replace />} />
            <Route path="/dept-admin/profile" element={<Navigate to="/admin/profile" replace />} />
            <Route path="/dept-admin/*" element={<Navigate to="/admin" replace />} />

            {/* Staff Routes */}
            <Route path="/staff" element={
              <ProtectedRoute allowedRoles={['staff']}>
                <StaffLayout />
              </ProtectedRoute>
            }>
              <Route index element={<StaffPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<Navigate to="/staff/tasks" replace />} />
            </Route>

            {/* Global fallback route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default AppRouter;
