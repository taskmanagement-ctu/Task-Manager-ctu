import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  UserPlus, 
  UserCheck, 
  Building, 
  BarChart2,
  Menu,
  X
} from 'lucide-react';
import './SuperAdminLayout.css';
import UserProfileDropdown from './UserProfileDropdown';
import NotificationDropdown from './NotificationDropdown';
import TopbarBreadcrumbs from './TopbarBreadcrumbs';
import { useSettings } from '../context/SettingsContext';
import PortalBrandLogo from './PortalBrandLogo';

const SuperAdminLayout: React.FC = () => {
  const { currentUser } = useAuth();
  const { systemName } = useSettings();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Background body scroll lock & ESC key listener
  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileSidebarOpen]);

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
      setIsMobileSidebarOpen(false);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (currentUser?.role !== 'super_admin') {
    return null; 
  }

  return (
    <div className="sa-layout-container">
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="sa-sidebar-backdrop sa-sidebar-overlay" 
          onClick={() => setIsMobileSidebarOpen(false)} 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Sidebar (Desktop & Mobile) */}
      <aside 
        className={`sa-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sa-sidebar-header">
          <div className="sa-sidebar-brand-group">
            <PortalBrandLogo />
            <span className="sa-sidebar-title">{systemName}</span>
          </div>
          <button 
            type="button"
            className="sa-sidebar-close-btn" 
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close navigation menu"
            title="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="sa-sidebar-section-title">Super Admin</div>
        
        <nav className="sa-sidebar-nav">
          <NavLink to="/super-admin" end className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/super-admin/tasks" className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <FileText size={18} /> Tasks
          </NavLink>
          <NavLink to="/super-admin/team" className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <Users size={18} /> Manage Team
          </NavLink>
          <NavLink to="/super-admin/users" className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <UserCheck size={18} /> Users
          </NavLink>
          <NavLink to="/super-admin/staff-manage" className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <UserPlus size={18} /> Manage Staff
          </NavLink>
          <NavLink to="/super-admin/departments" className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <Building size={18} /> Departments
          </NavLink>
          <NavLink to="/super-admin/naac" className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
            <BarChart2 size={18} /> NAAC Dashboard
          </NavLink>
        </nav>
      </aside>

      <main className="sa-main-content">
        {/* Top Navbar */}
        <header className="sa-topbar">
          <div className="sa-topbar-left">
            <button 
              className="sa-mobile-menu-btn" 
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <TopbarBreadcrumbs roleLabel="Super Admin" />
          </div>
          <div className="sa-topbar-right">
            <NotificationDropdown />
            <UserProfileDropdown 
              user={currentUser}
              roleLabel="Super Admin"
              avatarBg="e2e8f0"
              avatarColor="0f172a"
              profilePath="/super-admin/profile"
            />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="sa-content-scroll">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;

