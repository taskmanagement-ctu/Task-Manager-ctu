import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  ShieldCheck, 
  Shield, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  LogOut,
  X
} from 'lucide-react';
import './CompleteProfileModal.css';

const CompleteProfileModal: React.FC = () => {
  const { currentUser, refreshUser, logout } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Render if profile is incomplete OR if executive admin has missing/pending contact details
  const isSetupRequired = Boolean(
    currentUser && (
      currentUser.isProfileComplete === false ||
      (currentUser.isExecutiveAdmin && (
        !currentUser.phone ||
        currentUser.phone === '0000000000' ||
        currentUser.phone === '-' ||
        currentUser.phone.trim() === '' ||
        !currentUser.email ||
        currentUser.email === '-' ||
        currentUser.email.includes('@placeholder') ||
        currentUser.name === 'Executive Admin' ||
        currentUser.name === 'Pending Setup'
      ))
    )
  );

  if (!isSetupRequired) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = form.name.trim();
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }

    const cleanEmail = form.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid official email address.');
      return;
    }

    const cleanPhone = form.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (form.newPassword) {
      if (form.newPassword.length < 6) {
        setError('New personal password must be at least 6 characters long.');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError('New passwords do not match. Please verify.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await api.completeProfile({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        newPassword: form.newPassword ? form.newPassword : undefined,
      });

      if (res.success) {
        await refreshUser();
        window.location.reload();
      } else {
        setError(res.message || 'Failed to complete profile setup.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay cpm-overlay">
      <div 
        className="modal-content um-edit-modal-content cpm-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Standard Modal Header matching UserManagement & SystemSettings */}
        <div className="um-modal-header cpm-header">
          <div className="um-modal-header-icon cpm-header-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="um-modal-header-text" style={{ flex: 1 }}>
            <h3 className="um-modal-title">Complete Your Profile</h3>
            <p className="um-modal-subtitle">
              First-time setup: configure your official contact details and security credentials.
            </p>
          </div>
          <button
            type="button"
            className="um-modal-close-icon-btn cpm-close-btn"
            onClick={logout}
            disabled={isSubmitting}
            title="Log out and return to login screen"
            aria-label="Log out"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Card with ID and Role */}
        <div className="cpm-id-banner">
          <div className="cpm-id-badge-left">
            <Shield size={16} className="cpm-banner-shield" />
            <span>Account ID: <strong>{currentUser?.universityId}</strong></span>
          </div>
          <span className="cpm-role-tag">Executive Super Admin</span>
        </div>

        {error && (
          <div className="um-edit-error-alert cpm-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="cpm-form" autoComplete="off">
          {/* Full Name */}
          <div className="um-edit-form-group">
            <label htmlFor="cpm-fullname">
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              id="cpm-fullname"
              name="fullname"
              className="um-edit-input"
              placeholder="e.g. Dr. Harpreet Singh"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={isSubmitting}
              autoComplete="name"
              required
            />
          </div>

          {/* Official Email */}
          <div className="um-edit-form-group">
            <label htmlFor="cpm-email">
              Official Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              id="cpm-email"
              name="email"
              className="um-edit-input"
              placeholder="e.g. director@ctuniversity.in"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={isSubmitting}
              autoComplete="email"
              required
            />
          </div>

          {/* Mobile Phone Number */}
          <div className="um-edit-form-group">
            <label htmlFor="cpm-phone">
              Mobile Number (10 digits) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="tel"
              id="cpm-phone"
              name="mobile"
              className="um-edit-input"
              placeholder="Enter 10-digit mobile number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              maxLength={10}
              inputMode="numeric"
              disabled={isSubmitting}
              autoComplete="tel-national"
              required
            />
          </div>

          {/* Set Personal Password (Optional) */}
          <div className="cpm-password-card">
            <div className="cpm-password-header">
              <span className="cpm-password-title">Set Personal Password (Optional)</span>
              <button
                type="button"
                className="cpm-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Hide' : 'Show Passwords'}</span>
              </button>
            </div>
            <p className="cpm-password-desc">
              You can choose a private, permanent password now or keep the initial one provided to you.
            </p>

            <div className="cpm-password-grid">
              <div className="um-edit-form-group" style={{ margin: 0 }}>
                <label htmlFor="cpm-new-pwd">New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="cpm-new-pwd"
                  name="new-password"
                  className="um-edit-input"
                  placeholder="Min 6 characters"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>

              <div className="um-edit-form-group" style={{ margin: 0 }}>
                <label htmlFor="cpm-confirm-pwd">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="cpm-confirm-pwd"
                  name="confirm-password"
                  className="um-edit-input"
                  placeholder="Re-enter new password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </div>
          </div>

          {/* Modal Actions matching UserManagementPage standard */}
          <div className="modal-actions cpm-actions">
            <button
              type="button"
              className="btn-paginate cpm-btn-cancel"
              onClick={logout}
              disabled={isSubmitting}
              title="Logout and return to login screen"
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>

            <button
              type="submit"
              className="btn-add-user cpm-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="um-spin-icon" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Save &amp; Enter Portal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfileModal;
