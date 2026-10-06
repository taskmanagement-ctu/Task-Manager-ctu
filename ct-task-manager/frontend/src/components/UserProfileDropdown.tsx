import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown, Building, Shield, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import './UserProfileDropdown.css';

interface UserProfileDropdownProps {
  user: any;
  roleLabel: string;
  avatarBg?: string;
  avatarColor?: string;
  profilePath: string;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  user,
  roleLabel,
  avatarBg = '0f172a',
  avatarColor = 'fff',
  profilePath,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { openSettingsModal } = useSettings();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNavigateProfile = () => {
    setIsOpen(false);
    navigate(profilePath);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    openSettingsModal();
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=${avatarBg}&color=${avatarColor}`;

  return (
    <div className="upd-container" ref={dropdownRef}>
      {/* Trigger: Profile Header */}
      <div 
        className={`upd-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Click to view profile menu"
      >
        <div className="upd-info">
          <span className="upd-name">
            {user?.name || 'User'}
          </span>
          <span className="upd-role">
            {roleLabel}{user?.role !== 'super_admin' && user?.department ? ` : ${user?.department}` : ''}
          </span>
        </div>
        <div 
          className="upd-avatar" 
          style={{ backgroundImage: `url(${avatarUrl})` }}
        />
        <ChevronDown size={14} className={`upd-chevron ${isOpen ? 'open' : ''}`} />
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="upd-popover">
          <div className="upd-popover-header">
            <div className="upd-popover-avatar" style={{ backgroundImage: `url(${avatarUrl})` }} />
            <div className="upd-popover-user">
              <h4 className="upd-popover-name">{user?.name}</h4>
              <span className="upd-popover-email">{user?.email}</span>
              <div className="upd-popover-badges">
                <span className="upd-badge-role">
                  <Shield size={11} /> {roleLabel}
                </span>
                {user?.universityId && (
                  <span className="upd-badge-id">ID: {user?.universityId}</span>
                )}
              </div>
            </div>
          </div>

          {user?.role !== 'super_admin' && user?.department && (
            <div className="upd-popover-dept">
              <Building size={13} />
              <span>{user?.department}</span>
            </div>
          )}

          <div className="upd-popover-divider" />

          <div className="upd-popover-menu">
            <button className="upd-menu-item" onClick={handleNavigateProfile}>
              <User size={16} />
              <div className="upd-menu-text">
                <span className="upd-menu-title">
                  {user?.role === 'super_admin' ? 'My Profile' : 'My Profile & Performance'}
                </span>
                <span className="upd-menu-sub">
                  {user?.role === 'super_admin' ? 'Manage account details' : 'View personal details & star ratings'}
                </span>
              </div>
            </button>

            {user?.role === 'super_admin' && (
              <button className="upd-menu-item" onClick={handleOpenSettings}>
                <Settings size={16} />
                <div className="upd-menu-text">
                  <span className="upd-menu-title">Settings</span>
                  <span className="upd-menu-sub">System name & branding</span>
                </div>
              </button>
            )}
          </div>

          <div className="upd-popover-divider" />

          <div className="upd-popover-footer">
            <button className="upd-menu-item upd-logout" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;
