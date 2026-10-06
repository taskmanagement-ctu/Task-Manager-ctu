import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import './TopbarBreadcrumbs.css';

interface TopbarBreadcrumbsProps {
  roleLabel: string;
  departmentName?: string | null;
}

const ROUTE_NAME_MAP: Record<string, string> = {
  // Super Admin
  '/super-admin': 'Dashboard',
  '/super-admin/tasks': 'Task Management',
  '/super-admin/team': 'Team Directory',
  '/super-admin/users': 'User Accounts',
  '/super-admin/staff-manage': 'Staff Assignments',
  '/super-admin/departments': 'Departments',
  '/super-admin/naac': 'NAAC Dashboard',
  '/super-admin/verified-users': 'Verified Users',
  '/super-admin/profile': 'Profile & Security',

  // Dept Admin
  '/admin': 'Dashboard',
  '/admin/tasks': 'Department Tasks',
  '/admin/staff': 'Department Staff',
  '/admin/verified-users': 'Verified Users',
  '/admin/profile': 'Profile & Security',

  // Staff
  '/staff': 'My Workspace',
  '/staff/tasks': 'Assigned Tasks',
  '/staff/profile': 'Profile & Security',
};

export const TopbarBreadcrumbs: React.FC<TopbarBreadcrumbsProps> = ({
  roleLabel,
  departmentName,
}) => {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/$/, '') || '/';

  // Find exact match or match base route
  let pageTitle = ROUTE_NAME_MAP[currentPath];
  if (!pageTitle) {
    // Attempt fallback from path segment
    const segments = currentPath.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      pageTitle = last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
    } else {
      pageTitle = 'Dashboard';
    }
  }

  return (
    <div className="tbc-container" aria-label="Breadcrumb and Context">
      {/* Role / Section pill (Desktop only) */}
      <div className="tbc-section-badge">
        <span className="tbc-section-text">{roleLabel}</span>
      </div>

      <ChevronRight size={14} className="tbc-separator" aria-hidden="true" />

      {/* Active Page Title (Visible on both Desktop and Mobile) */}
      <div className="tbc-page-title-box">
        <h1 className="tbc-page-title">{pageTitle}</h1>
        {departmentName && (
          <span className="tbc-dept-sub">({departmentName})</span>
        )}
      </div>

      {/* CTU Academic Session Badge (Desktop/Tablet only) */}
      <div className="tbc-session-badge" title="Active Institutional Academic Session">
        <span className="tbc-status-dot" />
        <Calendar size={12} className="tbc-session-icon" />
        <span className="tbc-session-text">Session 2024–25</span>
      </div>
    </div>
  );
};

export default TopbarBreadcrumbs;
