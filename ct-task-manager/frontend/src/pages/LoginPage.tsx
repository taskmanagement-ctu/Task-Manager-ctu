import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { IdCard, Lock, Eye, EyeOff, ShieldCheck, Mail, KeyRound, X, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import PortalBrandLogo from '../components/PortalBrandLogo';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { systemName } = useSettings();

  const [formData, setFormData] = useState({
    universityId: '',
    password: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotResolvedEmail, setForgotResolvedEmail] = useState('');
  const [forgotDisplayEmail, setForgotDisplayEmail] = useState('');
  const [forgotResolvedUniversityId, setForgotResolvedUniversityId] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotCountdown, setForgotCountdown] = useState(0);

  const from = location.state?.from?.pathname || '/';

  // Countdown timer for Forgot Password OTP
  useEffect(() => {
    let timer: any;
    if (forgotCountdown > 0) {
      timer = setInterval(() => {
        setForgotCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [forgotCountdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.universityId || !formData.password) {
      setError('Please enter University ID and password.');
      return;
    }

    try {
      setLoading(true);
      await login(formData);
      navigate(from === '/' ? '/staff' : from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid University ID or password.');
    } finally {
      setLoading(false);
    }
  };

  const openForgotModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowForgotModal(true);
    setForgotStep(1);
    // If universityId was already typed on login form, prefill it!
    setForgotIdentifier(formData.universityId.trim() || '');
    setForgotResolvedEmail('');
    setForgotDisplayEmail('');
    setForgotResolvedUniversityId('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError(null);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotIdentifier('');
    setForgotResolvedEmail('');
    setForgotDisplayEmail('');
    setForgotResolvedUniversityId('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError(null);
  };

  const handleReturnToSignInAfterReset = () => {
    if (forgotResolvedUniversityId) {
      setFormData((prev) => ({
        ...prev,
        universityId: forgotResolvedUniversityId,
        password: '',
      }));
    }
    closeForgotModal();
    // Focus password input after modal closes
    setTimeout(() => {
      const pwInput = document.getElementById('password');
      if (pwInput) pwInput.focus();
    }, 100);
  };

  const handleSendResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const trimmed = forgotIdentifier.trim();
    if (!trimmed) {
      setForgotError('Please enter your University ID (3-5 digits) or registered email.');
      return;
    }

    const isUniversityId = /^\d{3,5}$/.test(trimmed);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(trimmed);

    if (!isUniversityId && !isEmail) {
      setForgotError('Please enter a valid University ID (3-5 digits) or registered email address.');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await api.sendOTP({
        identifier: trimmed,
        email: isEmail ? trimmed : undefined,
        purpose: 'forgot_password',
      });

      if (res.success) {
        setForgotResolvedEmail(res.email || trimmed);
        setForgotDisplayEmail(res.maskedEmail || res.email || trimmed);
        if (res.universityId) {
          setForgotResolvedUniversityId(res.universityId);
        } else if (isUniversityId) {
          setForgotResolvedUniversityId(trimmed);
        }
        setForgotStep(2);
        setForgotCountdown(60);
      }
    } catch (err: any) {
      setForgotError(err.message || 'No registered account found. Please check your University ID or email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendResetOTP = async () => {
    if (forgotCountdown > 0 || forgotLoading) return;
    setForgotError(null);

    const target = forgotResolvedEmail || forgotIdentifier.trim();

    try {
      setForgotLoading(true);
      const res = await api.sendOTP({
        identifier: target,
        email: target.includes('@') ? target : undefined,
        purpose: 'forgot_password',
      });

      if (res.success) {
        setForgotCountdown(60);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Failed to resend code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    try {
      setForgotLoading(true);
      const target = forgotResolvedEmail || forgotIdentifier.trim();
      const res = await api.resetPassword({
        email: target,
        identifier: target,
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword,
        confirmNewPassword: forgotConfirmPassword,
      });

      if (res.success) {
        if (res.universityId) {
          setForgotResolvedUniversityId(res.universityId);
        }
        setForgotStep(3);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password. Please check your verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        
        {/* Left Panel (Desktop only) */}
        <div className="login-left-panel">
          <div className="login-left-header">
            <PortalBrandLogo />
            <div className="login-university-title">
              <span className="uni-name">{systemName}</span>
              <span className="portal-label">Portal Access</span>
            </div>
          </div>
          <div className="login-left-body">
            <h2>Internal System Access</h2>
            <p>Welcome to the centralized portal for faculty, administration, and verified staff.</p>
          </div>
          <div className="login-left-footer">
            <ShieldCheck size={16} className="login-shield-icon" />
            <span>Secure access is restricted to individuals with an active University ID. Registration requests are matched against verified institutional records.</span>
          </div>
        </div>

        {/* Right Panel (Form) */}
        <div className="login-right-panel">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="login-mobile-header">
            <div className="login-mobile-logo-wrap" style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <PortalBrandLogo />
            </div>
            <h1>{systemName}</h1>
            <p>Faculty & Administration Portal</p>
          </div>

          <h1>Sign In</h1>
          <p className="subtitle">Enter your credentials to access your dashboard.</p>

          {error && <div className="login-error-alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <div className="login-label-row">
                <label htmlFor="universityId">University ID (3-5 Digits)</label>
              </div>
              <div className="login-input-wrapper">
                <IdCard size={18} className="input-icon-left" />
                <input
                  type="text"
                  id="universityId"
                  name="universityId"
                  value={formData.universityId}
                  onChange={handleChange}
                  placeholder="e.g. 12345"
                  maxLength={5}
                  required
                />
              </div>
            </div>

            <div className="login-form-group">
              <div className="login-label-row">
                <label htmlFor="password">Password</label>
                <a href="#forgot" className="login-forgot-link" onClick={openForgotModal}>
                  Forgot Password?
                </a>
              </div>
              <div className="login-input-wrapper">
                <Lock size={18} className="input-icon-left" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  required
                />
                <button 
                  type="button" 
                  className="input-icon-right" 
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="login-register-link">
            Don't have an account? <Link to="/register">Register</Link>
          </div>
          
          {/* Mobile Footer (Hidden on Desktop) */}
          <div className="login-mobile-footer">
            <ShieldCheck size={14} />
            <span>Secure Institutional Connection</span>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="login-modal-overlay" onClick={closeForgotModal}>
          <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="login-modal-close-btn" onClick={closeForgotModal} aria-label="Close modal">
              <X size={20} />
            </button>

            {/* Step 1: Request OTP */}
            {forgotStep === 1 && (
              <form onSubmit={handleSendResetOTP} className="forgot-modal-form">
                <div className="forgot-modal-header">
                  <div className="forgot-icon-wrap">
                    <KeyRound size={26} />
                  </div>
                  <h2>Reset Password</h2>
                  <p>Enter your University ID (3-5 digits) or registered institutional email to receive a 6-digit verification code.</p>
                </div>

                {forgotError && <div className="login-error-alert">{forgotError}</div>}

                <div className="login-form-group" style={{ textAlign: 'left' }}>
                  <label htmlFor="forgotIdentifier">University ID (3-5 Digits) or Registered Email</label>
                  <div className="login-input-wrapper">
                    {/^\d+$/.test(forgotIdentifier) ? (
                      <IdCard size={18} className="input-icon-left" />
                    ) : (
                      <Mail size={18} className="input-icon-left" />
                    )}
                    <input
                      type="text"
                      id="forgotIdentifier"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. 10001 or name@ctuniversity.in"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className="login-btn" disabled={forgotLoading || !forgotIdentifier.trim()}>
                  {forgotLoading ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" /> Sending Code...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Enter OTP & New Password */}
            {forgotStep === 2 && (
              <form onSubmit={handleResetPassword} className="forgot-modal-form">
                <div className="forgot-modal-header">
                  <div className="forgot-icon-wrap">
                    <Lock size={26} />
                  </div>
                  <h2>Enter Reset Code</h2>
                  <p>
                    A 6-digit code has been sent to <strong>{forgotDisplayEmail || forgotIdentifier}</strong>.{' '}
                    <button
                      type="button"
                      className="forgot-change-email-btn"
                      onClick={() => {
                        setForgotStep(1);
                        setForgotError(null);
                      }}
                    >
                      Change ID / email
                    </button>
                  </p>
                </div>

                {forgotError && <div className="login-error-alert">{forgotError}</div>}

                <div className="login-form-group" style={{ textAlign: 'left' }}>
                  <div className="login-label-row">
                    <label htmlFor="forgotOtp">6-Digit Code</label>
                    <button
                      type="button"
                      className="forgot-resend-link"
                      onClick={handleResendResetOTP}
                      disabled={forgotCountdown > 0 || forgotLoading}
                    >
                      {forgotCountdown > 0 ? `Resend in ${forgotCountdown}s` : 'Resend Code'}
                    </button>
                  </div>
                  <input
                    type="text"
                    id="forgotOtp"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    maxLength={6}
                    className="forgot-otp-input"
                    autoFocus
                    required
                  />
                </div>

                <div className="login-form-group" style={{ textAlign: 'left' }}>
                  <div className="login-label-row">
                    <label htmlFor="forgotNewPassword">New Password (Min. 8 chars)</label>
                    {forgotNewPassword.length > 0 && forgotNewPassword.length < 8 && (
                      <span style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500 }}>Min. 8 characters</span>
                    )}
                  </div>
                  <div className="login-input-wrapper">
                    <Lock size={18} className="input-icon-left" />
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      id="forgotNewPassword"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      minLength={8}
                    />
                    <button 
                      type="button" 
                      className="input-icon-right" 
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      aria-label={showForgotNewPassword ? "Hide password" : "Show password"}
                    >
                      {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="login-form-group" style={{ textAlign: 'left' }}>
                  <div className="login-label-row">
                    <label htmlFor="forgotConfirmPassword">Confirm New Password</label>
                    {forgotConfirmPassword.length > 0 && (
                      forgotNewPassword === forgotConfirmPassword ? (
                        <span style={{ color: '#16a34a', fontSize: '0.75rem', fontWeight: 600 }}>✓ Passwords match</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>Passwords do not match</span>
                      )
                    )}
                  </div>
                  <div className="login-input-wrapper">
                    <Lock size={18} className="input-icon-left" />
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      id="forgotConfirmPassword"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      required
                      minLength={8}
                    />
                    <button 
                      type="button" 
                      className="input-icon-right" 
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      aria-label={showForgotConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showForgotConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="login-btn" 
                  disabled={
                    forgotLoading || 
                    forgotOtp.length !== 6 || 
                    forgotNewPassword.length < 8 || 
                    forgotNewPassword !== forgotConfirmPassword
                  }
                >
                  {forgotLoading ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" /> Resetting Password...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </button>
              </form>
            )}

            {/* Step 3: Success State */}
            {forgotStep === 3 && (
              <div className="forgot-modal-success">
                <div className="forgot-success-icon-wrap">
                  <CheckCircle2 size={42} />
                </div>
                <h2>Password Reset Successful!</h2>
                <p>Your password has been securely updated. You can now log in with your new credentials.</p>
                <button type="button" className="login-btn" onClick={handleReturnToSignInAfterReset} style={{ marginTop: '1.5rem' }}>
                  Return to Sign In
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default LoginPage;
