import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Info, AlertCircle, RefreshCw, Mail } from 'lucide-react';
import { api, Department } from '../services/api';
import PortalBrandLogo from './PortalBrandLogo';
import { useSettings } from '../context/SettingsContext';
import './AccessRequestModal.css';

interface AccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    universityId?: string;
    name?: string;
    email?: string;
    phone?: string;
    department?: string;
  };
  onSuccess?: () => void;
}

const AccessRequestModal: React.FC<AccessRequestModalProps> = ({
  isOpen,
  onClose,
  initialData = {},
  onSuccess,
}) => {
  const { systemName } = useSettings();
  const [formData, setFormData] = useState({
    universityId: initialData.universityId || '',
    name: initialData.name || '',
    email: initialData.email || '',
    phone: initialData.phone || '',
    department: initialData.department || '',
    userType: 'teaching' as 'teaching' | 'non_teaching',
    reason: '',
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Sync initialData when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        universityId: initialData.universityId || '',
        name: initialData.name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        department: initialData.department || '',
        userType: 'teaching',
        reason: '',
      });
      setError(null);
      setIsSuccess(false);

      // Load departments
      setLoadingDepts(true);
      api.getDepartments()
        .then((res) => {
          if (res.success && res.data?.departments) {
            setDepartments(res.data.departments);
          }
        })
        .catch(() => {
          // Non-blocking
        })
        .finally(() => setLoadingDepts(false));
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const uid = formData.universityId.trim();
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim().replace(/\D/g, '');

    if (!uid || !name || !email || !phone) {
      setError('Please fill in all required fields (University ID, Name, Email, and Phone).');
      return;
    }

    if (!/^\d{3,5}$/.test(uid)) {
      setError('University ID must contain between 3 and 5 digits.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid institutional email address.');
      return;
    }

    if (phone.length !== 10) {
      setError('Phone number must contain exactly 10 digits.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.submitAccessRequest({
        universityId: uid,
        name,
        email,
        phone,
        department: formData.department.trim() || null,
        userType: formData.userType,
        reason: formData.reason.trim() || undefined,
      });

      if (res.success) {
        setSubmittedEmail(email);
        setIsSuccess(true);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit access request. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="arm-overlay" onClick={onClose}>
      <div className="arm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top-Right Close Button */}
        <button className="arm-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        <div className="arm-content-scroll">
          {/* Header matching Register Page style */}
          <div className="arm-header-section">
            <div className="arm-logo-wrap">
              <PortalBrandLogo overrideSize="large" overrideShape="circle" />
            </div>
            <h1 className="arm-title">Request Portal Access</h1>
            <p className="arm-subtitle">
              Submit your credentials to request unlisted University ID verification in {systemName}.
            </p>
          </div>

          {/* Info Box matching .register-info-box-mobile */}
          <div className="arm-info-box">
            <Info size={18} />
            <p>
              Your University ID must match university records. If your ID is not found, submit this form. An administrator will verify your credentials and approve your account.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="arm-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="arm-success-alert">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <CheckCircle2 size={48} color="#16a34a" />
              </div>
              <h3>Access Request Submitted!</h3>
              <p>
                Your request for University ID <strong>{formData.universityId}</strong> has been forwarded to the IT Administrator and Department Coordinator.
                <br /><br />
                As soon as your access is approved, an email notification will be sent to <strong>{submittedEmail}</strong>. You will then be able to register instantly!
              </p>
              <button
                type="button"
                className="arm-btn-primary"
                onClick={onClose}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                Back to Registration
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* UNIVERSITY ID */}
              <div className="arm-form-group">
                <label htmlFor="arm-uid">University ID *</label>
                <div className="arm-input-wrapper">
                  <input
                    type="text"
                    id="arm-uid"
                    name="universityId"
                    value={formData.universityId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, universityId: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                    placeholder="e.g. 10001 (3-5 digits)"
                    maxLength={5}
                    required
                    style={formData.universityId ? { backgroundColor: '#edf5ff' } : {}}
                  />
                </div>
              </div>

              {/* FULL NAME & PHONE NUMBER in a row */}
              <div className="arm-row">
                <div className="arm-form-group">
                  <label htmlFor="arm-name">Full Name *</label>
                  <div className="arm-input-wrapper">
                    <input
                      type="text"
                      id="arm-name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Jane Doe"
                      required
                    />
                  </div>
                </div>

                <div className="arm-form-group">
                  <label htmlFor="arm-phone">Phone Number *</label>
                  <div className="arm-input-wrapper">
                    <input
                      type="tel"
                      id="arm-phone"
                      name="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* INSTITUTIONAL EMAIL (with left mail icon matching RegisterPage) */}
              <div className="arm-form-group">
                <label htmlFor="arm-email">Institutional Email *</label>
                <div className="arm-input-wrapper with-icon">
                  <Mail size={18} className="input-icon-left" />
                  <input
                    type="email"
                    id="arm-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. jane.doe@ctuniversity.in"
                    required
                  />
                </div>
              </div>

              {/* DEPARTMENT & USER TYPE in a row */}
              <div className="arm-row">
                <div className="arm-form-group">
                  <label htmlFor="arm-dept">Department (Optional)</label>
                  <div className="arm-input-wrapper">
                    <select
                      id="arm-dept"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      disabled={loadingDepts}
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="arm-form-group">
                  <label htmlFor="arm-usertype">User Type *</label>
                  <div className="arm-input-wrapper">
                    <select
                      id="arm-usertype"
                      name="userType"
                      value={formData.userType}
                      onChange={handleChange}
                      required
                    >
                      <option value="teaching">Teaching Staff</option>
                      <option value="non_teaching">Non-Teaching Staff</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* REMARKS / DESIGNATION */}
              <div className="arm-form-group">
                <label htmlFor="arm-reason">
                  Remarks / Designation (Optional)
                </label>
                <div className="arm-input-wrapper">
                  <input
                    type="text"
                    id="arm-reason"
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    placeholder="e.g. Assistant Professor in CSE Dept"
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Actions Button Row matching Register page button style */}
              <div className="arm-btn-row">
                <button
                  type="button"
                  className="arm-cancel-btn"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="arm-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="spin-icon" /> Submitting...
                    </>
                  ) : (
                    'Submit Access Request'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessRequestModal;
