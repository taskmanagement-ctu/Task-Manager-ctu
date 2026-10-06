import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './StaffLayout.css';
import UserProfileDropdown from './UserProfileDropdown';
import NotificationDropdown from './NotificationDropdown';
import TopbarBreadcrumbs from './TopbarBreadcrumbs';
import { useSettings } from '../context/SettingsContext';
import PortalBrandLogo from './PortalBrandLogo';

const StaffLayout: React.FC = () => {
  const { currentUser: user } = useAuth();
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

  const navLinks = [
    { to: "/staff", icon: <LayoutDashboard size={20} />, label: "Dashboard", end: true },
    { to: "/staff/tasks", icon: <CheckSquare size={20} />, label: "My Tasks" },
  ];

  return (
    <div className="staff-layout">
      {isMobileSidebarOpen && (
        <div 
          className="staff-sidebar-overlay" 
          onClick={() => setIsMobileSidebarOpen(false)} 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside 
        className={`staff-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="staff-sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PortalBrandLogo />
            <div>
              <div>{systemName}</div>
              <div className="staff-brand-sub">PORTAL</div>
            </div>
          </div>
          <button 
            type="button"
            className="staff-sidebar-close-btn" 
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close navigation menu"
            title="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="staff-sidebar-nav">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `staff-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>
        
        <div className="staff-sidebar-footer">
          Institutional Access &copy; 2024
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="staff-main">
        {/* Top Navbar */}
        <header className="staff-topbar">
          <div className="staff-topbar-left">
            <button 
              className="staff-mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <TopbarBreadcrumbs roleLabel="Staff" departmentName={user?.department} />
          </div>

          <div className="staff-topbar-right">
            <NotificationDropdown />

            <UserProfileDropdown 
              user={user}
              roleLabel="Staff"
              avatarBg="0f172a"
              avatarColor="fff"
              profilePath="/staff/profile"
            />
          </div>
        </header>

        {/* Page Content */}
        <div className="staff-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StaffLayout;

