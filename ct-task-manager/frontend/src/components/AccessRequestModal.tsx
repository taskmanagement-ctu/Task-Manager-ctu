import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Loader2, Building2, User, Mail, Phone, IdCard, FileText } from 'lucide-react';
import { api, Department } from '../services/api';
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
        {/* Modal Header */}
        <div className="arm-header">
          <div className="arm-header-left">
            <div className="arm-icon-badge">
              <IdCard size={20} />
            </div>
            <div>
              <h3 className="arm-title">Request Portal Access</h3>
              <p className="arm-subtitle">Unlisted University ID Verification</p>
            </div>
          </div>
          <button className="arm-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        {isSuccess ? (
          <div className="arm-success-body">
            <div className="arm-success-icon-wrap">
              <CheckCircle2 size={52} className="arm-success-icon" />
            </div>
            <h4 className="arm-success-title">Access Request Submitted!</h4>
            <p className="arm-success-text">
              Your request for University ID <strong>{formData.universityId}</strong> has been forwarded to the IT Administrator and Department Coordinator.
            </p>
            <div className="arm-success-callout">
              <Mail size={16} />
              <span>
                As soon as your access is approved, an approval email will be sent to <strong>{submittedEmail}</strong>. You will then be able to register instantly!
              </span>
            </div>
            <div className="arm-success-actions">
              <button className="btn btn-primary arm-done-btn" onClick={onClose}>
                Back to Registration
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="arm-form">
            <div className="arm-notice">
              <AlertCircle size={16} className="arm-notice-icon" />
              <span>
                If your University ID is not found in our records, submit this form. An administrator will verify your credentials and approve your account.
              </span>
            </div>

            {error && (
              <div className="arm-error-alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="arm-form-grid">
              {/* University ID */}
              <div className="arm-form-group">
                <label htmlFor="arm-uid">University ID *</label>
                <div className="arm-input-wrap">
                  <IdCard size={16} className="arm-input-icon" />
                  <input
                    type="text"
                    id="arm-uid"
                    name="universityId"
                    value={formData.universityId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, universityId: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                    placeholder="3-5 digit ID (e.g. 10045 or 101)"
                    maxLength={5}
                    required
                  />
                </div>
              </div>

              {/* Full Name */}
              <div className="arm-form-group">
                <label htmlFor="arm-name">Full Name *</label>
                <div className="arm-input-wrap">
                  <User size={16} className="arm-input-icon" />
                  <input
                    type="text"
                    id="arm-name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Dr. Jane Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="arm-form-group">
                <label htmlFor="arm-email">Institutional Email *</label>
                <div className="arm-input-wrap">
                  <Mail size={16} className="arm-input-icon" />
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

              {/* Phone */}
              <div className="arm-form-group">
                <label htmlFor="arm-phone">Phone Number *</label>
                <div className="arm-input-wrap">
                  <Phone size={16} className="arm-input-icon" />
                  <input
                    type="tel"
                    id="arm-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="10-digit number"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              {/* Department */}
              <div className="arm-form-group">
                <label htmlFor="arm-dept">Department *</label>
                <div className="arm-input-wrap">
                  <Building2 size={16} className="arm-input-icon" />
                  <select
                    id="arm-dept"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    disabled={loadingDepts}
                    required
                  >
                    <option value="">Select your department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role / User Type: Only Teaching and Non-Teaching Staff */}
              <div className="arm-form-group">
                <label htmlFor="arm-usertype">User Type *</label>
                <div className="arm-input-wrap">
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

            {/* Reason / Remarks */}
            <div className="arm-form-group full-width" style={{ marginTop: '0.85rem' }}>
              <label htmlFor="arm-reason">
                Remarks / Designation <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <div className="arm-input-wrap textarea-wrap">
                <FileText size={16} className="arm-input-icon textarea-icon" />
                <textarea
                  id="arm-reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="e.g. Assistant Professor in CSE Dept / Lab Assistant"
                  rows={2}
                  maxLength={300}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="arm-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary arm-submit-btn" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="arm-spin" /> Submitting Request...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit Access Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AccessRequestModal;
