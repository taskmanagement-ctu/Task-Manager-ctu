import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Menu, 
  ShieldCheck,
  CalendarClock,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import './DeptAdminLayout.css';
import UserProfileDropdown from './UserProfileDropdown';
import NotificationDropdown from './NotificationDropdown';
import TopbarBreadcrumbs from './TopbarBreadcrumbs';
import { useSettings } from '../context/SettingsContext';
import PortalBrandLogo from './PortalBrandLogo';

const DeptAdminLayout: React.FC = () => {
  const { currentUser: user } = useAuth();
  const { systemName } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canAccessVerified, setCanAccessVerified] = useState(false);
  const [pendingDeadlinesCount, setPendingDeadlinesCount] = useState<number>(0);

  // Background body scroll lock & ESC key listener
  useEffect(() => {
    if (!sidebarOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  // Touch swipe left to close drawer
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Swiped left by > 40px
    if (diffX < -40 && Math.abs(diffX) > Math.abs(diffY)) {
      setSidebarOpen(false);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  useEffect(() => {
    api.getMyDepartmentPermissions()
      .then(res => {
        if (res.success && res.data.verifiedUserAccess && res.data.verifiedUserAccess !== 'none') {
          setCanAccessVerified(true);
        }
      })
      .catch(err => {
        console.error('Failed to check verified user access', err);
      });

    api.getDeadlineRequests({ status: 'pending', limit: 1 })
      .then(res => {
        if (res.success && res.data?.counts?.pending !== undefined) {
          setPendingDeadlinesCount(res.data.counts.pending);
        }
      })
      .catch(() => {});
  }, []);

  const navLinks = [
    { to: "/admin", icon: <LayoutDashboard size={20} />, label: "Dashboard", end: true },
    { to: "/admin/tasks", icon: <CheckSquare size={20} />, label: "Tasks" },
    { 
      to: "/admin/deadline-requests", 
      icon: <CalendarClock size={20} />, 
      label: "Deadline Requests",
      badge: pendingDeadlinesCount > 0 ? pendingDeadlinesCount : undefined
    },
    { to: "/admin/staff", icon: <Users size={20} />, label: "My Team" },
    ...(canAccessVerified ? [{ to: "/admin/verified-users", icon: <ShieldCheck size={20} />, label: "Verified Users" }] : []),
  ];

  return (
    <div className="dept-admin-layout">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="dept-sidebar-overlay" 
          onClick={() => setSidebarOpen(false)} 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`dept-sidebar ${sidebarOpen ? 'open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="dept-sidebar-header">
          <div className="dept-sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PortalBrandLogo />
            <span>{systemName}</span>
          </div>
          <button 
            type="button"
            className="dept-sidebar-close-btn" 
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
            title="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="dept-sidebar-content">
          <div className="dept-sidebar-title">Department Admin</div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `dept-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{link.icon}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{link.label}</span>
                {link.badge !== undefined && (
                  <span style={{
                    marginLeft: 'auto',
                    backgroundColor: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '12px',
                    lineHeight: 1.2,
                    flexShrink: 0
                  }}>
                    {link.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dept-main">
        {/* Top Navbar */}
        <header className="dept-topbar">
          <div className="dept-topbar-left">
            <button 
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            
            <TopbarBreadcrumbs roleLabel="Department Admin" departmentName={user?.department} />
          </div>

          <div className="dept-topbar-right">
            <NotificationDropdown />

            <UserProfileDropdown 
              user={user}
              roleLabel="Department Admin"
              avatarBg="1e3a8a"
              avatarColor="fff"
              profilePath="/admin/profile"
            />
          </div>
        </header>

        {/* Page Content */}
        <div className="dept-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DeptAdminLayout;

