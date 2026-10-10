import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, Department } from '../services/api';
import { Eye, EyeOff, Info, Mail, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import PortalBrandLogo from '../components/PortalBrandLogo';
import AccessRequestModal from '../components/AccessRequestModal';
import './RegisterPage.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { systemName } = useSettings();

  const [formData, setFormData] = useState({
    universityId: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; role: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showAccessModal, setShowAccessModal] = useState(false);

  // OTP State
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpFeedback, setOtpFeedback] = useState<{ type: 'error' | 'success'; message: string; canRequestAccess?: boolean } | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.getDepartments();
        if (res.success) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.error('Failed to load departments');
      }
    };
    fetchDepartments();
  }, []);

  // OTP countdown timer
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, email: val }));
    // If email changes after OTP is sent/verified, reset OTP status
    if (otpSent || otpVerified) {
      setOtpSent(false);
      setOtpVerified(false);
      setOtp('');
      setOtpFeedback(null);
    }
  };

  const handleResetEmailVerification = () => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtp('');
    setOtpFeedback(null);
  };

  const handleSendOTP = async () => {
    setError(null);
    setOtpFeedback(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      setOtpFeedback({ type: 'error', message: 'Please enter a valid institutional email address.' });
      return;
    }

    if (!formData.universityId || !/^\d{3,5}$/.test(formData.universityId.trim())) {
      setOtpFeedback({ type: 'error', message: 'Please enter a valid 3-5 digit University ID before requesting a code.' });
      return;
    }

    try {
      setOtpSending(true);
      const res = await api.sendOTP({
        email: formData.email.trim(),
        purpose: 'registration',
        universityId: formData.universityId.trim(),
        name: formData.name.trim(),
      });

      if (res.success) {
        setOtpSent(true);
        setOtpCountdown(60);
        setOtpFeedback({
          type: 'success',
          message: res.message || `Verification code sent to ${formData.email}. Please check your inbox.`,
        });
      }
    } catch (err: any) {
      const isNotVerified =
        err?.code === 'NOT_VERIFIED' ||
        err?.canRequestAccess ||
        (err?.message && String(err.message).toLowerCase().includes('not found in university records')) ||
        (err?.message && String(err.message).toLowerCase().includes('could not be found in university records')) ||
        (err?.message && String(err.message).toLowerCase().includes('not verified in university records'));

      setOtpFeedback({
        type: 'error',
        message: isNotVerified
          ? 'Your University ID was not found in university records.'
          : (err.message || 'Failed to send verification code. Please check your details.'),
        canRequestAccess: Boolean(isNotVerified),
      });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.trim().length !== 6) {
      setOtpFeedback({ type: 'error', message: 'Please enter the complete 6-digit verification code.' });
      return;
    }

    try {
      setOtpVerifying(true);
      setOtpFeedback(null);
      const res = await api.verifyOTP({
        email: formData.email.trim(),
        otp: otp.trim(),
        purpose: 'registration',
      });

      if (res.success) {
        setOtpVerified(true);
        setOtpFeedback({
          type: 'success',
          message: 'Email verified successfully! You can now proceed to complete registration.',
        });
      }
    } catch (err: any) {
      setOtpFeedback({
        type: 'error',
        message: err.message || 'Invalid or expired code.',
      });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic frontend validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!/^\d{3,5}$/.test(formData.universityId.trim())) {
      setError('University ID must contain between 3 and 5 digits.');
      return;
    }

    if (formData.phone.length !== 10 || !/^\d+$/.test(formData.phone)) {
      setError('Phone number must contain exactly 10 digits.');
      return;
    }

    if (!otpSent) {
      setError('Please click "Send Code" to verify your email address before registering.');
      return;
    }

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    try {
      setLoading(true);
      
      const payload: any = {
        ...formData,
        email: formData.email.trim(),
        otp: otp.trim(),
      };
      if (!payload.department.trim()) {
        payload.department = '';
      }

      const response = await api.register(payload);
      
      if (response.success) {
        let displayRole = 'Staff';
        if (response.data?.user?.role === 'super_admin') {
          displayRole = 'Super Admin';
        } else if (response.data?.user?.role === 'department_admin') {
          displayRole = 'Department Admin';
        }

        setSuccess({
          message: 'Registration successful.',
          role: `Your account has been created as ${displayRole}.`,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-container">
      <div className="register-card">
        
        {/* Left Panel (Desktop only) */}
        <div className="register-left-panel">
          <div className="register-left-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PortalBrandLogo />
            <div className="register-university-title">{systemName}</div>
          </div>
          <div className="register-left-body">
            <h2>Secure Portal Registration</h2>
            <p>Join the administrative network. Access institutional resources, manage departmental tasks, and collaborate across the university ecosystem.</p>
          </div>
          <div className="register-left-footer">
            <div className="register-left-footer-title">
              <Info size={16} /> Authorization Required
            </div>
            <p>Registration requires an active University ID present in university records. Only your University ID needs to match.</p>
          </div>
        </div>

        {/* Right Panel (Form) */}
        <div className="register-right-panel">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="register-mobile-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <PortalBrandLogo />
            </div>
            <h1>Create an Account</h1>
            <p>Register to access {systemName}'s centralized task management system.</p>
          </div>
          
          {/* Mobile Info Box (Hidden on Desktop) */}
          <div className="register-info-box-mobile">
            <Info size={18} />
            <p>Your University ID must match university records to successfully create an account.</p>
          </div>

          {error && <div className="register-error-alert">{error}</div>}
          
          {success ? (
            <div className="register-success-alert">
              <h3>{success.message}</h3>
              <p>{success.role}</p>
              <button className="register-btn" onClick={() => navigate('/login')} style={{ marginTop: '1.5rem' }}>
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              
              <div className="register-form-group">
                <div className="register-label-between">
                  <label htmlFor="universityId">University ID *</label>
                  <button
                    type="button"
                    className="register-helper-link"
                    onClick={() => setShowAccessModal(true)}
                  >
                    Unlisted ID? Request Access
                  </button>
                </div>
                <div className="register-input-wrapper">
                  <input
                    type="text"
                    id="universityId"
                    name="universityId"
                    value={formData.universityId}
                    onChange={handleChange}
                    placeholder="e.g. 12345 (3-5 digits)"
                    maxLength={5}
                    required
                  />
                </div>
              </div>

              <div className="register-row">
                <div className="register-form-group">
                  <label htmlFor="name">Full Name *</label>
                  <div className="register-input-wrapper">
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Jane Doe"
                      required
                    />
                  </div>
                </div>

                <div className="register-form-group">
                  <label htmlFor="phone">Phone Number *</label>
                  <div className="register-input-wrapper">
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email with Send OTP Button */}
              <div className="register-form-group">
                <div className="register-label-between">
                  <label htmlFor="email">Institutional Email *</label>
                  {otpVerified && (
                    <span className="otp-verified-badge">
                      <CheckCircle2 size={14} /> Verified
                    </span>
                  )}
                </div>
                <div className="register-email-input-group">
                  <div className="register-input-wrapper with-icon" style={{ flex: 1 }}>
                    <Mail size={18} className="input-icon-left" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleEmailChange}
                      placeholder="Enter email for OTP"
                      required
                      readOnly={otpVerified}
                      style={otpVerified ? { backgroundColor: '#f8fafc', color: '#334155' } : {}}
                    />
                  </div>
                  {otpVerified ? (
                    <button
                      type="button"
                      className="otp-change-email-btn"
                      onClick={handleResetEmailVerification}
                      title="Change email and verify again"
                    >
                      Change
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="otp-action-btn"
                      onClick={handleSendOTP}
                      disabled={otpSending || otpCountdown > 0 || !formData.email || !formData.universityId}
                    >
                      {otpSending ? (
                        <>
                          <RefreshCw size={14} className="spin-icon" /> Sending...
                        </>
                      ) : otpCountdown > 0 ? (
                        `Resend (${otpCountdown}s)`
                      ) : otpSent ? (
                        'Resend Code'
                      ) : (
                        'Send Code'
                      )}
                    </button>
                  )}
                </div>

                {otpFeedback && (
                  <div className={`otp-inline-feedback ${otpFeedback.type} ${otpFeedback.canRequestAccess ? 'with-action' : ''}`}>
                    <div className="otp-feedback-msg-wrap">
                      <span>{otpFeedback.message}</span>
                    </div>
                    {otpFeedback.canRequestAccess && (
                      <div className="otp-feedback-action-row">
                        <button
                          type="button"
                          className="btn-trigger-access-request"
                          onClick={() => setShowAccessModal(true)}
                        >
                          📝 Submit Access Request Form
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* OTP Input Section (Visible when code is sent and not yet verified) */}
              {otpSent && !otpVerified && (
                <div className="register-otp-box">
                  <div className="register-otp-box-header">
                    <div>
                      <strong>Enter Verification Code</strong>
                      <div className="otp-subtext">Check your inbox ({formData.email}) for the 6-digit code</div>
                    </div>
                  </div>
                  <div className="register-otp-input-row">
                    <input
                      type="text"
                      id="otp"
                      name="otp"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      maxLength={6}
                      className="otp-code-input"
                      autoComplete="one-time-code"
                    />
                    <button
                      type="button"
                      className="otp-verify-btn"
                      onClick={handleVerifyOTP}
                      disabled={otpVerifying || otp.trim().length !== 6}
                    >
                      {otpVerifying ? 'Verifying...' : 'Verify Code'}
                    </button>
                  </div>
                </div>
              )}

              <div className="register-form-group">
                <label htmlFor="department">Department (Optional)</label>
                <div className="register-input-wrapper">
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="form-control"
                    style={{ width: '100%', padding: '0.875rem 1rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none' }}
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="register-row">
                <div className="register-form-group">
                  <label htmlFor="password">Password *</label>
                  <div className="register-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
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

                <div className="register-form-group">
                  <label htmlFor="confirmPassword">Confirm Password *</label>
                  <div className="register-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-type password"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="register-btn" disabled={loading}>
                {loading ? 'Creating Account...' : 'REGISTER ACCOUNT'}
              </button>
            </form>
          )}

          {!success && (
            <div className="register-login-link">
              Already have an account? <Link to="/login">Login</Link>
            </div>
          )}
          
        </div>
      </div>

      <AccessRequestModal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        initialData={{
          universityId: formData.universityId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
        }}
      />
    </div>
  );
};

export default RegisterPage;
