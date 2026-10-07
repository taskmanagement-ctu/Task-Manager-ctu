import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, Building, Shield, Award, Star, CheckCircle, 
  Clock, AlertTriangle, Calendar, Save, Check, Trophy, Crown,
  Lock, Eye, EyeOff, KeyRound, ShieldCheck, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './ProfilePage.css';

export const ProfilePage: React.FC = () => {
  const { currentUser: authUser, refreshUser } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccessMsg, setPwSuccessMsg] = useState('');
  const [pwErrorMsg, setPwErrorMsg] = useState('');

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    if (pass.length < 6) return { score: 1, label: 'Too Short', color: '#ef4444' };
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 2) return { score: 1, label: 'Weak', color: '#f59e0b' };
    if (score <= 4) return { score: 2, label: 'Good', color: '#3b82f6' };
    return { score: 3, label: 'Strong', color: '#10b981' };
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErrorMsg('');
    setPwSuccessMsg('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwErrorMsg('All password fields are required.');
      return;
    }

    if (newPassword.length < 8) {
      setPwErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setPwErrorMsg('New password must be different from current password.');
      return;
    }

    try {
      setPwLoading(true);
      const res = await api.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setPwSuccessMsg(res.message || 'Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPwSuccessMsg(''), 5000);
      }
    } catch (err: any) {
      setPwErrorMsg(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPwLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileRes, deptRes] = await Promise.all([
        api.getUserProfile(),
        api.getDepartments()
      ]);

      if (profileRes.success) {
        setProfileData(profileRes.data);
        setDepartment(profileRes.data.user.department || '');
        setPhone(profileRes.data.user.phone || '');
        setName(profileRes.data.user.name || '');
      }

      if (deptRes.success) {
        setDepartments(deptRes.data.departments || []);
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setErrorMsg(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg('');
      setErrorMsg('');

      const res = await api.updateUserProfile({
        department: department || undefined,
        phone: phone || undefined,
        name: name || undefined,
      });

      if (res.success) {
        setSuccessMsg('Profile updated successfully!');
        await refreshUser();
        await fetchProfile();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pp-loading-container">
        <div className="pp-spinner" />
        <p>Loading profile details...</p>
      </div>
    );
  }

  const user = profileData?.user || authUser;
  const departmentStats = profileData?.departmentStats || null;
  const performance = profileData?.performance || {
    totalCompleted: 0,
    onTimeCount: 0,
    overdueCount: 0,
    onTimePercentage: 100,
    totalRatings: 0,
    averageRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    reviews: []
  };

  const roleDisplay = 
    user.role === 'super_admin' ? 'Super Admin' :
    user.role === 'department_admin' ? 'Department Admin' : 'Staff Member';

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0f172a&color=fff&size=128`;

  return (
    <div className="pp-page">
      {/* Header Banner */}
      <div className="pp-header-card">
        <div className="pp-header-profile">
          <div className="pp-avatar" style={{ backgroundImage: `url(${avatarUrl})` }} />
          <div className="pp-header-info">
            <div className="pp-name-row">
              <h1 className="pp-user-name">{user.name}</h1>
              <span className="pp-role-badge">
                <Shield size={13} /> {roleDisplay}
              </span>
            </div>
            <p className="pp-user-id">University ID: <strong>{user.universityId || 'N/A'}</strong></p>
            {user.role !== 'super_admin' && (
              <p className="pp-user-dept">
                <Building size={14} /> 
                {user.department ? user.department : <span className="pp-no-dept">Department Not Assigned</span>}
              </p>
            )}
          </div>
        </div>

        {/* Middle Header: Department Rating & University Rank (strictly for Dept Admin) */}
        {user.role === 'department_admin' && departmentStats && (
          <div className="pp-dept-score-banner">
            <div className="pp-dept-score-top">
              <div className="pp-dept-score-title">
                <Building size={14} />
                <span>Department Rating</span>
              </div>
              <span className="pp-dept-rank-badge">
                <Trophy size={11} /> Rank #{departmentStats.rank}
              </span>
            </div>
            <div className="pp-dept-score-middle">
              <span className="pp-dept-score-num">
                {departmentStats.averageRating > 0 ? departmentStats.averageRating.toFixed(1) : '—'}
              </span>
              <span className="pp-dept-score-max">/ 5.0</span>
              <div className="pp-dept-score-stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    size={14} 
                    fill={s <= Math.round(departmentStats.averageRating) ? '#eab308' : 'none'} 
                    color="#eab308" 
                  />
                ))}
              </div>
            </div>
            <div className="pp-dept-score-footer">
              <span>{departmentStats.totalMembers} Members • {departmentStats.totalRatings} Ratings</span>
            </div>
          </div>
        )}

        {/* Header Right: Personal Rating Score for Staff/Admin OR Admin Badge for Super Admin */}
        {user.role === 'super_admin' ? (
          <div className="pp-admin-badge-box">
            <div className="pp-admin-badge-icon">
              <Shield size={22} />
            </div>
            <div className="pp-admin-badge-text">
              <span className="pp-admin-badge-title">System Administrator</span>
              <span className="pp-admin-badge-sub">Task Evaluator & Full Access</span>
            </div>
          </div>
        ) : (
          <div className="pp-score-banner">
            <span className="pp-score-label">Personal Rating</span>
            <div className="pp-score-value">
              <span className="pp-score-num">{performance.averageRating > 0 ? performance.averageRating.toFixed(1) : '—'}</span>
              <span className="pp-score-max">/ 5.0</span>
            </div>
            <div className="pp-score-stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star 
                  key={s} 
                  size={16} 
                  fill={s <= Math.round(performance.averageRating) ? '#eab308' : 'none'} 
                  color="#eab308" 
                />
              ))}
            </div>
            <span className="pp-score-count">
              {performance.totalRatings} {performance.totalRatings === 1 ? 'Rating' : 'Ratings'}
            </span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="pp-grid">
        
        {/* Left Column: Personal Details & Password Security */}
        <div className="pp-left-column">
          {/* Personal Information Form */}
          <div className="pp-card pp-personal-card">
            <div className="pp-card-header">
              <h2 className="pp-card-title">
                <User size={18} /> Personal Details
              </h2>
              <span className="pp-card-subtitle">Manage your account information</span>
            </div>

            {successMsg && (
              <div className="pp-alert pp-alert-success">
                <Check size={16} /> {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="pp-alert pp-alert-danger">
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="pp-form">
              <div className="pp-form-group">
                <label className="pp-label">Full Name</label>
                <div className="pp-input-wrapper">
                  <User size={16} className="pp-input-icon" />
                  <input 
                    type="text" 
                    className="pp-input" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pp-form-group">
                <label className="pp-label">University ID (Read-only)</label>
                <div className="pp-input-wrapper">
                  <Shield size={16} className="pp-input-icon" />
                  <input 
                    type="text" 
                    className="pp-input pp-input-disabled" 
                    value={user.universityId || ''} 
                    disabled 
                  />
                </div>
              </div>

              <div className="pp-form-group">
                <label className="pp-label">Email Address (Read-only)</label>
                <div className="pp-input-wrapper">
                  <Mail size={16} className="pp-input-icon" />
                  <input 
                    type="email" 
                    className="pp-input pp-input-disabled" 
                    value={user.email || ''} 
                    disabled 
                  />
                </div>
              </div>

              <div className="pp-form-group">
                <label className="pp-label">Phone Number</label>
                <div className="pp-input-wrapper">
                  <Phone size={16} className="pp-input-icon" />
                  <input 
                    type="tel" 
                    className="pp-input" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {user.role !== 'super_admin' && (
                <div className="pp-form-group">
                  <label className="pp-label">
                    Department / School
                    {!user.department && <span className="pp-required-tag"> (Select your department)</span>}
                  </label>
                  <div className="pp-input-wrapper">
                    <Building size={16} className="pp-input-icon" />
                    <select 
                      className="pp-input pp-select"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d.name}>
                          {d.name} {d.code ? `(${d.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="pp-field-hint">
                    Choose the department you are affiliated with.
                  </span>
                </div>
              )}

              <div className="pp-form-actions">
                <button 
                  type="submit" 
                  className="pp-btn-save" 
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Account Security & Change Password Card */}
          <div className="pp-card pp-security-card">
            <div className="pp-card-header">
              <h2 className="pp-card-title">
                <KeyRound size={18} /> Account Security & Password
              </h2>
              <span className="pp-card-subtitle">
                Change your password to keep your institutional account secure
              </span>
            </div>

            {pwSuccessMsg && (
              <div className="pp-alert pp-alert-success">
                <Check size={16} /> {pwSuccessMsg}
              </div>
            )}

            {pwErrorMsg && (
              <div className="pp-alert pp-alert-danger">
                <AlertTriangle size={16} /> {pwErrorMsg}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="pp-form">
              <div className="pp-form-group">
                <label className="pp-label">Current Password</label>
                <div className="pp-input-wrapper">
                  <Lock size={16} className="pp-input-icon" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="pp-input pp-input-has-toggle"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    className="pp-input-pw-toggle"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pp-form-group">
                <div className="pp-label-row">
                  <label className="pp-label">New Password</label>
                  {newPassword.length > 0 && (
                    <span className={`pp-pw-strength-tag ${getPasswordStrength(newPassword).label.toLowerCase().replace(' ', '-')}`}>
                      {getPasswordStrength(newPassword).label}
                    </span>
                  )}
                </div>
                <div className="pp-input-wrapper">
                  <KeyRound size={16} className="pp-input-icon" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="pp-input pp-input-has-toggle"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="pp-input-pw-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {newPassword.length > 0 && (
                  <div className="pp-pw-meter-bar">
                    <div 
                      className={`pp-pw-meter-segment ${getPasswordStrength(newPassword).score >= 1 ? 'active ' + getPasswordStrength(newPassword).label.toLowerCase().replace(' ', '-') : ''}`} 
                    />
                    <div 
                      className={`pp-pw-meter-segment ${getPasswordStrength(newPassword).score >= 2 ? 'active ' + getPasswordStrength(newPassword).label.toLowerCase().replace(' ', '-') : ''}`} 
                    />
                    <div 
                      className={`pp-pw-meter-segment ${getPasswordStrength(newPassword).score >= 3 ? 'active ' + getPasswordStrength(newPassword).label.toLowerCase().replace(' ', '-') : ''}`} 
                    />
                  </div>
                )}
                <span className="pp-field-hint">
                  Password must be at least 8 characters long. Letters & numbers recommended.
                </span>
              </div>

              <div className="pp-form-group">
                <div className="pp-label-row">
                  <label className="pp-label">Confirm New Password</label>
                  {confirmPassword.length > 0 && (
                    newPassword === confirmPassword ? (
                      <span className="pp-pw-match-badge ok">✓ Passwords match</span>
                    ) : (
                      <span className="pp-pw-match-badge err">Passwords do not match</span>
                    )
                  )}
                </div>
                <div className="pp-input-wrapper">
                  <ShieldCheck size={16} className="pp-input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="pp-input pp-input-has-toggle"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="pp-input-pw-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pp-form-actions">
                <button
                  type="submit"
                  className="pp-btn-change-password"
                  disabled={
                    pwLoading || 
                    !currentPassword || 
                    !newPassword || 
                    !confirmPassword || 
                    newPassword !== confirmPassword || 
                    newPassword.length < 8
                  }
                >
                  {pwLoading ? (
                    <>
                      <RefreshCw size={16} className="pp-spin" /> Updating Password...
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} /> Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Performance Analytics for Staff/Dept Admin OR System Administration for Super Admin */}
        {user.role === 'super_admin' ? (
          <div className="pp-performance-column">
            <div className="pp-card pp-admin-scope-card">
              <div className="pp-card-header">
                <h2 className="pp-card-title">
                  <Shield size={18} /> Administrator Responsibilities
                </h2>
                <span className="pp-card-subtitle">Overview of system privileges and evaluation duties</span>
              </div>

              <div className="pp-scope-list">
                <div className="pp-scope-item">
                  <div className="pp-scope-icon pp-icon-blue">
                    <Star size={18} />
                  </div>
                  <div>
                    <h4 className="pp-scope-title">Task Evaluation & Rating Authority</h4>
                    <p className="pp-scope-desc">You review submitted tasks and award 1–5 star ratings & feedback to Staff and Department Admins.</p>
                  </div>
                </div>

                <div className="pp-scope-item">
                  <div className="pp-scope-icon pp-icon-green">
                    <Building size={18} />
                  </div>
                  <div>
                    <h4 className="pp-scope-title">Institutional Department Management</h4>
                    <p className="pp-scope-desc">Create and oversee all academic departments, faculties, and schools across the university.</p>
                  </div>
                </div>

                <div className="pp-scope-item">
                  <div className="pp-scope-icon pp-icon-yellow">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="pp-scope-title">User Verification & Access Control</h4>
                    <p className="pp-scope-desc">Verify new user registrations, assign Department Admins, and manage staff allocations.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="pp-performance-column">
            
            {/* Key Metric Tiles */}
            <div className="pp-metrics-row">
              <div className="pp-metric-card">
                <div className="pp-metric-icon pp-icon-green">
                  <CheckCircle size={20} />
                </div>
                <div className="pp-metric-info">
                  <span className="pp-metric-val">{performance.totalCompleted}</span>
                  <span className="pp-metric-lbl">Tasks Completed</span>
                </div>
              </div>

              <div className="pp-metric-card">
                <div className="pp-metric-icon pp-icon-blue">
                  <Clock size={20} />
                </div>
                <div className="pp-metric-info">
                  <span className="pp-metric-val">{performance.onTimePercentage}%</span>
                  <span className="pp-metric-lbl">On-Time Completion</span>
                </div>
              </div>

              <div className="pp-metric-card">
                <div className="pp-metric-icon pp-icon-yellow">
                  <Award size={20} />
                </div>
                <div className="pp-metric-info">
                  <span className="pp-metric-val">{performance.totalRatings}</span>
                  <span className="pp-metric-lbl">Reviewed Tasks</span>
                </div>
              </div>
            </div>

            {/* Rating Breakdown Card */}
            <div className="pp-card">
              <div className="pp-card-header">
                <h2 className="pp-card-title">
                  <Star size={18} /> Performance Rating Breakdown
                </h2>
                <span className="pp-card-subtitle">Summary of task star ratings</span>
              </div>

              <div className="pp-breakdown-container">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = performance.ratingDistribution[stars] || 0;
                  const pct = performance.totalRatings > 0 ? (count / performance.totalRatings) * 100 : 0;
                  return (
                    <div key={stars} className="pp-breakdown-row">
                      <div className="pp-breakdown-label">
                        <span>{stars}</span>
                        <Star size={14} fill="#eab308" color="#eab308" />
                      </div>
                      <div className="pp-progress-track">
                        <div 
                          className="pp-progress-bar" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                      <span className="pp-breakdown-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Super Admin Reviews & Feedback History */}
            <div className="pp-card">
              <div className="pp-card-header">
                <h2 className="pp-card-title">
                  <Award size={18} /> Reviews & Feedback
                </h2>
                <span className="pp-card-subtitle">Ratings and comments awarded by Super Admin</span>
              </div>

              {performance.reviews.length === 0 ? (
                <div className="pp-empty-reviews">
                  <Star size={32} color="#cbd5e1" />
                  <p>No task ratings or feedback received yet.</p>
                  <span>Complete assigned tasks to earn star ratings and feedback.</span>
                </div>
              ) : (
                <div className="pp-reviews-list">
                  {performance.reviews.map((rev: any, index: number) => (
                    <div key={index} className="pp-review-card">
                      <div className="pp-review-header">
                        <div className="pp-review-task">
                          <span className="pp-review-taskid">#{rev.customTaskId || 'TASK'}</span>
                          <h4 className="pp-review-tasktitle">{rev.title}</h4>
                        </div>
                        <div className="pp-review-stars">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={14} 
                              fill={s <= rev.rating ? '#eab308' : 'none'} 
                              color="#eab308" 
                            />
                          ))}
                          <span className="pp-review-score">({rev.rating}/5)</span>
                        </div>
                      </div>

                      {rev.feedback ? (
                        <p className="pp-review-comment">"{rev.feedback}"</p>
                      ) : (
                        <p className="pp-review-comment pp-no-comment">No additional feedback provided.</p>
                      )}

                      <div className="pp-review-footer">
                        {rev.ratedBy && (
                          <span className="pp-reviewer-name">
                            Reviewed by <strong>{rev.ratedBy.name}</strong> ({rev.ratedBy.role === 'super_admin' ? 'Super Admin' : 'Admin'})
                          </span>
                        )}
                        {rev.ratedAt && (
                          <span className="pp-review-date">
                            <Calendar size={12} />
                            {new Date(rev.ratedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Department Leaderboard (strictly for Department Admin) */}
      {user.role === 'department_admin' && departmentStats && departmentStats.leaderboard && departmentStats.leaderboard.length > 0 && (
        <div className="pp-card pp-leaderboard-card">
          <div className="pp-card-header pp-lb-header">
            <div>
              <h2 className="pp-card-title">
                <Trophy size={18} color="#f59e0b" /> {departmentStats.department} — Staff Performance Leaderboard
              </h2>
              <span className="pp-card-subtitle">
                Department members ranked by average star ratings and performance (Admin on top)
              </span>
            </div>
            <div className="pp-lb-header-badge">
              <Building size={14} />
              <span>Rank #{departmentStats.rank} of {departmentStats.totalDepartments} Departments</span>
            </div>
          </div>

          <div className="pp-leaderboard-table-wrapper">
            <table className="pp-leaderboard-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>MEMBER</th>
                  <th>ROLE</th>
                  <th className="text-center">AVG RATING</th>
                  <th className="text-center">REVIEWS</th>
                  <th className="text-center">TASKS COMPLETED</th>
                  <th className="text-center">ON-TIME %</th>
                </tr>
              </thead>
              <tbody>
                {departmentStats.leaderboard.map((m: any) => {
                  const isCurUser = m._id === user._id || m.universityId === user.universityId;
                  const isAdmin = m.role === 'department_admin';
                  return (
                    <tr key={m._id} className={`pp-lb-row ${isAdmin ? 'pp-lb-admin-row' : ''} ${isCurUser ? 'pp-lb-current-user' : ''}`}>
                      <td className="pp-lb-rank-cell">
                        {isAdmin ? (
                          <span className="pp-rank-badge pp-rank-admin" title="Department Admin">
                            <Crown size={13} /> ADMIN
                          </span>
                        ) : (
                          <span className={`pp-rank-badge pp-rank-${m.rank <= 3 ? m.rank : 'default'}`}>
                            {m.rank === 1 ? '🥇 #1' : m.rank === 2 ? '🥈 #2' : m.rank === 3 ? '🥉 #3' : `#${m.rank}`}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="pp-lb-member-info">
                          <div className="pp-lb-avatar" style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=${isAdmin ? '1e3a8a' : '0f172a'}&color=fff)` }} />
                          <div>
                            <div className="pp-lb-name">
                              {m.name} {isCurUser && <span className="pp-lb-you-tag">(You)</span>}
                            </div>
                            <div className="pp-lb-sub">ID: {m.universityId || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`pp-lb-role-tag ${isAdmin ? 'admin' : 'staff'}`}>
                          {isAdmin ? 'Dept Admin' : 'Staff'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="pp-lb-rating-box">
                          <Star size={14} fill={m.averageRating > 0 ? '#eab308' : 'none'} color="#eab308" />
                          <span className="pp-lb-score">{m.averageRating > 0 ? m.averageRating.toFixed(1) : '—'}</span>
                          <span className="pp-lb-max">/ 5.0</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="pp-lb-stat-val">{m.totalRatings}</span>
                      </td>
                      <td className="text-center">
                        <span className="pp-lb-stat-val">{m.totalCompleted}</span>
                      </td>
                      <td className="text-center">
                        <span className="pp-lb-ontime-val">{m.onTimePercentage}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
